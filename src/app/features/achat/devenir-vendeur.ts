import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { LOCALITES, PRODUITS } from '../../core/data/referentiel';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI, visuel } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';

type TypeVendeur = 'producteur' | 'cooperative' | 'commercant';
const TYPES: { id: TypeVendeur; ic: string; titre: string; texte: string; pieces: string[] }[] = [
  { id: 'producteur', ic: 'pousse', titre: 'Producteur', texte: 'Je vends ma propre récolte.', pieces: ['CNIB', 'Carte de producteur'] },
  { id: 'cooperative', ic: 'groupe', titre: 'Coopérative / union', texte: 'Nous regroupons la production de nos membres.', pieces: ['Récépissé OHADA/SCOOPS', 'PV d’assemblée générale'] },
  { id: 'commercant', ic: 'marche', titre: 'Commerçant / collecteur', texte: 'J’achète et je revends des produits agricoles.', pieces: ['CNIB', 'Carte de commerçant', 'RCCM'] },
];

@Component({
  selector: 'app-devenir-vendeur',
  imports: [FormsModule, RouterLink, ...ACHAT_UI],
  template: `
  <div class="page etroit">
    <h1>Devenir vendeur</h1>
    <p class="muted">Même compte. Paiement garanti.</p>


    <div class="card section">
      <h2>1. Vous êtes…</h2>
      <div class="types">
        @for (t of types; track t.id) {
          <button class="type" [class.on]="type() === t.id" (click)="choisir(t.id)"><app-ic [n]="t.ic" [taille]="24" /><span><strong>{{ t.titre }}</strong><br /><span class="small muted">{{ t.texte }}</span></span></button>
        }
      </div>
    </div>

    @if (def(); as t) {
      <div class="card section">
        <h2>2. Ce que vous vendez</h2>
        <div class="chips">
          @for (p of produits; track p.id) { <button class="chip" [class.on]="choisis().includes(p.id)" (click)="basculer(p.id)">{{ ic(p.id) }} {{ p.nom }}</button> }
        </div>
        <div class="form-grid section">
          @if (t.id !== 'producteur') { <label class="field">Nom de la structure<input [(ngModel)]="organisation" /></label> }
          @if (t.id === 'cooperative') { <label class="field">Nombre de membres<input type="number" min="2" [(ngModel)]="membres" /></label> }
          <label class="field">Où se trouve la marchandise ?<select [(ngModel)]="localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
          <label class="field">Pièce justificative<select [(ngModel)]="piece">@for (p of t.pieces; track p) { <option>{{ p }}</option> }</select></label>
        </div>
        <p class="hint" style="margin-top:8px">{{ session.utilisateur()?.kyc === 'verifie' ? 'Votre identité est déjà vérifiée : vous pourrez publier immédiatement.' : 'La pièce est vérifiée par l’équipe (48 h) avant votre première publication. En production, elle est photographiée et téléversée.' }}</p>
        <div class="actions">
          <a class="btn" routerLink="/accueil">Plus tard</a>
          <button class="primary" [disabled]="!choisis().length || (t.id !== 'producteur' && !organisation.trim())" (click)="valider()">Ouvrir mon espace vendeur</button>
        </div>
      </div>
    }
  </div>`,
  styles: `
    .etroit { max-width: 900px; }
    .types { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .type { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; }
    .type.on { border-color: var(--primary); background: var(--primary-soft); }
    .em { font-size: 26px; }
    .avantages .card p { margin: 4px 0 0; }
  `,
})
export class DevenirVendeurPage {
  protected readonly session = inject(SessionService);
  private readonly achat = inject(AchatService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly types = TYPES;
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly type = signal<TypeVendeur | null>(null);
  protected readonly choisis = signal<string[]>([]);
  protected organisation = '';
  protected membres = 20;
  protected piece = 'CNIB';
  protected localiteId = this.session.utilisateur()?.localiteId ?? 'OUA';

  protected ic(p: string) { return visuel(p).ic; }
  protected def() { return TYPES.find((t) => t.id === this.type()); }
  choisir(t: TypeVendeur) { this.type.set(t); this.piece = TYPES.find((x) => x.id === t)!.pieces[0]; }
  basculer(p: string) { this.choisis.update((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p])); }

  async valider() {
    await this.achat.devenirVendeur(this.type()!, { produits: this.choisis(), piece: this.piece, localiteId: this.localiteId, organisation: this.organisation.trim() || undefined, membres: this.type() === 'cooperative' ? this.membres : undefined });
    this.toast.afficher('Vous êtes vendeur. Passez de « Acheter » à « Vendre » en haut de l’écran.');
    this.session.changerMode('vente');
  }
}
