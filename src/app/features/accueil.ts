import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MARCHES, distanceKm, localite, produit } from '../core/data/referentiel';
import { PlateformeService, de, fmtKg } from '../core/plateforme.service';
import { LIBELLE_ROLE, SessionService } from '../core/session.service';
import { ACCES, CONFIG_ROLES } from '../core/roles';
import { UI } from '../shared/ui';

interface Tache { icone: string; texte: string; lien: string; urgence: 'haute' | 'normale' }

@Component({
  selector: 'app-accueil',
  imports: [RouterLink, ...UI],
  template: `
  @let moi = session.utilisateur()!;
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">{{ config().emoji }} {{ config().espace }}@if (moi.categorie) { · {{ moi.categorie }} } · {{ moi.localiteId | loc }}</div>
        <h1>Bonjour, {{ prenom() }}</h1>
        <p>{{ dateJour }} — marché de référence : <strong>{{ marcheRef() | loc }}</strong></p>
      </div>
    </div>

    <div class="tuiles">
      @for (t of config().tuiles; track t.titre) {
        <a class="tuile" [routerLink]="t.route" [queryParams]="t.query ?? {}"><span class="ic">{{ t.icone }}</span><strong>{{ t.titre }}</strong><span class="small muted">{{ t.texte }}</span></a>
      }
    </div>

    <div class="grid g4 section">
      @for (k of kpis(); track k.l) {
        <a class="card kpi lien-carte" [routerLink]="k.lien"><div class="v">{{ k.v }}</div><div class="l">{{ k.l }}</div></a>
      }
    </div>

    <div class="split section">
      <div class="card">
        <h2>À faire <span class="badge" [class.ko]="taches().length">{{ taches().length }}</span></h2>
        <ul class="clean">
          @for (t of taches(); track t.texte) {
            <li><a [routerLink]="t.lien" class="tache">{{ t.icone }} <span>{{ t.texte }}</span> @if (t.urgence === 'haute') { <span class="badge warn">prioritaire</span> } <span class="fl">→</span></a></li>
          } @empty { <li class="vide">Rien à traiter pour le moment 👍</li> }
        </ul>
      </div>
      <div class="card">
        <h2>Prix du jour <a class="small" routerLink="/prix">Tous les prix →</a></h2>
        <table class="small">
          <thead><tr><th>Produit</th><th class="num">FCFA/kg</th><th class="num">Tendance</th></tr></thead>
          <tbody>
            @for (l of prixJour(); track l.id) {
              <tr>
                <td>{{ l.nom }}<div class="muted">{{ l.sac }}</div></td>
                <td class="num"><strong>{{ l.prix | nb }}</strong></td>
                <td class="num"><span class="badge" [class.ko]="l.var > 3" [class.ok]="l.var < -3">{{ l.var > 0 ? '▲' : l.var < 0 ? '▼' : '=' }} {{ l.var | nb: 1 }} %</span></td>
              </tr>
            }
          </tbody>
        </table>
        <p class="hint">Dernier relevé sur le marché de {{ marcheRef() | loc }}, comparé au relevé précédent.</p>
      </div>
    </div>

    <div class="grid g2 section">
      <div class="card">
        <h2>Dernières notifications <a class="small" routerLink="/notifications">Tout voir →</a></h2>
        <ul class="clean">
          @for (n of pf.mesNotifications().slice(0, 5); track n.id) {
            <li [class.nonlu]="!n.lu"><a [routerLink]="n.lien ?? '/notifications'">{{ n.texte }}</a> <span class="small muted">· {{ n.date }}</span></li>
          } @empty { <li class="muted">Aucune notification.</li> }
        </ul>
      </div>
      @if (voitAxes()) {
      <div class="card">
        <h2>État des axes routiers <a class="small" routerLink="/transport">Signaler →</a></h2>
        <ul class="clean">
          @for (a of axes(); track a.id) {
            <li>
              <span class="badge" [class.ko]="a.niveau === 'deconseille'" [class.warn]="a.niveau === 'prudence'" [class.info]="a.niveau === 'info'">{{ a.motif }}</span>
              <strong> {{ a.origineId | loc }} ↔ {{ a.destinationId | loc }}</strong>
              <div class="small muted">{{ a.commentaire }} · {{ a.confirmations }} confirmation(s) · {{ a.date }}</div>
            </li>
          }
        </ul>
      </div>
      }
    </div>
  </div>`,
  styles: `
    .tuiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .tuile { display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); text-decoration: none; color: var(--text); box-shadow: var(--shadow); }
    .tuile:hover { border-color: var(--primary); background: var(--primary-soft); }
    .tuile .ic { font-size: 28px; }
    @media (max-width: 900px) { .tuiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tache { display: flex; gap: 8px; align-items: center; text-decoration: none; color: var(--text); padding: 4px 0; }
    .tache span:first-of-type { flex: 1; }
    .fl { color: var(--muted); }
    li.nonlu a { font-weight: 600; }
  `,
})
export class AccueilPage {
  protected readonly session = inject(SessionService);
  protected readonly pf = inject(PlateformeService);
  private readonly db = this.pf.db;
  protected readonly libelle = LIBELLE_ROLE;
  protected readonly config = computed(() => CONFIG_ROLES[this.session.role()!]);
  protected readonly voitAxes = computed(() => this.session.a(...ACCES['transport']));
  protected readonly dateJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  private get moi() { return this.session.utilisateur()!; }

