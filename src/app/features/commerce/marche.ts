import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, REGIONS, localite, produit } from '../../core/data/referentiel';
import { PlateformeService, fraicheur, offreVisible } from '../../core/plateforme.service';
import { AchatService } from '../../core/achat.service';
import { ACHAT_UI, visuel } from '../../shared/achat-ui';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-marche',
  imports: [FormsModule, RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head">
      <h1>{{ miennes() ? 'Mes offres' : 'Marché' }}</h1>
      @if (session.estVendeur()) { <a class="btn primary" routerLink="/marche/nouvelle">Publier une offre</a> }
    </div>
    @if (visiteur()) { <p class="note green"><a routerLink="/inscription">Créez un compte gratuit</a> pour commander.</p> }

    <div class="barre">
      <input type="search" placeholder="Rechercher" aria-label="Rechercher" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select aria-label="Région" [ngModel]="regionId()" (ngModelChange)="regionId.set($event)"><option value="">Toutes les régions</option>@for (r of regions; track r.id) { <option [value]="r.id">{{ r.nom }}</option> }</select>
      <select aria-label="Qualité" [ngModel]="qualite()" (ngModelChange)="qualite.set($event)"><option value="">Toute qualité</option><option value="A">Premier choix</option><option value="B">Bonne qualité ou mieux</option></select>
      <select aria-label="Trier" [ngModel]="tri()" (ngModelChange)="tri.set($event)"><option value="rendu">Moins cher livré</option><option value="prix">Moins cher sur place</option><option value="recent">Plus récents</option><option value="qte">Plus grande quantité</option></select>
      @if (session.estVendeur()) { <label class="coche"><input type="checkbox" [ngModel]="miennes()" (ngModelChange)="miennes.set($event)" /> Mes offres</label> }
      @if (nbMasques()) { <label class="coche"><input type="checkbox" [ngModel]="voirMasques()" (ngModelChange)="voirMasques.set($event)" /> Produits masqués ({{ nbMasques() }})</label> }
    </div>
    <div class="chips cats" role="group" aria-label="Produits">
      <button class="chip" [class.on]="!produitId()" (click)="produitId.set('')">Tout</button>
      @for (p of produits; track p.id) { <button class="chip" [class.on]="produitId() === p.id" (click)="produitId.set(p.id)">{{ ic(p.id) }} {{ p.nom }}</button> }
    </div>

    <p class="small muted compte">{{ liste().length }} produit{{ liste().length > 1 ? 's' : '' }} · prix livrés à {{ maLocalite() | loc }}</p>
    <div class="grille">
      @for (l of liste(); track l.o.id) { <app-carte-offre [offre]="l.o" [base]="base()" /> }
      @empty { <div class="vide">Rien pour le moment.
        @if (!visiteur() && produitId()) { <a routerLink="/alertes" [queryParams]="{ produit: produitId() }">Me prévenir quand il y en a</a> } </div> }
    </div>
  </div>`,
  styles: `
    .barre { display: flex; gap: 8px; flex-wrap: wrap; }
    .barre input[type=search] { flex: 1 1 240px; }
    .coche { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-s); }
    .cats { margin-top: 12px; overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; }
    .cats .chip { white-space: nowrap; }
    .compte { margin: 14px 0 12px; }
    .grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
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
  protected readonly confirmees = signal(false);
  /** Afficher uniquement les produits que j'ai masqués (pour les faire réapparaître) */
  protected readonly voirMasques = signal(false);
  private readonly achat = inject(AchatService);
  protected readonly nbMasques = computed(() => this.achat.idsMasques().size);
  /** ?produit=mais pré-filtre le marché (liens des actualités, alertes, offres équivalentes). */
  readonly produit = input<string>();
  /** ?q=… recherche depuis l'accueil */
  readonly recherche = input<string>('', { alias: 'q' });

  /** ?vue=mes ouvre directement « Mes offres » (lien du menu vendeur). */
  readonly vue = input<string>();
  private readonly router = inject(Router);
  protected readonly visiteur = computed(() => !this.session.utilisateur());
  protected readonly base = () => (this.router.url.startsWith('/decouvrir') ? '/decouvrir/marche' : '/marche');
  constructor() {
    effect(() => this.miennes.set(this.vue() === 'mes'));
    effect(() => { const p = this.produit(); if (p) this.produitId.set(p); });
    effect(() => { const q = this.recherche(); if (q) this.q.set(q); });
  }

  protected ic(p: string) { return visuel(p).ic; }
  protected readonly maLocalite = computed(() => this.session.utilisateur()?.localiteId ?? 'OUA');

  protected readonly liste = computed(() => {
    const moi = this.session.utilisateur()?.id;
    const q = this.q().toLowerCase();
    const l = this.pf.db.offres.items()
      .filter((o) => (this.miennes() ? o.vendeurId === moi : offreVisible(o)))
      .filter((o) => this.miennes() || !this.confirmees() || fraicheur(o).niveau === 'confirme')
      .filter((o) => this.miennes() || this.voirMasques() === this.achat.idsMasques().has(o.id))
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
          verifie: this.pf.utilisateur(o.vendeurId)?.kyc === 'verifie', moi: o.vendeurId === moi,
          note: this.pf.score(o.vendeurId).noteMoyenne,
        };
      });
    const t = this.tri();
    return l.sort((a, b) => t === 'prix' ? a.o.prixKg - b.o.prixKg : t === 'recent' ? b.o.creeLe.localeCompare(a.o.creeLe) : t === 'qte' ? b.o.quantiteRestanteKg - a.o.quantiteRestanteKg : a.rendu - b.rendu);
  });
}
