import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LOCALITES, PRODUITS, TARIF_KG_KM, distanceKm } from '../core/data/referentiel';
import { DisponibiliteCamion, Fret, SignalementAxe } from '../core/models';
import { PlateformeService, aujourdhui } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { UI } from '../shared/ui';

const STATUT_FRET: Record<Fret['statut'], string> = { ouvert: 'Ouvert', attribue: 'Attribué', en_route: 'En route', livre: 'Livré' };

@Component({
  selector: 'app-transport',
  imports: [FormsModule, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Transport</div><h1>Bourse de fret & état des axes</h1>
        <p>Trouvez un camion (ou un tricycle pour la collecte), remplissez vos retours à vide, et partagez l’état des routes.</p></div>
      <div class="toolbar">
        <button class="primary" (click)="modal.set('fret')">＋ Publier un fret</button>
        <button (click)="modal.set('axe')">⚠ Signaler un axe</button>
      </div>
    </div>

    <div class="tabs">
      <button [class.on]="onglet() === 'bourse'" (click)="onglet.set('bourse')">Frets ouverts ({{ ouverts().length }})</button>
      <button [class.on]="onglet() === 'miens'" (click)="onglet.set('miens')">Mes frets ({{ miens().length }})</button>
      <button [class.on]="onglet() === 'camions'" (click)="onglet.set('camions')">Camions disponibles ({{ camions().length }})</button>
      <button [class.on]="onglet() === 'axes'" (click)="onglet.set('axes')">État des axes ({{ axes().length }})</button>
    </div>

    @if (onglet() === 'camions') {
      <p class="small muted">Transporteurs qui ont annoncé un camion libre (souvent un retour à vide, donc moins cher). Réservez directement.</p>
      <div class="grid g2">
        @for (d of camions(); track d.id) {
          <div class="card">
            <h3>{{ d.origineId | loc }} → {{ d.destinationId ? (d.destinationId | loc) : 'toutes destinations' }}</h3>
            <p class="small">{{ d.transporteurId | qui }} · {{ d.capaciteT | nb: 1 }} t · le {{ d.date }} · <strong>{{ d.tarifTonneKm }} F / t / km</strong><br /><span class="muted">{{ d.commentaire }}</span></p>
            @if (!estTransporteur()) {
              @if (resa()?.id === d.id) {
                <div class="form-grid">
                  <label class="field">Produit<select [(ngModel)]="nr.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
                  <label class="field">Tonnage<input type="number" min="0.1" [max]="d.capaciteT" step="0.1" [(ngModel)]="nr.tonnage" /></label>
                  @if (!d.destinationId) { <label class="field">Destination<select [(ngModel)]="nr.destinationId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label> }
                </div>
                <p class="small">Prix : {{ prixResa(d) | fcfa }} ({{ kmResa(d) }} km)</p>
                <div class="actions"><button (click)="resa.set(null)">Annuler</button><button class="primary" [disabled]="!nr.tonnage || nr.tonnage > d.capaciteT" (click)="reserver(d)">Confirmer la réservation</button></div>
              } @else { <button class="primary" (click)="ouvrirResa(d)">Réserver ce camion</button> }
            }
          </div>
        } @empty { <div class="vide card">Aucun camion annoncé pour le moment.</div> }
      </div>
    } @else if (onglet() === 'axes') {
      <div class="note" style="margin-bottom:12px">Informations signalées par les usagers, non vérifiées par la plateforme. En cas de doute sur la sécurité d’un axe, se conformer aux consignes des autorités.</div>
      <div class="grid g2">
        @for (a of axes(); track a.id) {
          <div class="card">
            <h3>{{ a.origineId | loc }} ↔ {{ a.destinationId | loc }}
              <span class="badge" [class.ko]="a.niveau === 'deconseille'" [class.warn]="a.niveau === 'prudence'" [class.info]="a.niveau === 'info'">{{ a.motif }}</span></h3>
            <p class="small">{{ a.commentaire }}</p>
            <div class="toolbar small"><span class="muted">{{ a.date }} · signalé par {{ a.auteurId | qui }} · {{ a.confirmations }} confirmation(s)</span>
              <button class="ghost" (click)="confirmerAxe(a.id)">👍 Je confirme</button></div>
          </div>
        }
      </div>
    } @else {
      @if (estTransporteur()) { <p class="small muted">Capacité de votre véhicule : <strong>{{ capacite() }} t</strong> — les frets plus lourds sont grisés.</p> }
      <div class="table-wrap">
        <table>
          <thead><tr><th>Trajet</th><th>Chargement</th><th>Date</th><th class="num">Prix proposé</th><th class="num">F / t·km</th><th>Statut</th><th>Axe</th><th>Action</th></tr></thead>
          <tbody>
            @for (l of (onglet() === 'bourse' ? ouverts() : miens()); track l.f.id) {
              <tr [class.gris]="estTransporteur() && l.f.tonnage > capacite()">
                <td><strong>{{ l.f.origineId | loc }} → {{ l.f.destinationId | loc }}</strong><div class="small muted">{{ l.km }} km · {{ l.f.demandeurId | qui }}</div></td>
                <td>{{ l.f.produitId | prod }}<div class="small muted">{{ l.f.tonnage }} t</div></td>
                <td class="small">{{ l.f.dateChargement }}</td>
                <td class="num">{{ l.f.prixPropose | nb }}</td>
                <td class="num small">{{ l.tkm | nb: 0 }}</td>
                <td><span class="badge" [class.warn]="l.f.statut === 'ouvert'" [class.info]="l.f.statut === 'attribue' || l.f.statut === 'en_route'" [class.ok]="l.f.statut === 'livre'">{{ statut[l.f.statut] }}</span>
                  @if (l.f.transporteurId) { <div class="small muted">{{ l.f.transporteurId | qui }}</div> }</td>
                <td>@if (l.alerte; as a) { <span class="badge" [class.ko]="a.niveau === 'deconseille'" [class.warn]="a.niveau === 'prudence'" [title]="a.commentaire">{{ a.motif }}</span> }</td>
                <td>
                  @if (l.f.demandeurId === moi() && l.f.statut === 'ouvert') {
                    @for (c of l.f.candidatures; track c.transporteurId) {
                      <div class="cand small"><span>{{ c.transporteurId | qui }} : <strong>{{ c.prix | nb }} F</strong></span><button class="primary" (click)="attribuer(l.f, c.transporteurId)">Retenir</button></div>
                    } @empty { <span class="small muted">En attente de candidatures</span> }
                  } @else if (estTransporteur() && l.f.statut === 'ouvert' && l.f.tonnage <= capacite()) {
                    @if (aCandidate(l.f)) { <span class="badge info">Candidature envoyée</span> }
                    @else { <button class="primary" (click)="ouvrirCandidature(l.f)">Proposer mon prix</button> }
                  } @else if (l.f.transporteurId === moi() && l.f.statut !== 'livre') {
                    <button class="primary" (click)="avancer(l.f)">{{ l.f.statut === 'attribue' ? 'Chargé — départ' : 'Livré à destination' }}</button>
                  }
                </td>
              </tr>
            } @empty { <tr><td colspan="8" class="vide">Aucun fret.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="hint">Repère : ≈ {{ tarif * 1000 | nb }} FCFA par tonne et par km (hors manutention). Les retours à vide peuvent être proposés moins cher.</p>
    }

    @if (modal()) {
      <div class="modal-fond" (click)="modal.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          @switch (modal()) {
            @case ('fret') {
              <h2>Publier un fret</h2>
              <div class="form-grid">
                <label class="field">Départ<select [(ngModel)]="nf.origineId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                <label class="field">Arrivée<select [(ngModel)]="nf.destinationId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                <label class="field">Produit<select [(ngModel)]="nf.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
                <label class="field">Tonnage<input type="number" min="0.1" step="0.1" [(ngModel)]="nf.tonnage" /></label>
                <label class="field">Date de chargement<input type="date" [(ngModel)]="nf.dateChargement" /></label>
                <label class="field">Prix proposé (FCFA)<input type="number" [(ngModel)]="nf.prixPropose" /></label>
              </div>
              <p class="small">Prix indicatif : <strong>{{ prixIndicatif() | fcfa }}</strong> ({{ kmNf() }} km)</p>
              @if (alerteNf(); as a) { <div class="note">⚠ Axe signalé : {{ a.motif }} — {{ a.commentaire }}</div> }
              <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!nf.tonnage || nf.origineId === nf.destinationId" (click)="publierFret()">Publier</button></div>
            }
            @case ('candidature') {
              <h2>Proposer mon prix</h2>
              <p class="small">{{ cible()?.origineId | loc }} → {{ cible()?.destinationId | loc }} · {{ cible()?.tonnage }} t · prix proposé {{ cible()?.prixPropose | fcfa }}</p>
              <label class="field">Mon prix (FCFA)<input type="number" [(ngModel)]="cand.prix" /></label>
              <label class="field" style="margin-top:8px">Message<textarea rows="2" [(ngModel)]="cand.message" placeholder="Disponibilité, type de camion…"></textarea></label>
              <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="candidater()">Envoyer</button></div>
            }
            @case ('axe') {
              <h2>Signaler l’état d’un axe</h2>
              <div class="form-grid">
                <label class="field">De<select [(ngModel)]="na.origineId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                <label class="field">À<select [(ngModel)]="na.destinationId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                <label class="field">Motif<select [(ngModel)]="na.motif"><option>Route dégradée</option><option>Coupure / radier submergé</option><option>Contrôles fréquents</option><option>Travaux</option><option>Circulation déconseillée</option></select></label>
                <label class="field">Niveau<select [(ngModel)]="na.niveau"><option value="info">Information</option><option value="prudence">Prudence</option><option value="deconseille">Déconseillé</option></select></label>
                <label class="field full">Commentaire<textarea rows="2" [(ngModel)]="na.commentaire"></textarea></label>
              </div>
              <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="na.origineId === na.destinationId" (click)="signaler()">Publier</button></div>
            }
          }
        </div>
      </div>
    }
  </div>`,
  styles: `tr.gris td { opacity: .45; } .cand { display: flex; gap: 6px; align-items: center; justify-content: space-between; margin-bottom: 4px; }`,
})
export class TransportPage {
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  protected readonly produits = PRODUITS;
  protected readonly statut = STATUT_FRET;
  protected readonly tarif = TARIF_KG_KM;
  protected readonly onglet = signal<'bourse' | 'miens' | 'axes' | 'camions'>('bourse');
  protected readonly resa = signal<DisponibiliteCamion | null>(null);
  protected nr = { produitId: 'mais', tonnage: 10, destinationId: 'OUA' };
  protected readonly camions = computed(() => this.pf.db.disponibilites.items().filter((d) => d.statut === 'active'));

  ouvrirResa(d: DisponibiliteCamion) {
    this.nr = { produitId: 'mais', tonnage: Math.min(d.capaciteT, 10), destinationId: d.destinationId ?? this.session.utilisateur()!.localiteId };
    this.resa.set(d);
  }
  kmResa(d: DisponibiliteCamion) { return distanceKm(d.origineId, d.destinationId ?? this.nr.destinationId); }
  prixResa(d: DisponibiliteCamion) { return Math.round(this.nr.tonnage * this.kmResa(d) * d.tarifTonneKm / 1000) * 1000; }

  async reserver(d: DisponibiliteCamion) {
    const f = await this.pf.publierFret({
      origineId: d.origineId, destinationId: d.destinationId ?? this.nr.destinationId, produitId: this.nr.produitId,
      tonnage: this.nr.tonnage, dateChargement: d.date, prixPropose: this.prixResa(d),
    });
    await this.pf.attribuerFret(f, d.transporteurId);
    await this.pf.db.disponibilites.update(d.id, { statut: 'reservee' });
    this.resa.set(null);
    this.onglet.set('miens');
    this.toast.afficher('Camion réservé, le transporteur est prévenu.');
  }
  protected readonly modal = signal<'fret' | 'candidature' | 'axe' | null>(null);
  protected readonly cible = signal<Fret | null>(null);
  readonly vue = input<string>();
  constructor() { effect(() => { const v = this.vue(); this.onglet.set(v === 'miens' || v === 'axes' || v === 'camions' ? v : 'bourse'); }); }

  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly estTransporteur = computed(() => this.session.role() === 'transporteur');
  protected readonly capacite = computed(() => this.session.utilisateur()!.capaciteT ?? 0);

  protected nf = { origineId: this.session.utilisateur()!.localiteId, destinationId: 'OUA', produitId: 'mais', tonnage: 10, dateChargement: aujourdhui(), prixPropose: 0 };
  protected cand = { prix: 0, message: '' };
  protected na = { origineId: 'OUA', destinationId: 'KAY', motif: 'Route dégradée' as SignalementAxe['motif'], niveau: 'prudence' as SignalementAxe['niveau'], commentaire: '' };

  protected readonly axes = computed(() => [...this.pf.db.axes.items()].sort((a, b) => b.date.localeCompare(a.date)));

  private alerte(o: string, d: string) {
    return this.axes().find((a) => (a.origineId === o && a.destinationId === d) || (a.origineId === d && a.destinationId === o));
  }

  private enrichir(f: Fret) {
    const km = distanceKm(f.origineId, f.destinationId);
    return { f, km, tkm: f.prixPropose / (f.tonnage * km), alerte: this.alerte(f.origineId, f.destinationId) };
  }

  protected readonly ouverts = computed(() => this.pf.db.frets.items().filter((f) => f.statut === 'ouvert').map((f) => this.enrichir(f)));
  protected readonly miens = computed(() => this.pf.db.frets.items().filter((f) => f.demandeurId === this.moi() || f.transporteurId === this.moi()).map((f) => this.enrichir(f)));

  aCandidate(f: Fret) { return f.candidatures.some((c) => c.transporteurId === this.moi()); }
  kmNf() { return this.nf.origineId === this.nf.destinationId ? 0 : distanceKm(this.nf.origineId, this.nf.destinationId); }
  prixIndicatif() { return Math.round((this.nf.tonnage * 1000 * (this.kmNf() * TARIF_KG_KM + 4)) / 1000) * 1000; }
  alerteNf() { return this.alerte(this.nf.origineId, this.nf.destinationId); }

  ouvrirCandidature(f: Fret) { this.cible.set(f); this.cand = { prix: f.prixPropose, message: '' }; this.modal.set('candidature'); }

  async publierFret() {
    await this.pf.publierFret({ ...this.nf, prixPropose: this.nf.prixPropose || this.prixIndicatif() });
    this.modal.set(null); this.onglet.set('miens');
    this.toast.afficher('Fret publié, les transporteurs sont alertés.');
  }
  async candidater() { await this.pf.candidater(this.cible()!, this.cand.prix, this.cand.message); this.modal.set(null); this.toast.afficher('Proposition envoyée.'); }
  async attribuer(f: Fret, t: string) { await this.pf.attribuerFret(f, t); this.toast.afficher('Transporteur retenu.'); }
  async avancer(f: Fret) { await this.pf.avancerFret(f); this.toast.afficher('Statut du trajet mis à jour.'); }
  async signaler() { await this.pf.signalerAxe(this.na); this.modal.set(null); this.onglet.set('axes'); this.toast.afficher('Merci, signalement publié.'); }
  async confirmerAxe(id: string) { await this.pf.confirmerAxe(id); this.toast.afficher('Confirmation enregistrée.'); }
}
