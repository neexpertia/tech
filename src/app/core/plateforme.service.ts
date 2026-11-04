import { Injectable, computed, inject } from '@angular/core';
import { DbService } from './api/db.service';
import {
  COMMISSION_PCT, DELAI_CONFIRMATION_H, DELAI_EXPEDITION_J, FRAICHEUR_J, MARCHES, MOIS, PARAM_PRIX, coutTransportKg, distanceKm, localite, produit,
} from './data/referentiel';
import {
  Commande, Cotation, Demande, Fret, Livraison, Offre, Operateur, Qualite, StatutCommande, TypeNotification, Utilisateur,
} from './models';
import { SessionService } from './session.service';

export const aujourdhui = () => new Date().toISOString().slice(0, 10);
export const maintenant = () => new Date().toISOString();
const dansHeures = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
/** Nombre de jours entiers écoulés depuis une date AAAA-MM-JJ */
export const joursDepuis = (d: string) => Math.max(0, Math.floor((Date.parse(aujourdhui()) - Date.parse(d.slice(0, 10))) / 86_400_000));
/** « 14 h 05 » */
export const heure = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : '—');

export type NiveauFraicheur = 'confirme' | 'recent' | 'a_reconfirmer' | 'masque';
/** Fraîcheur du stock d'une offre : depuis combien de temps le vendeur n'a pas confirmé l'avoir encore. */
export function fraicheur(o: Offre): { jours: number; niveau: NiveauFraicheur; libelle: string } {
  const jours = joursDepuis(o.stockConfirmeLe ?? o.creeLe);
  const quand = jours === 0 ? 'aujourd’hui' : jours === 1 ? 'hier' : `il y a ${jours} jours`;
  if (jours <= FRAICHEUR_J.confirme) return { jours, niveau: 'confirme', libelle: `Vérifié ${quand}` };
  if (jours <= FRAICHEUR_J.aReconfirmer) return { jours, niveau: 'recent', libelle: `Vérifié ${quand}` };
  if (jours <= FRAICHEUR_J.masque) return { jours, niveau: 'a_reconfirmer', libelle: `Pas vérifié depuis ${jours} jours` };
  return { jours, niveau: 'masque', libelle: `Pas vérifié depuis ${jours} jours` };
}
/** Offre visible et commandable sur le marché */
export const offreVisible = (o: Offre) => o.statut === 'active' && o.quantiteRestanteKg > 0 && fraicheur(o).niveau !== 'masque';

