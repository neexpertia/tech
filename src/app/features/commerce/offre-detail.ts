import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COMMISSION_PCT, LOCALITES, coutTransportKg, distanceKm, produit } from '../../core/data/referentiel';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-offre-detail',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <a [routerLink]="base()" class="small">← Marché</a>
    @if (offre(); as o) {
      @let p = prod();
      <div class="page-head" style="margin-top:8px">
        <div>
          <div class="eyebrow">Offre {{ o.id }} · publiée le {{ o.creeLe }}</div>
          <h1>{{ p.nom }} — {{ o.quantiteRestanteKg | qte }} à {{ o.prixKg | nb }} F/kg</h1>
          <p>📍 {{ o.localiteId | loc }} · qualité {{ o.qualite }} · disponible le {{ o.disponibleLe }}</p>
        </div>
        @if (estVendeur()) {
          <div class="toolbar">
            @if (o.statut === 'active') { <button class="danger" (click)="retirer()">Retirer l’offre</button> }
          </div>
        }
      </div>

      <div class="split">
        <div>
          <div class="card">
            <h2>Description</h2>
            <p>{{ o.description }}</p>
            <div class="grid g2">
              <div>
                <div class="ligne"><span>Quantité initiale</span><span>{{ o.quantiteKg | qte }}</span></div>
                <div class="ligne"><span>Restant</span><strong>{{ o.quantiteRestanteKg | qte }}</strong></div>
                <div class="ligne"><span>En unité locale</span><span>{{ o.quantiteRestanteKg | enUnite: o.produitId }}</span></div>
                <div class="ligne"><span>Prix par {{ p.unites[1]?.libelle?.toLowerCase() ?? 'kg' }}</span><span>{{ o.prixKg * (p.unites[1]?.kg ?? 1) | nb }} F</span></div>
              </div>
              <div>
                <div class="ligne"><span>Livraison</span><span>{{ o.livraison ? 'Possible par le vendeur' : 'Enlèvement ou fret plateforme' }}</span></div>
                <div class="ligne"><span>Stockage</span><span>{{ entrepot()?.nom ?? 'Chez le vendeur' }}</span></div>
                <div class="ligne"><span>Statut</span><span class="badge" [class.ok]="o.statut === 'active'">{{ o.statut }}</span></div>
              </div>
            </div>
          </div>

          <div class="card section">
            <h2>🔎 Traçabilité du lot</h2>
            <div class="trace">
              <div class="code">{{ o.lot }}</div>
              <ul class="clean small">
                <li><strong>Origine :</strong> {{ o.localiteId | loc }} ({{ province() }})</li>
                <li><strong>Vendeur :</strong> {{ o.vendeurId | qui }}</li>
                @if (o.producteurs) { <li><strong>Lot groupé :</strong> {{ o.producteurs }} producteurs identifiés (liste détenue par la coopérative)</li> }
                @if (o.certification) { <li><strong>Certification :</strong> {{ o.certification }}</li> }
                @if (depot(); as d) { <li><strong>Récépissé d’entrepôt :</strong> {{ d.recu }} du {{ d.dateEntree }}</li> }
              </ul>
            </div>
            <p class="hint">Le code de lot est imprimé sur les sacs / étiquettes et suit la marchandise jusqu’à l’acheteur final (export, supermarché).</p>
          </div>

          <div class="card section">
            <h2>Vendeur</h2>
            @let s = score();
            <div class="vend">
              <div>
                <strong>{{ o.vendeurId | qui }}</strong> @if (vendeur()?.kyc === 'verifie') { <span class="badge ok">✔ identité vérifiée</span> }
                <div class="small muted">{{ vendeur()?.telephone }} · membre depuis {{ vendeur()?.inscritLe }}</div>
              </div>
              <div class="num"><app-etoiles [note]="s.noteMoyenne" /> <span class="small muted">({{ s.nbAvis }} avis)</span><br /><span class="badge info">Score {{ s.grade }} · {{ s.valeur }}/100</span></div>
            </div>
            <ul class="clean small">
              @for (a of avis(); track a.id) { <li><app-etoiles [note]="a.note" /> « {{ a.commentaire }} » — {{ a.auteurId | qui }}, {{ a.date }}</li> }
            </ul>
          </div>
        </div>

        <div class="card collant">
          @if (!session.utilisateur()) {
            <h2>Commander ce lot</h2>
            <p class="small">Créez votre compte gratuit pour commander, payer en séquestre Mobile Money et être livré.</p>
            <a class="btn primary large" routerLink="/inscription">Créer un compte</a>
            <a class="btn large" routerLink="/connexion" style="margin-top:8px">Se connecter</a>
            <p class="hint">Prix : {{ o.prixKg | nb }} F/kg · coût rendu Ouagadougou ≈ {{ renduOuaga() | nb }} F/kg</p>
          } @else if (!estVendeur() && o.statut === 'active') {
            <h2>Commander</h2>
            <div class="form-grid">
              <label class="field">Quantité<input type="number" min="1" [ngModel]="qte()" (ngModelChange)="qte.set($event)" /></label>
              <label class="field">Unité<select [ngModel]="unite() || p.unites[p.unites.length > 1 ? 1 : 0].code" (ngModelChange)="unite.set($event)">@for (u of p.unites; track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
              <label class="field full">Livrer à<select [ngModel]="destination()" (ngModelChange)="destination.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
              <label class="field full"><span><input type="checkbox" [ngModel]="transport()" (ngModelChange)="transport.set($event)" /> Inclure le transport ({{ km() }} km)</span></label>
            </div>
            @let c = calcul();
            <div style="margin-top:10px">
              <div class="ligne"><span>{{ c.kg | nb }} kg × {{ o.prixKg | nb }} F</span><span>{{ c.marchandise | fcfa }}</span></div>
              <div class="ligne"><span>Transport estimé</span><span>{{ c.transport | fcfa }}</span></div>
              <div class="ligne"><span>Frais de service ({{ commission }} %)</span><span>{{ c.commission | fcfa }}</span></div>
              <div class="ligne total"><span>Total à payer</span><span>{{ c.total | fcfa }}</span></div>
            </div>
            @if (c.kg > o.quantiteRestanteKg) { <p class="note">Quantité supérieure au disponible ({{ o.quantiteRestanteKg | qte }}).</p> }
            <button class="primary large" [disabled]="c.kg <= 0 || c.kg > o.quantiteRestanteKg || session.utilisateur()?.kyc !== 'verifie'" (click)="commander()">Commander</button>
            <p class="hint">🔒 Le paiement est conservé en séquestre et versé au vendeur seulement après votre confirmation de réception.</p>
          } @else if (estVendeur()) {
            <h2>Commandes sur cette offre</h2>
            <ul class="clean">
              @for (c of commandesOffre(); track c.id) { <li><a [routerLink]="['/commandes', c.id]">{{ c.reference }}</a> — {{ c.acheteurId | qui }} · {{ c.quantiteKg | qte }} <span class="badge">{{ c.statut }}</span></li> }
              @empty { <li class="muted">Aucune commande pour le moment.</li> }
            </ul>
          } @else {
            <p class="muted">Cette offre n’est plus disponible.</p>
          }
        </div>
      </div>
    } @else {
      <div class="vide">Offre introuvable.</div>
    }
  </div>`,
  styles: `
    .trace { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .code { font-family: ui-monospace, monospace; font-size: 15px; font-weight: 700; padding: 12px 14px; border: 2px dashed var(--primary); border-radius: 8px; background: var(--primary-soft); }
    .vend { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .collant { position: sticky; top: 70px; }
    .large { width: 100%; justify-content: center; padding: 10px; margin-top: 12px; font-size: 15px; }
  `,
})
export class OffreDetailPage {
  readonly id = input.required<string>();
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  protected readonly commission = COMMISSION_PCT;

  protected readonly offre = computed(() => this.pf.db.offres.get(this.id()));
  protected readonly prod = computed(() => produit(this.offre()!.produitId));
  protected readonly estVendeur = computed(() => this.offre()?.vendeurId === this.session.utilisateur()?.id);
  protected readonly vendeur = computed(() => this.pf.utilisateur(this.offre()!.vendeurId));
  protected readonly score = computed(() => this.pf.score(this.offre()!.vendeurId));
  protected readonly avis = computed(() => this.pf.db.avis.items().filter((a) => a.cibleId === this.offre()!.vendeurId).slice(0, 4));
  protected readonly entrepot = computed(() => this.offre()?.entrepotId ? this.pf.db.entrepots.get(this.offre()!.entrepotId!) : undefined);
  protected readonly depot = computed(() => this.pf.db.depots.items().find((d) => d.entrepotId === this.offre()?.entrepotId && d.deposantId === this.offre()?.vendeurId && d.produitId === this.offre()?.produitId));
  protected readonly province = computed(() => this.localites.find((l) => l.id === this.offre()!.localiteId)?.province);
  protected readonly commandesOffre = computed(() => this.pf.db.commandes.items().filter((c) => c.source.type === 'offre' && c.source.id === this.id()));

  protected readonly qte = signal(1);
  protected readonly unite = signal('');
  protected readonly destination = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly base = () => (this.router.url.startsWith('/decouvrir') ? '/decouvrir/marche' : '/marche');
  protected readonly renduOuaga = computed(() => this.pf.coutRendu(this.offre()!.prixKg, this.offre()!.produitId, this.offre()!.localiteId, 'OUA').total);
  protected readonly transport = signal(true);

  protected readonly km = computed(() => distanceKm(this.offre()!.localiteId, this.destination()));

  protected readonly calcul = computed(() => {
    const o = this.offre()!;
    const us = produit(o.produitId).unites;
    const u = us.find((x) => x.code === this.unite()) ?? us[1] ?? us[0];
    const kg = Math.round((this.qte() || 0) * u.kg);
    const marchandise = kg * o.prixKg;
    const transport = this.transport() ? coutTransportKg(this.km()) * kg : 0;
    const commission = Math.round((marchandise * COMMISSION_PCT) / 100);
    return { kg, marchandise, transport, commission, total: marchandise + transport + commission };
  });

  async commander() {
    const c = await this.pf.commanderOffre(this.id(), this.calcul().kg, this.destination(), this.transport());
    this.toast.afficher(`Commande ${c.reference} créée — procédez au paiement.`);
    this.router.navigate(['/commandes', c.id]);
  }

  async retirer() {
    if (!confirm('Retirer cette offre du marché ?')) return;
    await this.pf.retirerOffre(this.id());
    this.toast.afficher('Offre retirée.');
  }
}
