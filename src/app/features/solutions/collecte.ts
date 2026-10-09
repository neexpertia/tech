import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PRODUITS, produit } from '../../core/data/referentiel';
import { Collecte, Qualite } from '../../core/models';
import { PlateformeService, aujourdhui, de, fmtKg } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

/** 2. COOPÉRATIVE — agréger la production des membres et la vendre au meilleur débouché. */
@Component({
  selector: 'app-collecte',
  imports: [FormsModule, RouterLink, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🤝" acteur="Coopérative" question="Comment agréger efficacement la production de plusieurs producteurs et la vendre au meilleur débouché ?"
      [etapes]="['Partir d’un débouché (acheteur) ou d’un objectif de volume', 'Recueillir les engagements des membres et suivre les livraisons', 'Constituer le lot et vendre au meilleur net', 'Payer chaque membre au prorata']" />

    <div class="layout">
      <div>
        <div class="toolbar" style="justify-content:space-between;margin-bottom:8px"><h2 style="margin:0">Mes campagnes</h2><button class="primary" (click)="form.set(!form())">＋ Nouvelle campagne</button></div>
        @if (form()) {
          <div class="card" style="margin-bottom:10px">
            <label class="field">Partir d’une demande d’acheteur (conseillé)
              <select [(ngModel)]="nc.demandeId" (ngModelChange)="prefill($event)"><option value="">— objectif libre —</option>
                @for (d of demandesOuvertes(); track d.id) { <option [value]="d.id">{{ d.acheteurId | qui }} · {{ d.quantiteKg | qte }} {{ d.produitId | prod }}{{ d.prixMaxKg ? ' · ' + d.prixMaxKg + ' F/kg' : '' }}</option> }
              </select></label>
            <div class="form-grid" style="margin-top:8px">
              <label class="field">Produit<select [(ngModel)]="nc.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Objectif (t)<input type="number" min="1" [(ngModel)]="nc.objectifT" /></label>
              <label class="field">Qualité min.<select [(ngModel)]="nc.qualiteMin"><option>A</option><option>B</option><option>C</option></select></label>
              <label class="field">Prix payé aux membres (F/kg)<input type="number" [(ngModel)]="nc.prix" /></label>
              <label class="field">Date limite<input type="date" [(ngModel)]="nc.dateLimite" /></label>
            </div>
            <div class="actions"><button (click)="form.set(false)">Annuler</button><button class="primary" [disabled]="!nc.objectifT || !nc.prix" (click)="creer()">Lancer et prévenir les membres</button></div>
          </div>
        }
        @for (c of mesCollectes(); track c.id) {
          @let a = sol.avancementCollecte(c.id);
          <button class="card camp" [class.sel]="c.id === selId()" (click)="selId.set(c.id)">
            <div class="l1"><strong>{{ c.produitId | prod }} · objectif {{ c.objectifKg | qte }}</strong><span class="badge" [class.ok]="c.statut === 'ouverte'">{{ c.statut }}</span></div>
            <div class="prog"><span class="liv" [style.width.%]="a.pctLivre"></span><span class="eng" [style.width.%]="a.pctEngage - a.pctLivre"></span></div>
            <div class="small muted">{{ a.engage | qte }} engagés · {{ a.livre | qte }} livrés · {{ a.jours }} j restants @if (a.demande) { · pour {{ a.demande.acheteurId | qui }} }</div>
          </button>
        } @empty { <div class="vide card">Aucune campagne. Lancez-en une à partir d’une demande d’acheteur.</div> }
      </div>

      @if (sel(); as c) {
        @let a = sol.avancementCollecte(c.id);
        <div>
          <div class="card">
            <h2>{{ c.produitId | prod }} — {{ a.engage | qte }} / {{ c.objectifKg | qte }}</h2>
            <div class="grid g4">
              <div class="kpi"><div class="v">{{ a.pctEngage | nb }} %</div><div class="l">engagé</div></div>
              <div class="kpi"><div class="v">{{ a.pctLivre | nb }} %</div><div class="l">livré au magasin</div></div>
              <div class="kpi"><div class="v">{{ a.manque | qte }}</div><div class="l">manquant</div></div>
              <div class="kpi"><div class="v">{{ c.engagements.length }}</div><div class="l">membres engagés</div></div>
            </div>
            @if (a.manque > 0 && c.statut === 'ouverte') {
              <p class="note small" style="margin-top:10px">Il manque {{ a.manque | qte }} ({{ a.manque / 100 | nb }} sacs) en {{ a.jours }} jours. <button class="ghost" (click)="relancer(c)">📲 Relancer les membres par SMS</button></p>
            }
          </div>

          <div class="card section">
            <h3>Engagements des membres</h3>
            <table class="small">
              <thead><tr><th>Membre</th><th class="num">Engagé</th><th>Date</th><th>Livré au magasin</th></tr></thead>
              <tbody>
                @for (e of c.engagements; track $index; let i = $index) {
                  <tr><td>{{ e.membre }}</td><td class="num">{{ e.kg | qte }}</td><td>{{ e.date }}</td>
                    <td><label><input type="checkbox" [checked]="e.livre" [disabled]="c.statut !== 'ouverte'" (change)="basculerLivre(c, i)" /> {{ e.livre ? 'oui' : 'non' }}</label></td></tr>
                }
              </tbody>
            </table>
            @if (c.statut === 'ouverte') {
              <div class="toolbar" style="margin-top:8px">
                <input placeholder="Nom du membre" [(ngModel)]="ne.membre" list="membres-coop" />
                <datalist id="membres-coop">@for (m of membresConnus(); track m) { <option [value]="m"></option> }</datalist>
                <input type="number" min="1" style="width:90px" [(ngModel)]="ne.sacs" /> <span class="small">sacs</span>
                <button [disabled]="!ne.membre || !ne.sacs" (click)="engager(c)">＋ Ajouter</button>
              </div>
            }
          </div>

          <div class="card section">
            <h3>Meilleurs débouchés pour {{ volumeVente(c) | qte }} (net à la porte du magasin)</h3>
            @for (o of debouches(); track o.titre; let i = $index) {
              <div class="deb" [class.top]="i === 0">
                <div><strong>{{ o.titre }}</strong><div class="small muted">{{ o.detail }}</div></div>
                <div class="num"><strong>{{ o.netKg | nb }} F/kg</strong><div class="small">{{ o.netTotal | fcfa: true }}</div></div>
                <span class="badge" [class.ok]="o.risque === 'faible'" [class.warn]="o.risque !== 'faible'">{{ o.risque }}</span>
              </div>
            } @empty { <p class="muted small">Aucun débouché trouvé pour ce produit.</p> }
            @if (debouches()[0]; as b) {
              <p class="small" style="margin-top:8px">Marge coopérative au prix payé aux membres ({{ c.prixIndicatifKg }} F/kg) : <strong>{{ (b.netKg - c.prixIndicatifKg) * volumeVente(c) | fcfa: true }}</strong> ({{ b.netKg - c.prixIndicatifKg | nb }} F/kg)</p>
            }
            @if (c.statut === 'ouverte') {
              <div class="actions">
                <button class="primary" [disabled]="!a.livre" (click)="constituer(c)">Constituer le lot avec les {{ a.livre | qte }} livrés et le mettre en vente</button>
              </div>
            } @else if (c.lotId) { <p class="small"><a routerLink="/cooperative" [queryParams]="{ vue: 'lots' }">Voir le lot et la répartition →</a></p> }
          </div>
        </div>
      }
    </div>
  </div>`,
  styles: `
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .camp { display: block; width: 100%; text-align: left; margin-bottom: 8px; }
    .camp.sel { border-color: var(--primary); background: var(--primary-soft); }
    .l1 { display: flex; justify-content: space-between; gap: 8px; }
    .prog { display: flex; height: 10px; background: var(--surface-2); border-radius: 999px; overflow: hidden; margin: 8px 0 4px; }
    .liv { background: var(--primary); } .eng { background: color-mix(in srgb, var(--primary) 40%, transparent); }
    .deb { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--border); }
    .deb.top strong { color: var(--primary); }
  `,
})
export class CollectePage {
  protected readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly produits = PRODUITS;
  protected readonly form = signal(false);
  protected readonly selId = signal<string | null>(null);
  protected nc = { demandeId: '', produitId: 'sorgho', objectifT: 30, qualiteMin: 'B' as Qualite, prix: 0, dateLimite: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10) };
  protected ne = { membre: '', sacs: 10 };

  private get moi() { return this.session.utilisateur()!; }
  protected readonly mesCollectes = computed(() => this.pf.db.collectes.items().filter((c) => c.cooperativeId === this.moi.id || this.session.role() === 'admin'));
  protected readonly sel = computed(() => this.mesCollectes().find((c) => c.id === this.selId()) ?? this.mesCollectes()[0]);
  protected readonly demandesOuvertes = computed(() => this.pf.db.demandes.items().filter((d) => d.statut === 'ouverte' && d.acheteurId !== this.moi.id));
  protected readonly membresConnus = computed(() => [...new Set(this.pf.db.apports.items().filter((a) => a.cooperativeId === this.moi.id).map((a) => a.membre))]);

  volumeVente(c: Collecte) { const a = this.sol.avancementCollecte(c.id); return Math.max(a.engage, 1); }
  protected readonly debouches = computed(() => {
    const c = this.sel();
    return c ? this.sol.debouches(c.produitId, this.volumeVente(c), this.moi.localiteId, c.qualiteMin, this.moi.id).slice(0, 5) : [];
  });

  prefill(id: string) {
    const d = this.pf.db.demandes.get(id);
    if (!d) return;
    const km = 0;
    const ref = d.prixMaxKg ?? this.pf.prixReference(d.produitId, d.localiteLivraisonId)?.prix ?? 0;
    const net = this.pf.coutRendu(0, d.produitId, this.moi.localiteId, d.localiteLivraisonId).transport + km;
    this.nc = { ...this.nc, produitId: d.produitId, objectifT: Math.round(d.quantiteKg / 1000), qualiteMin: d.qualiteMin, dateLimite: d.dateLimite, prix: Math.round((ref - net) * 0.9 / 5) * 5 };
  }

  async creer() {
    const c = await this.pf.db.collectes.create({
      cooperativeId: this.moi.id, produitId: this.nc.produitId, objectifKg: this.nc.objectifT * 1000, qualiteMin: this.nc.qualiteMin, prixIndicatifKg: this.nc.prix,
      dateLimite: this.nc.dateLimite, ...(this.nc.demandeId ? { demandeId: this.nc.demandeId } : {}), engagements: [], statut: 'ouverte', creeLe: aujourdhui(),
    });
    this.form.set(false);
    this.selId.set(c.id);
    this.toast.afficher(`Campagne lancée : SMS envoyé aux ${this.moi.membres ?? ''} membres.`);
  }

  async engager(c: Collecte) {
    await this.pf.db.collectes.update(c.id, { engagements: [...c.engagements, { membre: this.ne.membre.trim(), telephone: '—', kg: this.ne.sacs * 100, date: aujourdhui(), livre: false }] });
    this.ne = { membre: '', sacs: 10 };
  }

  async basculerLivre(c: Collecte, i: number) {
    await this.pf.db.collectes.update(c.id, { engagements: c.engagements.map((e, j) => (j === i ? { ...e, livre: !e.livre } : e)) });
  }

  relancer(c: Collecte) {
    const a = this.sol.avancementCollecte(c.id);
    this.toast.afficher(`SMS envoyé : « Il manque ${fmtKg(a.manque)} ${de(produit(c.produitId).nom)} à ${c.prixIndicatifKg} F/kg, avant le ${c.dateLimite}. »`);
  }

  /** Transforme les engagements livrés en apports, puis en lot mis en vente. */
  async constituer(c: Collecte) {
    const livres = c.engagements.filter((e) => e.livre);
    const ids: string[] = [];
    for (const e of livres) ids.push((await this.pf.ajouterApport({ membre: e.membre, telephone: e.telephone, produitId: c.produitId, quantiteKg: e.kg, qualite: c.qualiteMin })).id);
    const best = this.debouches()[0];
    const prixVente = best ? Math.max(c.prixIndicatifKg, best.prixBrutKg) : c.prixIndicatifKg;
    const lot = await this.pf.constituerLot(ids, prixVente, this.moi.localiteId);
    await this.pf.db.collectes.update(c.id, { statut: 'close', lotId: lot.id });
    this.toast.afficher(`Lot ${lot.code} constitué (${fmtKg(lot.quantiteKg)}) et mis en vente.`);
    if (c.demandeId) this.router.navigate(['/demandes', c.demandeId]);
  }
}
