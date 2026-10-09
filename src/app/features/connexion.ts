import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DbService } from '../core/api/db.service';
import { ACTEURS } from '../core/roles';
import { Role } from '../core/models';
import { LIBELLE_ROLE, SessionService } from '../core/session.service';
import { UI } from '../shared/ui';

const ORDRE: Role[] = [...ACTEURS, 'admin'];

@Component({
  selector: 'app-connexion',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="wrap">
    <div class="intro">
      <div class="logo">🌾</div>
      <h1>FasoAgri</h1>
      <p>Vendre, acheter, transporter, stocker et financer les produits agricoles au Burkina Faso — avec les prix des marchés et un paiement sécurisé par Mobile Money.</p>
      <div class="card otp">
        <h3>Connexion</h3>
        <label class="field">Numéro de téléphone
          <input type="tel" placeholder="+226 7• •• •• ••" [(ngModel)]="tel" />
        </label>
        <button class="primary" disabled title="Branché au backend (envoi d’un code SMS)">Recevoir un code par SMS</button>
        <p class="small">Pas encore de compte ? <a routerLink="/inscription">Créer un compte gratuit</a></p>
        <p class="hint" style="margin-top:8px">En production : connexion par code SMS à usage unique (pas de mot de passe à retenir). Accessible aussi par USSD pour les téléphones simples.</p>
      </div>
    </div>
    <div class="comptes">
      <h2>Comptes de démonstration</h2>
      <p class="small">Chaque acteur a son propre espace : menu, tableau de bord et outils adaptés à ses besoins.</p>
      <p class="muted small">Choisissez un acteur pour voir la plateforme de son point de vue. Données fictives.</p>
      <input type="search" placeholder="Filtrer (nom, rôle, ville)…" [(ngModel)]="filtre" style="width:100%;margin-bottom:12px" />
      @for (g of groupes(); track g.role) {
        <div class="gt">{{ libelle[g.role] }}</div>
        <div class="grille">
          @for (u of g.users; track u.id) {
            <button class="compte" (click)="session.connecter(u.id)">
              <span class="av">{{ u.nom.charAt(0) }}</span>
              <span><strong>{{ u.nom }}</strong><br /><span class="small muted">@if (u.categorie) { {{ u.categorie }} · }{{ u.localiteId | loc }}@if (u.kyc !== 'verifie') { · <span class="badge warn">non vérifié</span> }</span></span>
            </button>
          }
        </div>
      }
    </div>
  </div>`,
  styles: `
    .wrap { display: grid; grid-template-columns: 380px 1fr; min-height: calc(100vh - 60px); }
    .intro { background: linear-gradient(160deg, var(--primary), #0f4a30); color: #fff; padding: 40px 32px; display: flex; flex-direction: column; gap: 12px; }
    .intro h1 { font-size: 2rem; margin: 0; } .logo { font-size: 44px; }
    .intro p { opacity: .9; font-size: 15px; }
    .otp { color: var(--text); margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
    .comptes { padding: 32px; overflow: auto; max-height: calc(100vh - 60px); }
    .gt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 14px 0 6px; }
    .grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
    .compte { display: flex; gap: 10px; align-items: center; text-align: left; padding: 10px; }
    .av { width: 34px; height: 34px; border-radius: 50%; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; font-weight: 700; flex: none; }
    @media (max-width: 800px) { .wrap { grid-template-columns: 1fr; } .comptes { max-height: none; padding: 16px; } .intro { padding: 24px 16px; } }
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

  protected readonly groupes = computed(() => {
    const f = this._filtre().toLowerCase();
    const us = this.db.utilisateurs.items().filter((u) => !f || `${u.nom} ${LIBELLE_ROLE[u.role]} ${u.localiteId}`.toLowerCase().includes(f));
    return ORDRE.map((role) => ({ role, users: us.filter((u) => u.role === role) })).filter((g) => g.users.length);
  });
}
