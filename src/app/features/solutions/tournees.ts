import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LOCALITES } from '../../core/data/referentiel';
import { PlateformeService, aujourdhui } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { HYP, SolutionsService, Tournee } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

/** 4. TRANSPORTEUR — « Comment trouver des marchandises à transporter et éviter de rouler à vide ? » */
@Component({
  selector: 'app-tournees',
  imports: [FormsModule, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🚚" acteur="Transporteur" question="Comment trouver des marchandises à transporter et éviter de rouler à vide ?"
      [etapes]="['Indiquez où est votre camion et sa charge utile', 'La plateforme combine un aller chargé et le meilleur retour chargé', 'Classement par marge réelle (carburant et km à vide déduits)', 'Pas de retour ? Annoncez votre camion disponible : les chargeurs vous trouvent']" />

    <div class="card saisie">
      <label class="field">Mon camion est à<select [ngModel]="position()" (ngModelChange)="position.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
      <label class="field">Charge utile (t)<input type="number" min="0.5" step="0.5" [ngModel]="capacite()" (ngModelChange)="capacite.set($event)" /></label>
      <label class="field">Disponible à partir du<input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
      <div class="small muted">Coût de route retenu : {{ coutKm() | nb }} F/km (carburant, usure).</div>
    </div>

    <div class="grid g4 section">
      <div class="card kpi"><div class="v">{{ tournees().length }}</div><div class="l">tournées possibles</div></div>
      <div class="card kpi"><div class="v">{{ (tournees()[0]?.marge ?? 0) | fcfa: true }}</div><div class="l">meilleure marge</div></div>
      <div class="card kpi"><div class="v">{{ avecRetour() }}</div><div class="l">avec retour chargé</div></div>
      <div class="card kpi"><div class="v">{{ videMoyen() | nb }} %</div><div class="l">de km à vide (meilleures tournées)</div></div>
    </div>

    <h2 class="section">Tournées proposées</h2>
    @for (t of tournees(); track t.aller.id; let i = $index) {
      <div class="card tour" [class.top]="i === 0">
        <div class="trajet">
          <div class="etape"><span class="badge">à vide {{ t.approcheKm }} km</span></div>
          <div class="etape charge"><strong>{{ t.aller.origineId | loc }} → {{ t.aller.destinationId | loc }}</strong><div class="small">{{ t.aller.produitId | prod }} · {{ t.aller.tonnage }} t · le {{ t.aller.dateChargement }} · {{ t.aller.prixPropose | fcfa }}</div></div>
          @if (t.retour; as r) {
            <div class="etape charge"><strong>{{ r.origineId | loc }} → {{ r.destinationId | loc }}</strong><div class="small">retour : {{ r.produitId | prod }} · {{ r.tonnage }} t · le {{ r.dateChargement }} · {{ r.prixPropose | fcfa }}</div></div>
          } @else {
            <div class="etape vide"><strong>Retour à vide</strong><div class="small">Annoncez votre camion disponible à {{ t.aller.destinationId | loc }}</div></div>
          }
        </div>
        <div class="chiffres">
          <div><span class="small muted">Revenu</span><strong>{{ t.revenu | fcfa: true }}</strong></div>
          <div><span class="small muted">Coût de route</span><strong>{{ t.cout | fcfa: true }}</strong></div>
          <div><span class="small muted">Marge</span><strong [class.rouge]="t.marge < 0">{{ t.marge | fcfa: true }}</strong></div>
          <div><span class="small muted">km chargés / à vide</span><strong>{{ t.chargeKm }} / {{ t.videKm }}</strong></div>
          <div><span class="small muted">Revenu / km</span><strong>{{ t.revenuKm | nb }} F</strong></div>
        </div>
        <div class="bar vide-bar" [title]="'Part de km à vide : ' + (t.tauxVide * 100 | nb) + ' %'"><span [style.width.%]="(1 - t.tauxVide) * 100"></span></div>
        <div class="actions">
          @if (!t.retour) { <button (click)="annoncer(t)">📣 Annoncer mon retour depuis {{ t.aller.destinationId | loc }}</button> }
          <button class="primary" (click)="postuler(t)">Proposer mes services {{ t.retour ? 'pour l’aller et le retour' : 'pour ce fret' }}</button>
        </div>
      </div>
    } @empty { <div class="vide card">Aucun fret compatible pour le moment. Annoncez votre camion disponible ci-dessous.</div> }

    <div class="grid g2 section">
      <div class="card">
        <h2>Annoncer mon camion disponible</h2>
        <p class="small muted">Les coopératives, collecteurs et acheteurs voient votre annonce et peuvent vous réserver directement.</p>
        <div class="form-grid">
          <label class="field">Départ<select [(ngModel)]="nd.origineId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
          <label class="field">Vers (facultatif)<select [(ngModel)]="nd.destinationId"><option value="">Toutes destinations</option>@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
          <label class="field">Date<input type="date" [(ngModel)]="nd.date" /></label>
          <label class="field">Tarif (F / t / km)<input type="number" [(ngModel)]="nd.tarif" /></label>
          <label class="field full">Commentaire<input [(ngModel)]="nd.commentaire" placeholder="Retour à vide, bâche, sangles…" /></label>
        </div>
        <div class="actions"><button class="primary" (click)="publierDispo()">Publier l’annonce</button></div>
      </div>
      <div class="card">
        <h2>Mes annonces</h2>
        <ul class="clean">
          @for (d of mesDispos(); track d.id) {
            <li><strong>{{ d.origineId | loc }} → {{ d.destinationId ? (d.destinationId | loc) : 'toutes destinations' }}</strong> · {{ d.date }} · {{ d.capaciteT }} t · {{ d.tarifTonneKm }} F/t/km
              <span class="badge" [class.ok]="d.statut === 'reservee'" [class.info]="d.statut === 'active'">{{ d.statut }}</span></li>
          } @empty { <li class="muted">Aucune annonce.</li> }
        </ul>
      </div>
    </div>
  </div>`,
  styles: `
    .saisie { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
    @media (max-width: 900px) { .saisie { grid-template-columns: 1fr 1fr; } }
    .tour { margin-bottom: 10px; } .tour.top { border-color: var(--primary); }
    .trajet { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
    .etape { padding: 8px 10px; border-radius: 8px; background: var(--surface-2); display: flex; flex-direction: column; justify-content: center; }
    .etape.charge { background: var(--primary-soft); flex: 1 1 220px; } .etape.vide { background: var(--accent-soft); flex: 1 1 200px; }
    .chiffres { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 10px 0 6px; }
    .chiffres div { display: flex; flex-direction: column; } .rouge { color: var(--danger); }
    @media (max-width: 800px) { .chiffres { grid-template-columns: 1fr 1fr; } }
    .vide-bar { background: var(--accent-soft); } .actions { margin-top: 8px; }
  `,
})
export class TourneesPage {
  private readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;

  protected readonly position = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly capacite = signal(this.session.utilisateur()?.capaciteT ?? 30);
  protected readonly date = signal(aujourdhui());
  protected nd = { origineId: this.session.utilisateur()?.localiteId ?? 'OUA', destinationId: '', date: aujourdhui(), tarif: 60, commentaire: '' };

  protected readonly coutKm = computed(() => (this.capacite() < 3 ? HYP.coutRouteTricycleKm : HYP.coutRouteCamionKm));
  protected readonly tournees = computed(() => this.sol.tournees(this.position(), this.capacite(), this.date()));
  protected readonly avecRetour = computed(() => this.tournees().filter((t) => t.retour).length);
  protected readonly videMoyen = computed(() => {
    const t = this.tournees().slice(0, 3);
    return t.length ? (t.reduce((s, x) => s + x.tauxVide, 0) / t.length) * 100 : 0;
  });
  protected readonly mesDispos = computed(() => this.pf.db.disponibilites.items().filter((d) => d.transporteurId === this.session.utilisateur()?.id));

  async postuler(t: Tournee) {
    for (const f of [t.aller, t.retour].filter((x) => !!x)) await this.pf.candidater(f!, f!.prixPropose, 'Proposé via le planificateur de tournées.');
    this.toast.afficher(t.retour ? 'Candidatures envoyées pour l’aller et le retour.' : 'Candidature envoyée.');
  }

  annoncer(t: Tournee) {
    this.nd = { ...this.nd, origineId: t.aller.destinationId, destinationId: this.position(), date: t.aller.dateChargement };
    this.publierDispo();
  }

  async publierDispo() {
    await this.pf.db.disponibilites.create({
      transporteurId: this.session.utilisateur()!.id, origineId: this.nd.origineId, ...(this.nd.destinationId ? { destinationId: this.nd.destinationId } : {}),
      date: this.nd.date, capaciteT: this.capacite(), tarifTonneKm: this.nd.tarif, commentaire: this.nd.commentaire || 'Camion disponible', statut: 'active', creeLe: aujourdhui(),
    });
    this.toast.afficher('Annonce publiée : les chargeurs de la zone sont alertés.');
  }
}
