import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS } from '../../core/data/referentiel';
import { SessionService } from '../../core/session.service';
import { SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { UI } from '../../shared/ui';

/** 6. COLLECTEUR — « Où trouver rapidement les volumes que je peux revendre ? » */
@Component({
  selector: 'app-opportunites',
  imports: [FormsModule, RouterLink, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🧑🏾‍🌾" acteur="Collecteur" question="Où trouver rapidement les volumes que je peux revendre ?"
      [etapes]="['Tous les lots proposés autour de votre point de collecte', 'Pour chacun : prix d’achat rendu chez vous et meilleure revente (acheteur ou marché)', 'Classement par marge nette ; achat et revente en un clic']" />

    <div class="card saisie">
      <label class="field">Mon point de collecte<select [ngModel]="lieu()" (ngModelChange)="lieu.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
      <label class="field">Rayon : {{ rayon() }} km<input type="range" min="20" max="400" step="10" [ngModel]="rayon()" (ngModelChange)="rayon.set(+$event)" /></label>
      <label class="field">Produit<select [ngModel]="produitId()" (ngModelChange)="produitId.set($event)"><option value="">Tous</option>@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
    </div>

    <div class="grid g4 section">
      <div class="card kpi"><div class="v">{{ volumeTotal() | qte }}</div><div class="l">disponibles dans {{ rayon() }} km</div></div>
      <div class="card kpi"><div class="v">{{ rentables().length }} / {{ opps().length }}</div><div class="l">lots revendables avec marge</div></div>
      <div class="card kpi"><div class="v">{{ margeTotale() | fcfa: true }}</div><div class="l">marge potentielle totale</div></div>
      <div class="card kpi"><div class="v">{{ opps()[0]?.margeKg ?? 0 | nb }} F/kg</div><div class="l">meilleure marge unitaire</div></div>
    </div>

    <div class="split section">
      <div>
        <h2>Opportunités d’achat-revente</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Lot</th><th class="num">Volume</th><th class="num">Achat rendu chez moi</th><th>Meilleure revente</th><th class="num">Marge</th><th></th></tr></thead>
            <tbody>
              @for (x of opps(); track x.o.id) {
                <tr [class.neg]="x.margeKg <= 0">
                  <td><strong>{{ x.o.produitId | prod }}</strong> <span class="badge">{{ x.o.qualite }}</span><div class="small muted">{{ x.o.vendeurId | qui }} · {{ x.o.localiteId | loc }} ({{ x.km }} km) · {{ x.o.prixKg | nb }} F/kg</div></td>
                  <td class="num">{{ x.o.quantiteRestanteKg | qte }}</td>
                  <td class="num">{{ x.achat | nb }} F/kg</td>
                  <td class="small">@if (x.best; as b) { {{ b.titre }}<div class="muted">net {{ b.netKg | nb }} F/kg · risque {{ b.risque }}</div> } @else { — }</td>
                  <td class="num"><strong [class.vert]="x.margeKg > 0" [class.rouge]="x.margeKg <= 0">{{ x.margeKg | nb }} F/kg</strong><div class="small">{{ x.margeTotal | fcfa: true }}</div></td>
                  <td><div class="toolbar">
                    <a class="btn" [routerLink]="['/marche', x.o.id]">Acheter</a>
                    @if (x.best && x.margeKg > 0) { <a class="btn ghost" [routerLink]="x.best.action.route" [queryParams]="x.best.action.query ?? {}">Revendre</a> }
                  </div></td>
                </tr>
              } @empty { <tr><td colspan="6" class="vide">Aucun lot dans ce rayon. Élargissez la zone.</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="hint">Achat rendu = prix du vendeur + transport jusqu’à votre point de collecte. Revente = meilleure option nette (acheteur de la plateforme ou marché de gros, transport et frais déduits).</p>
      </div>
      <div class="card">
        <h2>Où sont les volumes ?</h2>
        @for (v of volumes(); track v.l.id) {
          <div class="loc">
            <div><strong>{{ v.l.nom }}</strong> <span class="small muted">{{ v.km }} km</span><div class="small muted">{{ v.produits.join(', ') }}</div></div>
            <div class="num"><strong>{{ v.kg | qte }}</strong><div class="small muted">{{ v.n }} lot(s)</div></div>
          </div>
          <div class="bar"><span [style.width.%]="(v.kg / maxVol()) * 100"></span></div>
        } @empty { <p class="muted small">Aucun volume.</p> }
      </div>
    </div>
  </div>`,
  styles: `
    .saisie { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: end; }
    @media (max-width: 800px) { .saisie { grid-template-columns: 1fr; } }
    tr.neg td { opacity: .55; } .vert { color: var(--primary); } .rouge { color: var(--danger); }
    .loc { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; }
  `,
})
export class OpportunitesPage {
  private readonly sol = inject(SolutionsService);
  private readonly session = inject(SessionService);
  protected readonly localites = LOCALITES;
  protected readonly produits = PRODUITS;
  protected readonly lieu = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly rayon = signal(150);
  protected readonly produitId = signal('');

  protected readonly opps = computed(() => this.sol.opportunites(this.lieu(), this.rayon(), this.session.utilisateur()!.id, this.produitId()));
  protected readonly rentables = computed(() => this.opps().filter((x) => x.margeKg > 0));
  protected readonly margeTotale = computed(() => this.rentables().reduce((s, x) => s + x.margeTotal, 0));
  protected readonly volumes = computed(() => this.sol.volumesAutour(this.lieu(), this.rayon()));
  protected readonly volumeTotal = computed(() => this.volumes().reduce((s, v) => s + v.kg, 0));
  protected readonly maxVol = computed(() => Math.max(1, ...this.volumes().map((v) => v.kg)));
}
