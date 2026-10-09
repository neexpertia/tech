import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS } from '../../core/data/referentiel';
import { Qualite } from '../../core/models';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { SolutionsService } from '../../core/solutions.service';
import { QuestionComponent } from '../../shared/question';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

/** 3. ACHETEUR — « Où acheter suffisamment de produit, au bon prix, avec le moins de risque possible ? » */
@Component({
  selector: 'app-approvisionnement',
  imports: [FormsModule, RouterLink, QuestionComponent, ...UI],
  template: `
  <div class="page">
    <app-question emoji="🧑🏾‍💼" acteur="Acheteur" question="Où acheter suffisamment de produit, au bon prix, avec le moins de risque possible ?"
      [etapes]="['Indiquez volume, qualité, lieu et date', 'La plateforme combine plusieurs vendeurs pour atteindre le volume', 'Classement par coût rendu chez vous, corrigé du risque', 'Commandez tout en séquestre ; le manque devient une demande publique']" />

    <div class="card saisie">
      <label class="field">Produit<select [ngModel]="produitId()" (ngModelChange)="produitId.set($event)">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
      <label class="field">Volume voulu (t)<input type="number" min="0.1" step="0.1" [ngModel]="tonnes()" (ngModelChange)="tonnes.set($event)" /></label>
      <label class="field">Livré à<select [ngModel]="dest()" (ngModelChange)="dest.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
      <label class="field">Qualité minimale<select [ngModel]="qualite()" (ngModelChange)="qualite.set($event)"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
      <label class="field">Avant le<input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
      <label class="field"><span><input type="checkbox" [ngModel]="prudence()" (ngModelChange)="prudence.set($event)" /> Exclure les vendeurs à risque élevé</span></label>
    </div>

    @let p = plan();
    <div class="grid g4 section">
      <div class="card kpi"><div class="v">{{ p.couvert / (tonnes() * 10) | nb }} %</div><div class="l">du volume trouvé ({{ p.couvert | qte }})</div></div>
      <div class="card kpi"><div class="v">{{ p.coutMoyen | nb }} F/kg</div><div class="l">coût moyen rendu @if (p.prixMarcheDest) { · marché local {{ p.prixMarcheDest | nb }} F }</div></div>
      <div class="card kpi"><div class="v">{{ p.total | fcfa: true }}</div><div class="l">budget total (hors frais de service 2 %)</div></div>
      <div class="card kpi"><div class="v"><span class="badge big" [class.ok]="p.risqueGlobal === 'faible'" [class.warn]="p.risqueGlobal === 'moyen'" [class.ko]="p.risqueGlobal === 'élevé'">{{ p.risqueGlobal }}</span></div><div class="l">risque global · {{ p.nbFournisseurs }} fournisseur(s)</div></div>
    </div>
    @if (p.prixMarcheDest && p.coutMoyen) {
      <p class="small">{{ p.ecartMarchePct <= 0 ? 'Économie' : 'Surcoût' }} de <strong>{{ (p.ecartMarchePct < 0 ? -p.ecartMarchePct : p.ecartMarchePct) | nb: 1 }} %</strong> par rapport à un achat au marché de {{ dest() | loc }}, avec paiement garanti et traçabilité des lots.</p>
    }

    <h2 class="section">Plan d’achat proposé</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Vendeur</th><th class="num">Quantité</th><th class="num">Prix départ</th><th class="num">Transport + pertes</th><th class="num">Coût rendu</th><th>Risque</th></tr></thead>
        <tbody>
          @for (l of p.lignes; track l.offre.id) {
            <tr>
              <td><a [routerLink]="['/marche', l.offre.id]"><strong>{{ l.offre.vendeurId | qui }}</strong></a><div class="small muted">{{ l.offre.localiteId | loc }} · {{ l.rendu.km }} km · qualité {{ l.offre.qualite }} · lot {{ l.offre.lot }}</div></td>
              <td class="num">{{ l.kg | qte }}<div class="small muted">{{ l.kg | enUnite: produitId() }}</div></td>
              <td class="num">{{ l.offre.prixKg | nb }}</td>
              <td class="num">{{ l.rendu.transport + l.rendu.pertes | nb }}</td>
              <td class="num"><strong>{{ l.rendu.total | nb }}</strong></td>
              <td><span class="badge" [class.ok]="l.niveau === 'faible'" [class.warn]="l.niveau === 'moyen'" [class.ko]="l.niveau === 'élevé'">{{ l.niveau }}</span><div class="small muted">{{ l.raisons.join(' · ') }}</div></td>
            </tr>
          } @empty { <tr><td colspan="6" class="vide">Aucune offre disponible pour ces critères.</td></tr> }
        </tbody>
      </table>
    </div>

    <div class="actions">
      @if (p.reste > 0) { <button (click)="publierReste()">📋 Publier une demande pour les {{ p.reste | qte }} manquants</button> }
      <button class="primary" [disabled]="!p.lignes.length || envoi()" (click)="commanderTout()">Commander ce plan ({{ p.lignes.length }} commande(s), paiement en séquestre)</button>
    </div>

    @if (p.exclus) {
      <details class="section"><summary class="small">{{ p.exclus }} offre(s) écartée(s) car jugée(s) trop risquée(s)</summary>
        <ul class="clean small">@for (c of exclus(); track c.offre.id) { <li>{{ c.offre.vendeurId | qui }} — {{ c.offre.quantiteRestanteKg | qte }} à {{ c.rendu.total | nb }} F/kg rendu : {{ c.raisons.join(', ') }}</li> }</ul>
      </details>
    }
    <p class="hint">Risque : identité vérifiée, historique et avis du vendeur, stock en magasin avec récépissé, date de disponibilité, état de la route signalé. 1 point de risque ≈ +0,5 % sur le prix dans le classement.</p>
  </div>`,
  styles: `
    .saisie { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; align-items: end; }
    @media (max-width: 1000px) { .saisie { grid-template-columns: 1fr 1fr; } }
    .big { font-size: 15px; padding: 3px 12px; }
  `,
})
export class ApprovisionnementPage {
  private readonly sol = inject(SolutionsService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly envoi = signal(false);

  protected readonly produitId = signal('mais');
  protected readonly tonnes = signal(150);
  protected readonly dest = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly qualite = signal<Qualite>('B');
  protected readonly date = signal(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  protected readonly prudence = signal(true);

  constructor() {
    // Pré-remplir avec la dernière demande ouverte de l'acheteur
    const u = this.session.utilisateur();
    const d = u && this.pf.db.demandes.items().find((x) => x.acheteurId === u.id && x.statut === 'ouverte');
    if (d) {
      this.produitId.set(d.produitId); this.tonnes.set(d.quantiteKg / 1000); this.dest.set(d.localiteLivraisonId);
      this.qualite.set(d.qualiteMin); this.date.set(d.dateLimite);
    }
  }

  protected readonly plan = computed(() => this.sol.planAppro(this.produitId(), Math.round(this.tonnes() * 1000), this.dest(), this.qualite(), this.date(), this.session.utilisateur()!.id, this.prudence()));
  protected readonly exclus = computed(() => this.plan().candidats.filter((c) => c.niveau === 'élevé'));

  async commanderTout() {
    if (this.session.utilisateur()?.kyc !== 'verifie') { this.toast.afficher('Votre compte doit être vérifié pour commander.'); return; }
    if (!confirm(`Créer ${this.plan().lignes.length} commande(s) ? Vous paierez chacune en séquestre.`)) return;
    this.envoi.set(true);
    for (const l of this.plan().lignes) await this.pf.commanderOffre(l.offre.id, l.kg, this.dest(), true);
    this.toast.afficher('Commandes créées : payez-les pour lancer les expéditions.');
    this.router.navigate(['/commandes']);
  }

  async publierReste() {
    const d = await this.pf.publierDemande({
      produitId: this.produitId(), quantiteKg: this.plan().reste, qualiteMin: this.qualite(), localiteLivraisonId: this.dest(),
      dateLimite: this.date(), type: 'rfq', description: 'Complément de volume (plan d’approvisionnement).',
      ...(this.plan().prixMarcheDest ? { prixMaxKg: this.plan().prixMarcheDest } : {}),
    });
    this.toast.afficher('Demande publiée : les vendeurs et coopératives sont alertés.');
    this.router.navigate(['/demandes', d.id]);
  }
}
