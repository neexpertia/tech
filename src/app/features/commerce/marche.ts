import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, REGIONS, localite, produit } from '../../core/data/referentiel';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-marche',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Marché</div>
        <h1>{{ miennes() ? 'Mes offres' : 'Offres disponibles' }}</h1>
        <p>Lots publiés par les producteurs, coopératives et commerçants. Le coût rendu est calculé jusqu’à {{ maLocalite() | loc }}.</p>
        @if (visiteur()) { <p class="note green" style="margin-top:8px">Vous consultez le marché en visiteur. <a routerLink="/connexion">Connectez-vous</a> ou <a routerLink="/inscription">créez un compte</a> pour commander ou vendre.</p> }
      </div>
      @if (session.estVendeur()) { <a class="btn primary" routerLink="/marche/nouvelle">＋ Publier une offre</a> }
    </div>

    <div class="filtres card">
      <input type="search" placeholder="Rechercher (produit, lieu, vendeur)…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select [ngModel]="produitId()" (ngModelChange)="produitId.set($event)"><option value="">Tous les produits</option>@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select>
      <select [ngModel]="regionId()" (ngModelChange)="regionId.set($event)"><option value="">Toutes les régions</option>@for (r of regions; track r.id) { <option [value]="r.id">{{ r.nom }}</option> }</select>
      <select [ngModel]="qualite()" (ngModelChange)="qualite.set($event)"><option value="">Toute qualité</option><option value="A">Qualité A</option><option value="B">B et mieux</option></select>
      <select [ngModel]="tri()" (ngModelChange)="tri.set($event)"><option value="rendu">Tri : coût rendu</option><option value="prix">Tri : prix départ</option><option value="recent">Tri : plus récentes</option><option value="qte">Tri : quantité</option></select>
      @if (session.estVendeur()) { <label class="small"><input type="checkbox" [ngModel]="miennes()" (ngModelChange)="miennes.set($event)" /> Mes offres</label> }
    </div>

    <p class="small muted" style="margin:10px 0">{{ liste().length }} offre(s)</p>
    <div class="grid g3">
      @for (l of liste(); track l.o.id) {
        <a class="card lien-carte offre" [routerLink]="[base(), l.o.id]">
          <div class="haut">
            <span class="badge" [class.ok]="l.o.qualite === 'A'">Qualité {{ l.o.qualite }}</span>
            @if (l.o.statut !== 'active') { <span class="badge ko">{{ l.o.statut === 'epuisee' ? 'épuisée' : 'retirée' }}</span> }
            @if (l.o.producteurs) { <span class="badge info">{{ l.o.producteurs }} producteurs</span> }
            @if (l.o.certification) { <span class="badge ok">{{ l.o.certification }}</span> }
          </div>
          <h3>{{ l.p.nom }} · {{ l.o.quantiteRestanteKg | qte }}</h3>
          <div class="small muted">{{ l.o.quantiteRestanteKg | enUnite: l.o.produitId }}</div>
          <div class="prix">
            <strong>{{ l.o.prixKg | nb }} F/kg</strong>
            @if (l.ecart !== null) { <span class="badge" [class.ok]="l.ecart <= 0" [class.warn]="l.ecart > 5">{{ l.ecart > 0 ? '+' : '' }}{{ l.ecart | nb }} % vs marché</span> }
          </div>
          <div class="small">Rendu {{ maLocalite() | loc }} : <strong>{{ l.rendu | nb }} F/kg</strong> <span class="muted">({{ l.km }} km)</span></div>
          <div class="pied small">
            <span>📍 {{ l.o.localiteId | loc }}</span>
            <span>{{ l.o.vendeurId | qui }} @if (l.verifie) { <span title="Identité vérifiée">✔️</span> }</span>
            <span class="muted">Dispo {{ l.o.disponibleLe }}@if (l.o.livraison) { · livraison possible }</span>
          </div>
        </a>
      } @empty { <div class="vide card">Aucune offre ne correspond. @if (session.estAcheteur()) { <a routerLink="/demandes/nouvelle">Publiez une demande</a> : les vendeurs seront alertés. } </div> }
    </div>
  </div>`,
  styles: `
    .filtres { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; }
    .filtres input[type=search] { flex: 1 1 220px; }
    .offre { display: flex; flex-direction: column; gap: 6px; }
    .haut { display: flex; gap: 4px; flex-wrap: wrap; }
    .offre h3 { margin: 4px 0 0; }
    .prix { display: flex; gap: 8px; align-items: center; font-size: 17px; flex-wrap: wrap; }
    .pied { display: flex; flex-direction: column; gap: 2px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: auto; }
  `,
})
export class MarchePage {
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  protected readonly produits = PRODUITS;
  protected readonly regions = REGIONS;
  protected readonly localites = LOCALITES;

  protected readonly q = signal('');
  protected readonly produitId = signal('');
  protected readonly regionId = signal('');
  protected readonly qualite = signal('');
  protected readonly tri = signal<'rendu' | 'prix' | 'recent' | 'qte'>('rendu');
  protected readonly miennes = signal(false);

  /** ?vue=mes ouvre directement « Mes offres » (lien du menu vendeur). */
  readonly vue = input<string>();
  private readonly router = inject(Router);
  protected readonly visiteur = computed(() => !this.session.utilisateur());
  protected readonly base = () => (this.router.url.startsWith('/decouvrir') ? '/decouvrir/marche' : '/marche');
  constructor() { effect(() => this.miennes.set(this.vue() === 'mes')); }

  protected readonly maLocalite = computed(() => this.session.utilisateur()?.localiteId ?? 'OUA');

  protected readonly liste = computed(() => {
    const moi = this.session.utilisateur()?.id;
    const q = this.q().toLowerCase();
    const l = this.pf.db.offres.items()
      .filter((o) => (this.miennes() ? o.vendeurId === moi : o.statut === 'active'))
      .filter((o) => !this.produitId() || o.produitId === this.produitId())
      .filter((o) => !this.regionId() || localite(o.localiteId).regionId === this.regionId())
      .filter((o) => !this.qualite() || o.qualite <= this.qualite())
      .filter((o) => !q || `${produit(o.produitId).nom} ${localite(o.localiteId).nom} ${this.pf.nom(o.vendeurId)} ${o.description}`.toLowerCase().includes(q))
      .map((o) => {
        const c = this.pf.coutRendu(o.prixKg, o.produitId, o.localiteId, this.maLocalite());
        const ref = this.pf.prixReference(o.produitId, o.localiteId);
        return {
          o, p: produit(o.produitId), rendu: c.total, km: c.km,
          ecart: ref ? ((o.prixKg - ref.prix) / ref.prix) * 100 : null,
          verifie: this.pf.utilisateur(o.vendeurId)?.kyc === 'verifie',
        };
      });
    const t = this.tri();
    return l.sort((a, b) => t === 'prix' ? a.o.prixKg - b.o.prixKg : t === 'recent' ? b.o.creeLe.localeCompare(a.o.creeLe) : t === 'qte' ? b.o.quantiteRestanteKg - a.o.quantiteRestanteKg : a.rendu - b.rendu);
  });
}
