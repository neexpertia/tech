import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, produit } from '../../core/data/referentiel';
import { Qualite } from '../../core/models';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { OptionVente, SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { UI } from '../../shared/ui';

const ICONES: Record<OptionVente['type'], string> = { acheteur: '🤝', marche: '🏪', collecteur: '🧑🏾‍🌾', stockage: '🏬', cooperative: '👥' };

/** 1. PRODUCTEUR — « Comment vendre ma production dans de bonnes conditions ? » */
@Component({
  selector: 'app-vendre',
  imports: [FormsModule, RouterLink, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="👨🏾‍🌾" acteur="Producteur" question="Comment vendre ma production dans de bonnes conditions ?"
      [etapes]="['Dites ce que vous avez à vendre', 'Comparez toutes les façons de vendre sur ce qui reste dans votre poche', 'Choisissez la plus sûre : paiement garanti en séquestre']" />

    <div class="card saisie">
      <label class="field">Produit<select [ngModel]="produitId()" (ngModelChange)="choisirProduit($event)">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
      <label class="field">Quantité<input type="number" min="1" [ngModel]="qte()" (ngModelChange)="qte.set($event)" /></label>
      <label class="field">Unité<select [ngModel]="unite()" (ngModelChange)="unite.set($event)">@for (u of unites(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
      <label class="field">Où est la récolte ?<select [ngModel]="lieu()" (ngModelChange)="lieu.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
      <label class="field">Qualité<select [ngModel]="qualite()" (ngModelChange)="qualite.set($event)"><option value="A">A — trié, sec</option><option value="B">B — standard</option><option value="C">C — tout-venant</option></select></label>
    </div>

    @if (options().length) {
      @let best = recommandee()!;
      <div class="reco card">
        <div class="eyebrow">Notre conseil</div>
        <h2>{{ icones[best.type] }} {{ best.titre }}</h2>
        <p>Vous gardez <strong class="gros">{{ best.netKg | nb }} F/kg</strong>, soit <strong>{{ best.netTotal | fcfa }}</strong> pour {{ best.volumeKg | qte }} ({{ best.volumeKg | enUnite: produitId() }}).
          @if (ecartPire() > 0) { C’est <strong>{{ ecartPire() | fcfa }}</strong> de plus que la moins bonne option. }</p>
        <p class="small">Risque {{ best.risque }} : {{ best.pourquoiRisque }}.</p>
        <a class="btn primary" [routerLink]="best.action.route" [queryParams]="best.action.query ?? {}">{{ best.action.label }} →</a>
      </div>

      <h2 class="section">Toutes les options, de la plus rémunératrice à la moins rémunératrice</h2>
      <div class="options">
        @for (o of options(); track o.titre; let i = $index) {
          <div class="card opt" [class.best]="o === best">
            <div class="haut">
              <span class="ic">{{ icones[o.type] }}</span>
              <div class="t"><strong>{{ o.titre }}</strong><div class="small muted">{{ o.detail }}</div></div>
              <div class="net"><strong>{{ o.netKg | nb }} F/kg</strong><div class="small muted">net pour vous</div></div>
            </div>
            <div class="barre"><span [style.width.%]="(o.netKg / maxNet()) * 100" [class.risque]="o.risque !== 'faible'"></span></div>
            <div class="bas">
              <div class="calc small">
                Prix {{ o.prixBrutKg | nb }}
                @for (d of o.deductions; track d.label) { @if (d.kg) { − {{ d.kg | nb }} <span class="muted">({{ d.label }})</span> } }
                = <strong>{{ o.netKg | nb }} F/kg</strong> · total <strong>{{ o.netTotal | fcfa: true }}</strong> · {{ o.quand }}
              </div>
              <span class="badge" [class.ok]="o.risque === 'faible'" [class.warn]="o.risque === 'moyen'" [class.ko]="o.risque === 'élevé'" [title]="o.pourquoiRisque">risque {{ o.risque }}</span>
              <a class="btn" [routerLink]="o.action.route" [queryParams]="o.action.query ?? {}">{{ o.action.label }}</a>
            </div>
          </div>
        }
      </div>
      <p class="hint">Transport : 75 F par tonne et par km + manutention pour un camion plein, majoré jusqu’à +80 % pour les petits lots (camion partagé, car, tricycle). Les prix viennent des derniers relevés et des demandes publiées. Stockage : tendance des 12 derniers mois, non garantie.</p>
    } @else {
      <div class="vide card">Pas encore de prix pour ce produit près de chez vous. Publiez votre offre : les acheteurs et collecteurs seront alertés.</div>
    }
  </div>`,
  styles: `
    .saisie { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    @media (max-width: 900px) { .saisie { grid-template-columns: 1fr 1fr; } }
    .reco { border: 2px solid var(--primary); margin-top: 16px; }
    .gros { font-size: 1.3rem; color: var(--primary); }
    .options { display: flex; flex-direction: column; gap: 10px; }
    .opt.best { border-color: var(--primary); }
    .haut { display: flex; gap: 12px; align-items: center; }
    .ic { font-size: 26px; } .t { flex: 1; min-width: 0; } .net { text-align: right; white-space: nowrap; } .net strong { font-size: 1.15rem; }
    .barre { height: 8px; background: var(--surface-2); border-radius: 999px; margin: 10px 0; overflow: hidden; }
    .barre span { display: block; height: 100%; background: var(--primary); } .barre span.risque { background: var(--accent); }
    .bas { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .calc { flex: 1; min-width: 260px; }
  `,
})
export class VendrePage {
  private readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly icones = ICONES;

  protected readonly produitId = signal('mais');
  protected readonly qte = signal(20);
  protected readonly unite = signal('sac100');
  protected readonly lieu = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly qualite = signal<Qualite>('B');

  constructor() {
    const u = this.session.utilisateur();
    const o = u && this.pf.db.offres.items().find((x) => x.vendeurId === u.id && x.statut === 'active');
    if (o) this.choisirProduit(o.produitId);
  }

  choisirProduit(id: string) {
    this.produitId.set(id);
    this.unite.set(produit(id).unites[1]?.code ?? 'kg');
  }
  unites() { return produit(this.produitId()).unites; }

  private readonly kg = computed(() => {
    const u = this.unites().find((x) => x.code === this.unite()) ?? this.unites()[0];
    return Math.round((this.qte() || 0) * u.kg);
  });

  protected readonly options = computed(() => this.kg() > 0 ? this.sol.optionsVente(this.produitId(), this.kg(), this.lieu(), this.qualite(), this.session.utilisateur()?.id) : []);
  protected readonly maxNet = computed(() => Math.max(1, ...this.options().map((o) => o.netKg)));
  /** Meilleur net parmi les options à risque faible ; sinon meilleur net tout court. */
  protected readonly recommandee = computed(() => {
    const o = this.options();
    const surs = o.filter((x) => x.risque === 'faible');
    const bestSur = surs[0];
    // une option plus risquée n'est préférée que si elle rapporte nettement plus (> 8 %)
    return bestSur && bestSur.netKg >= o[0].netKg * 0.92 ? bestSur : o[0];
  });
  protected readonly ecartPire = computed(() => {
    const o = this.options(), r = this.recommandee();
    return r ? Math.round(r.netTotal - Math.min(...o.map((x) => x.netKg)) * r.volumeKg) : 0;
  });
}
