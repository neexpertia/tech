import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CONFIG_ROLES } from '../../core/roles';
import { SessionService } from '../../core/session.service';

/** Mise en page du site public (visiteurs) : barre de navigation + pied de page. */
@Component({
  selector: 'app-public',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  <header class="nav">
    <div class="in">
      <a class="brand" routerLink="/" (click)="ouvert.set(false)"><span class="logo">🌾</span><strong>FasoAgri</strong></a>
      <button class="ghost burger" (click)="ouvert.set(!ouvert())" aria-label="Menu">☰</button>
      <nav [class.ouvert]="ouvert()" (click)="ouvert.set(false)">
        <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Accueil</a>
        <a routerLink="/decouvrir/prix" routerLinkActive="on">Prix des marchés</a>
        <a routerLink="/decouvrir/marche" routerLinkActive="on">Marché</a>
        <a routerLink="/decouvrir/observatoire" routerLinkActive="on">Observatoire</a>
        <a routerLink="/" fragment="acteurs">Pour qui ?</a>
        <a routerLink="/" fragment="comment">Comment ça marche</a>
        <span class="sep"></span>
        @if (session.utilisateur(); as u) {
          <a class="btn primary" routerLink="/accueil">{{ espace(u.role) }} →</a>
        } @else {
          <a class="btn" routerLink="/connexion">Se connecter</a>
          <a class="btn primary" routerLink="/inscription">Créer un compte</a>
        }
      </nav>
    </div>
  </header>
  <main class="public"><router-outlet /></main>
  <footer>
    <div class="in grille">
      <div><strong>🌾 FasoAgri</strong><p class="small">La place de marché agricole du Burkina Faso : prix, ventes, transport, stockage et financement.</p></div>
    
      <div><strong>Accès</strong><a routerLink="/inscription">Créer un compte</a><a routerLink="/connexion">Se connecter</a><span class="small">Sans internet : code USSD *000# (démo)</span></div>
      <div><strong>Contact</strong><span class="small">Assistance : +226 •• •• •• ••</span><span class="small">Prototype — données fictives</span></div>
    </div>
  </footer>`,
  styles: `
    .nav { position: sticky; top: 0; z-index: 30; background: var(--surface); border-bottom: 1px solid var(--border); }
    .in { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .nav .in { display: flex; align-items: center; gap: 16px; min-height: 60px; }
    .brand { display: flex; gap: 8px; align-items: center; text-decoration: none; color: var(--text); font-size: 18px; }
    .logo { font-size: 24px; }
    nav { display: flex; align-items: center; gap: 4px; flex: 1; }
    nav > a:not(.btn) { padding: 8px 12px; border-radius: 8px; text-decoration: none; color: var(--text); font-weight: 500; }
    nav > a:not(.btn):hover { background: var(--surface-2); }
    nav > a.on { color: var(--primary); }
    .sep { flex: 1; }
    .burger { display: none; margin-left: auto; font-size: 20px; }
    main.public { min-height: calc(100vh - 60px); }
    footer { background: #13301f; color: #d9e6dd; padding: 32px 0; margin-top: 40px; }
    footer .grille { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 24px; }
    footer a, footer span { display: block; color: #d9e6dd; text-decoration: none; margin-top: 6px; }
    footer a:hover { text-decoration: underline; }
    @media (max-width: 860px) {
      .burger { display: inline-flex; }
      nav { display: none; position: absolute; top: 60px; left: 0; right: 0; background: var(--surface); flex-direction: column; align-items: stretch; padding: 10px 16px 16px; border-bottom: 1px solid var(--border); }
      nav.ouvert { display: flex; }
      .sep { display: none; }
      footer .grille { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class PublicLayout {
  protected readonly session = inject(SessionService);
  protected readonly ouvert = signal(false);
  espace(role: keyof typeof CONFIG_ROLES) { return CONFIG_ROLES[role].espace; }
}
