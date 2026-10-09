import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS } from '../core/data/referentiel';
import { Qualite } from '../core/models';
import { PlateformeService } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../shared/toast';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-cooperative',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Coopérative</div><h1>{{ moi().nom }}</h1>
        <p>Enregistrez les apports des membres, constituez des lots vendables en gros et répartissez automatiquement le paiement par Mobile Money.</p></div>
    </div>
    <div class="grid g4">
      <div class="card kpi"><div class="v">{{ moi().membres ?? membres().length }}</div><div class="l">membres déclarés ({{ membres().length }} actifs)</div></div>
      <div class="card kpi"><div class="v">{{ libres().length }}</div><div class="l">apports à regrouper · {{ totalLibres() | qte }}</div></div>
      <div class="card kpi"><div class="v">{{ lots().length }}</div><div class="l">lots constitués</div></div>
      <div class="card kpi"><div class="v">{{ aPayer() | fcfa: true }}</div><div class="l">à répartir aux membres</div></div>
    </div>

    <div class="tabs section">
      <button [class.on]="onglet() === 'apports'" (click)="onglet.set('apports')">Apports</button>
      <button [class.on]="onglet() === 'lots'" (click)="onglet.set('lots')">Lots & répartition</button>
      <button [class.on]="onglet() === 'membres'" (click)="onglet.set('membres')">Membres</button>
    </div>

    @switch (onglet()) {
      @case ('apports') {
        <div class="split">
          <div>
            <div class="table-wrap">
              <table>
                <thead><tr><th></th><th>Membre</th><th>Produit</th><th class="num">Quantité</th><th>Qualité</th><th>Date</th><th>Lot</th></tr></thead>
                <tbody>
                  @for (a of apports(); track a.id) {
                    <tr>
                      <td>@if (!a.lotId) { <input type="checkbox" [checked]="selection().has(a.id)" (change)="basculer(a.id)" [attr.aria-label]="'Sélectionner ' + a.membre" /> }</td>
                      <td>{{ a.membre }}<div class="small muted">{{ a.telephone }}</div></td>
                      <td>{{ a.produitId | prod }}</td>
                      <td class="num">{{ a.quantiteKg | qte }}</td>
                      <td><span class="badge" [class.ok]="a.qualite === 'A'">{{ a.qualite }}</span></td>
                      <td class="small">{{ a.date }}</td>
                      <td class="small">{{ a.lotId ? codeLot(a.lotId) : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (selection().size) {
              <div class="card section">
                <h3>Constituer un lot avec {{ selection().size }} apport(s) — {{ totalSelection() | qte }}</h3>
                @if (!selectionHomogene()) { <p class="note">Sélectionnez des apports d’un seul produit.</p> }
                @else {
                  <div class="form-grid">
                    <label class="field">Prix de vente (F/kg)<input type="number" [(ngModel)]="lot.prixKg" /></label>
                    <label class="field">Lieu d’enlèvement<select [(ngModel)]="lot.localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                  </div>
                  @if (refLot(); as r) { <p class="small">Prix de marché à {{ r.marcheId | loc }} : {{ r.prix | nb }} F/kg</p> }
                  <div class="actions"><button class="primary" [disabled]="!lot.prixKg" (click)="constituer()">Créer le lot et le mettre en vente</button></div>
                }
              </div>
            }
          </div>
          <div class="card">
            <h2>Enregistrer un apport</h2>
            <div class="form-grid">
              <label class="field full">Nom du membre<input [(ngModel)]="ap.membre" list="membres" /></label>
              <datalist id="membres">@for (m of membres(); track m.nom) { <option [value]="m.nom"></option> }</datalist>
              <label class="field full">Téléphone (paiement Mobile Money)<input type="tel" [(ngModel)]="ap.telephone" /></label>
              <label class="field">Produit<select [(ngModel)]="ap.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Nombre de sacs de 100 kg<input type="number" min="0" step="0.5" [(ngModel)]="ap.sacs" /></label>
              <label class="field">Qualité<select [(ngModel)]="ap.qualite"><option>A</option><option>B</option><option>C</option></select></label>
            </div>
            <p class="small">= {{ ap.sacs * 100 | nb }} kg</p>
            <div class="actions"><button class="primary" [disabled]="!ap.membre || !ap.sacs" (click)="ajouter()">Enregistrer</button></div>
            <p class="hint">Le membre reçoit un SMS de confirmation de son apport (backend).</p>
          </div>
        </div>
      }
      @case ('lots') {
        @for (l of lots(); track l.id) {
          @let r = repartition(l.id);
          <div class="card section">
            <h2>{{ l.produitId | prod }} — lot {{ l.code }} <span class="badge" [class.ok]="l.statut === 'reparti'" [class.info]="l.statut !== 'reparti'">{{ l.statut }}</span></h2>
            <p class="small">{{ l.quantiteKg | qte }} · {{ l.apportIds.length }} apports · créé le {{ l.creeLe }} @if (l.offreId) { · <a [routerLink]="['/marche', l.offreId]">voir l’offre</a> }</p>
            <div class="grid g2">
              <div>
                <div class="ligne"><span>Vente brute ({{ prixLot(l.id) | nb }} F/kg)</span><span>{{ r.brut | fcfa }}</span></div>
                <div class="ligne"><span>Retenue coopérative (3 %)</span><span>− {{ r.retenue | fcfa }}</span></div>
                <div class="ligne total"><span>Net à répartir</span><span>{{ r.net | fcfa }}</span></div>
                @if (l.statut !== 'reparti') { <div class="actions"><button class="primary" (click)="payer(l.id)">Payer les {{ r.lignes.length }} membres par Mobile Money</button></div> }
              </div>
              <table class="small">
                <thead><tr><th>Membre</th><th class="num">Apport</th><th class="num">Montant</th><th></th></tr></thead>
                <tbody>
                  @for (x of r.lignes; track x.apport.id) {
                    <tr><td>{{ x.apport.membre }}</td><td class="num">{{ x.apport.quantiteKg | qte }}</td><td class="num">{{ x.montant | fcfa }}</td><td>@if (x.apport.paye) { <span class="badge ok">payé</span> }</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @empty { <div class="vide card">Aucun lot. Sélectionnez des apports dans l’onglet « Apports ».</div> }
      }
      @case ('membres') {
        <div class="table-wrap">
          <table>
            <thead><tr><th>Membre</th><th>Téléphone</th><th class="num">Apports</th><th class="num">Volume total</th><th>Produits</th></tr></thead>
            <tbody>@for (m of membres(); track m.nom) { <tr><td>{{ m.nom }}</td><td class="small">{{ m.tel }}</td><td class="num">{{ m.n }}</td><td class="num">{{ m.kg | qte }}</td><td class="small">{{ m.produits }}</td></tr> }</tbody>
          </table>
        </div>
      }
    }
  </div>`,
})
export class CooperativePage {
  private readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly toast = inject(ToastService);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly onglet = signal<'apports' | 'lots' | 'membres'>('apports');
  protected readonly selection = signal(new Set<string>());
  readonly vue = input<string>();
  constructor() { effect(() => { const v = this.vue(); this.onglet.set(v === 'lots' || v === 'membres' ? v : 'apports'); }); }
  protected readonly moi = computed(() => this.session.utilisateur()!);

  protected ap = { membre: '', telephone: '', produitId: 'mais', sacs: 1, qualite: 'A' as Qualite };
  protected lot = { prixKg: 0, localiteId: this.session.utilisateur()!.localiteId };

  protected readonly apports = computed(() => this.pf.db.apports.items().filter((a) => a.cooperativeId === this.moi().id).sort((a, b) => b.date.localeCompare(a.date)));
  protected readonly libres = computed(() => this.apports().filter((a) => !a.lotId));
  protected readonly totalLibres = computed(() => this.libres().reduce((s, a) => s + a.quantiteKg, 0));
  protected readonly lots = computed(() => this.pf.db.lots.items().filter((l) => l.cooperativeId === this.moi().id));
  protected readonly aPayer = computed(() => this.lots().filter((l) => l.statut !== 'reparti').reduce((s, l) => s + this.repartition(l.id).net, 0));

  protected readonly membres = computed(() => {
    const m = new Map<string, { nom: string; tel: string; n: number; kg: number; p: Set<string> }>();
    for (const a of this.apports()) {
      const x = m.get(a.membre) ?? { nom: a.membre, tel: a.telephone, n: 0, kg: 0, p: new Set<string>() };
      x.n++; x.kg += a.quantiteKg; x.p.add(PRODUITS.find((p) => p.id === a.produitId)!.nom);
      m.set(a.membre, x);
    }
    return [...m.values()].map((x) => ({ ...x, produits: [...x.p].join(', ') })).sort((a, b) => b.kg - a.kg);
  });

  private readonly selApports = computed(() => [...this.selection()].map((id) => this.pf.db.apports.get(id)!));
  protected readonly totalSelection = computed(() => this.selApports().reduce((s, a) => s + a.quantiteKg, 0));
  protected readonly selectionHomogene = computed(() => new Set(this.selApports().map((a) => a.produitId)).size === 1);
  protected readonly refLot = computed(() => this.selApports()[0] ? this.pf.prixReference(this.selApports()[0].produitId, this.lot.localiteId) : undefined);

  basculer(id: string) {
    const s = new Set(this.selection());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selection.set(s);
  }
  codeLot(id: string) { return this.pf.db.lots.get(id)?.code ?? id; }

  /** Prix réellement obtenu (commandes terminées) sinon prix de l'offre. */
  prixLot(lotId: string) {
    const l = this.pf.db.lots.get(lotId)!;
    const ventes = this.pf.db.commandes.items().filter((c) => c.source.type === 'offre' && c.source.id === l.offreId && c.statut !== 'annulee');
    if (ventes.length) return Math.round(ventes.reduce((s, c) => s + c.prixKg * c.quantiteKg, 0) / ventes.reduce((s, c) => s + c.quantiteKg, 0));
    return l.offreId ? (this.pf.db.offres.get(l.offreId)?.prixKg ?? 0) : 0;
  }
  repartition(lotId: string) { return this.pf.repartition(lotId, this.prixLot(lotId)); }

  async ajouter() {
    await this.pf.ajouterApport({ membre: this.ap.membre.trim(), telephone: this.ap.telephone || '—', produitId: this.ap.produitId, quantiteKg: Math.round(this.ap.sacs * 100), qualite: this.ap.qualite });
    this.toast.afficher(`Apport de ${this.ap.membre} enregistré.`);
    this.ap = { ...this.ap, membre: '', telephone: '', sacs: 1 };
  }

  async constituer() {
    const l = await this.pf.constituerLot([...this.selection()], this.lot.prixKg, this.lot.localiteId);
    this.selection.set(new Set());
    this.toast.afficher(`Lot ${l.code} créé et publié sur le marché.`);
    this.onglet.set('lots');
  }

  async payer(lotId: string) {
    if (!confirm('Lancer les paiements Mobile Money vers les membres ?')) return;
    await this.pf.payerMembres(lotId);
    this.toast.afficher('Paiements envoyés aux membres.');
  }
}
