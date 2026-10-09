import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LOCALITES } from '../../core/data/referentiel';
import { CategorieAcheteur, Role, Utilisateur } from '../../core/models';
import { PlateformeService, aujourdhui } from '../../core/plateforme.service';
import { ACTEURS, CONFIG_ROLES } from '../../core/roles';
import { SessionService } from '../../core/session.service';

const ORDRE: Role[] = [...ACTEURS];

const PIECES: Partial<Record<Role, string[]>> = {
  producteur: ['CNIB', 'Carte de producteur'],
  cooperative: ['Récépissé OHADA/SCOOPS', 'PV d’assemblée générale'],
  transporteur: ['Carte grise', 'Assurance', 'CNIB'],
  acheteur: ['RCCM', 'IFU', 'CNIB'],
  collecteur: ['CNIB', 'Carte de commerçant'],
  institution: ['Lettre de mission'],
  entrepot: ['Agrément magasin', 'RCCM'],
};

@Component({
  selector: 'app-inscription',
  imports: [FormsModule, RouterLink],
  template: `
  <div class="wrap">
    <h1>Créer mon compte</h1>
    <p class="muted">Étape {{ etape() }} / 2 — {{ etape() === 1 ? 'Qui êtes-vous ?' : 'Vos informations' }}</p>

    @if (etape() === 1) {
      <div class="roles">
        @for (r of ordre; track r) {
          <button class="role" [class.on]="role() === r" (click)="role.set(r); etape.set(2)">
            <span class="em">{{ config[r].emoji }}</span>
            <span><strong>{{ config[r].espace.replace('Espace ', '') }}</strong><br /><span class="small muted">{{ config[r].accroche }}</span></span>
          </button>
        }
      </div>
    } @else {
      @let c = config[role()];
      <div class="card">
        <div class="choix"><span class="em">{{ c.emoji }}</span><div><strong>{{ c.espace }}</strong><div class="small muted">{{ c.accroche }}</div></div>
          <button class="ghost small" (click)="etape.set(1)">Changer</button></div>
        <div class="form-grid" style="margin-top:14px">
          <label class="field">{{ estOrganisation() ? 'Nom de la structure' : 'Nom et prénom' }}<input [(ngModel)]="f.nom" /></label>
          <label class="field">Téléphone (Mobile Money)<input type="tel" [(ngModel)]="f.telephone" placeholder="+226 •• •• •• ••" /></label>
          <label class="field">Localité<select [(ngModel)]="f.localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }} ({{ l.province }})</option> }</select></label>
          <label class="field">Langue préférée<select [(ngModel)]="f.langue"><option value="fr">Français</option><option value="mos">Mooré</option><option value="dyu">Dioula</option><option value="ful">Fulfuldé</option></select></label>
          @if (role() === 'acheteur') {
            <label class="field">Votre métier<select [(ngModel)]="f.categorie">@for (c of categories; track c) { <option [value]="c">{{ c }}</option> }</select></label>
          }
          @if (role() === 'cooperative') { <label class="field">Nombre de membres<input type="number" min="1" [(ngModel)]="f.membres" /></label> }
          @if (role() === 'transporteur') { <label class="field">Charge utile du véhicule (t)<input type="number" min="0.5" step="0.5" [(ngModel)]="f.capaciteT" /></label> }
          <label class="field">Pièce justificative<select [(ngModel)]="f.piece">@for (p of pieces(); track p) { <option>{{ p }}</option> }</select></label>
        </div>
        <p class="hint" style="margin-top:10px">En production, un code SMS confirme votre numéro et la pièce est téléversée. Votre compte est vérifié par l’équipe avant de pouvoir publier et payer.</p>
        <div class="actions">
          <button (click)="etape.set(1)">← Retour</button>
          <button class="primary" [disabled]="!f.nom.trim() || !f.telephone.trim()" (click)="creer()">Créer mon espace</button>
        </div>
      </div>
    }
    <p class="small" style="margin-top:16px">Déjà inscrit ? <a routerLink="/connexion">Se connecter</a></p>
  </div>`,
  styles: `
    .wrap { max-width: 900px; margin: 0 auto; padding: 32px 20px; }
    .roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-top: 12px; }
    .role { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; }
    .role.on { border-color: var(--primary); background: var(--primary-soft); }
    .em { font-size: 26px; }
    .choix { display: flex; gap: 12px; align-items: center; } .choix > div { flex: 1; }
  `,
})
export class InscriptionPage {
  /** Rôle pré-sélectionné via ?role= */
  readonly roleParam = input<string>('', { alias: 'role' });
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  protected readonly ordre = ORDRE;
  protected readonly config = CONFIG_ROLES;
  protected readonly localites = LOCALITES;
  protected readonly role = signal<Role>('producteur');
  protected readonly etape = signal<1 | 2>(1);
  protected readonly categories: CategorieAcheteur[] = ['Grossiste / commerçant', 'Transformateur', 'Hôtel / restaurant', 'Exportateur', 'Supermarché / distributeur'];
  protected f = { nom: '', telephone: '', localiteId: 'OUA', langue: 'fr' as Utilisateur['langue'], membres: 50, capaciteT: 10, piece: 'CNIB', categorie: 'Grossiste / commerçant' as CategorieAcheteur };

  ngOnInit() {
    const r = this.roleParam() as Role;
    if (r && ORDRE.includes(r)) { this.role.set(r); this.etape.set(2); }
  }

  protected readonly estOrganisation = computed(() => !['producteur'].includes(this.role()));
  protected readonly pieces = computed(() => PIECES[this.role()] ?? ['RCCM', 'IFU', 'CNIB']);

  async creer() {
    const r = this.role();
    const u = await this.pf.db.utilisateurs.create({
      nom: this.f.nom.trim(), role: r, telephone: this.f.telephone.trim(), localiteId: this.f.localiteId, langue: this.f.langue,
      kyc: 'en_attente', pieces: [this.pieces().includes(this.f.piece) ? this.f.piece : this.pieces()[0]], inscritLe: aujourdhui(),
      ...(r === 'cooperative' ? { membres: this.f.membres } : {}), ...(r === 'transporteur' ? { capaciteT: this.f.capaciteT } : {}), ...(r === 'acheteur' ? { categorie: this.f.categorie } : {}),
      ...(this.estOrganisation() ? { organisation: this.f.nom.trim() } : {}),
    });
    await this.pf.notifier('U-ADM', `Nouvelle inscription à vérifier : ${u.nom} (${CONFIG_ROLES[r].espace}).`, '/admin');
    await this.pf.notifier(u.id, `Bienvenue sur FasoAgri ! Votre compte sera vérifié sous 48 h.`, '/profil');
    this.session.connecter(u.id);
  }
}
