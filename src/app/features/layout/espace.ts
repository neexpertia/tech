import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlateformeService } from '../../core/plateforme.service';
import { CONFIG_ROLES } from '../../core/roles';
import { LIBELLE_ROLE, SessionService } from '../../core/session.service';

/** Mise en page de l'espace connecté : menu propre au rôle de l'utilisateur. */
@Component({
  selector: 'app-espace',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  @let moi = session.utilisateur()!;
  <div class="shell" [class.open]="menuOuvert()">
    <aside>
      <a class="brand" routerLink="/"><span class="logo">🌾</span><div><strong>FasoAgri</strong><div class="small muted">Marchés agricoles · Burkina Faso</div></div></a>
      <div class="espace"><span class="em">{{ config().emoji }}</span><div><strong>{{ config().espace }}</strong><div class="small muted">{{ config().accroche }}</div></div></div>
      <nav>
        @for (g of config().menu; track g.titre) {
          <div class="gt">{{ g.titre }}</div>
          @for (l of g.liens; track l.label) {
            <a [routerLink]="l.route" [queryParams]="l.query ?? {}" routerLinkActive="active"
               [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' }"
               (click)="menuOuvert.set(false)"><span class="ic" aria-hidden="true">{{ l.icone }}</span>{{ l.label }}</a>
          }
        }
      </nav>
      <div class="foot small muted">
        <a class="visiteur" routerLink="/">← Site public</a><br />Prototype · données fictives
      </div>
    </aside>
    <div class="col">
      <header class="top">
        <button class="ghost burger" (click)="menuOuvert.set(!menuOuvert())" aria-label="Menu">☰</button>
        <div class="spacer"></div>
        <a class="cloche" routerLink="/notifications" aria-label="Notifications">🔔 @if (pf.nonLues()) { <span class="pastille">{{ pf.nonLues() }}</span> }</a>
        <a class="moi" routerLink="/profil">
          <span class="avatar">{{ moi.nom.charAt(0) }}</span>
          <span class="who"><strong>{{ moi.nom }}</strong><span class="small muted">{{ libelleRole[moi.role] }}@if (moi.categorie) { · {{ moi.categorie }} }</span></span>
        </a>
        <button class="ghost small" (click)="session.deconnecter()" title="Se déconnecter / changer de compte">⏻</button>
      </header>
      @if (moi.kyc !== 'verifie') {
        <div class="bandeau">Compte en attente de vérification : vous pouvez consulter, mais publier et payer nécessitent la validation de vos pièces. <a routerLink="/profil">Compléter mon profil →</a></div>
      }
      <main><router-outlet /></main>
    </div>
  </div>`,
  styleUrl: './espace.scss',
})
export class EspaceLayout {
  protected readonly session = inject(SessionService);
  protected readonly pf = inject(PlateformeService);
  protected readonly menuOuvert = signal(false);
  protected readonly libelleRole = LIBELLE_ROLE;
  protected readonly config = computed(() => CONFIG_ROLES[this.session.role() ?? 'producteur']);
}
