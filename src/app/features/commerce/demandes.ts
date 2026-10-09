import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PRODUITS } from '../../core/data/referentiel';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-demandes',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Demandes d’achat</div>
        <h1>Demandes & appels d’offres</h1>
        <p>Les acheteurs (usines, grossistes, hôtels, exportateurs, ONG) publient leurs besoins ; les vendeurs répondent par une cotation.</p>
      </div>
      @if (session.estAcheteur()) { <a class="btn primary" routerLink="/demandes/nouvelle">＋ Nouvelle demande</a> }
    </div>
    <div class="tabs">
      <button [class.on]="onglet() === 'ouvertes'" (click)="onglet.set('ouvertes')">Ouvertes ({{ nb().ouvertes }})</button>
      <button [class.on]="onglet() === 'ao'" (click)="onglet.set('ao')">Appels d’offres ({{ nb().ao }})</button>
      @if (session.estAcheteur()) { <button [class.on]="onglet() === 'miennes'" (click)="onglet.set('miennes')">Mes demandes ({{ nb().miennes }})</button> }
      @if (session.estVendeur()) { <button [class.on]="onglet() === 'cotees'" (click)="onglet.set('cotees')">Mes cotations ({{ nb().cotees }})</button> }
      <select style="margin-left:auto" [ngModel]="produitId()" (ngModelChange)="produitId.set($event)"><option value="">Tous produits</option>@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Demande</th><th>Acheteur</th><th class="num">Quantité</th><th class="num">Prix max</th><th>Livraison</th><th>Échéance</th><th class="num">Cotations</th><th></th></tr></thead>
        <tbody>
          @for (d of liste(); track d.id) {
            <tr>
              <td>
                <a [routerLink]="['/demandes', d.id]"><strong>{{ d.produitId | prod }}</strong></a>
                @if (d.type === 'appel_offres') { <span class="badge warn">appel d’offres</span> }
                @if (d.recurrence) { <span class="badge info">↻ {{ d.recurrence }}</span> }
                <div class="small muted">{{ d.description.slice(0, 80) }}{{ d.description.length > 80 ? '…' : '' }}</div>
              </td>
              <td class="small">{{ d.acheteurId | qui }}</td>
              <td class="num">{{ d.quantiteKg | qte }}</td>
              <td class="num">{{ d.prixMaxKg ? (d.prixMaxKg | nb) + ' F/kg' : '—' }}</td>
              <td class="small">{{ d.localiteLivraisonId | loc }}</td>
              <td class="small">{{ d.dateLimite }}</td>
              <td class="num">{{ nbCotations(d.id) }}</td>
              <td><span class="badge" [class.ok]="d.statut === 'ouverte'">{{ d.statut }}</span></td>
            </tr>
          } @empty { <tr><td colspan="8" class="vide">Aucune demande.</td></tr> }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class DemandesPage {
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  protected readonly produits = PRODUITS;
  protected readonly onglet = signal<'ouvertes' | 'ao' | 'miennes' | 'cotees'>(this.session.estAcheteur() && !this.session.estVendeur() ? 'miennes' : 'ouvertes');
  protected readonly produitId = signal('');
  /** ?vue=miennes|ao|cotees|ouvertes (liens du menu) */
  readonly vue = input<string>();
  constructor() { effect(() => { const v = this.vue(); if (v === 'miennes' || v === 'ao' || v === 'cotees' || v === 'ouvertes') this.onglet.set(v); }); }

  private get moi() { return this.session.utilisateur()!.id; }
  nbCotations(id: string) { return this.pf.db.cotations.items().filter((c) => c.demandeId === id).length; }

  protected readonly nb = computed(() => {
    const d = this.pf.db.demandes.items();
    const cot = new Set(this.pf.db.cotations.items().filter((c) => c.vendeurId === this.moi).map((c) => c.demandeId));
    return {
      ouvertes: d.filter((x) => x.statut === 'ouverte').length,
      ao: d.filter((x) => x.type === 'appel_offres' && x.statut === 'ouverte').length,
      miennes: d.filter((x) => x.acheteurId === this.moi).length,
      cotees: cot.size,
    };
  });

  protected readonly liste = computed(() => {
    const cot = new Set(this.pf.db.cotations.items().filter((c) => c.vendeurId === this.moi).map((c) => c.demandeId));
    return this.pf.db.demandes.items()
      .filter((d) => {
        switch (this.onglet()) {
          case 'ouvertes': return d.statut === 'ouverte';
          case 'ao': return d.type === 'appel_offres' && d.statut === 'ouverte';
          case 'miennes': return d.acheteurId === this.moi;
          case 'cotees': return cot.has(d.id);
        }
      })
      .filter((d) => !this.produitId() || d.produitId === this.produitId())
      .sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
  });
}
