import { LowerCasePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { PRODUITS, localite, produit } from '../../core/data/referentiel';
import { Commande } from '../../core/models';
import { PlateformeService, fraicheur, heure, offreVisible } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI, visuel } from '../../shared/achat-ui';
import { UI } from '../../shared/ui';

interface Tache { icone: string; texte: string; lien: string; cta: string }

/**
 * Accueil acheteur = une boutique.
 * Ordre : chercher → ce qui m'attend → ce qui arrive → des rayons de produits à parcourir.
 */
@Component({
  selector: 'app-accueil-acheteur',
  imports: [FormsModule, RouterLink, LowerCasePipe, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <!-- Recherche : la porte d'entrée -->
    <section class="entree">
      <h1>Du champ à votre porte.</h1>
      <form class="recherche" (submit)="chercher($event)" role="search">
        <app-ic n="recherche" />
        <input type="search" name="q" [(ngModel)]="q" placeholder="Rechercher un produit" aria-label="Rechercher un produit" />
        <button class="primary" type="submit">Chercher</button>
      </form>
      <div class="cats">
        @for (p of produits; track p.id) {
          <a class="cat" routerLink="/marche" [queryParams]="{ produit: p.id }"><span class="ic">{{ vis(p.id).ic }}</span>{{ court(p.nom) }}</a>
        }
      </div>
    </section>

    <!-- Première visite : comment ça marche, en 4 mots -->
    @if (guide()) {
      <section class="guide">
        <ol>
          <li><strong>Choisir</strong><span>un produit</span></li>
          <li><strong>Attendre</strong><span>l’accord du vendeur</span></li>
          <li><strong>Payer</strong><span>FasoAgri garde l’argent</span></li>
          <li><strong>Recevoir</strong><span>le vendeur est payé</span></li>
        </ol>
        <button class="ghost" (click)="fermerGuide()" aria-label="Masquer">✕</button>
      </section>
    }

    <!-- Ce qui m'attend -->
    @if (taches().length || enRoute().length) {
      <section class="section suivi">
        @for (c of enRoute(); track c.id) {
          <a class="ligne-suivi en-route" [routerLink]="['/commandes', c.id]">
            <app-vignette [produitId]="c.produitId" />
            <div class="t"><strong>Votre {{ c.produitId | prod | lowercase }} arrive {{ eta(c) }}</strong>
              <div class="bar"><span [style.width.%]="progression(c) * 100"></span></div></div>
            <span class="btn">Suivre</span>
          </a>
        }
        @for (t of taches(); track t.texte) {
          <a class="ligne-suivi" [routerLink]="t.lien"><app-vignette [produitId]="t.icone" /><span class="t">{{ t.texte }}</span><span class="btn primary">{{ t.cta }}</span></a>
        }
      </section>
    }

    <!-- Rayons -->
    @if (affaires().length >= 3) {
      <section class="section">
        <div class="titre-rayon"><h2>Bonnes affaires</h2><a routerLink="/marche">Tout voir</a></div>
        <div class="rayon">@for (o of affaires(); track o.id) { <app-carte-offre [offre]="o" /> }</div>
      </section>
    }
    <section class="section">
      <div class="titre-rayon"><h2>Près de {{ ville() }}</h2><a routerLink="/marche">Tout voir</a></div>
      <div class="rayon">@for (o of proches(); track o.id) { <app-carte-offre [offre]="o" /> }</div>
    </section>
    @if (achat.mesFavoris().length) {
      <section class="section">
        <div class="titre-rayon"><h2>Vos favoris</h2><a routerLink="/favoris">Tout voir</a></div>
        <div class="rayon">@for (f of achat.mesFavoris(); track f.f.id) { <app-carte-offre [offre]="f.o" /> }</div>
      </section>
    }

    <!-- À lire -->
    <section class="section">
      <div class="titre-rayon"><h2>À savoir cette semaine</h2><a routerLink="/actualites">Actualités</a></div>
      <div class="actus">
        @for (a of achat.actualites().slice(0, 3); track a.id) {
          <a class="actu" routerLink="/actualites"><span class="cat-a">{{ a.categorie }}</span><strong>{{ a.titre }}</strong></a>
        }
      </div>
    </section>

    <a class="section vendre" routerLink="/devenir-vendeur"><app-ic n="pousse" [taille]="22" /><span><strong>Vous produisez aussi ?</strong> Vendez avec le même compte.</span><span class="btn">Devenir vendeur</span></a>
  </div>`,
  styles: `
    .entree { padding: 8px 0 4px; }
    .entree h1 { margin-bottom: 14px; }
    .recherche { display: flex; align-items: center; gap: 8px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: 14px; padding: 6px 6px 6px 14px; max-width: 720px; }
    .recherche:focus-within { border-color: var(--vert); }
    .recherche app-ic { color: var(--gris); }
    .recherche input { flex: 1; border: 0; padding: 8px 4px; background: transparent; }
    .recherche input:focus-visible { outline: none; }
    .cats { display: flex; gap: 8px; margin-top: 16px; overflow-x: auto; padding-bottom: 4px; }
    .cat { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border: 1px solid var(--ligne); border-radius: 999px; background: var(--blanc); color: var(--encre); text-decoration: none; white-space: nowrap; font-size: var(--t-s); font-weight: 600; }
    .cat:hover { border-color: var(--vert); }
    .cat .ic { width: 30px; height: 30px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; font-size: 17px; }
    .guide { margin-top: 24px; display: flex; align-items: center; gap: 8px; background: var(--vert); color: #fff; border-radius: var(--radius); padding: 14px 10px 14px 20px; }
    .guide ol { flex: 1; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; counter-reset: e; }
    .guide li { display: flex; flex-direction: column; counter-increment: e; }
    .guide li strong::before { content: counter(e) '. '; opacity: .7; }
    .guide li span { font-size: var(--t-s); opacity: .85; }
    .guide button { color: #fff; }
    @media (max-width: 680px) { .guide ol { grid-template-columns: 1fr 1fr; } }
    .suivi { display: flex; flex-direction: column; gap: 8px; }
    .ligne-suivi { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: var(--radius); color: var(--encre); text-decoration: none; }
    .ligne-suivi:hover { border-color: var(--vert); }
    .ligne-suivi .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .ligne-suivi .btn { padding: 6px 12px; font-size: var(--t-s); }
    .en-route { border-color: var(--vert); }
    .actus { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    @media (max-width: 800px) { .actus { grid-template-columns: 1fr; } }
    .actu { display: flex; flex-direction: column; gap: 6px; padding: 16px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: var(--radius); color: var(--encre); text-decoration: none; }
    .actu:hover { border-color: var(--vert); }
    .cat-a { font-size: var(--t-s); color: var(--vert); font-weight: 600; }
    .vendre { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border: 1px dashed var(--ligne); border-radius: var(--radius); color: var(--encre); text-decoration: none; }
    .vendre > span:nth-child(2) { flex: 1; }
    .vendre app-ic { color: var(--vert); }
  `,
})
export class AccueilAcheteurPage {
  protected readonly session = inject(SessionService);
  protected readonly achat = inject(AchatService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  protected readonly produits = PRODUITS;
  protected q = '';
  private readonly now = signal(Date.now());
  constructor() { const t = setInterval(() => this.now.set(Date.now()), 30_000); inject(DestroyRef).onDestroy(() => clearInterval(t)); }

  protected readonly guide = signal(this.lireGuide());
  private lireGuide() { try { return localStorage.getItem('agri-bf.guide-acheteur') !== 'vu'; } catch { return true; } }
  fermerGuide() { this.guide.set(false); try { localStorage.setItem('agri-bf.guide-acheteur', 'vu'); } catch { /* ignore */ } }

  private readonly loc = computed(() => this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly ville = computed(() => localite(this.loc()).nom.split(' (')[0]);
  vis(p: string) { return visuel(p); }
  court(nom: string) { return nom.split(' ')[0]; }

  private readonly mesCommandes = computed(() => this.pf.db.commandes.items().filter((c) => c.acheteurId === this.session.utilisateur()?.id));
  protected readonly enRoute = computed(() => this.mesCommandes().filter((c) => c.statut === 'expediee' && c.livraison));

  /** Trois actions au plus, la plus urgente d'abord. */
  protected readonly taches = computed<Tache[]>(() => {
    const t: Tache[] = [];
    for (const c of this.mesCommandes()) {
      const nom = produit(c.produitId).nom;
      if (c.statut === 'attente_paiement') t.push({ icone: c.produitId, texte: `${nom} : le vendeur l’a. À payer : ${this.pf.montant(c).total.toLocaleString('fr-FR')} F`, lien: `/commandes/${c.id}`, cta: 'Payer' });
      if (c.statut === 'livree') t.push({ icone: c.produitId, texte: `${nom} est arrivé`, lien: `/commandes/${c.id}`, cta: 'J’ai reçu' });
    }
    for (const cv of this.achat.mesConversations()) {
      if (cv.acheteurId === this.session.utilisateur()?.id && cv.messages.some((m) => m.proposition?.statut === 'en_attente'))
        t.push({ icone: cv.produitId, texte: `${produit(cv.produitId).nom} : un vendeur vous propose un prix`, lien: `/messages/${cv.id}`, cta: 'Voir' });
    }
    for (const c of this.mesCommandes()) {
      if (c.statut === 'terminee' && !this.pf.db.avis.items().some((a) => a.commandeId === c.id && a.auteurId === c.acheteurId))
        t.push({ icone: c.produitId, texte: `${produit(c.produitId).nom} reçu. Votre avis ?`, lien: `/commandes/${c.id}`, cta: 'Noter' });
    }
    return t.slice(0, 3);
  });

  private readonly visibles = computed(() => this.pf.db.offres.items().filter((o) => offreVisible(o) && fraicheur(o).niveau !== 'a_reconfirmer' && o.vendeurId !== this.session.utilisateur()?.id && !this.achat.idsMasques().has(o.id)));

  /** Offres sous le prix habituel du marché, les plus fortes remises d'abord */
  protected readonly affaires = computed(() => this.visibles()
    .map((o) => ({ o, r: this.pf.prixReference(o.produitId, o.localiteId) }))
    .filter((x) => x.r && x.o.prixKg < x.r.prix)
    .sort((a, b) => a.o.prixKg / a.r!.prix - b.o.prixKg / b.r!.prix)
    .map((x) => x.o).slice(0, 8));

  /** Les moins chères une fois livrées chez l'acheteur (comparées au prix local) */
  protected readonly proches = computed(() => this.visibles()
    .map((o) => ({ o, rendu: this.pf.coutRendu(o.prixKg, o.produitId, o.localiteId, this.loc()).total }))
    .sort((a, b) => a.rendu / (this.pf.prixReference(a.o.produitId, this.loc())?.prix ?? a.rendu) - b.rendu / (this.pf.prixReference(b.o.produitId, this.loc())?.prix ?? b.rendu))
    .map((x) => x.o).slice(0, 8));

  progression(c: Commande) {
    const l = c.livraison!;
    if (!l.departPrevu || !l.arriveePrevue) return 0.1;
    return Math.max(0.05, Math.min(0.95, (this.now() - Date.parse(l.departPrevu)) / (Date.parse(l.arriveePrevue) - Date.parse(l.departPrevu))));
  }
  eta(c: Commande) {
    const a = c.livraison?.arriveePrevue;
    if (!a) return 'bientôt';
    const min = Math.round((Date.parse(a) - this.now()) / 60_000);
    return min > 0 ? `vers ${heure(a)}` : 'maintenant';
  }

  chercher(e: Event) { e.preventDefault(); this.router.navigate(['/marche'], { queryParams: this.q.trim() ? { q: this.q.trim() } : {} }); }
}
