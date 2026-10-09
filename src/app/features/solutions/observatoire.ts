import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MARCHES, PRODUITS, localite } from '../../core/data/referentiel';
import { PlateformeService } from '../../core/plateforme.service';
import { SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { UI } from '../../shared/ui';

/** 7. INSTITUTION — « Que se passe-t-il réellement sur les marchés agricoles ? » */
@Component({
  selector: 'app-observatoire',
  imports: [QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🏛️" acteur="Institution / organisme public" question="Que se passe-t-il réellement sur les marchés agricoles ?"
      [etapes]="['Prix relevés sur les marchés ET prix réellement payés dans les transactions', 'Volumes qui circulent entre régions', 'Offre, demande et stocks par produit : où sont les tensions ?', 'Fiabilité des données : couverture des relevés par marché']" />

    @let o = obs();
    <div class="grid g4">
      <div class="card kpi"><div class="v">{{ o.nbTransactions }}</div><div class="l">transactions tracées ({{ o.volumeTx | qte }})</div></div>
      <div class="card kpi"><div class="v">{{ marches }}</div><div class="l">marchés suivis</div></div>
      <div class="card kpi"><div class="v">{{ o.sources.agent + o.sources.utilisateur + o.sources.transaction }}</div><div class="l">relevés de prix sur 30 jours</div></div>
      <div class="card kpi"><div class="v">{{ tensions().length }}</div><div class="l">produits en tension (demande > offre + stock)</div></div>
    </div>

    <h2 class="section">1. Les prix : relevés et réellement payés</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produit</th><th class="num">Prix moyen de gros</th><th class="num">Min – max entre marchés</th><th class="num">Écart entre marchés</th><th class="num">Sur 12 mois</th><th class="num">Prix payé (transactions)</th><th class="num">Écart payé / relevé</th></tr></thead>
        <tbody>
          @for (l of o.prix; track l.p.id) {
            <tr>
              <td><strong>{{ l.p.nom }}</strong><div class="small muted">{{ l.p.categorie }}</div></td>
              <td class="num"><strong>{{ l.moy | nb }}</strong> F/kg</td>
              <td class="num small">{{ l.min | nb }} – {{ l.max | nb }}</td>
              <td class="num"><span class="badge" [class.warn]="l.dispersion > 30">{{ l.dispersion | nb }} %</span></td>
              <td class="num"><span class="badge" [class.ko]="l.var12 > 15" [class.ok]="l.var12 < -5">{{ l.var12 > 0 ? '+' : '' }}{{ l.var12 | nb }} %</span></td>
              <td class="num">@if (l.prixTx) { {{ l.prixTx | nb }} F/kg <div class="small muted">{{ l.kgTx | qte }}</div> } @else { <span class="muted">—</span> }</td>
              <td class="num">@if (l.ecartTx !== null) { <span class="badge" [class.ok]="l.ecartTx >= 0" [class.warn]="l.ecartTx < 0">{{ l.ecartTx > 0 ? '+' : '' }}{{ l.ecartTx | nb: 1 }} %</span> }</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="hint">Écart payé / relevé : prix de chaque transaction comparé au relevé du marché le plus proche à la même date. Un fort écart entre marchés signale un marché mal intégré (transport cher, axes coupés, information absente). L’écart payé / relevé mesure si les vendeurs obtiennent le prix du marché.</p>

    <div class="grid g2 section">
      <div class="card">
        <h2>2. Offre, demande et stocks : où sont les tensions ?</h2>
        <table class="small">
          <thead><tr><th>Produit</th><th class="num">Offre</th><th class="num">En collecte</th><th class="num">En magasin</th><th class="num">Demande</th><th>Signal</th></tr></thead>
          <tbody>
            @for (b of o.bilan; track b.p.id) {
              <tr><td>{{ b.p.nom }}</td><td class="num">{{ b.offre | qte }}</td><td class="num">{{ b.collecte | qte }}</td><td class="num">{{ b.stock | qte }}</td><td class="num">{{ b.demande | qte }}</td>
                <td>@if (b.demande > b.offre + b.stock + b.collecte) { <span class="badge ko">tension</span> } @else if (b.demande > b.offre) { <span class="badge warn">{{ b.collecte ? 'collecte / stock à mobiliser' : 'stock à mobiliser' }}</span> } @else { <span class="badge ok">équilibré</span> }
                  <span class="muted"> · prix {{ b.tendance > 0 ? '↗' : '↘' }} {{ b.tendance | nb }} % sur 2 mois</span></td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>3. Flux entre régions</h2>
        @for (f of o.flux.slice(0, 10); track f.de + f.vers) {
          <div class="flux"><span>{{ f.de }} → {{ f.vers }} @if (f.interne) { <span class="muted small">(intra-régional)</span> }</span><strong>{{ f.kg | qte }}</strong></div>
          <div class="bar"><span [style.width.%]="(f.kg / maxFlux()) * 100"></span></div>
        } @empty { <p class="muted small">Pas encore de flux enregistré.</p> }
        <p class="hint">Commandes et frets de la plateforme. À croiser avec les postes de contrôle et les bilans céréaliers officiels.</p>
      </div>
    </div>

    <div class="grid g2 section">
      <div class="card">
        <h2>4. Fiabilité des données</h2>
        <p class="small">Sources des relevés (30 j) : agents {{ o.sources.agent }} · utilisateurs {{ o.sources.utilisateur }} · transactions {{ o.sources.transaction }}</p>
        <table class="small">
          <thead><tr><th>Marché</th><th class="num">Relevés 30 j</th><th class="num">Produits couverts</th><th>Dernier relevé</th></tr></thead>
          <tbody>
            @for (c of o.couverture; track c.m.id) {
              <tr><td>{{ c.m.nom.split(' (')[0] }}</td><td class="num"><span class="badge" [class.ko]="c.recents < 10" [class.ok]="c.recents >= 20">{{ c.recents }}</span></td><td class="num">{{ c.produits }} / {{ nbProduits }}</td><td>{{ c.dernier }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>5. Alertes</h2>
        <ul class="clean small">
          @for (a of alertes(); track a.texte) { <li><span class="badge" [class.ko]="a.niveau === 'critique'" [class.warn]="a.niveau === 'vigilance'" [class.info]="a.niveau === 'info'">{{ a.niveau }}</span> {{ a.texte }}</li> }
          @empty { <li class="muted">Aucune alerte.</li> }
        </ul>
      </div>
    </div>
    @if (public_()) { <p class="note green section">Version publique de l’observatoire. Les institutions partenaires accèdent au détail par région, aux exports et aux séries complètes.</p> }
  </div>`,
  styles: `.flux { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 13px; }`,
})
export class ObservatoirePage {
  private readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  protected readonly marches = MARCHES.length;
  protected readonly nbProduits = PRODUITS.length;
  protected readonly public_ = () => this.router.url.startsWith('/decouvrir');

  protected readonly obs = computed(() => this.sol.observatoire());
  protected readonly maxFlux = computed(() => Math.max(1, ...this.obs().flux.map((f) => f.kg)));
  protected readonly tensions = computed(() => this.obs().bilan.filter((b) => b.demande > b.offre + b.stock + b.collecte));

  protected readonly alertes = computed(() => {
    const a: { niveau: 'critique' | 'vigilance' | 'info'; texte: string }[] = [];
    for (const p of PRODUITS) for (const m of MARCHES) {
      const d = this.pf.prix(p.id, m.id);
      if (d?.precedent) {
        const v = ((d.prix - d.precedent) / d.precedent) * 100;
        if (v >= 12 && p.categorie === 'Céréales') a.push({ niveau: v >= 20 ? 'critique' : 'vigilance', texte: `${p.nom} +${Math.round(v)} % à ${m.nom.split(' (')[0]}` });
      }
    }
    for (const t of this.tensions()) a.push({ niveau: 'vigilance', texte: `${t.p.nom} : demande ${Math.round(t.demande / 1000)} t pour ${Math.round((t.offre + t.stock + t.collecte) / 1000)} t disponibles (offre, collecte, stocks).` });
    for (const x of this.pf.db.axes.items().filter((x) => x.niveau === 'deconseille'))
      a.push({ niveau: 'vigilance', texte: `Axe ${localite(x.origineId).nom.split(' (')[0]} ↔ ${localite(x.destinationId).nom} : ${x.motif.toLowerCase()} (${x.confirmations} confirmations).` });
    const faibles = this.obs().couverture.filter((c) => c.recents < 10);
    if (faibles.length) a.push({ niveau: 'info', texte: `${faibles.length} marché(s) avec peu de relevés ce mois : ${faibles.map((c) => c.m.nom.split(' (')[0]).join(', ')}.` });
    return a;
  });
}
