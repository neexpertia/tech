import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DbService } from '../core/api/db.service';
import { Role } from '../core/models';
import { LIBELLE_ROLE, SessionService } from '../core/session.service';
import { UI } from '../shared/ui';
import { IconeComponent } from '../shared/icone';

/** Acheteurs en premier : c'est le profil de départ de tout nouvel inscrit. */
const ORDRE: Role[] = ['acheteur', 'vendeur', 'admin'];

@Component({
  selector: 'app-connexion',
  imports: [FormsModule, RouterLink, IconeComponent, ...UI],
  template: `
  <div class="wrap">
    <h1>Se connecter</h1>
    <div class="card">
      <label class="field">Numéro de téléphone<input type="tel" placeholder="+226 •• •• •• ••" [(ngModel)]="tel" /></label>
      <button class="primary large" disabled title="Branché au backend (envoi d’un code SMS)">Recevoir un code par SMS</button>
      <p class="small muted">Pas de mot de passe : un code arrive par SMS. Pas encore inscrit ? <a routerLink="/inscription">Créer un compte</a></p>
    </div>

    <h2 class="section">Comptes de démonstration</h2>
    <div class="chips">
      @for (g of groupes(); track g.role) { <button class="chip" [class.on]="onglet() === g.role" (click)="onglet.set(g.role)">{{ g.role === 'admin' ? 'Équipe' : libelle[g.role] + 's' }} ({{ g.users.length }})</button> }
    </div>
    <div class="comptes">
      @for (u of liste(); track u.id) {
        <button class="compte" (click)="session.connecter(u.id)">
          <span class="av">{{ u.nom.charAt(0) }}</span>
          <span class="t"><strong>{{ u.nom }}</strong><span>{{ u.localiteId | loc }}</span></span>
          <app-ic n="sortie" [taille]="18" class="go" />
        </button>
      }
    </div>
  </div>`,
  styles: `
    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .card { display: flex; flex-direction: column; gap: 12px; }
    .large { justify-content: center; padding: 11px; }
    .card p { margin: 0; }
    .chips { margin-bottom: 12px; }
    .comptes { display: flex; flex-direction: column; gap: 8px; }
    .compte { display: flex; gap: 12px; align-items: center; text-align: left; padding: 10px 14px; font-weight: 400; }
    .t { flex: 1; display: flex; flex-direction: column; } .t span { font-size: var(--t-s); color: var(--gris); }
    .av { width: 36px; height: 36px; border-radius: 50%; background: var(--vert-pale); color: var(--vert); display: grid; place-items: center; font-weight: 700; flex: none; }
    .go { color: var(--gris); transform: scaleX(-1); }
  `,
})
export class ConnexionPage {
  protected readonly session = inject(SessionService);
  private readonly db = inject(DbService);
  protected readonly libelle = LIBELLE_ROLE;
  protected tel = '';
  private readonly _filtre = signal('');
  get filtre() { return this._filtre(); }
  set filtre(v: string) { this._filtre.set(v); }

  protected readonly onglet = signal<Role>('acheteur');
  protected readonly liste = computed(() => this.groupes().find((g) => g.role === this.onglet())?.users ?? []);
  protected readonly groupes = computed(() => {
    const f = this._filtre().toLowerCase();
    const us = this.db.utilisateurs.items().filter((u) => !f || `${u.nom} ${LIBELLE_ROLE[u.role]} ${u.localiteId}`.toLowerCase().includes(f));
    return ORDRE.map((role) => ({ role, users: us.filter((u) => u.role === role) })).filter((g) => g.users.length);
  });
}
