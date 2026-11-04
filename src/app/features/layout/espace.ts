import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlateformeService } from '../../core/plateforme.service';
import { AchatService } from '../../core/achat.service';
import { CONFIG_ROLES } from '../../core/roles';
import { LIBELLE_ROLE, SessionService } from '../../core/session.service';
import { IconeComponent } from '../../shared/icone';

/** Mise en page de l'espace connecté : menu propre au rôle de l'utilisateur. */
@Component({
  selector: 'app-espace',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconeComponent],
  template: `
  @let moi = session.utilisateur()!;
  <div class="shell" [class.open]="menuOuvert()">
    <aside>
      <a class="brand" routerLink="/"><span class="logo" aria-hidden="true"><app-ic n="pousse" [taille]="22" /></span><span><strong>FasoAgri</strong><span class="vision">Du champ à votre porte</span></span></a>
      <nav>
        @for (g of config().menu; track g.titre) {
          <div class="gt">{{ g.titre }}</div>
          @for (l of g.liens; track l.label) {
            <a [routerLink]="l.route" [queryParams]="l.query ?? {}" routerLinkActive="active"
               [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' }"
               (click)="menuOuvert.set(false)"><app-ic [n]="l.icone" [taille]="19" />{{ l.label }}</a>
          }
        }
      </nav>
      <div class="foot"><a routerLink="/">Site public</a><span>Prototype, données fictives</span></div>
    </aside>
    <div class="col">
      <header class="top">
        <button class="ghost burger" (click)="menuOuvert.set(!menuOuvert())" aria-label="Menu"><app-ic n="menu" /></button>
        @if (moi.role === 'vendeur') {
          <div class="bascule" role="group" aria-label="Espace">
            <button [class.on]="session.mode() === 'achat'" [attr.aria-pressed]="session.mode() === 'achat'" (click)="session.changerMode('achat')"><app-ic n="marche" [taille]="18" />Acheter</button>
            <button [class.on]="session.mode() === 'vente'" [attr.aria-pressed]="session.mode() === 'vente'" (click)="session.changerMode('vente')"><app-ic n="pousse" [taille]="18" />Vendre @if (aFaireVendeur()) { <i>{{ aFaireVendeur() }}</i> }</button>
          </div>
        } @else if (moi.role === 'acheteur') {
          <a class="btn devenir" routerLink="/devenir-vendeur"><app-ic n="pousse" [taille]="18" />Devenir vendeur</a>
        }
        <div class="spacer"></div>
        @if (session.peutAcheter()) {
          <a class="ico" routerLink="/messages" aria-label="Messages"><app-ic n="messages" />@if (achat.nbNonLus()) { <span class="pastille">{{ achat.nbNonLus() }}</span> }</a>
          <a class="ico" routerLink="/panier" aria-label="Panier"><app-ic n="panier" />@if (achat.nbPanier()) { <span class="pastille">{{ achat.nbPanier() }}</span> }</a>
        }
        <a class="ico" routerLink="/alertes" aria-label="Alertes"><app-ic n="alertes" />@if (pf.nonLues()) { <span class="pastille">{{ pf.nonLues() }}</span> }</a>
        <a class="moi" routerLink="/profil" [attr.aria-label]="'Mon profil : ' + moi.nom">
          <span class="avatar">{{ moi.nom.charAt(0) }}</span>
          <span class="who">{{ moi.nom }}</span>
        </a>
        <button class="ghost" (click)="session.deconnecter()" aria-label="Se déconnecter" title="Se déconnecter"><app-ic n="sortie" /></button>
      </header>
      @if (moi.kyc !== 'verifie' && session.espace() === 'vendeur') {
        <div class="bandeau">Vos pièces sont en cours de vérification. <a routerLink="/profil">Compléter mon profil</a></div>
      }
      <main [class.avec-onglets]="onglets()"><router-outlet /></main>
      @if (session.espace() === 'vendeur') {
        <nav class="onglets" aria-label="Navigation vendeur">
          <a routerLink="/accueil" routerLinkActive="on"><span><app-ic n="accueil" /></span>Accueil</a>
          <a routerLink="/marche" [queryParams]="{ vue: 'mes' }" routerLinkActive="on"><span><app-ic n="panier" /></span>Produits</a>
          <a routerLink="/marche/nouvelle" routerLinkActive="on"><span><app-ic n="pousse" /></span>Publier</a>
          <a routerLink="/commandes" routerLinkActive="on"><span><app-ic n="commandes" />@if (aFaireVendeur()) { <i>{{ aFaireVendeur() }}</i> }</span>Commandes</a>
          <a routerLink="/messages" routerLinkActive="on"><span><app-ic n="messages" />@if (achat.nbNonLus()) { <i>{{ achat.nbNonLus() }}</i> }</span>Messages</a>
        </nav>
      } @else if (onglets()) {
        <nav class="onglets" aria-label="Navigation">
          <a routerLink="/accueil" routerLinkActive="on"><span><app-ic n="accueil" /></span>Accueil</a>
          <a routerLink="/marche" routerLinkActive="on"><span><app-ic n="marche" /></span>Marché</a>
          <a routerLink="/panier" routerLinkActive="on"><span><app-ic n="panier" />@if (achat.nbPanier()) { <i>{{ achat.nbPanier() }}</i> }</span>Panier</a>
          <a routerLink="/messages" routerLinkActive="on"><span><app-ic n="messages" />@if (achat.nbNonLus()) { <i>{{ achat.nbNonLus() }}</i> }</span>Messages</a>
          <a routerLink="/commandes" routerLinkActive="on"><span><app-ic n="commandes" /></span>Commandes</a>
        </nav>
      }
    </div>
  </div>`,
  styleUrl: './espace.scss',
})
export class EspaceLayout {
  protected readonly session = inject(SessionService);
  protected readonly pf = inject(PlateformeService);
  protected readonly achat = inject(AchatService);
  protected readonly menuOuvert = signal(false);
  protected readonly libelleRole = LIBELLE_ROLE;
  protected readonly config = computed(() => {
    const c = CONFIG_ROLES[this.session.espace()];
    // Un vendeur en mode « Acheter » n'a plus besoin du lien « Devenir vendeur »
    if (this.session.role() !== 'vendeur') return c;
    return { ...c, menu: c.menu.map((g) => ({ ...g, liens: g.liens.filter((l) => l.route !== '/devenir-vendeur') })).filter((g) => g.liens.length) };
  });
  /** Barre d'onglets en bas (téléphone) pour les deux profils */
  protected readonly onglets = computed(() => ['acheteur', 'vendeur'].includes(this.session.role() ?? ''));
  /** Commandes reçues qui attendent une action du vendeur */
  protected readonly aFaireVendeur = computed(() => {
    const id = this.session.utilisateur()?.id;
    return this.pf.db.commandes.items().filter((c) => c.vendeurId === id && ['attente_confirmation', 'sequestre'].includes(c.statut)).length;
  });

  constructor() {
    // Délais de confirmation (24 h) : annulations automatiques. Côté backend : tâche planifiée.
    this.pf.verifierDelais();
    const t = setInterval(() => this.pf.verifierDelais(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }
}
