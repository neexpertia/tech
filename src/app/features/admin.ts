import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, REGIONS } from '../core/data/referentiel';
import { Utilisateur } from '../core/models';
import { PlateformeService } from '../core/plateforme.service';
import { LIBELLE_ROLE } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-admin',
  imports: [RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head"><div><div class="eyebrow">Administration</div><h1>Comptes, litiges et référentiels</h1></div></div>
    <div class="tabs">
      <button [class.on]="onglet() === 'kyc'" (click)="onglet.set('kyc')">Vérifications ({{ attente().length }})</button>
      <button [class.on]="onglet() === 'comptes'" (click)="onglet.set('comptes')">Comptes ({{ pf.db.utilisateurs.items().length }})</button>
      <button [class.on]="onglet() === 'litiges'" (click)="onglet.set('litiges')">Litiges ({{ litiges().length }})</button>
      <button [class.on]="onglet() === 'ref'" (click)="onglet.set('ref')">Référentiels</button>
    </div>
    @switch (onglet()) {
      @case ('kyc') {
        <div class="grid g2">
          @for (u of attente(); track u.id) {
            <div class="card">
              <h3>{{ u.nom }}</h3>
              <p class="small">{{ libelle[u.role] }} · {{ u.localiteId | loc }} · {{ u.telephone }} · inscrit le {{ u.inscritLe }}</p>
              <p class="small">Pièces : @for (p of u.pieces; track p) { <span class="badge">{{ p }}</span> } @empty { <span class="badge ko">aucune</span> }</p>
              <div class="actions"><button class="danger" (click)="kyc(u, 'rejete')">Refuser</button><button class="primary" [disabled]="!u.pieces.length" (click)="kyc(u, 'verifie')">Valider</button></div>
            </div>
          } @empty { <div class="vide card">Aucun compte en attente.</div> }
        </div>
      }
      @case ('comptes') {
        <div class="table-wrap"><table>
          <thead><tr><th>Nom</th><th>Rôle</th><th>Localité</th><th>Téléphone</th><th>KYC</th><th>Score</th></tr></thead>
          <tbody>@for (u of pf.db.utilisateurs.items(); track u.id) {
            <tr><td>{{ u.nom }}</td><td class="small">{{ libelle[u.role] }}</td><td class="small">{{ u.localiteId | loc }}</td><td class="small">{{ u.telephone }}</td>
              <td><span class="badge" [class.ok]="u.kyc === 'verifie'" [class.warn]="u.kyc === 'en_attente'" [class.ko]="u.kyc === 'rejete'">{{ u.kyc }}</span></td>
              <td class="small">{{ pf.score(u.id).grade }} · {{ pf.score(u.id).valeur }}</td></tr>
          }</tbody>
        </table></div>
      }
      @case ('litiges') {
        <ul class="clean card">
          @for (c of litiges(); track c.id) { <li><a [routerLink]="['/commandes', c.id]"><strong>{{ c.reference }}</strong></a> — {{ c.litige?.motif }} · {{ c.acheteurId | qui }} / {{ c.vendeurId | qui }} · ouvert le {{ c.litige?.ouvertLe }}</li> }
          @empty { <li class="vide">Aucun litige ouvert.</li> }
        </ul>
      }
      @case ('ref') {
        <div class="note" style="margin-bottom:12px">Référentiel administratif basé sur les 13 régions historiques : à mettre à jour selon le découpage en vigueur (réforme 2025) dans la table <code>regions</code> du backend.</div>
        <div class="grid g3">
          <div class="card"><h3>Régions ({{ regions.length }})</h3><ul class="clean small">@for (r of regions; track r.id) { <li>{{ r.nom }} — {{ r.chefLieu }}</li> }</ul></div>
          <div class="card"><h3>Localités ({{ localites.length }})</h3><ul class="clean small">@for (l of localites; track l.id) { <li>{{ l.nom }} <span class="muted">({{ l.province }})</span> @if (l.marche) { <span class="badge info">marché suivi</span> }</li> }</ul></div>
          <div class="card"><h3>Produits & unités ({{ produits.length }})</h3><ul class="clean small">@for (p of produits; track p.id) { <li><strong>{{ p.nom }}</strong><br /><span class="muted">@for (u of p.unites; track u.code; let l = $last) { {{ u.libelle }}{{ l ? '' : ' · ' }} }</span></li> }</ul></div>
        </div>
      }
    }
  </div>`,
})
export class AdminPage {
  protected readonly pf = inject(PlateformeService);
  private readonly toast = inject(ToastService);
  protected readonly libelle = LIBELLE_ROLE;
  protected readonly regions = REGIONS;
  protected readonly localites = LOCALITES;
  protected readonly produits = PRODUITS;
  protected readonly onglet = signal<'kyc' | 'comptes' | 'litiges' | 'ref'>('kyc');

  protected readonly attente = computed(() => this.pf.db.utilisateurs.items().filter((u) => u.kyc === 'en_attente'));
  protected readonly litiges = computed(() => this.pf.db.commandes.items().filter((c) => c.statut === 'litige'));

  async kyc(u: Utilisateur, kyc: 'verifie' | 'rejete') {
    await this.pf.db.utilisateurs.update(u.id, { kyc });
    await this.pf.notifier(u.id, kyc === 'verifie' ? 'Votre compte est vérifié : vous pouvez publier, commander et payer.' : 'Vérification refusée : merci de fournir une pièce lisible.', '/profil');
    this.toast.afficher(kyc === 'verifie' ? 'Compte validé.' : 'Compte refusé.');
  }
}
