import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NOM_MOIS, produit } from '../../core/data/referentiel';
import { Depot, Offre } from '../../core/models';
import { PlateformeService, aujourdhui, de, fmtKg } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

const STATUT = { vendable: 'Vendable', a_surveiller: 'À surveiller', a_risque: 'À risque' };

/** 5. ENTREPÔT — « Comment remplir mon entrepôt avec des produits qui vont réellement être vendus, tout en maîtrisant le stock ? » */
@Component({
  selector: 'app-magasin',
  imports: [FormsModule, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🏬" acteur="Entrepôt" question="Comment remplir mon entrepôt avec des produits qui vont réellement être vendus, tout en maîtrisant le stock ?"
      [etapes]="['Chaque lot est classé : vendable, à surveiller, à risque (âge, acheteurs, tendance des prix)', 'Prévenez le déposant quand un acheteur cherche son produit', 'Remplissez l’espace libre avec les lots et récoltes qui arrivent près de chez vous']" />

    @if (entrepots().length > 1) {
      <select [ngModel]="entrepotId()" (ngModelChange)="entrepotId.set($event)" style="margin-bottom:12px">@for (e of entrepots(); track e.id) { <option [value]="e.id">{{ e.nom }}</option> }</select>
    }
    @if (a(); as x) {
      <div class="grid g4">
        <div class="card kpi"><div class="v">{{ x.taux | nb }} %</div><div class="l">occupé · {{ x.occupeKg | qte }} / {{ x.e.capaciteT }} t</div><div class="bar" style="margin-top:6px"><span [style.width.%]="x.taux"></span></div></div>
        <div class="card kpi"><div class="v">{{ x.libreKg | qte }}</div><div class="l">de place libre à remplir</div></div>
        <div class="card kpi"><div class="v">{{ x.revenuMois | fcfa: true }}</div><div class="l">revenu mensuel de stockage ({{ x.e.tarifSacMois }} F/sac/mois)</div></div>
        <div class="card kpi"><div class="v">{{ x.dureeMoy || '—' }} j</div><div class="l">durée moyenne avant sortie ({{ x.nbSorties }} sorties)</div></div>
      </div>

      <h2 class="section">1. Mon stock : qu’est-ce qui va vraiment se vendre ?</h2>
      <div class="chips" style="margin-bottom:8px">
        @for (k of statuts; track k) { <span class="badge" [class.ok]="k === 'vendable'" [class.warn]="k === 'a_surveiller'" [class.ko]="k === 'a_risque'">{{ libelle[k] }} : {{ compte(k) }}</span> }
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Lot</th><th>Déposant</th><th class="num">Quantité</th><th>Âge / conservation</th><th>Acheteurs en attente</th><th class="num">Prix 3 mois</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            @for (s of x.stocks; track s.d.id) {
              <tr>
                <td><strong>{{ s.p.nom }}</strong> <span class="badge">{{ s.d.qualite }}</span><div class="small muted">{{ s.d.recu }}</div></td>
                <td class="small">{{ s.d.deposantId | qui }}</td>
                <td class="num">{{ s.d.quantiteKg | qte }}<div class="small muted">{{ s.valeur | fcfa: true }}</div></td>
                <td style="min-width:150px"><div class="bar"><span [style.width.%]="s.usure * 100 > 100 ? 100 : s.usure * 100" [style.background]="s.usure > 0.8 ? 'var(--danger)' : s.usure > 0.5 ? 'var(--accent)' : null"></span></div><div class="small muted">{{ s.age }} j / {{ s.p.conservationJ }} j</div></td>
                <td class="small">@if (s.demandes.length) { <strong>{{ s.demandes.length }}</strong> demande(s) · {{ s.volDemande | qte }} } @else { <span class="muted">aucune</span> }</td>
                <td class="num"><span class="badge" [class.ok]="s.tendance > 2" [class.ko]="s.tendance < -2">{{ s.tendance > 0 ? '+' : '' }}{{ s.tendance | nb }} %</span></td>
                <td><span class="badge" [class.ok]="s.statut === 'vendable'" [class.warn]="s.statut === 'a_surveiller'" [class.ko]="s.statut === 'a_risque'">{{ libelle[s.statut] }}</span></td>
                <td>
                  <div class="toolbar">
                    <button class="ghost" (click)="prevenir(s.d, s.demandes.length, s.statut)">📲 Prévenir</button>
                    @if (s.d.statut === 'en_stock') { <button class="ghost" (click)="sortie(s.d)">Sortie</button> }
                  </div>
                </td>
              </tr>
            } @empty { <tr><td colspan="8" class="vide">Magasin vide.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="hint">À risque : plus de 80 % de la durée de conservation, ou pas d’acheteur alors que les prix baissent. « Prévenir » envoie un SMS au déposant (acheteurs trouvés, ou stock qui vieillit).</p>

      <h2 class="section">2. Remplir la place libre ({{ x.libreKg | qte }})</h2>
      <div class="grid g3">
        <div class="card">
          <h3>Lots à vendre près d’ici, non stockés</h3>
          <ul class="clean small">
            @for (p of x.proches.slice(0, 8); track p.o.id) {
              <li><strong>{{ p.o.produitId | prod }}</strong> · {{ p.o.quantiteRestanteKg | qte }} · {{ p.o.vendeurId | qui }} <span class="muted">({{ p.km }} km)</span>
                <button class="ghost" (click)="proposer(p.o)">Proposer mon magasin</button></li>
            } @empty { <li class="muted">Aucun lot proche.</li> }
          </ul>
        </div>
        <div class="card">
          <h3>Collectes de coopératives en cours</h3>
          <ul class="clean small">
            @for (c of x.collectes; track c.id) {
              <li><strong>{{ c.cooperativeId | qui }}</strong> · {{ c.produitId | prod }} · objectif {{ c.objectifKg | qte }} jusqu’au {{ c.dateLimite }}
                <button class="ghost" (click)="proposerCoop(c.cooperativeId, c.produitId)">Proposer</button></li>
            } @empty { <li class="muted">Aucune collecte proche.</li> }
          </ul>
        </div>
        <div class="card">
          <h3>Récoltes qui arrivent dans la zone</h3>
          <ul class="clean small">
            @for (p of x.recoltes; track p.id) { <li><strong>{{ p.nom }}</strong> — récolte en {{ moisRecolte(p.recolte) }} · se conserve {{ p.conservationJ }} j</li> }
            @empty { <li class="muted">Pas de récolte stockable dans les 2 prochains mois.</li> }
          </ul>
          <p class="hint">Période idéale pour démarcher : juste après la récolte, quand les prix sont bas et que les producteurs ont intérêt à stocker.</p>
        </div>
      </div>
    } @else { <div class="vide card">Aucun entrepôt rattaché à votre compte.</div> }
  </div>`,
})
export class MagasinPage {
  private readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly libelle = STATUT;
  protected readonly statuts = ['vendable', 'a_surveiller', 'a_risque'] as const;

  protected readonly entrepots = computed(() => this.session.role() === 'admin' ? this.pf.db.entrepots.items() : this.pf.db.entrepots.items().filter((e) => e.gestionnaireId === this.session.utilisateur()?.id));
  protected readonly entrepotId = signal('');
  protected readonly a = computed(() => {
    const id = this.entrepotId() || this.entrepots()[0]?.id;
    return id ? this.sol.analyseEntrepot(id) : null;
  });

  compte(k: string) { return this.a()?.stocks.filter((s) => s.statut === k).length ?? 0; }
  moisRecolte(m: number[]) { return m.map((x) => NOM_MOIS[x - 1]).join(', '); }

  async prevenir(d: Depot, nbDemandes: number, statut: string) {
    const p = produit(d.produitId).nom;
    const texte = nbDemandes
      ? `${nbDemandes} acheteur(s) cherchent ${de(p)} : votre stock ${d.recu} (${fmtKg(d.quantiteKg)}) peut être vendu. Publiez une offre.`
      : statut === 'a_risque' ? `Votre stock ${d.recu} ${de(p)} approche de sa durée de conservation : pensez à le vendre.` : `Point sur votre stock ${d.recu} ${de(p)}.`;
    await this.pf.notifier(d.deposantId, texte, '/marche/nouvelle');
    this.toast.afficher('Déposant prévenu par SMS.');
  }

  async sortie(d: Depot) {
    if (!confirm(`Enregistrer la sortie du stock ${d.recu} ?`)) return;
    await this.pf.db.depots.update(d.id, { statut: 'retire', dateSortie: aujourdhui() });
    this.toast.afficher('Sortie enregistrée, place libérée.');
  }

  async proposer(o: Offre) {
    const e = this.a()!.e;
    await this.pf.notifier(o.vendeurId, `${e.nom} propose de stocker votre ${produit(o.produitId).nom.toLowerCase()} à ${e.tarifSacMois} F/sac/mois${e.warrantage ? ' (magasin agréé, récépissé reconnu par les banques)' : ''}. Récépissé fourni.`, '/stockage');
    this.toast.afficher('Proposition envoyée au vendeur.');
  }

  async proposerCoop(coopId: string, produitId: string) {
    const e = this.a()!.e;
    await this.pf.notifier(coopId, `${e.nom} peut accueillir le lot de votre collecte ${de(produit(produitId).nom)} (${e.tarifSacMois} F/sac/mois).`, '/stockage');
    this.toast.afficher('Proposition envoyée à la coopérative.');
  }
}
