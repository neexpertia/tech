import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LOCALITES } from '../core/data/referentiel';
import { Utilisateur } from '../core/models';
import { PlateformeService } from '../core/plateforme.service';
import { LIBELLE_ROLE, SessionService } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-profil',
  imports: [FormsModule, ...UI],
  template: `
  @let u = moi();
  <div class="page">
    <div class="page-head"><div><div class="eyebrow">{{ libelle[u.role] }}</div><h1>{{ u.nom }}</h1><p>Membre depuis le {{ u.inscritLe }}</p></div>
      <span class="badge" [class.ok]="u.kyc === 'verifie'" [class.warn]="u.kyc === 'en_attente'" [class.ko]="u.kyc === 'rejete'">{{ u.kyc === 'verifie' ? '✔ identité vérifiée' : u.kyc === 'en_attente' ? 'vérification en attente' : 'vérification refusée' }}</span></div>
    <div class="split">
      <div class="card">
        <h2>Informations</h2>
        <div class="form-grid">
          <label class="field">Nom / raison sociale<input [ngModel]="u.nom" (change)="maj({ nom: val($event) })" /></label>
          <label class="field">Téléphone (Mobile Money)<input [ngModel]="u.telephone" (change)="maj({ telephone: val($event) })" /></label>
          <label class="field">Localité<select [ngModel]="u.localiteId" (ngModelChange)="maj({ localiteId: $event })">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
          <label class="field">Langue des messages vocaux / SMS
            <select [ngModel]="u.langue" (ngModelChange)="maj({ langue: $event })"><option value="fr">Français</option><option value="mos">Mooré</option><option value="dyu">Dioula</option><option value="ful">Fulfuldé</option></select></label>
          @if (u.role === 'cooperative') { <label class="field">Nombre de membres<input type="number" [ngModel]="u.membres" (change)="maj({ membres: +val($event) })" /></label> }
          @if (u.role === 'transporteur') { <label class="field">Charge utile (t)<input type="number" step="0.5" [ngModel]="u.capaciteT" (change)="maj({ capaciteT: +val($event) })" /></label> }
        </div>
        <h3 class="section">Pièces justificatives</h3>
        <ul class="ticks small">@for (p of u.pieces; track p) { <li>{{ p }}</li> } @empty { <li class="muted">Aucune pièce fournie.</li> }</ul>
        <div class="toolbar" style="margin-top:8px">
          <select [(ngModel)]="piece"><option>CNIB</option><option>Passeport</option><option>RCCM</option><option>IFU</option><option>Récépissé OHADA/SCOOPS</option><option>Carte grise</option><option>Agrément</option></select>
          <button (click)="ajouterPiece()">＋ Ajouter (téléversement côté backend)</button>
        </div>
      </div>
      <div class="card">
        @let s = score();
        <h2>Réputation</h2>
        <p><app-etoiles [note]="s.noteMoyenne" /> {{ s.noteMoyenne | nb: 1 }}/5 · {{ s.nbAvis }} avis</p>
        <p>Score de confiance : <strong>{{ s.grade }} · {{ s.valeur }}/100</strong></p>
        <p class="small">{{ s.ventes }} vente(s) · {{ s.achats }} achat(s) · {{ s.litiges }} litige(s)</p>
        <ul class="clean small">@for (a of avis(); track a.id) { <li><app-etoiles [note]="a.note" /> « {{ a.commentaire }} » — {{ a.auteurId | qui }}</li> }</ul>
        <h3 class="section">Données de démonstration</h3>
        <p class="small muted">Les actions que vous faites sont enregistrées dans ce navigateur. Vous pouvez tout remettre à zéro.</p>
        <button class="danger" (click)="reinit()">↺ Réinitialiser les données de démo</button>
      </div>
    </div>
  </div>`,
})
export class ProfilPage {
  private readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  protected readonly libelle = LIBELLE_ROLE;
  protected piece = 'CNIB';
  protected readonly moi = computed(() => this.session.utilisateur()!);
  protected readonly score = computed(() => this.pf.score(this.moi().id));
  protected readonly avis = computed(() => this.pf.db.avis.items().filter((a) => a.cibleId === this.moi().id));

  val(e: Event) { return (e.target as HTMLInputElement).value; }

  async maj(p: Partial<Utilisateur>) {
    await this.pf.db.utilisateurs.update(this.moi().id, p);
    this.toast.afficher('Profil mis à jour.');
  }

  async ajouterPiece() {
    const u = this.moi();
    if (u.pieces.includes(this.piece)) return;
    await this.pf.db.utilisateurs.update(u.id, { pieces: [...u.pieces, this.piece], kyc: u.kyc === 'rejete' ? 'en_attente' : u.kyc });
    await this.pf.notifier('U-ADM', `${u.nom} a fourni une pièce (${this.piece}) à vérifier.`, '/admin');
    this.toast.afficher('Pièce ajoutée, en attente de vérification.');
  }

  reinit() {
    if (!confirm('Remettre toutes les données de démonstration à zéro ?')) return;
    this.pf.db.reinitialiserDemo();
    location.reload();
  }
}