/** 850 → « 850 kg » ; 12500 → « 12,5 t » */
export const fmtKg = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 100) / 10).toLocaleString('fr-FR')} t` : `${Math.round(kg).toLocaleString('fr-FR')} kg`);
/** « de maïs », « d’oignon » */
export const de = (nom: string) => (/^[aeiouyéèêh]/i.test(nom) ? `d’${nom.toLowerCase()}` : `de ${nom.toLowerCase()}`);

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  attente_confirmation: 'Le vendeur vérifie', attente_paiement: 'À payer', sequestre: 'Payée', expediee: 'En route',
  livree: 'Livrée', terminee: 'Terminée', litige: 'En litige', annulee: 'Annulée',
};

export interface Score {
  valeur: number;
  grade: 'A' | 'B' | 'C' | 'D' | '–';
  noteMoyenne: number;
  nbAvis: number;
  ventes: number;
  achats: number;
  volumeFcfa: number;
  litiges: number;
  details: { label: string; points: number; max: number }[];
}

/**
 * Règles métier de la plateforme. Toutes les écritures passent par ici,
 * ce qui en fait le futur contrat des endpoints « action » du backend.
 */
@Injectable({ providedIn: 'root' })
export class PlateformeService {
  readonly db = inject(DbService);
  private readonly session = inject(SessionService);

  private get moi() { return this.session.utilisateur()!.id; }

  utilisateur(id: string): Utilisateur | undefined {
    return this.db.utilisateurs.get(id);
  }
  nom(id: string) {
    return this.utilisateur(id)?.nom ?? id;
  }

  // ================================================================ PRIX

  /** Dernier prix relevé (FCFA/kg) sur un marché, avec la date. */
  readonly derniersPrix = computed(() => {
    const m = new Map<string, { prix: number; date: string; precedent?: number }>();
    const tries = [...this.db.releves.items()].sort((a, b) => a.date.localeCompare(b.date));
    for (const r of tries) {
      const k = `${r.produitId}|${r.localiteId}`;
      const ancien = m.get(k);
      m.set(k, { prix: r.prix, date: r.date, precedent: ancien?.prix });
    }
    return m;
  });

  prix(produitId: string, localiteId: string) {
    return this.derniersPrix().get(`${produitId}|${localiteId}`);
  }

  /** Prix de référence le plus proche : marché de la localité ou marché suivi le plus proche. */
  prixReference(produitId: string, localiteId: string): { prix: number; marcheId: string } | undefined {
    const direct = this.prix(produitId, localiteId);
    if (direct) return { prix: direct.prix, marcheId: localiteId };
    const proche = [...MARCHES].sort((a, b) => distanceKm(a.id, localiteId) - distanceKm(b.id, localiteId))
      .find((m) => this.prix(produitId, m.id));
    return proche ? { prix: this.prix(produitId, proche.id)!.prix, marcheId: proche.id } : undefined;
  }

  /** Moyenne mensuelle sur 12 mois. */
  serie(produitId: string, localiteId: string): (number | null)[] {
    const rel = this.db.releves.items().filter((r) => r.produitId === produitId && r.localiteId === localiteId);
    return MOIS.map((mo) => {
      const l = rel.filter((r) => r.date.startsWith(mo));
      return l.length ? Math.round(l.reduce((s, r) => s + r.prix, 0) / l.length) : null;
    });
  }

  async publierReleve(produitId: string, localiteId: string, prix: number) {
    return this.db.releves.create({ produitId, localiteId, prix, date: aujourdhui(), source: 'utilisateur', auteurId: this.moi });
  }

  // ================================================================ COÛT RENDU

  coutRendu(prixKg: number, produitId: string, origineId: string, destinationId: string) {
    const km = distanceKm(origineId, destinationId);
    const transport = coutTransportKg(km);
    const pertes = Math.round((prixKg * produit(produitId).pertePct) / 100 * Math.min(1, km / 400));
    return { km, transport, pertes, total: prixKg + transport + pertes };
  }

  // ================================================================ OFFRES & DEMANDES

  async publierOffre(o: Omit<Offre, 'id' | 'vendeurId' | 'statut' | 'creeLe' | 'quantiteRestanteKg' | 'lot'>) {
    const lot = `BF-${o.localiteId}-${o.produitId.slice(0, 3).toUpperCase()}-${aujourdhui().slice(2, 7).replace('-', '')}-${Math.floor(Math.random() * 90 + 10)}`;
    const offre = await this.db.offres.create({ ...o, lot, vendeurId: this.moi, quantiteRestanteKg: o.quantiteKg, statut: 'active', creeLe: aujourdhui(), stockConfirmeLe: aujourdhui() });
    // Alertes produits des acheteurs (« préviens-moi quand… »)
    for (const a of this.db.alertes.items().filter((a) => a.active && a.userId !== this.moi && a.produitId === o.produitId)) {
      const okPrix = !a.prixMaxKg || o.prixKg <= a.prixMaxKg;
      const okQual = !a.qualiteMin || o.qualite <= a.qualiteMin;
      const okRayon = !a.rayonKm || distanceKm(o.localiteId, a.localiteId) <= a.rayonKm;
      if (okPrix && okQual && okRayon) await this.notifier(a.userId, `Alerte ${produit(o.produitId).nom.toLowerCase()} : nouvelle offre à ${o.prixKg} F/kg à ${localite(o.localiteId).nom} (qualité ${o.qualite}).`, `/marche/${offre.id}`, 'alerte');
    }
    // Alerte aux acheteurs ayant une demande ouverte sur ce produit
    for (const d of this.db.demandes.items().filter((d) => d.statut === 'ouverte' && d.produitId === o.produitId)) {
      if (!this.db.alertes.items().some((a) => a.active && a.userId === d.acheteurId && a.produitId === o.produitId))
        await this.notifier(d.acheteurId, `Nouvelle offre ${de(produit(o.produitId).nom)} à ${localite(o.localiteId).nom} : ${o.prixKg} F/kg.`, `/marche/${offre.id}`, 'alerte');
    }
    return offre;
  }

  async retirerOffre(id: string) {
    return this.db.offres.update(id, { statut: 'retiree' });
  }

  /**
   * Le vendeur confirme qu'il a toujours la marchandise (et peut ajuster stock et prix).
   * Les acheteurs qui suivent l'offre sont prévenus d'une baisse de prix ou d'un retour en stock.
   */
  async confirmerStock(id: string, maj: { quantiteRestanteKg?: number; prixKg?: number } = {}) {
    const o = this.db.offres.get(id)!;
    const reste = maj.quantiteRestanteKg ?? o.quantiteRestanteKg;
    const prix = maj.prixKg ?? o.prixKg;
    const etaitIndispo = o.statut !== 'active' || o.quantiteRestanteKg <= 0 || fraicheur(o).niveau === 'masque';
    const n = await this.db.offres.update(id, {
      quantiteRestanteKg: reste, prixKg: prix, stockConfirmeLe: aujourdhui(), statut: reste > 0 ? 'active' : 'epuisee',
      quantiteKg: Math.max(o.quantiteKg, reste),
    });
    for (const f of this.db.favoris.items().filter((f) => f.offreId === id)) {
      if (reste > 0 && etaitIndispo) await this.notifier(f.userId, `De nouveau disponible : ${produit(o.produitId).nom.toLowerCase()} de ${this.nom(o.vendeurId)} (${fmtKg(reste)}).`, `/marche/${id}`, 'favori');
      else if (prix < o.prixKg) await this.notifier(f.userId, `Baisse de prix sur un favori : ${produit(o.produitId).nom.toLowerCase()} à ${prix} F/kg (au lieu de ${o.prixKg}).`, `/marche/${id}`, 'favori');
    }
    return n;
  }

  async publierDemande(d: Omit<Demande, 'id' | 'acheteurId' | 'statut' | 'creeLe'>) {
    const dem = await this.db.demandes.create({ ...d, acheteurId: this.moi, statut: 'ouverte', creeLe: aujourdhui() });
    const vendeurs = new Set(this.db.offres.items().filter((o) => o.statut === 'active' && o.produitId === d.produitId).map((o) => o.vendeurId));
    for (const v of vendeurs) await this.notifier(v, `${this.nom(this.moi)} cherche ${fmtKg(d.quantiteKg)} ${de(produit(d.produitId).nom)}. Envoyez une cotation.`, `/demandes/${dem.id}`);
    return dem;
  }

  async envoyerCotation(c: Omit<Cotation, 'id' | 'vendeurId' | 'statut' | 'creeLe'>) {
    const cot = await this.db.cotations.create({ ...c, vendeurId: this.moi, statut: 'envoyee', creeLe: aujourdhui() });
    const d = this.db.demandes.get(c.demandeId)!;
    await this.notifier(d.acheteurId, `Nouvelle cotation de ${this.nom(this.moi)} : ${c.prixKg} F/kg.`, `/demandes/${d.id}`);
    return cot;
  }

  async accepterCotation(cotationId: string) {
    const c = this.db.cotations.get(cotationId)!;
    const d = this.db.demandes.get(c.demandeId)!;
    await this.db.cotations.update(c.id, { statut: 'acceptee' });
    const qteAttribuee = this.db.cotations.items().filter((x) => x.demandeId === d.id && x.statut === 'acceptee').reduce((s, x) => s + x.quantiteKg, 0);
    if (qteAttribuee >= d.quantiteKg) await this.db.demandes.update(d.id, { statut: 'attribuee' });
    // Réserver le stock correspondant sur l'offre publique du vendeur (évite de vendre deux fois le même lot)
    const offre = this.db.offres.items().find((o) => o.vendeurId === c.vendeurId && o.produitId === d.produitId && o.localiteId === c.localiteId && o.statut === 'active');
    if (offre) {
      const reste = Math.max(0, offre.quantiteRestanteKg - Math.min(c.quantiteKg, d.quantiteKg));
      await this.db.offres.update(offre.id, { quantiteRestanteKg: reste, statut: reste <= 0 ? 'epuisee' : 'active' });
    }
    return this.creerCommande({
      acheteurId: d.acheteurId, vendeurId: c.vendeurId, produitId: d.produitId, quantiteKg: Math.min(c.quantiteKg, d.quantiteKg),
      prixKg: c.prixKg, origineId: c.localiteId, destinationId: d.localiteLivraisonId, source: { type: 'cotation', id: c.id },
      origineAchat: 'cotation', statut: 'attente_paiement', // la cotation vaut confirmation de disponibilité
    });
  }

  async refuserCotation(cotationId: string) {
    const c = await this.db.cotations.update(cotationId, { statut: 'refusee' });
    await this.notifier(c.vendeurId, 'Votre cotation n’a pas été retenue.', `/demandes/${c.demandeId}`);
  }

  /**
   * Émettre une commande sur une offre. La quantité est réservée immédiatement ;
   * le vendeur doit confirmer la disponibilité sous 24 h avant que l'acheteur paie.
   * Avec un prix négocié (proposition acceptée dans la messagerie), ce prix remplace celui de l'offre.
   */
  async commanderOffre(offreId: string, quantiteKg: number, destinationId: string, avecTransport: boolean, opts: { prixKg?: number; origineAchat?: Commande['origineAchat'] } = {}) {
    const o = this.db.offres.get(offreId)!;
    if (quantiteKg > o.quantiteRestanteKg) throw new Error('Quantité supérieure au disponible');
    if (o.vendeurId === this.moi) throw new Error('Vous ne pouvez pas acheter votre propre offre');
    const reste = o.quantiteRestanteKg - quantiteKg;
    await this.db.offres.update(o.id, { quantiteRestanteKg: reste, statut: reste <= 0 ? 'epuisee' : 'active' });
    return this.creerCommande({
      acheteurId: this.moi, vendeurId: o.vendeurId, produitId: o.produitId, quantiteKg, prixKg: opts.prixKg ?? o.prixKg,
      origineId: o.localiteId, destinationId, source: { type: 'offre', id: o.id }, sansTransport: !avecTransport,
      origineAchat: opts.origineAchat ?? 'direct', statut: 'attente_confirmation',
    });
  }

  private async creerCommande(p: { acheteurId: string; vendeurId: string; produitId: string; quantiteKg: number; prixKg: number; origineId: string; destinationId: string; source: Commande['source']; sansTransport?: boolean; statut: StatutCommande; origineAchat: Commande['origineAchat'] }) {
    const frais = p.sansTransport ? 0 : coutTransportKg(distanceKm(p.origineId, p.destinationId)) * p.quantiteKg;
    const n = Math.max(0, ...this.db.commandes.items().map((c) => Number(c.reference.split('-').pop()) || 0)) + 1;
    const cmd = await this.db.commandes.create({
      reference: `CMD-2026-${String(n).padStart(4, '0')}`, acheteurId: p.acheteurId, vendeurId: p.vendeurId, produitId: p.produitId,
      quantiteKg: p.quantiteKg, prixKg: p.prixKg, fraisTransport: frais, commissionPct: COMMISSION_PCT,
      origineId: p.origineId, destinationId: p.destinationId, source: p.source, statut: p.statut, origineAchat: p.origineAchat,
      historique: [{ date: aujourdhui(), statut: p.statut, parId: this.moi }], messages: [], creeLe: aujourdhui(),
      codeRemise: String(1000 + Math.floor(Math.random() * 9000)),
      ...(p.statut === 'attente_confirmation' ? { confirmationAvant: dansHeures(DELAI_CONFIRMATION_H) } : {}),
    });
    await this.notifier(p.vendeurId, p.statut === 'attente_confirmation'
      ? `Nouvelle commande ${cmd.reference} : ${fmtKg(p.quantiteKg)} ${de(produit(p.produitId).nom)}. Confirmez la disponibilité sous ${DELAI_CONFIRMATION_H} h.`
      : `Nouvelle commande ${cmd.reference} : ${fmtKg(p.quantiteKg)} ${de(produit(p.produitId).nom)}.`, `/commandes/${cmd.id}`, 'commande');
    return cmd;
  }

  // ================================================================ DISPONIBILITÉ (avant paiement)

  /** Le vendeur confirme qu'il a bien la marchandise : l'acheteur peut payer. */
  async confirmerDisponibilite(c: Commande, note?: string) {
    await this.changerStatut(c, 'attente_paiement', note || 'Disponibilité confirmée par le vendeur');
    if (c.source.type === 'offre') await this.db.offres.update(c.source.id, { stockConfirmeLe: aujourdhui() });
    await this.notifier(c.acheteurId, `${this.nom(c.vendeurId)} a confirmé la disponibilité (${c.reference}). Vous pouvez payer.`, `/commandes/${c.id}`, 'commande');
  }

  /** Le vendeur n'a plus la marchandise : commande annulée, stock corrigé, l'acheteur reçoit des alternatives. */
  async declarerIndisponible(c: Commande, motif: string) {
    await this.changerStatut(c, 'annulee', `Indisponible : ${motif}`);
    if (c.source.type === 'offre') {
      const o = this.db.offres.get(c.source.id);
      if (o) await this.db.offres.update(o.id, { statut: 'epuisee', quantiteRestanteKg: 0, stockConfirmeLe: aujourdhui() });
    }
    await this.notifier(c.acheteurId, `${c.reference} annulée : le vendeur n’a plus la marchandise (${motif}). Voici des offres équivalentes.`, `/commandes/${c.id}`, 'commande');
  }

  /**
   * Règles de délai (exécutées côté backend par une tâche planifiée ; ici à l'ouverture de l'espace) :
   *  - pas de confirmation du vendeur dans les 24 h → commande annulée, quantité libérée ;
   *  - pas d'expédition dans les 5 jours après paiement → l'acheteur est prévenu qu'il peut annuler (remboursement).
   */
  async verifierDelais() {
    const now = Date.now();
    for (const c of this.db.commandes.items()) {
      if (c.statut === 'attente_confirmation' && c.confirmationAvant && Date.parse(c.confirmationAvant) < now) {
        await this.db.commandes.update(c.id, {
          statut: 'annulee', historique: [...c.historique, { date: aujourdhui(), statut: 'annulee', parId: 'U-ADM', note: `Annulation automatique : pas de confirmation du vendeur sous ${DELAI_CONFIRMATION_H} h` }],
        });
        await this.libererStock(c);
        await this.notifier(c.acheteurId, `${c.reference} annulée automatiquement : le vendeur n’a pas confirmé sous ${DELAI_CONFIRMATION_H} h. Rien ne vous a été débité.`, `/commandes/${c.id}`, 'commande');
        await this.notifier(c.vendeurId, `${c.reference} annulée : disponibilité non confirmée à temps. Pensez à mettre à jour votre stock.`, `/commandes/${c.id}`, 'commande');
      }
    }
  }

  expeditionEnRetard(c: Commande) {
    return c.statut === 'sequestre' && !!c.expeditionAvant && Date.parse(c.expeditionAvant) < Date.now();
  }

  private async libererStock(c: Commande) {
    if (c.source.type !== 'offre') return;
    const o = this.db.offres.get(c.source.id);
    if (o && o.statut !== 'retiree') await this.db.offres.update(o.id, { quantiteRestanteKg: o.quantiteRestanteKg + c.quantiteKg, statut: 'active' });
  }

  // ================================================================ CYCLE DE COMMANDE

  montant(c: Commande) {
    const marchandise = c.quantiteKg * c.prixKg;
    const commission = Math.round((marchandise * c.commissionPct) / 100);
    // Frais de service à la charge de l'acheteur : le vendeur reçoit la valeur intégrale de la marchandise.
    return { marchandise, transport: c.fraisTransport, commission, total: marchandise + c.fraisTransport + commission, netVendeur: marchandise };
  }

  private async changerStatut(c: Commande, statut: StatutCommande, note?: string, patch: Partial<Commande> = {}) {
    return this.db.commandes.update(c.id, {
      ...patch, statut, historique: [...c.historique, { date: aujourdhui(), statut, parId: this.moi, ...(note ? { note } : {}) }],
    });
  }

  /**
   * Paiement. En production, la confirmation vient de l'opérateur (callback) ; ici l'acheteur
   * saisit l'identifiant de transaction reçu par SMS après avoir composé le code USSD.
   */
  async payer(c: Commande, operateur: Operateur, referenceTransaction?: string) {
    const ref = referenceTransaction?.trim() || `${operateur.split(' ').map((x) => x[0]).join('')}-${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`;
    const cmd = await this.changerStatut(c, 'sequestre', `Paiement ${operateur} reçu et protégé par FasoAgri`, {
      paiement: { operateur, reference: ref, montant: this.montant(c).total, date: aujourdhui() },
      expeditionAvant: dansHeures(DELAI_EXPEDITION_J * 24),
    });
    await this.notifier(c.vendeurId, `${c.reference} payée : l’argent est gardé par FasoAgri. Organisez la livraison (transport, heure de départ et d’arrivée).`, `/commandes/${c.id}`, 'paiement');
    return cmd;
  }

  // ================================================================ LIVRAISON & SUIVI

  /** Le vendeur renseigne le transport convenu avec le chauffeur (heures, lieu de remise). */
  async organiserLivraison(c: Commande, l: Omit<Livraison, 'etapes'>) {
    const etapes = c.livraison?.etapes ?? [];
    const texte = `Transport organisé : ${l.chauffeur ? 'chauffeur ' + l.chauffeur + ', ' : ''}départ ${this.quand(l.departPrevu)}, arrivée prévue ${this.quand(l.arriveePrevue)}${l.pointRemise ? ' — remise : ' + l.pointRemise : ''}.`;
    await this.db.commandes.update(c.id, { livraison: { ...l, etapes: [...etapes, { date: maintenant(), texte, lieu: localite(c.origineId).nom, auteurId: this.moi }] } });
    await this.notifier(c.acheteurId, `${c.reference} : ${texte}`, `/commandes/${c.id}`, 'livraison');
  }

  private quand(iso?: string) {
    if (!iso) return 'à préciser';
    const d = new Date(iso);
    const jour = iso.slice(0, 10) === aujourdhui() ? 'aujourd’hui' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    return `${jour} à ${heure(iso)}`;
  }

  async ajouterEtape(c: Commande, texte: string, lieu?: string) {
    const l = c.livraison ?? { mode: 'vendeur' as const, etapes: [] };
    await this.db.commandes.update(c.id, { livraison: { ...l, etapes: [...l.etapes, { date: maintenant(), texte, lieu, auteurId: this.moi }] } });
    await this.notifier(c.acheteurId, `${c.reference} — suivi : ${lieu ? lieu + ' · ' : ''}${texte}`, `/commandes/${c.id}`, 'livraison');
  }

  /** Départ effectif : la commande passe « expédiée ». */
  async expedier(c: Commande, note: string) {
    const fresh = this.db.commandes.get(c.id)!;
    const l = fresh.livraison ?? { mode: 'vendeur' as const, etapes: [] };
    await this.changerStatut(fresh, 'expediee', note || 'Marchandise partie', {
      livraison: { ...l, departPrevu: l.departPrevu && Date.parse(l.departPrevu) > Date.now() ? maintenant() : (l.departPrevu ?? maintenant()), etapes: [...l.etapes, { date: maintenant(), texte: note || 'Départ de la marchandise.', lieu: localite(c.origineId).nom, auteurId: this.moi }] },
    });
    await this.notifier(c.acheteurId, `${c.reference} est partie de ${localite(c.origineId).nom}. ${l.arriveePrevue ? 'Arrivée prévue ' + this.quand(l.arriveePrevue) + '.' : ''}`, `/commandes/${c.id}`, 'livraison');
  }

  /** Arrivée au point de remise : l'acheteur est invité à venir avec son code. */
  async signalerArrivee(c: Commande) {
    const l = c.livraison ?? { mode: 'vendeur' as const, etapes: [] };
    await this.changerStatut(c, 'livree', 'Arrivée au point de remise', {
      livraison: { ...l, etapes: [...l.etapes, { date: maintenant(), texte: 'Arrivée au point de remise.', lieu: l.pointRemise ?? localite(c.destinationId).nom, auteurId: this.moi }] },
    });
    await this.notifier(c.acheteurId, `${c.reference} est arrivée${l.pointRemise ? ' : ' + l.pointRemise : ''}. Donnez votre code de réception au chauffeur puis confirmez la réception.`, `/commandes/${c.id}`, 'livraison');
  }

  async confirmerReception(c: Commande) {
    await this.changerStatut(c, 'terminee', 'Réception confirmée — fonds libérés au vendeur');
    await this.notifier(c.vendeurId, `${c.reference} : réception confirmée, ${this.montant(c).netVendeur.toLocaleString('fr-FR')} FCFA versés.`, `/commandes/${c.id}`, 'paiement');
  }

  /** Vendeur payé mais pas d'expédition dans le délai : l'acheteur annule et est remboursé. */
  async annulerPourRetard(c: Commande) {
    await this.changerStatut(c, 'annulee', `Expédition non faite sous ${DELAI_EXPEDITION_J} jours — acheteur remboursé`);
    await this.libererStock(c);
    await this.notifier(c.vendeurId, `${c.reference} annulée par l’acheteur : expédition non faite dans les délais. Les fonds lui sont restitués.`, `/commandes/${c.id}`, 'commande');
  }

  async ouvrirLitige(c: Commande, motif: string, description: string) {
    await this.changerStatut(c, 'litige', motif, { litige: { motif, description, ouvertLe: aujourdhui() } });
    await this.notifier(c.vendeurId, `Litige ouvert sur ${c.reference} : ${motif}. Les fonds restent bloqués.`, `/commandes/${c.id}`);
    await this.notifier('U-ADM', `Litige à arbitrer : ${c.reference}.`, `/commandes/${c.id}`);
  }

  async resoudreLitige(c: Commande, resolution: string) {
    await this.changerStatut(c, 'terminee', `Litige résolu : ${resolution}`, { litige: { ...c.litige!, resolution } });
    for (const u of [c.acheteurId, c.vendeurId]) await this.notifier(u, `Litige ${c.reference} résolu : ${resolution}`, `/commandes/${c.id}`);
  }

  async annuler(c: Commande) {
    await this.changerStatut(c, 'annulee', 'Commande annulée par l’acheteur avant paiement');
    await this.libererStock(c);
    await this.notifier(c.vendeurId, `${c.reference} annulée par l’acheteur avant paiement.`, `/commandes/${c.id}`, 'commande');
  }

  async message(c: Commande, texte: string) {
    await this.db.commandes.update(c.id, { messages: [...c.messages, { date: aujourdhui(), auteurId: this.moi, texte }] });
    const autre = c.acheteurId === this.moi ? c.vendeurId : c.acheteurId;
    await this.notifier(autre, `Message sur ${c.reference} : « ${texte.slice(0, 60)} »`, `/commandes/${c.id}`, 'message');
  }

  /** Avis après réception. Posé par l'acheteur, il compte aussi comme avis produit « achat vérifié ». */
  async noter(c: Commande, note: 1 | 2 | 3 | 4 | 5, commentaire: string) {
    const parAcheteur = c.acheteurId === this.moi;
    const cible = parAcheteur ? c.vendeurId : c.acheteurId;
    return this.db.avis.create({
      commandeId: c.id, auteurId: this.moi, cibleId: cible, note, commentaire, date: aujourdhui(),
      ...(parAcheteur ? { produitId: c.produitId, achatVerifie: true, ...(c.source.type === 'offre' ? { offreId: c.source.id } : {}) } : {}),
    });
  }

  async demanderTransport(c: Commande) {
    const f = await this.publierFret({
      commandeId: c.id, origineId: c.origineId, destinationId: c.destinationId, produitId: c.produitId,
      tonnage: Math.round(c.quantiteKg / 100) / 10, dateChargement: aujourdhui(), prixPropose: c.fraisTransport,
    });
    await this.db.commandes.update(c.id, { fretId: f.id });
    return f;
  }

  // ================================================================ TRANSPORT

  async publierFret(f: Omit<Fret, 'id' | 'demandeurId' | 'statut' | 'candidatures' | 'creeLe'>) {
    const fret = await this.db.frets.create({ ...f, demandeurId: this.moi, statut: 'ouvert', candidatures: [], creeLe: aujourdhui() });
    for (const t of this.db.utilisateurs.items().filter((u) => u.role === 'transporteur' && (u.capaciteT ?? 0) >= f.tonnage)) {
      await this.notifier(t.id, `Nouveau fret ${localite(f.origineId).nom} → ${localite(f.destinationId).nom} (${f.tonnage} t).`, '/transport');
    }
    return fret;
  }

  async candidater(f: Fret, prix: number, message: string) {
    await this.db.frets.update(f.id, { candidatures: [...f.candidatures.filter((c) => c.transporteurId !== this.moi), { transporteurId: this.moi, prix, message, date: aujourdhui() }] });
    await this.notifier(f.demandeurId, `${this.nom(this.moi)} propose ${prix.toLocaleString('fr-FR')} FCFA pour votre fret.`, '/transport');
  }

  async attribuerFret(f: Fret, transporteurId: string) {
    const c = f.candidatures.find((x) => x.transporteurId === transporteurId);
    await this.db.frets.update(f.id, { statut: 'attribue', transporteurId, prixPropose: c?.prix ?? f.prixPropose });
    await this.notifier(transporteurId, `Fret attribué : ${localite(f.origineId).nom} → ${localite(f.destinationId).nom}, chargement le ${f.dateChargement}.`, '/transport');
  }

  async avancerFret(f: Fret) {
    const statut = f.statut === 'attribue' ? 'en_route' : 'livre';
    await this.db.frets.update(f.id, { statut });
    await this.notifier(f.demandeurId, `Fret ${localite(f.origineId).nom} → ${localite(f.destinationId).nom} : ${statut === 'en_route' ? 'chargé, en route' : 'livré'}.`, '/transport');
    if (statut === 'livre' && f.commandeId) {
      const c = this.db.commandes.get(f.commandeId);
      if (c && c.statut === 'expediee') await this.changerStatut(c, 'livree', 'Livraison déclarée par le transporteur');
    }
  }

  async signalerAxe(a: { origineId: string; destinationId: string; niveau: 'info' | 'prudence' | 'deconseille'; motif: any; commentaire: string }) {
    return this.db.axes.create({ ...a, date: aujourdhui(), auteurId: this.moi, confirmations: 1 });
  }

  async confirmerAxe(id: string) {
    const a = this.db.axes.get(id)!;
    return this.db.axes.update(id, { confirmations: a.confirmations + 1, date: aujourdhui() });
  }

  // ================================================================ STOCKAGE & FINANCE

  valeurDepot(depotId: string) {
    const d = this.db.depots.get(depotId)!;
    const e = this.db.entrepots.get(d.entrepotId)!;
    const ref = this.prixReference(d.produitId, e.localiteId);
    return Math.round((ref?.prix ?? 0) * d.quantiteKg);
  }

  async deposer(entrepotId: string, produitId: string, quantiteKg: number, qualite: Qualite, deposantId = this.moi) {
    const e = this.db.entrepots.get(entrepotId)!;
    const n = this.db.depots.items().filter((x) => x.entrepotId === entrepotId).length + 120;
    const d = await this.db.depots.create({ entrepotId, deposantId, produitId, quantiteKg, qualite, dateEntree: aujourdhui(), statut: 'en_stock', recu: `RS-${e.localiteId}-2026-${n}` });
    await this.notifier(deposantId === this.moi ? e.gestionnaireId : deposantId, `Dépôt enregistré : ${fmtKg(quantiteKg)} ${de(produit(produitId).nom)} (${this.nom(deposantId)}), récépissé ${d.recu}.`, '/stockage');
    return d;
  }

  /** Score de confiance calculé sur l'historique de la plateforme. */
  score(userId: string): Score {
    const u = this.utilisateur(userId);
    const cmds = this.db.commandes.items().filter((c) => c.vendeurId === userId || c.acheteurId === userId);
    const terminees = cmds.filter((c) => c.statut === 'terminee');
    const litiges = cmds.filter((c) => c.litige).length;
    const avis = this.db.avis.items().filter((a) => a.cibleId === userId);
    const noteMoyenne = avis.length ? avis.reduce((s, a) => s + a.note, 0) / avis.length : 0;
    const volumeFcfa = terminees.reduce((s, c) => s + c.quantiteKg * c.prixKg, 0);
    const mois = u ? Math.max(0, (Date.parse(aujourdhui()) - Date.parse(u.inscritLe)) / (30 * 86_400_000)) : 0;
    const details = [
      { label: 'Identité vérifiée (KYC)', points: u?.kyc === 'verifie' ? 15 : 0, max: 15 },
      { label: 'Ancienneté', points: Math.round(Math.min(1, mois / 12) * 15), max: 15 },
      { label: 'Transactions terminées', points: Math.min(25, terminees.length * 8 + (avis.length >= 1 ? 5 : 0)), max: 25 },
      { label: 'Avis des partenaires', points: avis.length ? Math.round((noteMoyenne / 5) * 25) : 0, max: 25 },
      { label: 'Sans litige', points: cmds.length ? Math.round(Math.max(0, 1 - (litiges / cmds.length) * 3) * 20) : 10, max: 20 },
    ];
    const valeur = details.reduce((s, d) => s + d.points, 0);
    const grade = !cmds.length && !avis.length ? '–' : valeur >= 75 ? 'A' : valeur >= 55 ? 'B' : valeur >= 40 ? 'C' : 'D';
    return {
      valeur, grade, noteMoyenne, nbAvis: avis.length, litiges, volumeFcfa, details,
      ventes: cmds.filter((c) => c.vendeurId === userId).length, achats: cmds.filter((c) => c.acheteurId === userId).length,
    };
  }

  // ================================================================ COOPÉRATIVE

  async ajouterApport(a: { membre: string; telephone: string; produitId: string; quantiteKg: number; qualite: Qualite }) {
    return this.db.apports.create({ ...a, cooperativeId: this.moi, date: aujourdhui(), paye: false });
  }

  async constituerLot(apportIds: string[], prixKg: number, localiteId: string) {
    const apports = apportIds.map((id) => this.db.apports.get(id)!);
    const produitId = apports[0].produitId;
    const quantiteKg = apports.reduce((s, a) => s + a.quantiteKg, 0);
    const qualite: Qualite = apports.some((a) => a.qualite === 'C') ? 'C' : apports.some((a) => a.qualite === 'B') ? 'B' : 'A';
    const offre = await this.publierOffre({
      produitId, quantiteKg, prixKg, qualite, localiteId, disponibleLe: aujourdhui(), livraison: false,
      description: `Lot coopératif constitué de ${apports.length} apports de membres.`, producteurs: new Set(apports.map((a) => a.membre)).size,
    });
    const lot = await this.db.lots.create({ cooperativeId: this.moi, produitId, code: offre.lot, apportIds, quantiteKg, offreId: offre.id, statut: 'en_vente', creeLe: aujourdhui() });
    for (const a of apports) await this.db.apports.update(a.id, { lotId: lot.id });
    return lot;
  }

  /** Répartition du net de vente entre les membres au prorata des apports. */
  repartition(lotId: string, prixKg: number, retenueCoopPct = 3) {
    const lot = this.db.lots.get(lotId)!;
    const apports = lot.apportIds.map((id) => this.db.apports.get(id)!).filter(Boolean);
    const brut = lot.quantiteKg * prixKg;
    const net = brut * (1 - retenueCoopPct / 100);
    return { brut, net, retenue: brut * retenueCoopPct / 100, lignes: apports.map((a) => ({ apport: a, montant: Math.round((net * a.quantiteKg) / lot.quantiteKg) })) };
  }

  async payerMembres(lotId: string) {
    const lot = this.db.lots.get(lotId)!;
    for (const id of lot.apportIds) await this.db.apports.update(id, { paye: true });
    await this.db.lots.update(lotId, { statut: 'reparti' });
  }

  // ================================================================ NOTIFICATIONS

  readonly mesNotifications = computed(() => {
    const id = this.session.utilisateur()?.id;
    return this.db.notifications.items().filter((n) => n.userId === id).sort((a, b) => b.date.localeCompare(a.date));
  });
  readonly nonLues = computed(() => this.mesNotifications().filter((n) => !n.lu).length);

  async notifier(userId: string, texte: string, lien?: string, type: TypeNotification = 'autre') {
    return this.db.notifications.create({ userId, texte, lien, date: aujourdhui(), lu: false, type });
  }

  async toutLire() {
    for (const n of this.mesNotifications().filter((n) => !n.lu)) await this.db.notifications.update(n.id, { lu: true });
  }
}

export { PARAM_PRIX };
