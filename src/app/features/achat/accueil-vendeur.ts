import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { produit } from '../../core/data/referentiel';
import { PlateformeService, fraicheur, fmtKg } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { UI } from '../../shared/ui';

interface Tache { produitId: string; texte: string; lien: string; cta: string }

/** Accueil du mode « Vendre » : ce qu'il faut faire, ce que je vends, qui cherche mes produits. */
@Component({
  selector: 'app-accueil-vendeur',
  imports: [RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head">
      <h1>Bonjour {{ prenom() }}</h1>
      <a class="btn primary" routerLink="/marche/nouvelle"><app-ic n="pousse" [taille]="18" />Publier un produit</a>
    </div>

    <div class="chiffres">
      <div><strong>{{ ventesMois() | fcfa: true }}</strong><span>vendus ce mois</span></div>
      <div><strong>{{ enCours() }}</strong><span>commandes en cours</span></div>
      <div><strong>{{ mesOffres().length }}</strong><span>produits en ligne</span></div>
    </div>

    @if (taches().length) {
      <section class="section">
        <h2>À faire</h2>
        <div class="taches">
          @for (t of taches(); track t.texte) {
            <a class="tache" [routerLink]="t.lien"><app-vignette [produitId]="t.produitId" /><span class="t">{{ t.texte }}</span><span class="btn primary">{{ t.cta }}</span></a>
          }
        </div>
      </section>
    } @else {
      <p class="note green section">Rien à faire pour le moment.</p>
    }

    <section class="section">
      <div class="titre-rayon"><h2>Mes produits</h2><a routerLink="/marche" [queryParams]="{ vue: 'mes' }">Tout voir</a></div>
      <div class="rayon">
        @for (o of mesOffres(); track o.id) { <app-carte-offre [offre]="o" /> }
        <a class="ajout" routerLink="/marche/nouvelle"><app-ic n="pousse" [taille]="28" /><span>Publier un produit</span></a>
      </div>
    </section>

    @if (demandes().length) {
      <section class="section">
        <div class="titre-rayon"><h2>Des acheteurs cherchent vos produits</h2><a routerLink="/demandes">Tout voir</a></div>
        <div class="taches">
          @for (d of demandes(); track d.id) {
            <a class="tache" [routerLink]="['/demandes', d.id]"><app-vignette [produitId]="d.produitId" />
              <span class="t">{{ d.acheteurId | qui }} cherche {{ kg(d.quantiteKg) }} de {{ nom(d.produitId) }}@if (d.prixMaxKg) { , jusqu’à {{ d.prixMaxKg }} F/kg }</span>
              <span class="btn">Proposer</span></a>
          }
        </div>
      </section>
    }
  </div>`,
  styles: `
    .chiffres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .chiffres div { background: var(--blanc); border: 1px solid var(--ligne); border-radius: var(--radius); padding: 16px 18px; display: flex; flex-direction: column; }
    .chiffres strong { font-size: var(--t-xl); font-variant-numeric: tabular-nums; }
    .chiffres span { font-size: var(--t-s); color: var(--gris); }
    @media (max-width: 600px) { .chiffres { grid-template-columns: 1fr 1fr 1fr; gap: 8px; } .chiffres div { padding: 12px; } .chiffres strong { font-size: var(--t-l); } }
    .taches { display: flex; flex-direction: column; gap: 8px; }
    .tache { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: var(--radius); color: var(--encre); text-decoration: none; }
    .tache:hover { border-color: var(--vert); }
    .tache .t { flex: 1; min-width: 0; }
    .tache .btn { padding: 6px 12px; font-size: var(--t-s); }
    .ajout { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 260px; border: 1px dashed var(--ligne); border-radius: var(--radius); color: var(--vert); text-decoration: none; font-weight: 600; }
    .ajout:hover { border-color: var(--vert); }
  `,
})
export class AccueilVendeurPage {
  private readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly achat = inject(AchatService);
  private get moi() { return this.session.utilisateur()!; }

  protected readonly prenom = computed(() => { const u = this.session.utilisateur()!; return u.typeVendeur === 'producteur' ? u.nom.split(' ')[0] : u.nom.replace(/ \(fictif\)| \(fictive\)/, ''); });
  nom(p: string) { return produit(p).nom.toLowerCase(); }
  kg(v: number) { return fmtKg(v); }

  private readonly mesVentes = computed(() => this.pf.db.commandes.items().filter((c) => c.vendeurId === this.session.utilisateur()?.id));
  protected readonly mesOffres = computed(() => this.pf.db.offres.items().filter((o) => o.vendeurId === this.session.utilisateur()?.id && o.statut === 'active'));
  protected readonly enCours = computed(() => this.mesVentes().filter((c) => ['attente_confirmation', 'attente_paiement', 'sequestre', 'expediee', 'livree'].includes(c.statut)).length);
  protected readonly ventesMois = computed(() => {
    const mois = new Date().toISOString().slice(0, 7);
    return this.mesVentes().filter((c) => c.creeLe.startsWith(mois) && !['annulee', 'attente_confirmation'].includes(c.statut)).reduce((s, c) => s + c.quantiteKg * c.prixKg, 0);
  });

  /** Les actions qui font avancer une vente, la plus urgente d'abord */
  protected readonly taches = computed<Tache[]>(() => {
    const t: Tache[] = [];
    const nom = (p: string) => produit(p).nom;
    for (const c of this.mesVentes()) {
      if (c.statut === 'attente_confirmation') t.push({ produitId: c.produitId, texte: `${this.pf.nom(c.acheteurId)} veut ${fmtKg(c.quantiteKg)} de ${nom(c.produitId).toLowerCase()}. L’avez-vous ?`, lien: `/commandes/${c.id}`, cta: 'Répondre' });
      if (c.statut === 'sequestre') t.push({ produitId: c.produitId, texte: `${nom(c.produitId)} payé. ${c.livraison ? 'Signalez le départ.' : 'Organisez la livraison.'}`, lien: `/commandes/${c.id}`, cta: c.livraison ? 'Départ' : 'Organiser' });
      if (c.statut === 'expediee') t.push({ produitId: c.produitId, texte: `${nom(c.produitId)} en route vers ${this.pf.nom(c.acheteurId)}`, lien: `/commandes/${c.id}`, cta: 'Nouvelles' });
    }
    for (const cv of this.achat.mesConversations().filter((c) => c.vendeurId === this.session.utilisateur()?.id && c.nonLusVendeur > 0))
      t.push({ produitId: cv.produitId, texte: `${this.pf.nom(cv.acheteurId)} vous a écrit (${nom(cv.produitId).toLowerCase()})`, lien: `/messages/${cv.id}`, cta: 'Répondre' });
    for (const o of this.mesOffres().filter((o) => ['a_reconfirmer', 'masque'].includes(fraicheur(o).niveau)))
      t.push({ produitId: o.produitId, texte: `${nom(o.produitId)} : avez-vous encore ce produit ?`, lien: `/marche/${o.id}`, cta: 'Confirmer' });
    return t;
  });

  /** Demandes ouvertes sur les produits que je vends */
  protected readonly demandes = computed(() => {
    const p = new Set([...(this.moi.produitsVendus ?? []), ...this.mesOffres().map((o) => o.produitId)]);
    return this.pf.db.demandes.items().filter((d) => d.statut === 'ouverte' && p.has(d.produitId)).slice(0, 3);
  });
}
