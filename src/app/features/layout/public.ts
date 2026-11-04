import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { IconeComponent } from '../../shared/icone';
import { CONFIG_ROLES } from '../../core/roles';
import { SessionService } from '../../core/session.service';

/** Mise en page du site public (visiteurs) : barre de navigation + pied de page. */
@Component({
  selector: 'app-public',
  imports: [RouterOutlet, RouterLink, IconeComponent],
  template: `
  <header class="nav">
    <div class="in">
      <a class="brand" routerLink="/"><span class="logo"><app-ic n="pousse" [taille]="20" /></span><strong>FasoAgri</strong></a>
      <span class="sep"></span>
      <a class="lien" routerLink="/" fragment="comment">Comment ça marche</a>
      @if (session.utilisateur()) {
        <a class="btn primary" routerLink="/accueil">Mon espace</a>
      } @else {
        <a class="btn" routerLink="/connexion">Se connecter</a>
        <a class="btn primary large-only" routerLink="/inscription">Créer un compte</a>
      }
    </div>
  </header>
  <main class="public"><router-outlet /></main>
  <footer>
    <div class="in">
      <span><strong>FasoAgri</strong> · Du champ à votre porte</span>
      <span>Sans internet : *000# (démo)</span>
      <span>Prototype, données fictives</span>
    </div>
  </footer>`,
  styles: `
    .nav { position: sticky; top: 0; z-index: 30; background: color-mix(in srgb, var(--fond) 88%, transparent); backdrop-filter: blur(8px); }
    .in { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .nav .in { display: flex; align-items: center; gap: 8px; min-height: 68px; }
    .brand { display: flex; gap: 10px; align-items: center; text-decoration: none; color: var(--encre); font-size: var(--t-l); }
    .logo { width: 34px; height: 34px; border-radius: 10px; background: var(--vert); color: #fff; display: grid; place-items: center; }
    .sep { flex: 1; }
    .lien { color: var(--encre); text-decoration: none; padding: 8px 12px; }
    main.public { min-height: calc(100vh - 140px); }
    footer { margin-top: 72px; padding: 28px 0; border-top: 1px solid var(--ligne); }
    footer .in { display: flex; gap: 24px; flex-wrap: wrap; justify-content: space-between; font-size: var(--t-s); color: var(--gris); }
    @media (max-width: 640px) { .lien, .large-only { display: none; } .nav .btn { padding: 7px 12px; white-space: nowrap; } }
  `,
})
export class PublicLayout {
  protected readonly session = inject(SessionService);
  protected readonly ouvert = signal(false);
  espace(role: keyof typeof CONFIG_ROLES) { return CONFIG_ROLES[role].espace; }
}
