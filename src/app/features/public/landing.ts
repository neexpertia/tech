import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRODUITS } from '../../core/data/referentiel';
import { PlateformeService, offreVisible } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { visuel } from '../../shared/achat-ui';
import { IconeComponent } from '../../shared/icone';

/**
 * Page d'accueil publique.
 * Une promesse, une démonstration visuelle (le trajet du champ à la porte), un parcours en 4 étapes.
 * Les prix, vendeurs et offres ne sont visibles qu'une fois connecté.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, IconeComponent],
  template: `
  <section class="hero">
    <div class="in">
      <div class="txt">
        <h1>Du champ<br />à votre porte.</h1>
        <p class="sous">Achetez directement aux producteurs du Burkina Faso. Payez en sécurité, suivez la livraison jusqu’à vous.</p>
        <div class="cta">
          @if (session.utilisateur()) {
            <a class="btn primary grand" routerLink="/accueil">Ouvrir mon espace</a>
          } @else {
            <a class="btn primary grand" routerLink="/inscription">Créer mon compte</a>
            <a class="btn grand" routerLink="/connexion">Se connecter</a>
          }
        </div>
        <ul class="garanties">
          <li><app-ic n="check" [taille]="18" />Le vendeur confirme avant que vous payiez</li>
          <li><app-ic n="bouclier" [taille]="18" />Votre argent est gardé jusqu’à la réception</li>
          <li><app-ic n="camion" [taille]="18" />Vous suivez la marchandise en route</li>
        </ul>
      </div>

      <!-- La démonstration : un lot d'arachide part de Léo et arrive à Ouagadougou -->
      <div class="scene" aria-hidden="true">
        <svg viewBox="0 0 400 300" class="carte">
          <g class="villes"><circle cx="150" cy="120" r="4" /><text x="150" y="106" text-anchor="middle">Koudougou</text><circle cx="190" cy="215" r="4" /><text x="205" y="236" text-anchor="middle">Sapouy</text><circle cx="300" cy="190" r="4" /><text x="300" y="210" text-anchor="middle">Manga</text></g>
          <path class="trajet" d="M70 240 C 140 230, 170 150, 230 130 S 320 70, 340 60" />
          <path class="trajet-fait" d="M70 240 C 140 230, 170 150, 230 130 S 320 70, 340 60" pathLength="1" />
          <circle cx="70" cy="240" r="7" class="pt" /><text x="70" y="268" text-anchor="middle">Léo</text>
          <circle cx="340" cy="60" r="9" class="pt arr" /><text x="362" y="38" text-anchor="end">Ouagadougou</text>
          <g class="mobile"><circle r="16" class="halo" /><circle r="11" class="cam" /></g>
        </svg>
        <div class="fiche f1">
          <span class="pic">🥜</span>
          <div><strong>Arachide décortiquée</strong><span class="verrou"><app-ic n="bouclier" [taille]="14" /> Prix visible après connexion</span></div>
        </div>
        <div class="fiche f2">
          <app-ic n="horloge" [taille]="20" />
          <div><strong>Arrivée vers 13 h 30</strong><span>Gare routière de Ouagadougou</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="in bloc">
    <h2>Sur le marché aujourd’hui</h2>
    <div class="produits">
      @for (p of produits(); track p.id) {
        <a class="produit" [routerLink]="session.utilisateur() ? '/marche' : '/inscription'" [queryParams]="session.utilisateur() ? { produit: p.id } : {}">
          <span class="pic">{{ p.ic }}</span>
          <strong>{{ p.nom }}</strong>
          <span>{{ p.n }} vendeur{{ p.n > 1 ? 's' : '' }}</span>
        </a>
      }
    </div>
    @if (!session.utilisateur()) { <p class="verrou-ligne"><app-ic n="bouclier" [taille]="16" />Prix, vendeurs et quantités sont réservés aux membres. <a routerLink="/inscription">Inscription gratuite</a></p> }
  </section>

  <section class="in bloc" id="comment">
    <h2>Comment ça marche</h2>
    <ol class="etapes">
      <li><span class="n">1</span><strong>Choisissez</strong><span>un produit et une quantité</span></li>
      <li><span class="n">2</span><strong>Le vendeur confirme</strong><span>qu’il a la marchandise, en 24 h</span></li>
      <li><span class="n">3</span><strong>Payez</strong><span>par Orange, Moov ou Sank Money</span></li>
      <li><span class="n">4</span><strong>Recevez</strong><span>puis le vendeur est payé</span></li>
    </ol>
  </section>

  <section class="in bloc deux">
    <div class="panneau">
      <app-ic n="marche" [taille]="26" />
      <h3>Acheter</h3>
      <p>Des produits disponibles, le prix livré chez vous, l’argent protégé.</p>
    </div>
    <div class="panneau">
      <app-ic n="pousse" [taille]="26" />
      <h3>Vendre</h3>
      <p>Avec le même compte. Des commandes payées d’avance.</p>
    </div>
  </section>

  @if (!session.utilisateur()) {
    <section class="in bloc fin">
      <h2>Commencez en une minute.</h2>
      <a class="btn primary grand" routerLink="/inscription">Créer mon compte</a>
    </section>
  }`,
  styles: `
    .in { max-width: 1160px; margin: 0 auto; padding: 0 24px; }

    /* ---------- Hero ---------- */
    .hero { padding: 56px 0 40px; }
    .hero .in { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
    .hero h1 { font-size: clamp(40px, 6vw, 68px); line-height: 1; letter-spacing: -.035em; font-weight: 700; margin: 0 0 20px; }
    .sous { font-size: var(--t-l); color: var(--gris); max-width: 30ch; margin-bottom: 28px; }
    .cta { display: flex; gap: 10px; flex-wrap: wrap; }
    .grand { padding: 12px 22px; font-size: var(--t-m); border-radius: 12px; }
    .garanties { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-direction: column; gap: 10px; }
    .garanties li { display: flex; gap: 10px; align-items: center; color: var(--encre); }
    .garanties app-ic { color: var(--vert); }

    /* ---------- Scène : le trajet ---------- */
    .scene { position: relative; aspect-ratio: 4 / 3; background: var(--vert-pale); border-radius: 28px; overflow: hidden; }
    .carte { position: absolute; inset: 0; width: 100%; height: 100%; }
    .carte text { font: 600 13px Figtree, sans-serif; fill: var(--vert-fonce); }
    .trajet { fill: none; stroke: var(--blanc); stroke-width: 10; stroke-linecap: round; }
    .trajet-fait { fill: none; stroke: var(--vert); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: tracer 3.2s .4s ease-in-out forwards; }
    .villes circle { fill: var(--vert); opacity: .25; } .villes text { font-weight: 400; font-size: 11px; fill: var(--gris); }
    .pt { fill: var(--blanc); stroke: var(--vert); stroke-width: 3; } .pt.arr { fill: var(--vert); }
    .mobile { offset-path: path('M70 240 C 140 230, 170 150, 230 130 S 320 70, 340 60'); offset-distance: 0%; animation: rouler 3.2s .4s ease-in-out forwards; }
    .cam { fill: var(--vert); } .halo { fill: var(--vert); opacity: .18; }
    @keyframes tracer { to { stroke-dashoffset: 0; } }
    @keyframes rouler { to { offset-distance: 82%; } }
    .fiche { position: absolute; display: flex; gap: 12px; align-items: center; background: var(--blanc); border-radius: 16px; padding: 12px 16px; box-shadow: 0 10px 30px rgba(20, 60, 40, .12); }
    .fiche strong { display: block; } .fiche span { font-size: var(--t-s); color: var(--gris); }
    .fiche .pic { font-size: 28px; width: 44px; height: 44px; display: grid; place-items: center; background: var(--surface-2); border-radius: 12px; }
    .f1 { left: 6%; top: 8%; } .f2 { right: 6%; bottom: 8%; } .f2 app-ic { color: var(--vert); }
    .verrou { display: inline-flex; align-items: center; gap: 4px; }
    @media (prefers-reduced-motion: reduce) { .trajet-fait { stroke-dashoffset: .18; animation: none; } .mobile { offset-distance: 82%; animation: none; } }

    /* ---------- Blocs ---------- */
    .bloc { margin-top: 72px; scroll-margin-top: 80px; }
    .bloc h2 { font-size: var(--t-xl); margin-bottom: 20px; }
    .produits { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .produit { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 16px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: 16px; color: var(--encre); text-decoration: none; }
    .produit:hover { border-color: var(--vert); }
    .produit .pic { font-size: 34px; margin-bottom: 8px; }
    .produit span:last-child { font-size: var(--t-s); color: var(--gris); }
    .verrou-ligne { display: flex; align-items: center; gap: 8px; margin-top: 16px; color: var(--gris); font-size: var(--t-s); }
    .verrou-ligne app-ic { color: var(--vert); }

    .etapes { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; position: relative; }
    .etapes::before { content: ''; position: absolute; top: 20px; left: 20px; right: 12%; height: 2px; background: var(--ligne); }
    .etapes li { position: relative; display: flex; flex-direction: column; gap: 2px; padding-right: 16px; }
    .etapes .n { width: 40px; height: 40px; border-radius: 50%; background: var(--vert); color: #fff; display: grid; place-items: center; font-weight: 700; margin-bottom: 12px; position: relative; }
    .etapes li span:last-child { color: var(--gris); font-size: var(--t-s); }

    .deux { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panneau { background: var(--blanc); border: 1px solid var(--ligne); border-radius: 20px; padding: 28px; }
    .panneau app-ic { color: var(--vert); }
    .panneau h3 { font-size: var(--t-l); margin: 12px 0 4px; }
    .panneau p { color: var(--gris); margin: 0; }

    .fin { text-align: center; padding: 48px 24px; background: var(--vert); color: #fff; border-radius: 28px; max-width: 1112px; }
    .fin h2 { color: #fff; }
    .fin .btn.primary { background: #fff; color: var(--vert); border-color: #fff; }

    @media (max-width: 860px) {
      .hero { padding-top: 28px; }
      .hero .in { grid-template-columns: 1fr; gap: 28px; }
      .etapes { grid-template-columns: 1fr 1fr; row-gap: 24px; } .etapes::before { display: none; }
      .deux { grid-template-columns: 1fr; }
      .bloc { margin-top: 52px; }
      .produits { grid-template-columns: repeat(3, 1fr); gap: 8px; } .produit { padding: 12px; } .produit .pic { font-size: 28px; margin-bottom: 4px; }
      .fiche { padding: 8px 12px; gap: 8px; } .fiche .pic { width: 34px; height: 34px; font-size: 20px; }
      .f1 { left: 4%; top: 5%; } .f2 { right: 4%; bottom: 5%; } .villes { display: none; }
      .fiche strong { font-size: var(--t-s); }
    }
  `,
})
export class LandingPage {
  private readonly pf = inject(PlateformeService);
  protected readonly session = inject(SessionService);

  /** Produits présents sur le marché, avec le nombre de vendeurs (sans prix ni nom pour les visiteurs). */
  protected readonly produits = computed(() => PRODUITS.map((p) => {
    const vendeurs = new Set(this.pf.db.offres.items().filter((o) => o.produitId === p.id && offreVisible(o)).map((o) => o.vendeurId));
    return { id: p.id, nom: p.nom.split(' ')[0], ic: visuel(p.id).ic, n: vendeurs.size };
  }).filter((p) => p.n > 0));
}
