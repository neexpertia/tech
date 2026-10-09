import { Injectable, computed, inject } from '@angular/core';
import { DbService } from './api/db.service';
import {
  COMMISSION_PCT, MARCHES, MOIS, PARAM_PRIX, coutTransportKg, distanceKm, localite, produit,
} from './data/referentiel';
import {
  Commande, Cotation, Demande, Fret, Offre, Operateur, Qualite, StatutCommande, Utilisateur,
} from './models';
import { SessionService } from './session.service';

export const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** 850 → « 850 kg » ; 12500 → « 12,5 t » */
export const fmtKg = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 100) / 10).toLocaleString('fr-FR')} t` : `${Math.round(kg).toLocaleString('fr-FR')} kg`);
/** « de maïs », « d’oignon » */
export const de = (nom: string) => (/^[aeiouyéèêh]/i.test(nom) ? `d’${nom.toLowerCase()}` : `de ${nom.toLowerCase()}`);

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  attente_paiement: 'En attente de paiement', sequestre: 'Payée (séquestre)', expediee: 'Expédiée',
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
    const offre = await this.db.offres.create({ ...o, lot, vendeurId: this.moi, quantiteRestanteKg: o.quantiteKg, statut: 'active', creeLe: aujourdhui() });
    // Alerte aux acheteurs ayant une demande ouverte sur ce produit
    for (const d of this.db.demandes.items().filter((d) => d.statut === 'ouverte' && d.produitId === o.produitId)) {
      await this.notifier(d.acheteurId, `Nouvelle offre ${de(produit(o.produitId).nom)} à ${localite(o.localiteId).nom} : ${o.prixKg} F/kg.`, `/marche/${offre.id}`);
    }
    return offre;
  }

  async retirerOffre(id: string) {
    return this.db.offres.update(id, { statut: 'retiree' });
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
    });
  }

  async refuserCotation(cotationId: string) {
    const c = await this.db.cotations.update(cotationId, { statut: 'refusee' });
    await this.notifier(c.vendeurId, 'Votre cotation n’a pas été retenue.', `/demandes/${c.demandeId}`);
  }

  async commanderOffre(offreId: string, quantiteKg: number, destinationId: string, avecTransport: boolean) {
    const o = this.db.offres.get(offreId)!;
    if (quantiteKg > o.quantiteRestanteKg) throw new Error('Quantité supérieure au disponible');
    const reste = o.quantiteRestanteKg - quantiteKg;
    await this.db.offres.update(o.id, { quantiteRestanteKg: reste, statut: reste <= 0 ? 'epuisee' : 'active' });
    return this.creerCommande({
      acheteurId: this.moi, vendeurId: o.vendeurId, produitId: o.produitId, quantiteKg, prixKg: o.prixKg,
      origineId: o.localiteId, destinationId, source: { type: 'offre', id: o.id }, sansTransport: !avecTransport,
    });
  }

  private async creerCommande(p: { acheteurId: string; vendeurId: string; produitId: string; quantiteKg: number; prixKg: number; origineId: string; destinationId: string; source: Commande['source']; sansTransport?: boolean }) {
    const frais = p.sansTransport ? 0 : coutTransportKg(distanceKm(p.origineId, p.destinationId)) * p.quantiteKg;
    const n = Math.max(0, ...this.db.commandes.items().map((c) => Number(c.reference.split('-').pop()) || 0)) + 1;
    const cmd = await this.db.commandes.create({
      reference: `CMD-2026-${String(n).padStart(4, '0')}`, acheteurId: p.acheteurId, vendeurId: p.vendeurId, produitId: p.produitId,
      quantiteKg: p.quantiteKg, prixKg: p.prixKg, fraisTransport: frais, commissionPct: COMMISSION_PCT,
      origineId: p.origineId, destinationId: p.destinationId, source: p.source, statut: 'attente_paiement',
      historique: [{ date: aujourdhui(), statut: 'attente_paiement', parId: this.moi }], messages: [], creeLe: aujourdhui(),
    });
    await this.notifier(p.vendeurId, `Nouvelle commande ${cmd.reference} : ${fmtKg(p.quantiteKg)} ${de(produit(p.produitId).nom)}.`, `/commandes/${cmd.id}`);
    return cmd;
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

  async payer(c: Commande, operateur: Operateur) {
    const ref = `${operateur.split(' ').map((x) => x[0]).join('')}-${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`;
    const cmd = await this.changerStatut(c, 'sequestre', `Paiement ${operateur} bloqué en séquestre`, {
      paiement: { operateur, reference: ref, montant: this.montant(c).total, date: aujourdhui() },
    });
    await this.notifier(c.vendeurId, `${c.reference} payée : les fonds sont en séquestre. Vous pouvez préparer l’expédition.`, `/commandes/${c.id}`);
    return cmd;
  }

  async expedier(c: Commande, note: string) {
    await this.changerStatut(c, 'expediee', note || undefined);
    await this.notifier(c.acheteurId, `${c.reference} expédiée. ${note}`, `/commandes/${c.id}`);
  }

  async confirmerReception(c: Commande) {
    await this.changerStatut(c, 'terminee', 'Réception confirmée — fonds libérés au vendeur');
    await this.notifier(c.vendeurId, `${c.reference} : réception confirmée, ${this.montant(c).netVendeur.toLocaleString('fr-FR')} FCFA versés.`, `/commandes/${c.id}`);
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
    await this.changerStatut(c, 'annulee', 'Commande annulée avant paiement');
    if (c.source.type === 'offre') {
      const o = this.db.offres.get(c.source.id);
      if (o) await this.db.offres.update(o.id, { quantiteRestanteKg: o.quantiteRestanteKg + c.quantiteKg, statut: 'active' });
    }
  }

  async message(c: Commande, texte: string) {
    await this.db.commandes.update(c.id, { messages: [...c.messages, { date: aujourdhui(), auteurId: this.moi, texte }] });
    const autre = c.acheteurId === this.moi ? c.vendeurId : c.acheteurId;
    await this.notifier(autre, `Message sur ${c.reference} : « ${texte.slice(0, 60)} »`, `/commandes/${c.id}`);
  }

  async noter(c: Commande, note: 1 | 2 | 3 | 4 | 5, commentaire: string) {
    const cible = c.acheteurId === this.moi ? c.vendeurId : c.acheteurId;
    return this.db.avis.create({ commandeId: c.id, auteurId: this.moi, cibleId: cible, note, commentaire, date: aujourdhui() });
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

  async notifier(userId: string, texte: string, lien?: string) {
    return this.db.notifications.create({ userId, texte, lien, date: aujourdhui(), lu: false });
  }

  async toutLire() {
    for (const n of this.mesNotifications().filter((n) => !n.lu)) await this.db.notifications.update(n.id, { lu: true });
  }
}

export { PARAM_PRIX };