  protected readonly prenom = computed(() => {
    const u = this.session.utilisateur()!;
    return ['producteur'].includes(u.role) ? u.nom.split(' ')[0] : u.nom.replace(/ \(fictif\)| \(fictive\)/, '');
  });

  protected readonly marcheRef = computed(() => {
    const loc = this.session.utilisateur()!.localiteId;
    return [...MARCHES].sort((a, b) => distanceKm(a.id, loc) - distanceKm(b.id, loc))[0].id;
  });

  private readonly mesCommandes = computed(() => this.db.commandes.items().filter((c) => c.acheteurId === this.moi.id || c.vendeurId === this.moi.id));

  protected readonly kpis = computed(() => {
    const id = this.moi.id;
    const enCours = this.mesCommandes().filter((c) => !['terminee', 'annulee'].includes(c.statut)).length;
    const score = this.pf.score(id);
    switch (this.moi.role) {
      case 'producteur': case 'cooperative': case 'collecteur': {
        const offres = this.db.offres.items().filter((o) => o.vendeurId === id && o.statut === 'active');
        const ventes = this.mesCommandes().filter((c) => c.vendeurId === id && c.statut === 'terminee').reduce((s, c) => s + c.quantiteKg * c.prixKg, 0);
        return [
          { v: String(offres.length), l: 'offres actives', lien: '/marche' },
          { v: String(enCours), l: 'commandes en cours', lien: '/commandes' },
          { v: `${Math.round(ventes / 1000).toLocaleString('fr-FR')} k`, l: 'FCFA de ventes encaissées', lien: '/commandes' },
          { v: `${score.grade} · ${score.valeur}`, l: 'score de confiance', lien: '/profil' },
        ];
      }
      case 'transporteur': {
        const ouverts = this.db.frets.items().filter((f) => f.statut === 'ouvert' && f.tonnage <= (this.moi.capaciteT ?? 99)).length;
        const miens = this.db.frets.items().filter((f) => f.transporteurId === id && f.statut !== 'livre').length;
        return [
          { v: String(ouverts), l: 'frets compatibles avec mon camion', lien: '/transport' },
          { v: String(miens), l: 'trajets attribués', lien: '/transport' },
          { v: `${this.moi.capaciteT} t`, l: 'capacité déclarée', lien: '/profil' },
          { v: `${score.grade} · ${score.valeur}`, l: 'score de confiance', lien: '/profil' },
        ];
      }
      case 'entrepot': {
        const e = this.db.entrepots.items().find((x) => x.gestionnaireId === id);
        const occ = e ? this.db.depots.items().filter((d) => d.entrepotId === e.id && d.statut !== 'retire').reduce((s, d) => s + d.quantiteKg, 0) / 1000 : 0;
        return [
          { v: `${Math.round(occ)} t`, l: `en stock sur ${e?.capaciteT ?? 0} t`, lien: '/stockage' },
          { v: `${e ? Math.round((occ / e.capaciteT) * 100) : 0} %`, l: 'taux d’occupation', lien: '/stockage' },
          { v: String(this.db.depots.items().filter((d) => d.entrepotId === e?.id && d.statut !== 'retire').length), l: 'lots en stock', lien: '/magasin' },
          { v: e?.warrantage ? 'Oui' : 'Non', l: 'magasin agréé (récépissés)', lien: '/stockage' },
        ];
      }
      case 'institution': {
        const o = this.db.offres.items().filter((x) => x.statut === 'active');
        return [
          { v: `${Math.round(o.reduce((s, x) => s + x.quantiteRestanteKg, 0) / 1000)} t`, l: 'offertes à la vente', lien: '/observatoire' },
          { v: `${Math.round(this.db.demandes.items().filter((d) => d.statut === 'ouverte').reduce((s, d) => s + d.quantiteKg, 0) / 1000)} t`, l: 'demandées par les acheteurs', lien: '/observatoire' },
          { v: `${Math.round(this.db.depots.items().filter((d) => d.statut !== 'retire').reduce((s, d) => s + d.quantiteKg, 0) / 1000)} t`, l: 'stockées en magasin', lien: '/stockage' },
          { v: String(this.db.axes.items().filter((a) => a.niveau === 'deconseille').length), l: 'axes déconseillés', lien: '/transport' },
        ];
      }
      default: {
        const dem = this.db.demandes.items().filter((d) => d.acheteurId === id && d.statut === 'ouverte');
        const cot = this.db.cotations.items().filter((c) => dem.some((d) => d.id === c.demandeId) && c.statut === 'envoyee').length;
        return [
          { v: String(dem.length), l: 'demandes ouvertes', lien: '/demandes' },
          { v: String(cot), l: 'cotations à examiner', lien: '/demandes' },
          { v: String(enCours), l: 'commandes en cours', lien: '/commandes' },
          { v: String(this.db.offres.items().filter((o) => o.statut === 'active').length), l: 'offres sur le marché', lien: '/marche' },
        ];
      }
    }
  });

