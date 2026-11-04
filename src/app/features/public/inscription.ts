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
  acheteur: ['Plus tard', 'CNIB', 'RCCM', 'IFU'],
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
    <p class="muted">Gratuit, en 1 minute. Vous commencez comme acheteur ; vous pourrez vendre plus tard avec le même compte.</p>
    <div class="card">
      <div class="form-grid">
        <label class="field">Nom et prénom (ou nom de votre structure)<input [(ngModel)]="f.nom" /></label>
        <label class="field">Téléphone Mobile Money<input type="tel" [(ngModel)]="f.telephone" placeholder="+226 •• •• •• ••" /></label>
        <label class="field">Ville<select [(ngModel)]="f.localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
        <label class="field">Langue<select [(ngModel)]="f.langue"><option value="fr">Français</option><option value="mos">Mooré</option><option value="dyu">Dioula</option><option value="ful">Fulfuldé</option></select></label>
        <label class="field full">Vous achetez pour<select [(ngModel)]="f.categorie">@for (c of categories; track c) { <option [value]="c">{{ c }}</option> }</select></label>
      </div>
      <div class="actions">
        <button class="primary" [disabled]="!f.nom.trim() || !f.telephone.trim()" (click)="creer()">Créer mon compte</button>
      </div>
    </div>
    <p class="small" style="margin-top:16px">Déjà inscrit ? <a routerLink="/connexion">Se connecter</a></p>
  </div>`,
  styles: `
    .wrap { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
    .roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-top: 12px; }
    .role { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; }
    .role.on { border-color: var(--primary); background: var(--primary-soft); }
    .role.principal { width: 100%; margin-top: 12px; padding: 16px; border-color: var(--primary); background: var(--primary-soft); }
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
  protected readonly autres = ORDRE.filter((r) => r !== 'acheteur');
  /** Tout le monde arrive comme acheteur ; les profils professionnels restent accessibles. */
  protected readonly role = signal<Role>('acheteur');
  protected readonly etape = signal<1 | 2>(2);
  protected readonly categories: CategorieAcheteur[] = ['Particulier / ménage', 'Grossiste / commerçant', 'Transformateur', 'Hôtel / restaurant', 'Exportateur', 'Supermarché / distributeur'];
  protected f = { nom: '', telephone: '', localiteId: 'OUA', langue: 'fr' as Utilisateur['langue'], membres: 50, capaciteT: 10, piece: 'Plus tard', categorie: 'Particulier / ménage' as CategorieAcheteur };

  /** Deux profils : on s'inscrit toujours comme acheteur (« Devenir vendeur » ensuite). */
  ngOnInit() { this.role.set('acheteur'); }

  protected readonly estOrganisation = computed(() => !['producteur', 'acheteur'].includes(this.role()) || (this.role() === 'acheteur' && this.f.categorie !== 'Particulier / ménage'));
  protected readonly pieces = computed(() => PIECES[this.role()] ?? ['RCCM', 'IFU', 'CNIB']);

  choisir(r: Role) { this.role.set(r); this.etape.set(2); this.f.piece = this.pieces()[0]; }

  async creer() {
    const r = this.role();
    const u = await this.pf.db.utilisateurs.create({
      nom: this.f.nom.trim(), role: r, telephone: this.f.telephone.trim(), localiteId: this.f.localiteId, langue: this.f.langue,
      kyc: 'en_attente', pieces: this.f.piece === 'Plus tard' ? [] : [this.pieces().includes(this.f.piece) ? this.f.piece : this.pieces()[0]], inscritLe: aujourdhui(),
      ...(r === 'cooperative' ? { membres: this.f.membres } : {}), ...(r === 'transporteur' ? { capaciteT: this.f.capaciteT } : {}), ...(r === 'acheteur' ? { categorie: this.f.categorie } : {}),
      ...(this.estOrganisation() ? { organisation: this.f.nom.trim() } : {}),
    });
    await this.pf.notifier('U-ADM', `Nouvelle inscription à vérifier : ${u.nom} (${CONFIG_ROLES[r].espace}).`, '/admin');
    await this.pf.notifier(u.id, r === 'acheteur' ? 'Bienvenue sur FasoAgri ! Parcourez le marché, ajoutez des favoris et discutez avec les vendeurs.' : 'Bienvenue sur FasoAgri ! Votre compte sera vérifié sous 48 h.', r === 'acheteur' ? '/marche' : '/profil', 'compte');
    this.session.connecter(u.id);
  }
}
