import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LOCALITES, MARCHES, MOIS_COURT, PARAM_PRIX, PRODUITS, produit } from '../core/data/referentiel';
import { PlateformeService } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { SerieCourbe, UI } from '../shared/ui';

const PALETTE = ['#1f6f4a', '#c9821b', '#2b5f9e', '#b43c2f'];

@Component({
  selector: 'app-prix',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Observatoire</div>
        <h1>Prix des marchés</h1>
        <p>Prix de gros relevés sur {{ marches.length }} marchés du Burkina, convertis dans les unités utilisées sur place (sac, tine, plat yoruba…).</p>
      </div>
      @if (session.utilisateur()) { <button class="primary" (click)="formReleve.set(true)">＋ Publier un prix relevé</button> }
      @else { <a class="btn primary" routerLink="/inscription">Créer un compte pour vendre</a> }
    </div>

    <div class="tabs">
      <button [class.on]="vue() === 'marche'" (click)="vue.set('marche')">Par marché</button>
      <button [class.on]="vue() === 'produit'" (click)="vue.set('produit')">Par produit</button>
      <button [class.on]="vue() === 'outils'" (click)="vue.set('outils')">Convertisseur & coût rendu</button>
    </div>

    @switch (vue()) {
      @case ('marche') {
        <div class="toolbar" style="margin-bottom:12px">
          <label class="field">Marché
            <select [ngModel]="marcheId()" (ngModelChange)="marcheId.set($event)">@for (m of marches; track m.id) { <option [value]="m.id">{{ m.nom }}</option> }</select>
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Produit</th><th class="num">FCFA / kg</th><th class="num">Unité locale</th><th class="num">Évolution</th><th>Relevé du</th><th>Période</th></tr></thead>
            <tbody>
              @for (l of parMarche(); track l.p.id) {
                <tr>
                  <td><strong>{{ l.p.nom }}</strong><div class="small muted">{{ l.p.categorie }}</div></td>
                  <td class="num"><strong>{{ l.prix | nb }}</strong></td>
                  <td class="num small">@if (l.unite) { {{ l.unite.libelle }} : <strong>{{ l.prix * l.unite.kg | nb }} F</strong> }</td>
                  <td class="num"><span class="badge" [class.ko]="l.var > 3" [class.ok]="l.var < -3">{{ l.var > 0 ? '▲ +' : l.var < 0 ? '▼ ' : '' }}{{ l.var | nb: 1 }} %</span></td>
                  <td class="small">{{ l.date }}</td>
                  <td class="small">@if (l.recolte) { <span class="badge ok">récolte</span> } @else if (l.soudure) { <span class="badge warn">soudure</span> }</td>
                </tr>
              } @empty { <tr><td colspan="6" class="vide">Aucun relevé sur ce marché.</td></tr> }
            </tbody>
          </table>
        </div>
      }
      @case ('produit') {
        <div class="chips" style="margin-bottom:12px">
          @for (p of produits; track p.id) { <button class="chip" [class.on]="produitId() === p.id" (click)="choisirProduit(p.id)">{{ p.nom }}</button> }
        </div>
        <div class="split">
          <div class="card">
            <h2>12 derniers mois <span class="small muted">FCFA / kg</span></h2>
            <app-courbe [series]="series()" [mois]="moisCourt" />
            <div class="chips" style="margin-top:8px">
              @for (m of marches; track m.id) { <button class="chip" [class.on]="comparer().includes(m.id)" (click)="basculer(m.id)">{{ m.nom.split(' (')[0] }}</button> }
            </div>
          </div>
          <div class="card">
            <h2>Où vendre, où acheter ?</h2>
            <table class="small">
              <thead><tr><th>Marché</th><th class="num">Prix</th><th class="num">1 sac</th></tr></thead>
              <tbody>
                @for (l of parProduit(); track l.m.id; let i = $index) {
                  <tr>
                    <td>{{ l.m.nom.split(' (')[0] }} @if (i === 0) { <span class="badge ok">moins cher</span> } @if (i === parProduit().length - 1) { <span class="badge warn">plus cher</span> }</td>
                    <td class="num"><strong>{{ l.prix | nb }}</strong></td>
                    <td class="num">{{ l.sac | nb }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="hint">Période de récolte : {{ moisRecolte() }}. Les prix les plus hauts sont en général observés en {{ moisHaut() }}.</p>
          </div>
        </div>
      }
      @case ('outils') {
        <div class="grid g2">
          <div class="card">
            <h2>Convertisseur d’unités</h2>
            <div class="form-grid">
              <label class="field">Produit<select [(ngModel)]="cv.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Quantité<input type="number" min="0" [(ngModel)]="cv.quantite" /></label>
              <label class="field">Unité<select [(ngModel)]="cv.unite">@for (u of unitesCv(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
              <label class="field">Marché de prix<select [(ngModel)]="cv.marcheId">@for (m of marches; track m.id) { <option [value]="m.id">{{ m.nom }}</option> }</select></label>
            </div>
            @let r = conversion();
            <div class="note green" style="margin-top:12px">
              <strong>{{ r.kg | nb: 1 }} kg</strong> ({{ r.kg / 1000 | nb: 2 }} t) — valeur au prix de {{ cv.marcheId | loc }} : <strong>{{ r.valeur | fcfa }}</strong>
              <div class="small">@for (u of unitesCv(); track u.code) { @if (u.code !== cv.unite && u.code !== 'kg') { {{ r.kg / u.kg | nb: 1 }} × {{ u.libelle.toLowerCase() }} · } }</div>
            </div>
            <p class="hint">Équivalences usuelles, variables selon les marchés : à ajuster dans le référentiel.</p>
          </div>
          <div class="card">
            <h2>Calcul du coût rendu</h2>
            <div class="form-grid">
              <label class="field">Produit<select [(ngModel)]="cr.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Prix départ (F/kg)<input type="number" [(ngModel)]="cr.prix" /></label>
              <label class="field">Origine<select [(ngModel)]="cr.origine">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
              <label class="field">Destination<select [(ngModel)]="cr.destination">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
            </div>
            @let c = coutRendu();
            <div style="margin-top:12px">
              <div class="ligne"><span>Prix départ</span><span>{{ cr.prix | nb }} F/kg</span></div>
              <div class="ligne"><span>Transport ({{ c.km }} km, manutention incluse)</span><span>{{ c.transport | nb }} F/kg</span></div>
              <div class="ligne"><span>Pertes en route estimées</span><span>{{ c.pertes | nb }} F/kg</span></div>
              <div class="ligne total"><span>Coût rendu</span><span>{{ c.total | nb }} F/kg</span></div>
              @if (c.marche) { <p class="small" style="margin-top:8px">Prix constaté à destination : <strong>{{ c.marche | nb }} F/kg</strong> → marge brute <span class="badge" [class.ok]="c.marche - c.total > 0" [class.ko]="c.marche - c.total <= 0">{{ c.marche - c.total | nb }} F/kg</span></p> }
            </div>
          </div>
        </div>
      }
    }

    @if (formReleve()) {
      <div class="modal-fond" (click)="formReleve.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Publier un prix relevé</h2>
          <p class="small muted">Votre relevé enrichit l’observatoire. Il est signé de votre compte et pourra être comparé aux relevés des agents.</p>
          <div class="form-grid">
            <label class="field">Produit<select [(ngModel)]="rl.produitId" (ngModelChange)="rl.unite = 'kg'">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
            <label class="field">Marché<select [(ngModel)]="rl.marcheId">@for (m of marches; track m.id) { <option [value]="m.id">{{ m.nom }}</option> }</select></label>
            <label class="field">Prix constaté (FCFA)<input type="number" min="1" [(ngModel)]="rl.prix" /></label>
            <label class="field">Pour<select [(ngModel)]="rl.unite">@for (u of unitesRl(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
          </div>
          @if (rl.prix) { <p class="small">Soit <strong>{{ prixKgReleve() | nb }} FCFA/kg</strong> (dernier relevé : {{ dernierRl() ?? '—' }} F/kg)</p> }
          @if (ecartSuspect()) { <div class="note">Écart de plus de 40 % avec le dernier relevé : vérifiez l’unité avant de publier.</div> }
          <div class="actions">
            <button (click)="formReleve.set(false)">Annuler</button>
            <button class="primary" [disabled]="!rl.prix || session.utilisateur()?.kyc !== 'verifie'" (click)="publier()">Publier</button>
          </div>
        </div>
      </div>
    }
  </div>`,
})
export class PrixPage {
  protected readonly pf = inject(PlateformeService);
  protected readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly marches = MARCHES;
  protected readonly localites = LOCALITES;
  protected readonly produits = PRODUITS;
  protected readonly moisCourt = MOIS_COURT;

  protected readonly vue = signal<'marche' | 'produit' | 'outils'>('marche');
  /** ?vue=produit|outils */
  readonly vueParam = input<string>('', { alias: 'vue' });
  constructor() { effect(() => { const v = this.vueParam(); if (v === 'produit' || v === 'outils' || v === 'marche') this.vue.set(v); }); }
  protected readonly marcheId = signal(this.marcheProche());
  protected readonly produitId = signal('mais');
  protected readonly comparer = signal<string[]>(['OUA', 'BOB', 'SLN']);
  protected readonly formReleve = signal(false);

  protected cv = { produitId: 'mais', quantite: 10, unite: 'sac100', marcheId: 'OUA' };
  protected cr = { produitId: 'mais', prix: 225, origine: 'SLN', destination: 'OUA' };
  protected rl = { produitId: 'mais', marcheId: this.marcheProche(), prix: 0, unite: 'kg' };

  private marcheProche() {
    const loc = this.session.utilisateur()?.localiteId ?? 'OUA';
    return MARCHES.some((m) => m.id === loc) ? loc : 'OUA';
  }

  protected readonly parMarche = computed(() => {
    const mois = new Date().getMonth() + 1;
    return PRODUITS.map((p) => {
      const d = this.pf.prix(p.id, this.marcheId());
      if (!d) return null;
      return {
        p, prix: d.prix, date: d.date, unite: p.unites[1],
        var: d.precedent ? ((d.prix - d.precedent) / d.precedent) * 100 : 0,
        recolte: p.recolte.includes(mois), soudure: p.categorie === 'Céréales' && [6, 7, 8].includes(mois),
      };
    }).filter((x) => !!x);
  });

  choisirProduit(id: string) {
    this.produitId.set(id);
    this.comparer.set(['OUA', ...PARAM_PRIX[id].zones.slice(0, 2)]);
  }
  basculer(id: string) {
    const c = this.comparer();
    this.comparer.set(c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4));
  }

  protected readonly series = computed<SerieCourbe[]>(() =>
    this.comparer().map((m, i) => ({ nom: MARCHES.find((x) => x.id === m)!.nom.split(' (')[0], couleur: PALETTE[i], valeurs: this.pf.serie(this.produitId(), m) })),
  );

  protected readonly parProduit = computed(() => {
    const p = produit(this.produitId());
    return MARCHES.map((m) => ({ m, prix: this.pf.prix(p.id, m.id)?.prix ?? 0 }))
      .filter((x) => x.prix)
      .map((x) => ({ ...x, sac: x.prix * (p.unites[1]?.kg ?? 1) }))
      .sort((a, b) => a.prix - b.prix);
  });

  protected readonly moisRecolte = computed(() => produit(this.produitId()).recolte.map((m) => ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][m - 1]).join(', '));
  protected readonly moisHaut = computed(() => {
    const s = PARAM_PRIX[this.produitId()].saison;
    return MOIS_COURT[s.indexOf(Math.max(...s))];
  });

  unitesCv() { return produit(this.cv.produitId).unites; }
  unitesRl() { return produit(this.rl.produitId).unites; }

  conversion() {
    const u = this.unitesCv().find((x) => x.code === this.cv.unite) ?? this.unitesCv()[0];
    const kg = (this.cv.quantite || 0) * u.kg;
    return { kg, valeur: kg * (this.pf.prix(this.cv.produitId, this.cv.marcheId)?.prix ?? 0) };
  }

  coutRendu() {
    const c = this.pf.coutRendu(this.cr.prix || 0, this.cr.produitId, this.cr.origine, this.cr.destination);
    return { ...c, marche: this.pf.prixReference(this.cr.produitId, this.cr.destination)?.prix };
  }

  prixKgReleve() {
    const u = this.unitesRl().find((x) => x.code === this.rl.unite) ?? this.unitesRl()[0];
    return Math.round(this.rl.prix / u.kg);
  }
  dernierRl() { return this.pf.prix(this.rl.produitId, this.rl.marcheId)?.prix; }
  ecartSuspect() {
    const d = this.dernierRl();
    return !!d && !!this.rl.prix && Math.abs(this.prixKgReleve() - d) / d > 0.4;
  }

  async publier() {
    await this.pf.publierReleve(this.rl.produitId, this.rl.marcheId, this.prixKgReleve());
    this.formReleve.set(false);
    this.toast.afficher('Prix publié. Merci pour votre contribution !');
    this.rl.prix = 0;
  }
}
