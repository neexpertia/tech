import { Component, computed, inject, input, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService, SEUIL_KYC_ACHAT } from '../../core/achat.service';
import { COMMISSION_PCT, DELAI_CONFIRMATION_H, LOCALITES, coutTransportKg, distanceKm, produit } from '../../core/data/referentiel';
import { LIBELLE_STATUT, PlateformeService, fraicheur, offreVisible } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-offre-detail',
  imports: [FormsModule, RouterLink, LowerCasePipe, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <a [routerLink]="base()" class="small">← Marché</a>
    @if (offre(); as o) {
      @let p = prod();
      <div class="entete">
        <app-vignette [produitId]="o.produitId" />
        <div class="t">
          <h1>{{ p.nom }} — {{ o.prixKg | nb }} F/kg</h1>
          <p class="muted">{{ o.vendeurId | qui }}, {{ o.localiteId | loc }}</p>
          <div class="chips">
            @if (o.statut === 'active') { <app-fraicheur [offre]="o" /> } @else { <span class="badge ko">{{ o.statut === 'epuisee' ? 'Épuisée' : 'Retirée' }}</span> }
            @if (vendeur()?.kyc === 'verifie') { <span class="badge ok">✔ Vendeur vérifié</span> }
            @if (avisProduit().length) { <span class="badge">★ {{ noteProduit() | nb: 1 }} ({{ avisProduit().length }} avis)</span> }
          </div>
        </div>
        @if (session.utilisateur() && !estVendeur()) { <app-actions-offre [offre]="o" /> }
      </div>

      <div class="split">
        <div>
          <div class="card">
            <h2>Ce qu’il faut savoir</h2>
            <ul class="faits">
              <li><app-ic n="check" /><span>{{ o.quantiteRestanteKg | qte }} disponibles · {{ o.qualite | qualite }}</span></li>
              <li><app-ic n="horloge" /><span>Vous payez seulement après l’accord du vendeur (24 h)</span></li>
              <li><app-ic n="bouclier" /><span>Argent gardé par FasoAgri jusqu’à la réception</span></li>
              @if (fiabilite(); as f) { <li><app-ic n="groupe" /><span>Commandes honorées : {{ f.taux }} %</span></li> }
              @if (o.livraison) { <li><app-ic n="camion" /><span>Le vendeur peut livrer</span></li> }
            </ul>
            @if (session.utilisateur() && !estVendeur() && o.statut === 'active') { <button (click)="demanderDispo()">Demander s’il l’a toujours</button> }
          </div>

          <div class="card section">
            <h2>Description</h2>
            <p>{{ o.description }}</p>
            <div class="ligne"><span>Prix sur place</span><span>{{ o.prixKg | nb }} F/kg · {{ o.prixKg * (p.unites[1]?.kg ?? 1) | nb }} F le {{ (p.unites[1]?.libelle ?? 'kg') | lowercase }}</span></div>
            @if (ref(); as r) { <div class="ligne"><span>Prix habituel au marché</span><span>{{ r.prix | nb }} F/kg</span></div> }
            <div class="ligne"><span>Numéro du lot</span><span>{{ o.lot }}</span></div>
          </div>

          <!-- ===== Avis produits (achats vérifiés) ===== -->
          <div class="card section">
            <h2>Avis des acheteurs</h2>
            <ul class="clean">
              @for (a of avisProduit(); track a.id) {
                <li><app-etoiles [note]="a.note" /><div>{{ a.commentaire }}</div><div class="small muted">{{ a.auteurId | qui }}, a acheté ce produit</div></li>
              } @empty { <li class="muted small">Pas encore d’avis.</li> }
            </ul>
          </div>

          @if (alternatives().length && !estVendeur()) {
            <div class="section">
              <h2>Autres vendeurs</h2>
              <div class="rayon">@for (a of alternatives(); track a.o.id) { <app-carte-offre [offre]="a.o" [base]="base()" /> }</div>
            </div>
          }
        </div>

        <!-- ===== Colonne d'achat ===== -->
        <div class="card collant">
          @if (!session.utilisateur()) {
            <h2>Acheter ce produit</h2>
            <p class="small muted">Compte gratuit, en 1 minute.</p>
            <a class="btn primary large" routerLink="/inscription">Créer mon compte</a>
            <a class="btn large" routerLink="/connexion" style="margin-top:8px">Se connecter</a>
            <p class="hint">Prix livré à Ouagadougou ≈ {{ renduOuaga() | nb }} F/kg</p>
          } @else if (estVendeur()) {
            <h2>Votre offre</h2>
            <p class="small"><app-fraicheur [offre]="o" /></p>
            <p class="small muted">Confirmez régulièrement votre stock : les acheteurs voient la date et les offres non confirmées depuis 30 jours sont masquées.</p>
            <div class="form-grid">
              <label class="field">Quantité restante (kg)<input type="number" min="0" [(ngModel)]="stockMaj" /></label>
              <label class="field">Prix (F/kg)<input type="number" min="1" [(ngModel)]="prixMaj" /></label>
            </div>
            <button class="primary large" (click)="confirmerStock()">✓ Je confirme mon stock</button>
            @if (o.statut === 'active') { <button class="danger large" (click)="retirer()">Retirer l’offre</button> }
            <h3 class="section">Commandes sur cette offre</h3>
            <ul class="clean small">
              @for (c of commandesOffre(); track c.id) { <li><a [routerLink]="['/commandes', c.id]">{{ c.reference }}</a> — {{ c.acheteurId | qui }} · {{ c.quantiteKg | qte }} <span class="badge" [class.warn]="c.statut === 'attente_confirmation'">{{ libelle[c.statut] }}</span></li> }
              @empty { <li class="muted">Aucune commande pour le moment.</li> }
            </ul>
            <a class="small" routerLink="/messages">💬 {{ nbConversations() }} discussion(s) sur cette offre →</a>
          } @else if (disponible()) {
            <h2>Commander</h2>
            <div class="form-grid">
              <label class="field">Quantité<input type="number" min="1" [ngModel]="qte()" (ngModelChange)="qte.set($event)" /></label>
              <label class="field">Unité<select [ngModel]="uniteCode()" (ngModelChange)="unite.set($event)">@for (u of p.unites; track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
              <label class="field full">Livrer à<select [ngModel]="destination()" (ngModelChange)="destination.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
              <label class="field full"><span><input type="checkbox" [ngModel]="transport()" (ngModelChange)="transport.set($event)" /> Inclure le transport ({{ km() }} km)</span></label>
            </div>
            @let c = calcul();
            <div style="margin-top:10px">
              <div class="ligne"><span>{{ c.kg | nb }} kg × {{ o.prixKg | nb }} F</span><span>{{ c.marchandise | fcfa }}</span></div>
              <div class="ligne"><span>Transport estimé</span><span>{{ c.transport | fcfa }}</span></div>
              <div class="ligne"><span>Frais de service ({{ commission }} %)</span><span>{{ c.commission | fcfa }}</span></div>
              <div class="ligne total"><span>Total</span><span>{{ c.total | fcfa }}</span></div>
            </div>
            @if (c.kg > o.quantiteRestanteKg) { <p class="note">Quantité supérieure au disponible ({{ o.quantiteRestanteKg | qte }}).</p> }
            @if (kycRequis()) { <p class="note">Au-delà de {{ seuil | fcfa }}, votre identité doit être vérifiée. <a routerLink="/profil">Ajouter une pièce →</a></p> }
            <button class="primary large" [disabled]="!commandable()" (click)="commander()">Commander</button>
            <button class="large" [disabled]="!commandable()" (click)="auPanier()">Ajouter au panier</button>
            <button class="large" (click)="discuter()"><app-ic n="messages" [taille]="18" /> Écrire au vendeur</button>
          } @else {
            <h2>Plus disponible</h2>
            <p class="small muted">Ce lot est épuisé ou n’a pas été confirmé par le vendeur.</p>
            <a class="btn primary large" [routerLink]="'/marche'" [queryParams]="{ produit: o.produitId }">Voir les offres de {{ p.nom | lowercase }}</a>
            <a class="btn large" routerLink="/alertes" [queryParams]="{ produit: o.produitId }" style="margin-top:8px">🔔 Créer une alerte</a>
          }
        </div>
      </div>
    } @else {
      <div class="vide">Offre introuvable.</div>
    }
  </div>`,
  styles: `
    .entete { display: flex; gap: 14px; align-items: flex-start; margin: 10px 0 18px; }
    .entete app-vignette ::ng-deep .vg { width: 72px; height: 72px; font-size: 40px; border-radius: 14px; }
    .collant h2 { margin-bottom: 14px; }
    .entete .t { flex: 1; min-width: 0; }
    .entete h1 { margin-bottom: 2px; }
    .entete p { margin: 0 0 6px; }
    .faits { list-style: none; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 10px; }
    .faits li { display: flex; gap: 10px; align-items: center; }
    .faits app-ic { color: var(--vert); }
    .garanties { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 10px; }
    .garanties li { display: flex; gap: 10px; align-items: flex-start; }
    .garanties .ic { font-size: 18px; width: 24px; text-align: center; }
    .vend { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .collant { position: sticky; top: 70px; }
    @media (max-width: 1000px) { .collant { order: -1; position: static; } }
    .large { width: 100%; justify-content: center; padding: 10px; margin-top: 10px; font-size: 15px; }
    .ghost-b { background: var(--surface-2); }
    .etapes { margin: 14px 0 0; padding-left: 1.2rem; color: var(--muted); }
    .etapes li { margin: 3px 0; }
    .alt { display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class OffreDetailPage {
  readonly id = input.required<string>();
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly achat = inject(AchatService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  protected readonly commission = COMMISSION_PCT;
  protected readonly delai = DELAI_CONFIRMATION_H;
  protected readonly seuil = SEUIL_KYC_ACHAT;
  protected readonly libelle = LIBELLE_STATUT;

  protected readonly offre = computed(() => this.pf.db.offres.get(this.id()));
  protected readonly prod = computed(() => produit(this.offre()!.produitId));
  protected readonly fr = computed(() => fraicheur(this.offre()!));
  protected readonly estVendeur = computed(() => this.offre()?.vendeurId === this.session.utilisateur()?.id);
  protected readonly disponible = computed(() => !!this.offre() && offreVisible(this.offre()!));
  protected readonly vendeur = computed(() => this.pf.utilisateur(this.offre()!.vendeurId));
  protected readonly score = computed(() => this.pf.score(this.offre()!.vendeurId));
  protected readonly entrepot = computed(() => this.offre()?.entrepotId ? this.pf.db.entrepots.get(this.offre()!.entrepotId!) : undefined);
  protected readonly depot = computed(() => this.pf.db.depots.items().find((d) => d.entrepotId === this.offre()?.entrepotId && d.deposantId === this.offre()?.vendeurId && d.produitId === this.offre()?.produitId && d.statut === 'en_stock'));
  protected readonly province = computed(() => this.localites.find((l) => l.id === this.offre()!.localiteId)?.province);
  protected readonly commandesOffre = computed(() => this.pf.db.commandes.items().filter((c) => c.source.type === 'offre' && c.source.id === this.id()));
  protected readonly nbConversations = computed(() => this.pf.db.conversations.items().filter((c) => c.offreId === this.id()).length);
  protected readonly ref = computed(() => this.pf.prixReference(this.offre()!.produitId, this.offre()!.localiteId));
  protected readonly ecart = computed(() => { const r = this.ref(); return r ? ((this.offre()!.prixKg - r.prix) / r.prix) * 100 : null; });

  /** Quantité réservée par des commandes pas encore payées/expédiées */
  protected readonly reserve = computed(() => this.commandesOffre().filter((c) => ['attente_confirmation', 'attente_paiement'].includes(c.statut) && c.acheteurId !== this.session.utilisateur()?.id).reduce((s, c) => s + c.quantiteKg, 0));

  /** Taux de confirmation du vendeur : commandes confirmées / commandes reçues avec étape de confirmation */
  protected readonly fiabilite = computed(() => {
    const v = this.offre()!.vendeurId;
    const cmds = this.pf.db.commandes.items().filter((c) => c.vendeurId === v && c.historique.some((h) => h.statut === 'attente_confirmation') && c.statut !== 'attente_confirmation');
    if (!cmds.length) return null;
    const ok = cmds.filter((c) => c.historique.some((h) => h.statut === 'attente_paiement')).length;
    return { taux: Math.round((ok / cmds.length) * 100), total: cmds.length };
  });

  protected readonly avisProduit = computed(() => {
    const o = this.offre()!;
    return this.pf.db.avis.items().filter((a) => a.achatVerifie && (a.offreId === o.id || (a.produitId === o.produitId && a.cibleId === o.vendeurId)));
  });
  protected readonly noteProduit = computed(() => { const l = this.avisProduit(); return l.length ? l.reduce((s, a) => s + a.note, 0) / l.length : 0; });

  protected readonly qte = signal(1);
  protected readonly unite = signal('');
  protected readonly uniteCode = computed(() => this.unite() || this.prod().unites[this.prod().unites.length > 1 ? 1 : 0].code);
  protected readonly destination = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly transport = signal(true);
  protected readonly base = () => (this.router.url.startsWith('/decouvrir') ? '/decouvrir/marche' : '/marche');
  protected readonly renduOuaga = computed(() => this.pf.coutRendu(this.offre()!.prixKg, this.offre()!.produitId, this.offre()!.localiteId, 'OUA').total);
  protected readonly km = computed(() => distanceKm(this.offre()!.localiteId, this.destination()));
  protected readonly alternatives = computed(() => this.offre() ? this.achat.alternatives(this.offre()!.produitId, this.destination(), this.id()) : []);

  protected stockMaj = 0;
  protected prixMaj = 0;
  ngOnInit() { const o = this.offre(); if (o) { this.stockMaj = o.quantiteRestanteKg; this.prixMaj = o.prixKg; } }

  protected readonly calcul = computed(() => {
    const o = this.offre()!;
    const us = produit(o.produitId).unites;
    const u = us.find((x) => x.code === this.uniteCode()) ?? us[0];
    const kg = Math.round((this.qte() || 0) * u.kg);
    const marchandise = kg * o.prixKg;
    const transport = this.transport() ? coutTransportKg(this.km()) * kg : 0;
    const commission = Math.round((marchandise * COMMISSION_PCT) / 100);
    return { kg, marchandise, transport, commission, total: marchandise + transport + commission };
  });
  protected readonly kycRequis = computed(() => this.calcul().total > SEUIL_KYC_ACHAT && this.session.utilisateur()?.kyc !== 'verifie');
  protected readonly commandable = computed(() => { const c = this.calcul(); return c.kg > 0 && c.kg <= this.offre()!.quantiteRestanteKg && !this.kycRequis(); });

  async commander() {
    const c = await this.pf.commanderOffre(this.id(), this.calcul().kg, this.destination(), this.transport());
    this.toast.afficher(`Commande ${c.reference} émise : quantité réservée, le vendeur confirme sous ${DELAI_CONFIRMATION_H} h.`);
    this.router.navigate(['/commandes', c.id]);
  }

  async auPanier() {
    await this.achat.ajouterAuPanier(this.id(), this.calcul().kg);
    this.toast.afficher('Ajouté au panier.');
  }

  async discuter() {
    const c = await this.achat.discussion(this.offre()!);
    this.router.navigate(['/messages', c.id]);
  }

  async demanderDispo() {
    const c = await this.achat.discussion(this.offre()!);
    await this.achat.demanderDisponibilite(c, this.calcul().kg > 1 ? this.calcul().kg : undefined);
    this.toast.afficher('Question envoyée au vendeur : il peut répondre en un clic.');
    this.router.navigate(['/messages', c.id]);
  }

  async confirmerStock() {
    await this.pf.confirmerStock(this.id(), { quantiteRestanteKg: +this.stockMaj, prixKg: +this.prixMaj });
    this.toast.afficher('Stock confirmé : les acheteurs voient « Stock confirmé aujourd’hui ».');
  }

  async retirer() {
    if (!confirm('Retirer cette offre du marché ?')) return;
    await this.pf.retirerOffre(this.id());
    this.toast.afficher('Offre retirée.');
  }
}
