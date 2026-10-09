import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MOIS_COURT, PARAM_PRIX, PRODUITS, produit } from '../core/data/referentiel';
import { Qualite } from '../core/models';
import { PlateformeService, aujourdhui } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-stockage',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Stockage</div><h1>Stockage en magasin</h1>
        <p>Stocker au lieu de brader à la récolte : le produit est déposé dans un magasin, un récépissé est émis, et vous vendez quand les prix remontent. Le récépissé d’un magasin agréé peut aussi servir de garantie auprès d’une banque (warrantage).</p></div>
      @if (estGestionnaire()) { <button class="primary" (click)="modal.set('entree')">＋ Enregistrer une entrée</button> }
      @else { <button class="primary" (click)="modal.set('entree')">＋ Annoncer un dépôt</button> }
    </div>

    <div class="grid g3">
      @for (e of entrepots(); track e.e.id) {
        <div class="card">
          <h3>{{ e.e.nom }}</h3>
          <div class="small muted">📍 {{ e.e.localiteId | loc }} · {{ e.e.tarifSacMois | nb }} F / sac / mois</div>
          <div class="cap"><div class="bar"><span [style.width.%]="e.taux" [style.background]="e.taux > 85 ? 'var(--danger)' : null"></span></div><span class="small num">{{ e.occupeT | nb }} / {{ e.e.capaciteT | nb }} t</span></div>
          <div class="chips">
            @if (e.e.warrantage) { <span class="badge ok">Magasin agréé (récépissés)</span> }
            @else { <span class="badge">Stockage simple / froid</span> }
            <span class="badge">{{ e.libre | nb }} t libres</span>
          </div>
        </div>
      }
    </div>

    <h2 class="section">{{ estGestionnaire() ? 'Stocks de mon entrepôt' : 'Mes dépôts' }}</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Récépissé</th><th>Produit</th>@if (estGestionnaire() || admin()) { <th>Déposant</th> }<th class="num">Quantité</th><th>Entrée</th><th class="num">Valeur estimée</th><th>Conseil</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          @for (l of depots(); track l.d.id) {
            <tr>
              <td class="small"><strong>{{ l.d.recu }}</strong><div class="muted">{{ l.entrepot }}</div></td>
              <td>{{ l.d.produitId | prod }} <span class="badge">{{ l.d.qualite }}</span></td>
              @if (estGestionnaire() || admin()) { <td class="small">{{ l.d.deposantId | qui }}</td> }
              <td class="num">{{ l.d.quantiteKg | qte }}<div class="small muted">{{ l.d.quantiteKg | enUnite: l.d.produitId }}</div></td>
              <td class="small">{{ l.d.dateEntree }}<div class="muted">{{ l.jours }} j</div></td>
              <td class="num">{{ l.valeur | fcfa: true }}</td>
              <td class="small">
                @if (l.conseil.gain > 0) { <span class="badge ok">Attendre {{ l.conseil.mois }}</span><div class="muted">+{{ l.conseil.gain | nb }} F/kg net</div> }
                @else { <span class="badge warn">Vendre maintenant</span> }
              </td>
              <td><span class="badge" [class.ok]="l.d.statut === 'en_stock'">{{ l.d.statut === 'en_stock' ? 'en stock' : 'retiré' }}</span></td>
              <td>
                @if (l.d.deposantId === moi() && l.d.statut === 'en_stock') { <a class="btn" routerLink="/marche/nouvelle">Mettre en vente</a> }
              </td>
            </tr>
          } @empty { <tr><td colspan="9" class="vide">Aucun dépôt.</td></tr> }
        </tbody>
      </table>
    </div>
    <p class="hint">Conseil « stocker ou vendre » : prix attendu (jusqu’à 9 mois, période de soudure incluse) selon le profil saisonnier des 12 derniers mois, moins le coût de stockage et les pertes. Indicatif.</p>

    @if (modal()) {
      <div class="modal-fond" (click)="modal.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          @if (modal() === 'entree') {
            <h2>{{ estGestionnaire() ? 'Enregistrer une entrée en stock' : 'Annoncer un dépôt' }}</h2>
            <div class="form-grid">
              <label class="field">Entrepôt<select [(ngModel)]="ne.entrepotId">@for (e of entrepots(); track e.e.id) { <option [value]="e.e.id">{{ e.e.nom }}</option> }</select></label>
              @if (estGestionnaire()) { <label class="field">Déposant<select [(ngModel)]="ne.deposantId">@for (u of deposants(); track u.id) { <option [value]="u.id">{{ u.nom }}</option> }</select></label> }
              <label class="field">Produit<select [(ngModel)]="ne.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Nombre de sacs de 100 kg<input type="number" min="1" [(ngModel)]="ne.sacs" /></label>
              <label class="field">Qualité constatée<select [(ngModel)]="ne.qualite"><option>A</option><option>B</option><option>C</option></select></label>
            </div>
            <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!ne.sacs" (click)="deposer()">Valider — émettre le récépissé</button></div>
          }
        </div>
      </div>
    }
  </div>`,
  styles: `.cap { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; margin: 10px 0; }`,
})
export class StockagePage {
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly produits = PRODUITS;
  protected readonly modal = signal<'entree' | null>(null);

  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly estGestionnaire = computed(() => this.session.role() === 'entrepot');
  protected readonly admin = computed(() => ['admin', 'institution'].includes(this.session.role()!));
  private readonly monEntrepot = computed(() => this.pf.db.entrepots.items().find((e) => e.gestionnaireId === this.moi()));

  protected ne = { entrepotId: this.pf.db.entrepots.items()[0].id, deposantId: 'U-P03', produitId: 'mais', sacs: 10, qualite: 'A' as Qualite };

  constructor() {
    const e = this.monEntrepot();
    if (e) this.ne.entrepotId = e.id;
  }

  protected readonly entrepots = computed(() => this.pf.db.entrepots.items().map((e) => {
    const occupeT = this.pf.db.depots.items().filter((d) => d.entrepotId === e.id && d.statut !== 'retire').reduce((s, d) => s + d.quantiteKg, 0) / 1000;
    return { e, occupeT, libre: e.capaciteT - occupeT, taux: (occupeT / e.capaciteT) * 100 };
  }));

  protected readonly deposants = computed(() => this.pf.db.utilisateurs.items().filter((u) => ['producteur', 'cooperative', 'collecteur', 'acheteur'].includes(u.role)));

  protected readonly depots = computed(() => {
    const e = this.monEntrepot();
    return this.pf.db.depots.items()
      .filter((d) => this.admin() || (e ? d.entrepotId === e.id : d.deposantId === this.moi()))
      .map((d) => {
        const ent = this.pf.db.entrepots.get(d.entrepotId)!;
        return {
          d, entrepot: ent.nom,
          jours: Math.round((Date.parse(aujourdhui()) - Date.parse(d.dateEntree)) / 864e5),
          valeur: this.pf.valeurDepot(d.id), conseil: this.conseil(d.produitId, ent.tarifSacMois),
        };
      });
  });

  /** Gain net attendu (F/kg) en attendant 1 à 9 mois (jusqu’'à la soudure), selon le profil saisonnier. */
  private conseil(produitId: string, tarifSacMois: number) {
    const p = produit(produitId);
    const s = PARAM_PRIX[produitId].saison;
    const auj = s[11];
    let best = { mois: '', gain: 0 };
    for (let k = 1; k <= Math.min(9, Math.floor(p.conservationJ / 30)); k++) {
      const m = (11 + k) % 12;
      const gain = Math.round(PARAM_PRIX[produitId].base * (s[m] - auj) - (tarifSacMois / 100) * k - (PARAM_PRIX[produitId].base * auj * p.pertePct / 100) * Math.min(1, (30 * k) / p.conservationJ));
      if (gain > best.gain) best = { mois: MOIS_COURT[m], gain };
    }
    return best;
  }

  async deposer() {
    await this.pf.deposer(this.ne.entrepotId, this.ne.produitId, this.ne.sacs * 100, this.ne.qualite, this.estGestionnaire() ? this.ne.deposantId : this.moi());
    this.modal.set(null);
    this.toast.afficher('Dépôt enregistré, récépissé émis.');
  }
}