  protected readonly taches = computed<Tache[]>(() => {
    const id = this.moi.id;
    const t: Tache[] = [];
    for (const c of this.mesCommandes()) {
      const p = produit(c.produitId).nom.toLowerCase();
      if (c.acheteurId === id && c.statut === 'attente_paiement') t.push({ icone: '💳', texte: `Payer ${c.reference} (${p}) pour lancer l’expédition`, lien: `/commandes/${c.id}`, urgence: 'haute' });
      if (c.acheteurId === id && ['expediee', 'livree'].includes(c.statut)) t.push({ icone: '✅', texte: `Confirmer la réception de ${c.reference} (${p})`, lien: `/commandes/${c.id}`, urgence: c.statut === 'livree' ? 'haute' : 'normale' });
      if (c.vendeurId === id && c.statut === 'sequestre') t.push({ icone: '📦', texte: `Expédier ${c.reference} — l’acheteur a payé`, lien: `/commandes/${c.id}`, urgence: 'haute' });
      if (c.statut === 'litige') t.push({ icone: '⚠️', texte: `Litige en cours sur ${c.reference}`, lien: `/commandes/${c.id}`, urgence: 'haute' });
    }
    if (this.session.estVendeur()) {
      const mesProduits = new Set(this.db.offres.items().filter((o) => o.vendeurId === id).map((o) => o.produitId));
      for (const d of this.db.demandes.items().filter((d) => d.statut === 'ouverte' && mesProduits.has(d.produitId) && d.acheteurId !== id)) {
        if (!this.db.cotations.items().some((c) => c.demandeId === d.id && c.vendeurId === id))
          t.push({ icone: '📋', texte: `${this.pf.nom(d.acheteurId)} cherche ${fmtKg(d.quantiteKg)} ${de(produit(d.produitId).nom)} — envoyer une cotation`, lien: `/demandes/${d.id}`, urgence: 'normale' });
      }
    }
    for (const d of this.db.demandes.items().filter((d) => d.acheteurId === id && d.statut === 'ouverte')) {
      const n = this.db.cotations.items().filter((c) => c.demandeId === d.id && c.statut === 'envoyee').length;
      if (n) t.push({ icone: '📨', texte: `${n} cotation(s) à examiner — ${produit(d.produitId).nom.toLowerCase()}`, lien: `/demandes/${d.id}`, urgence: 'normale' });
    }
    for (const f of this.db.frets.items()) {
      if (f.demandeurId === id && f.statut === 'ouvert' && f.candidatures.length) t.push({ icone: '🚚', texte: `${f.candidatures.length} transporteur(s) candidat(s) pour ${this.loc(f.origineId)} → ${this.loc(f.destinationId)}`, lien: '/transport', urgence: 'normale' });
      if (f.transporteurId === id && ['attribue', 'en_route'].includes(f.statut)) t.push({ icone: '🛣️', texte: `Trajet ${this.loc(f.origineId)} → ${this.loc(f.destinationId)} (${f.statut === 'attribue' ? 'chargement le ' + f.dateChargement : 'en route'})`, lien: '/transport', urgence: 'normale' });
    }
    if (this.moi.role === 'admin') {
      for (const u of this.db.utilisateurs.items().filter((u) => u.kyc === 'en_attente')) t.push({ icone: '🪪', texte: `Vérifier le compte de ${u.nom}`, lien: '/admin', urgence: 'normale' });
    }
    if (this.moi.kyc !== 'verifie') t.unshift({ icone: '🪪', texte: 'Compléter la vérification de votre compte (CNIB)', lien: '/profil', urgence: 'haute' });
    return t.sort((a, b) => (a.urgence === b.urgence ? 0 : a.urgence === 'haute' ? -1 : 1));
  });

  protected readonly prixJour = computed(() => {
    const m = this.marcheRef();
    const miens = [...new Set(this.db.offres.items().filter((o) => o.vendeurId === this.moi.id).map((o) => o.produitId))];
    const ids = [...miens, 'mais', 'sorgho', 'mil', 'riz', 'niebe', 'oignon', 'tomate'].filter((v, i, a) => a.indexOf(v) === i).slice(0, 7);
    return ids.map((id) => {
      const p = this.pf.prix(id, m) ?? this.pf.prix(id, 'OUA');
      const pr = produit(id);
      const u = pr.unites[1];
      return {
        id, nom: pr.nom, prix: p?.prix ?? 0,
        var: p?.precedent ? ((p.prix - p.precedent) / p.precedent) * 100 : 0,
        sac: u ? `${u.libelle} ≈ ${Math.round((p?.prix ?? 0) * u.kg).toLocaleString('fr-FR')} F` : '',
      };
    });
  });

  protected readonly axes = computed(() => [...this.db.axes.items()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4));

  private loc(id: string) {
    return localite(id).nom.split(' (')[0];
  }
}
