import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, produit } from '../../core/data/referentiel';
import { PlateformeService, de } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-demande-detail',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <a routerLink="/demandes" class="small">← Demandes</a>
    @if (demande(); as d) {
      <div class="page-head" style="margin-top:8px">
        <div>
          <div class="eyebrow">{{ d.type === 'appel_offres' ? 'Appel d’offres' : 'Demande de cotation' }} {{ d.id }} · publiée le {{ d.creeLe }}</div>
          <h1>{{ d.acheteurId | qui }} cherche {{ d.quantiteKg | qte }} {{ nomProduit() }}</h1>
          <p>Livraison à <strong>{{ d.localiteLivraisonId | loc }}</strong> avant le <strong>{{ d.dateLimite }}</strong> · qualité ≥ {{ d.qualiteMin }}
            @if (d.prixMaxKg) { · prix max rendu <strong>{{ d.prixMaxKg | nb }} F/kg</strong> }
            @if (d.recurrence) { · <span class="badge info">↻ {{ d.recurrence }}</span> }</p>
        </div>
        <span class="badge" [class.ok]="d.statut === 'ouverte'">{{ d.statut }}</span>
      </div>
      <div class="card"><h3>Cahier des charges</h3><p>{{ d.description }}</p><p class="small muted">{{ d.quantiteKg | enUnite: d.produitId }}</p></div>

      @if (estAcheteur()) {
        <div class="section">
          <h2>Cotations reçues ({{ cotations().length }})</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Vendeur</th><th class="num">Qté</th><th class="num">Prix départ</th><th class="num">Transport</th><th class="num">Coût rendu</th><th class="num">Délai</th><th>Fiabilité</th><th></th></tr></thead>
              <tbody>
                @for (l of cotations(); track l.c.id; let i = $index) {
                  <tr>
                    <td><strong>{{ l.c.vendeurId | qui }}</strong> @if (i === 0 && l.c.statut === 'envoyee') { <span class="badge ok">meilleur coût rendu</span> }
                      <div class="small muted">{{ l.c.localiteId | loc }} · « {{ l.c.message }} »</div></td>
                    <td class="num">{{ l.c.quantiteKg | qte }}<div class="small muted">{{ (l.c.quantiteKg / d.quantiteKg) * 100 | nb }} %</div></td>
                    <td class="num">{{ l.c.prixKg | nb }}</td>
                    <td class="num">{{ l.r.transport + l.r.pertes | nb }}<div class="small muted">{{ l.r.km }} km</div></td>
                    <td class="num"><strong>{{ l.r.total | nb }}</strong>
                      @if (d.prixMaxKg) { <div><span class="badge" [class.ok]="l.r.total <= d.prixMaxKg" [class.ko]="l.r.total > d.prixMaxKg">{{ l.r.total <= d.prixMaxKg ? 'dans le budget' : 'hors budget' }}</span></div> }</td>
                    <td class="num">{{ l.c.delaiJours }} j</td>
                    <td class="small"><span class="badge info">{{ l.s.grade }} · {{ l.s.valeur }}</span><br /><app-etoiles [note]="l.s.noteMoyenne" /></td>
                    <td>
                      @if (l.c.statut === 'envoyee' && d.statut === 'ouverte') {
                        <div class="toolbar"><button class="primary" (click)="accepter(l.c.id)">Accepter</button><button class="ghost" (click)="refuser(l.c.id)">Refuser</button></div>
                      } @else { <span class="badge" [class.ok]="l.c.statut === 'acceptee'" [class.ko]="l.c.statut === 'refusee'">{{ l.c.statut }}</span> }
                    </td>
                  </tr>
                } @empty { <tr><td colspan="8" class="vide">Pas encore de cotation. Les vendeurs concernés ont été alertés.</td></tr> }
              </tbody>
            </table>
          </div>
          <p class="hint">Coût rendu = prix départ + transport jusqu’à {{ d.localiteLivraisonId | loc }} + pertes estimées. Accepter une cotation crée une commande à payer en séquestre.</p>
          @if (offresCorrespondantes().length) {
            <div class="card section"><h3>Offres déjà sur le marché</h3>
              <ul class="clean">@for (o of offresCorrespondantes(); track o.id) { <li><a [routerLink]="['/marche', o.id]">{{ o.vendeurId | qui }}</a> — {{ o.quantiteRestanteKg | qte }} à {{ o.prixKg | nb }} F/kg ({{ o.localiteId | loc }})</li> }</ul>
            </div>
          }
        </div>
      } @else {
        <div class="grid g2 section">
          <div class="card">
            @if (maCotation(); as c) {
              <h2>Votre cotation</h2>
              <div class="ligne"><span>Prix départ</span><strong>{{ c.prixKg | nb }} F/kg</strong></div>
              <div class="ligne"><span>Quantité</span><span>{{ c.quantiteKg | qte }}</span></div>
              <div class="ligne"><span>Délai</span><span>{{ c.delaiJours }} jours</span></div>
              <div class="ligne"><span>Statut</span><span class="badge" [class.ok]="c.statut === 'acceptee'" [class.ko]="c.statut === 'refusee'">{{ c.statut }}</span></div>
            } @else if (d.statut === 'ouverte' && session.estVendeur()) {
              <h2>Envoyer une cotation</h2>
              <div class="form-grid">
                <label class="field">Prix départ (F/kg)<input type="number" min="1" [(ngModel)]="cf.prixKg" /></label>
                <label class="field">Quantité proposée (kg)<input type="number" min="1" [(ngModel)]="cf.quantiteKg" /></label>
                <label class="field">Lieu d’enlèvement<select [(ngModel)]="cf.localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                <label class="field">Délai (jours)<input type="number" min="0" [(ngModel)]="cf.delaiJours" /></label>
                <label class="field full">Message<textarea rows="2" [(ngModel)]="cf.message" placeholder="Lot, humidité, conditionnement…"></textarea></label>
              </div>
              @let r = rendu();
              <p class="small" style="margin-top:8px">Votre coût rendu chez l’acheteur : <strong>{{ r.total | nb }} F/kg</strong> ({{ r.km }} km)
                @if (d.prixMaxKg) { — <span class="badge" [class.ok]="r.total <= d.prixMaxKg" [class.ko]="r.total > d.prixMaxKg">{{ r.total <= d.prixMaxKg ? 'compétitif' : 'au-dessus du budget' }}</span> }</p>
              <div class="actions"><button class="primary" [disabled]="!cf.prixKg || !cf.quantiteKg || session.utilisateur()?.kyc !== 'verifie'" (click)="coter()">Envoyer la cotation</button></div>
            } @else {
              <p class="muted">Cette demande n’accepte plus de cotation.</p>
            }
          </div>
          <div class="card">
            <h2>Acheteur</h2>
            @let s = scoreAcheteur();
            <p><strong>{{ d.acheteurId | qui }}</strong> <span class="badge info">{{ s.grade }} · {{ s.valeur }}/100</span></p>
            <p class="small"><app-etoiles [note]="s.noteMoyenne" /> {{ s.nbAvis }} avis · {{ s.achats }} achat(s) sur la plateforme</p>
            <p class="hint">🔒 Si votre cotation est acceptée, l’acheteur paie en séquestre avant que vous n’expédiiez.</p>
          </div>
        </div>
      }
    } @else { <div class="vide">Demande introuvable.</div> }
  </div>`,
})
export class DemandeDetailPage {
  readonly id = input.required<string>();
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  private readonly _v = signal(0);

  protected readonly demande = computed(() => this.pf.db.demandes.get(this.id()));
  protected readonly nomProduit = computed(() => de(produit(this.demande()!.produitId).nom));
  protected readonly estAcheteur = computed(() => this.demande()?.acheteurId === this.session.utilisateur()?.id || this.session.role() === 'admin');
  protected readonly scoreAcheteur = computed(() => this.pf.score(this.demande()!.acheteurId));

  protected readonly cotations = computed(() => {
    const d = this.demande()!;
    return this.pf.db.cotations.items().filter((c) => c.demandeId === d.id)
      .map((c) => ({ c, r: this.pf.coutRendu(c.prixKg, d.produitId, c.localiteId, d.localiteLivraisonId), s: this.pf.score(c.vendeurId) }))
      .sort((a, b) => a.r.total - b.r.total);
  });

  protected readonly offresCorrespondantes = computed(() => this.pf.db.offres.items().filter((o) => o.statut === 'active' && o.produitId === this.demande()!.produitId && o.qualite <= this.demande()!.qualiteMin).slice(0, 5));

  protected readonly maCotation = computed(() => this.pf.db.cotations.items().find((c) => c.demandeId === this.id() && c.vendeurId === this.session.utilisateur()?.id));

  protected cf = { prixKg: 0, quantiteKg: 0, localiteId: this.session.utilisateur()!.localiteId, delaiJours: 7, message: '' };

  rendu() {
    const d = this.demande()!;
    return this.pf.coutRendu(this.cf.prixKg || 0, d.produitId, this.cf.localiteId, d.localiteLivraisonId);
  }

  async coter() {
    await this.pf.envoyerCotation({ demandeId: this.id(), ...this.cf });
    this.toast.afficher('Cotation envoyée à l’acheteur.');
  }

  async accepter(id: string) {
    if (!confirm('Accepter cette cotation ? Une commande sera créée.')) return;
    const c = await this.pf.accepterCotation(id);
    this.toast.afficher(`Commande ${c.reference} créée.`);
    this.router.navigate(['/commandes', c.id]);
  }

  async refuser(id: string) {
    await this.pf.refuserCotation(id);
    this.toast.afficher('Cotation refusée.');
  }
}
