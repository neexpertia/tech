import {
  Actualite, AlerteProduit, Collecte, Conversation, DisponibiliteCamion, Favori, LignePanier,
  Apport, Avis, Commande, Demande, Depot, Entrepot, Fret, Lot,
  Notification, Offre, RelevePrix, SignalementAxe, Utilisateur, Cotation,
} from '../models';
import { MARCHES, MOIS, PARAM_PRIX, PRODUITS, TARIF_KG_KM, distanceKm, hash, prng } from './referentiel';

/**
 * JEU DE DONNÉES FICTIF — Burkina Faso.
 * Noms de personnes et d'organisations inventés (mention « fictif/fictive »).
 * Numéros de téléphone masqués. Prix calibrés sur des ordres de grandeur plausibles.
 * Les dates de l'espace acheteur (stock confirmé, livraisons, messages) sont relatives
 * au jour de la première ouverture, pour que la démonstration reste « vivante ».
 */

const MAINTENANT = Date.now();
/** Date AAAA-MM-JJ il y a n jours */
const J = (n: number) => new Date(MAINTENANT - n * 86_400_000).toISOString().slice(0, 10);
/** Date-heure ISO décalée de h heures (négatif = passé) */
const H = (h: number) => new Date(MAINTENANT + h * 3_600_000).toISOString();

const u = (id: string, nom: string, role: Utilisateur['role'], localiteId: string, extra: Partial<Utilisateur> = {}): Utilisateur => ({
  id, nom, role, localiteId, telephone: `+226 7${id.length % 9} •• •• ${String(hash(id) % 90 + 10)} ${String(hash(nom) % 90 + 10)}`,
  langue: 'fr', kyc: 'verifie', pieces: ['CNIB'], inscritLe: '2025-11-10', ...extra,
});

export const UTILISATEURS: Utilisateur[] = [
  // Acheteurs — tout nouvel inscrit commence ici
  u('U-A01', 'Mariam Kaboré', 'acheteur', 'OUA', { categorie: 'Particulier / ménage', inscritLe: '2026-03-02' }),
  u('U-A02', 'Restaurant Le Néré (fictif)', 'acheteur', 'OUA', { categorie: 'Hôtel / restaurant', organisation: 'Restaurant Le Néré (fictif)', pieces: ['RCCM', 'IFU'] }),
  u('U-A03', 'Boureima Zongo', 'acheteur', 'KDG', { categorie: 'Particulier / ménage', kyc: 'en_attente', inscritLe: J(2) }),
  u('U-T01', 'Faso Provende (fictive)', 'acheteur', 'OUA', { categorie: 'Transformateur', organisation: 'Faso Provende (fictive)', pieces: ['RCCM', 'IFU'] }),
  u('U-E01', 'Sahel Graines Export (fictif)', 'acheteur', 'BOB', { categorie: 'Exportateur', organisation: 'Sahel Graines Export (fictif)', pieces: ['RCCM', 'IFU'] }),
  // Vendeurs
  u('U-P01', 'Salif Ouédraogo', 'vendeur', 'OHG', { typeVendeur: 'producteur', langue: 'mos', inscritLe: '2025-10-14', vendeurDepuis: '2025-10-14', produitsVendus: ['oignon', 'niebe'] }),
  u('U-P02', 'Awa Sawadogo', 'vendeur', 'KGS', { typeVendeur: 'producteur', langue: 'mos', inscritLe: '2026-01-08', vendeurDepuis: '2026-01-08', produitsVendus: ['niebe'] }),
  u('U-P03', 'Issa Traoré', 'vendeur', 'SLN', { typeVendeur: 'producteur', langue: 'dyu', inscritLe: '2025-10-20', vendeurDepuis: '2025-10-20', produitsVendus: ['sesame', 'mais'] }),
  u('U-P04', 'Léon Bazié', 'vendeur', 'LEO', { typeVendeur: 'producteur', inscritLe: '2026-02-11', vendeurDepuis: '2026-04-03', produitsVendus: ['arachide', 'soja'] }),
  u('U-C01', 'Coopérative maraîchère du Yatenga (fictive)', 'vendeur', 'OHG', { typeVendeur: 'cooperative', vendeurDepuis: '2025-11-10', organisation: 'Coopérative maraîchère du Yatenga (fictive)', membres: 48, pieces: ['Récépissé OHADA/SCOOPS'] }),
  u('U-C02', 'Union des producteurs de Solenzo (fictive)', 'vendeur', 'SLN', { typeVendeur: 'cooperative', vendeurDepuis: '2025-11-10', organisation: 'Union des producteurs de Solenzo (fictive)', membres: 210, pieces: ['Récépissé OHADA/SCOOPS'] }),
  u('U-K02', 'Sanou Négoce (fictif)', 'vendeur', 'BOB', { typeVendeur: 'commercant', vendeurDepuis: '2025-11-10', organisation: 'Sanou Négoce (fictif)', produitsVendus: ['riz', 'soja', 'mais'] }),
  // Comptes internes (non proposés à l'inscription) : transport, magasins, observatoire, administration
  u('U-TR1', 'Kaboré Transport (fictif)', 'transporteur', 'OUA', { capaciteT: 30, pieces: ['Carte grise', 'Assurance'] }),
  u('U-TR2', 'Sanou Logistique (fictive)', 'transporteur', 'BOB', { capaciteT: 35, pieces: ['Carte grise', 'Assurance'] }),
  u('U-TR3', 'Tricycle Bazié (fictif)', 'transporteur', 'LEO', { capaciteT: 1.5, pieces: ['Carte grise'] }),
  u('U-W01', 'Magasins de Solenzo (fictifs)', 'entrepot', 'SLN', { pieces: ['Agrément magasin'] }),
  u('U-W02', 'Entrepôts de Bobo (fictifs)', 'entrepot', 'BOB', { pieces: ['Agrément magasin'] }),
  u('U-G01', 'Observatoire des marchés (fictif)', 'institution', 'OUA', { pieces: ['Lettre de mission'] }),
  u('U-ADM', 'Équipe FasoAgri', 'admin', 'OUA'),
];

// ---------------------------------------------------------------- Relevés de prix (générés, reproductibles)

function genererReleves(): RelevePrix[] {
  const out: RelevePrix[] = [];
  for (const p of PRODUITS) {
    const pp = PARAM_PRIX[p.id];
    for (const m of MARCHES) {
      const d = Math.min(...pp.zones.map((z) => distanceKm(z, m.id)));
      const zone = pp.zones.includes(m.id);
      const jours = [...MOIS.slice(0, 11).map((mo) => `${mo}-15`), '2026-09-08', '2026-09-24'];
      jours.forEach((date, k) => {
        const mi = Math.min(k, 11);
        const rnd = prng(hash(`${p.id}|${m.id}|${date}`));
        if (!zone && rnd() < 0.12 && k < 11) return; // relevé manquant (réaliste)
        const base = pp.base * pp.saison[mi] * (1 + (rnd() - 0.5) * 0.08);
        const prix = base + (zone ? 0 : (d * TARIF_KG_KM + 4) + base * 0.06) + (k === 12 ? base * (p.recolte.some((m) => m === 9 || m === 10) ? -0.05 : 0.02) : 0);
        out.push({ id: `RP-${p.id}-${m.id}-${date}`, produitId: p.id, localiteId: m.id, date, prix: Math.round(prix / 5) * 5, source: 'agent', auteurId: 'U-G01' });
      });
    }
  }
  return out;
}
export const RELEVES: RelevePrix[] = genererReleves();

// ---------------------------------------------------------------- Offres

const of = (o: Omit<Offre, 'quantiteRestanteKg' | 'statut'> & Partial<Pick<Offre, 'quantiteRestanteKg' | 'statut'>>): Offre => ({ quantiteRestanteKg: o.quantiteKg, statut: 'active', ...o });

export const OFFRES: Offre[] = [
  of({ id: 'OF-1001', vendeurId: 'U-C02', produitId: 'mais', quantiteKg: 120_000, quantiteRestanteKg: 119_000, prixKg: 225, qualite: 'A', localiteId: 'SLN', disponibleLe: J(10), description: 'Maïs jaune nouvelle récolte, séché < 13 % d’humidité, en sacs de 100 kg.', lot: 'BF-SLN-MAI-2610-01', producteurs: 64, entrepotId: 'EN-SLN', livraison: false, creeLe: J(30), stockConfirmeLe: J(1) }),
  of({ id: 'OF-1002', vendeurId: 'U-P03', produitId: 'sesame', quantiteKg: 4_000, prixKg: 700, qualite: 'B', localiteId: 'SLN', disponibleLe: J(5), description: 'Sésame blanc, nettoyé au tamis, en sacs de 80 kg.', lot: 'BF-SLN-SES-2610-02', entrepotId: 'EN-SLN', livraison: false, creeLe: J(28), stockConfirmeLe: J(6) }),
  of({ id: 'OF-1003', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 32_000, quantiteRestanteKg: 23_360, prixKg: 330, qualite: 'A', localiteId: 'OHG', disponibleLe: J(3), description: 'Oignon violet de Galmi, calibre moyen, filets de 80 kg. Conservé en chambre froide.', lot: 'BF-OHG-OIG-2604-07', producteurs: 12, entrepotId: 'EN-OHG', livraison: true, creeLe: J(20), stockConfirmeLe: J(0) }),
  of({ id: 'OF-1004', vendeurId: 'U-P04', produitId: 'arachide', quantiteKg: 6_000, quantiteRestanteKg: 5_200, prixKg: 540, qualite: 'A', localiteId: 'LEO', disponibleLe: J(4), description: 'Arachide décortiquée triée à la main, récolte de cette saison. Expédition possible par car vers Ouagadougou (gare routière).', lot: 'BF-LEO-ARA-2610-03', livraison: true, creeLe: J(14), stockConfirmeLe: J(2) }),
  of({ id: 'OF-1005', vendeurId: 'U-P04', produitId: 'soja', quantiteKg: 10_000, prixKg: 285, qualite: 'B', localiteId: 'LEO', disponibleLe: J(8), description: 'Soja grain, sacs de 100 kg, stocké au village.', lot: 'BF-LEO-SOJ-2610-04', livraison: false, creeLe: J(16), stockConfirmeLe: J(12) }),
  of({ id: 'OF-1006', vendeurId: 'U-P01', produitId: 'niebe', quantiteKg: 3_000, prixKg: 430, qualite: 'A', localiteId: 'OHG', disponibleLe: J(2), description: 'Niébé blanc, conservé en sacs à triple fond (sans produit chimique).', lot: 'BF-OHG-NIE-2610-05', livraison: false, creeLe: J(9), stockConfirmeLe: J(4) }),
  of({ id: 'OF-1007', vendeurId: 'U-K02', produitId: 'riz', quantiteKg: 25_000, prixKg: 235, qualite: 'B', localiteId: 'BOB', disponibleLe: J(1), description: 'Riz paddy de la vallée du Kou, sacs de 100 kg.', lot: 'BF-BOB-RIZ-2610-06', entrepotId: 'EN-BOB', livraison: true, creeLe: J(12), stockConfirmeLe: J(1) }),
  of({ id: 'OF-1008', vendeurId: 'U-K02', produitId: 'soja', quantiteKg: 15_000, quantiteRestanteKg: 0, statut: 'epuisee', prixKg: 290, qualite: 'A', localiteId: 'BOB', disponibleLe: J(20), description: 'Soja jaune, triage mécanique.', lot: 'BF-BOB-SOJ-2609-07', livraison: true, creeLe: J(40), stockConfirmeLe: J(15) }),
  of({ id: 'OF-1009', vendeurId: 'U-P03', produitId: 'mais', quantiteKg: 8_000, prixKg: 230, qualite: 'B', localiteId: 'SLN', disponibleLe: J(40), description: 'Maïs blanc, sacs de 100 kg.', lot: 'BF-SLN-MAI-2609-08', livraison: false, creeLe: J(45), stockConfirmeLe: J(38) }),
  of({ id: 'OF-1010', vendeurId: 'U-P02', produitId: 'niebe', quantiteKg: 1_200, prixKg: 440, qualite: 'B', localiteId: 'KGS', disponibleLe: J(6), description: 'Niébé rouge, 12 sacs de 100 kg.', lot: 'BF-KGS-NIE-2610-09', livraison: false, creeLe: J(11), stockConfirmeLe: J(8) }),
  of({ id: 'OF-1011', vendeurId: 'U-C02', produitId: 'sesame', quantiteKg: 20_000, prixKg: 715, qualite: 'A', localiteId: 'SLN', disponibleLe: J(3), description: 'Sésame blanc export, pureté 99 %, lot traçable par producteur.', lot: 'BF-SLN-SES-2610-10', producteurs: 38, entrepotId: 'EN-SLN', livraison: false, certification: 'Traçabilité export', creeLe: J(7), stockConfirmeLe: J(1) }),
];

// ---------------------------------------------------------------- Demandes (RFQ & appels d'offres)

export const DEMANDES: Demande[] = [
  { id: 'DM-2001', acheteurId: 'U-T01', produitId: 'mais', quantiteKg: 300_000, prixMaxKg: 275, qualiteMin: 'A', localiteLivraisonId: 'OUA', dateLimite: '2026-12-31', recurrence: 'Contrat trimestriel', type: 'rfq', description: 'Maïs jaune pour aliment volaille. Humidité < 14 %, aflatoxines contrôlées. Livraison usine Kossodo.', statut: 'ouverte', creeLe: J(20) },
  { id: 'DM-2004', acheteurId: 'U-E01', produitId: 'sesame', quantiteKg: 200_000, prixMaxKg: 790, qualiteMin: 'A', localiteLivraisonId: 'BOB', dateLimite: '2026-12-15', type: 'rfq', description: 'Sésame blanc, pureté ≥ 99 %, traçabilité par lot exigée (export).', statut: 'ouverte', creeLe: J(18) },
];

export const COTATIONS: Cotation[] = [
  { id: 'CT-3001', demandeId: 'DM-2001', vendeurId: 'U-C02', prixKg: 228, quantiteKg: 120_000, localiteId: 'SLN', delaiJours: 12, message: 'Lot BF-SLN-MAI-2610-01 disponible au magasin de Solenzo. Analyse humidité jointe.', statut: 'envoyee', creeLe: J(15) },
  { id: 'CT-3002', demandeId: 'DM-2001', vendeurId: 'U-K02', prixKg: 238, quantiteKg: 90_000, localiteId: 'BOB', delaiJours: 5, message: 'Livraison possible avec notre camion partenaire.', statut: 'envoyee', creeLe: J(14) },
  { id: 'CT-3003', demandeId: 'DM-2004', vendeurId: 'U-C02', prixKg: 740, quantiteKg: 20_000, localiteId: 'SLN', delaiJours: 7, message: 'Lot export traçable BF-SLN-SES-2610-10.', statut: 'envoyee', creeLe: J(6) },
];

// ---------------------------------------------------------------- Commandes (différents stades du cycle)

const h = (date: string, statut: Commande['statut'], parId: string, note?: string) => ({ date, statut, parId, ...(note ? { note } : {}) });

export const COMMANDES: Commande[] = [
  // --- Mariam Kaboré (acheteuse, Ouagadougou) : arachide de Léo en route par car
  {
    id: 'CM-4010', reference: 'CMD-2026-0510', acheteurId: 'U-A01', vendeurId: 'U-P04', produitId: 'arachide', quantiteKg: 500, prixKg: 530,
    fraisTransport: 9_500, commissionPct: 2, origineId: 'LEO', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1004' }, origineAchat: 'negociation',
    statut: 'expediee', paiement: { operateur: 'Orange Money', reference: 'OM-PP261104.0712.C88231', montant: 500 * 530 + 9_500 + 5_300, date: J(1) },
    historique: [h(J(2), 'attente_confirmation', 'U-A01'), h(J(2), 'attente_paiement', 'U-P04', 'Disponibilité confirmée par le vendeur'), h(J(1), 'sequestre', 'U-A01', 'Paiement Orange Money bloqué en séquestre'), h(J(0), 'expediee', 'U-P04', 'Départ de Léo par car')],
    messages: [], creeLe: J(2), codeRemise: '4827',
    livraison: {
      mode: 'car', transporteur: 'Car de ligne Léo – Ouagadougou (compagnie fictive)', chauffeur: 'Adama Nikiéma', telephoneChauffeur: '+226 7• •• •• 41', vehicule: 'Car 60 places · 11 GJ 4521 (fictif)',
      departPrevu: H(-1.5), arriveePrevue: H(1.75), pointRemise: 'Gare routière de Ouagadougou — quai des cars en provenance de Léo',
      etapes: [
        { date: H(-14), texte: 'Accord avec le chauffeur : départ demain 7 h, arrivée vers 10 h 30 à la gare de Ouaga.', lieu: 'Léo', auteurId: 'U-P04' },
        { date: H(-2), texte: '5 sacs de 100 kg pesés et chargés dans la soute.', lieu: 'Gare de Léo', auteurId: 'U-P04' },
        { date: H(-1.5), texte: 'Départ du car.', lieu: 'Léo', auteurId: 'U-P04' },
        { date: H(-0.4), texte: 'Passage à Sapouy, tout va bien.', lieu: 'Sapouy', auteurId: 'U-P04' },
      ],
    },
  },
  // --- en attente de confirmation de disponibilité par la coopérative
  {
    id: 'CM-4011', reference: 'CMD-2026-0511', acheteurId: 'U-A01', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 160, prixKg: 330,
    fraisTransport: 160 * 20, commissionPct: 2, origineId: 'OHG', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1003' }, origineAchat: 'panier',
    statut: 'attente_confirmation', confirmationAvant: H(19), historique: [h(J(0), 'attente_confirmation', 'U-A01')], messages: [], creeLe: J(0),
  },
  // --- disponibilité confirmée : à payer (*144*…#)
  {
    id: 'CM-4012', reference: 'CMD-2026-0512', acheteurId: 'U-A01', vendeurId: 'U-C02', produitId: 'mais', quantiteKg: 1_000, prixKg: 225,
    fraisTransport: 1_000 * 24, commissionPct: 2, origineId: 'SLN', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1001' }, origineAchat: 'direct',
    statut: 'attente_paiement', historique: [h(J(1), 'attente_confirmation', 'U-A01'), h(J(0), 'attente_paiement', 'U-C02', 'Disponibilité confirmée — 10 sacs réservés au magasin de Solenzo')], messages: [], creeLe: J(1),
  },
  // --- terminée, avis produit publié
  {
    id: 'CM-4013', reference: 'CMD-2026-0489', acheteurId: 'U-A01', vendeurId: 'U-P01', produitId: 'niebe', quantiteKg: 200, prixKg: 425,
    fraisTransport: 200 * 17, commissionPct: 2, origineId: 'OHG', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1006' }, origineAchat: 'direct',
    statut: 'terminee', paiement: { operateur: 'Orange Money', reference: 'OM-PP261018.1433.A11902', montant: 200 * 425 + 3_400 + 1_700, date: J(17) },
    historique: [h(J(18), 'attente_confirmation', 'U-A01'), h(J(18), 'attente_paiement', 'U-P01'), h(J(17), 'sequestre', 'U-A01'), h(J(16), 'expediee', 'U-P01'), h(J(15), 'livree', 'U-P01'), h(J(15), 'terminee', 'U-A01', 'Réception confirmée — fonds libérés')],
    messages: [], creeLe: J(18), codeRemise: '1290',
    livraison: { mode: 'car', chauffeur: 'Ousmane Sawadogo', telephoneChauffeur: '+226 7• •• •• 63', pointRemise: 'Gare routière de Ouagadougou', departPrevu: J(16) + 'T07:00:00', arriveePrevue: J(16) + 'T11:00:00', etapes: [{ date: J(16) + 'T07:10:00', texte: 'Départ de Ouahigouya.', lieu: 'Ouahigouya', auteurId: 'U-P01' }, { date: J(15) + 'T09:00:00', texte: 'Remis à l’acheteuse (code vérifié).', lieu: 'Ouagadougou', auteurId: 'U-P01' }] },
  },
  // --- côté vendeur de Léo : un restaurant attend la confirmation
  {
    id: 'CM-4014', reference: 'CMD-2026-0513', acheteurId: 'U-A02', vendeurId: 'U-P04', produitId: 'arachide', quantiteKg: 300, prixKg: 540,
    fraisTransport: 300 * 19, commissionPct: 2, origineId: 'LEO', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1004' }, origineAchat: 'direct',
    statut: 'attente_confirmation', confirmationAvant: H(22), historique: [h(J(0), 'attente_confirmation', 'U-A02')], messages: [], creeLe: J(0),
  },
  // --- historique professionnel
  {
    id: 'CM-4001', reference: 'CMD-2026-0412', acheteurId: 'U-T01', vendeurId: 'U-P03', produitId: 'mais', quantiteKg: 8_000, prixKg: 230,
    fraisTransport: 8_000 * 30, commissionPct: 2, origineId: 'SLN', destinationId: 'OUA', source: { type: 'cotation', id: 'CT-3001' },
    statut: 'terminee', paiement: { operateur: 'Orange Money', reference: 'OM-8841207', montant: 8_000 * 230 + 240_000, date: J(55) },
    historique: [h(J(56), 'attente_paiement', 'U-T01'), h(J(55), 'sequestre', 'U-T01', 'Paiement Orange Money bloqué en séquestre'), h(J(53), 'expediee', 'U-P03'), h(J(51), 'livree', 'U-TR1'), h(J(51), 'terminee', 'U-T01', 'Réception confirmée, fonds libérés')],
    messages: [], creeLe: J(56),
  },
  {
    id: 'CM-4005', reference: 'CMD-2026-0397', acheteurId: 'U-E01', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 18_000, prixKg: 310,
    fraisTransport: 18_000 * 35, commissionPct: 2, origineId: 'OHG', destinationId: 'BOB', source: { type: 'offre', id: 'OF-1003' },
    statut: 'litige', paiement: { operateur: 'Virement bancaire', reference: 'VIR-0055713', montant: 18_000 * 310 + 630_000, date: J(9) },
    historique: [h(J(10), 'attente_paiement', 'U-E01'), h(J(9), 'sequestre', 'U-E01'), h(J(7), 'expediee', 'U-C01'), h(J(6), 'livree', 'U-TR2'), h(J(6), 'litige', 'U-E01', 'Écart qualité signalé')],
    messages: [{ date: J(6), auteurId: 'U-E01', texte: 'Environ 15 % des bulbes sont abîmés.' }],
    litige: { motif: 'Qualité non conforme', description: '15 % de bulbes abîmés à l’arrivée. Demande de réfaction sur 2 700 kg.', ouvertLe: J(6) },
    creeLe: J(10),
  },
];

// ---------------------------------------------------------------- Transport

export const FRETS: Fret[] = [
  { id: 'FR-5001', demandeurId: 'U-C02', origineId: 'SLN', destinationId: 'OUA', produitId: 'mais', tonnage: 30, dateChargement: '2026-10-12', prixPropose: 900_000, statut: 'ouvert', candidatures: [{ transporteurId: 'U-TR2', prix: 950_000, message: 'Camion 35 t disponible à Bobo le 11/10.', date: '2026-09-27' }], creeLe: '2026-09-26' },
 ];

export const AXES: SignalementAxe[] = [
  { id: 'AX-1', origineId: 'SLN', destinationId: 'DED', niveau: 'prudence', motif: 'Route dégradée', commentaire: 'Nids de poule importants après les pluies, prévoir +1 h.', date: '2026-09-24', auteurId: 'U-TR2', confirmations: 6 },
  { id: 'AX-2', origineId: 'OUA', destinationId: 'KAY', niveau: 'info', motif: 'Contrôles fréquents', commentaire: 'Plusieurs postes de contrôle, documents du chargement à jour exigés.', date: '2026-09-27', auteurId: 'U-TR1', confirmations: 3 },
  { id: 'AX-3', origineId: 'KAY', destinationId: 'DRI', niveau: 'deconseille', motif: 'Circulation déconseillée', commentaire: 'Circulation déconseillée signalée par plusieurs transporteurs. Se renseigner auprès des autorités avant tout départ.', date: '2026-09-26', auteurId: 'U-TR1', confirmations: 9 },
  { id: 'AX-4', origineId: 'BGR', destinationId: 'TNK', niveau: 'prudence', motif: 'Coupure / radier submergé', commentaire: 'Radier submergé après forte pluie, passage possible le matin.', date: '2026-09-28', auteurId: 'U-C01', confirmations: 2 },
  { id: 'AX-5', origineId: 'BOB', destinationId: 'OUA', niveau: 'info', motif: 'Travaux', commentaire: 'Travaux de réhabilitation, alternat sur 2 sections.', date: '2026-09-20', auteurId: 'U-TR2', confirmations: 5 },
];

// ---------------------------------------------------------------- Stockage

export const ENTREPOTS: Entrepot[] = [
  { id: 'EN-SLN', nom: 'Magasin de warrantage de Solenzo (fictif)', gestionnaireId: 'U-W01', localiteId: 'SLN', capaciteT: 800, tarifSacMois: 250, warrantage: true },
  { id: 'EN-BOB', nom: 'Entrepôt céréalier de Bobo (fictif)', gestionnaireId: 'U-W02', localiteId: 'BOB', capaciteT: 3000, tarifSacMois: 300, warrantage: true },
  { id: 'EN-OHG', nom: 'Chambre froide maraîchère de Ouahigouya (fictive)', gestionnaireId: 'U-W01', localiteId: 'OHG', capaciteT: 150, tarifSacMois: 1500, warrantage: false },
];

export const DEPOTS: Depot[] = [
  { id: 'DP-6001', entrepotId: 'EN-SLN', deposantId: 'U-C02', produitId: 'mais', quantiteKg: 120_000, dateEntree: '2026-09-18', qualite: 'A', statut: 'en_stock', recu: 'RS-SLN-2026-118' },
   { id: 'DP-6003', entrepotId: 'EN-SLN', deposantId: 'U-P03', produitId: 'sesame', quantiteKg: 4_000, dateEntree: '2026-09-15', qualite: 'B', statut: 'en_stock', recu: 'RS-SLN-2026-112' },
 ];

// ---------------------------------------------------------------- Coopératives

const noms = ['Adama Ouédraogo', 'Fatimata Sawadogo', 'Boukary Zoungrana', 'Mariam Guiro', 'Hamidou Porgo', 'Aminata Belem', 'Souleymane Ouédraogo', 'Alizèta Kindo', 'Issaka Sankara', 'Rakiéta Tapsoba', 'Oumarou Sawadogo', 'Safiatou Nana'];
const noms2 = ['Drissa Traoré', 'Mamadou Sanou', 'Kadiatou Dembélé', 'Yacouba Coulibaly', 'Aïssata Barro', 'Siaka Ouattara', 'Bintou Konaté', 'Seydou Dao', 'Djénéba Millogo', 'Lassina Konaté'];

export const APPORTS: Apport[] = [
  ...noms.map((m, i): Apport => ({ id: `AP-C01-${i + 1}`, cooperativeId: 'U-C01', membre: m, telephone: `+226 7• •• •• ${10 + i * 7}`, produitId: 'oignon', quantiteKg: [2400, 3200, 1600, 4000, 2800, 1200, 3600, 2000, 4400, 1600, 3200, 2000][i], qualite: i % 4 === 3 ? 'B' : 'A', date: `2026-04-${String(10 + i).padStart(2, '0')}`, lotId: 'LT-01', paye: false })),
  ...noms2.map((m, i): Apport => ({ id: `AP-C02-${i + 1}`, cooperativeId: 'U-C02', membre: m, telephone: `+226 6• •• •• ${12 + i * 5}`, produitId: 'mais', quantiteKg: [15000, 9000, 6000, 18000, 12000, 21000, 7000, 11000, 8000, 13000][i], qualite: 'A', date: `2026-09-${String(5 + i).padStart(2, '0')}`, lotId: 'LT-02', paye: false })),
  { id: 'AP-C02-11', cooperativeId: 'U-C02', membre: 'Karim Sanogo', telephone: '+226 6• •• •• 91', produitId: 'niebe', quantiteKg: 5_000, qualite: 'A', date: '2026-09-21', paye: false },
  { id: 'AP-C02-12', cooperativeId: 'U-C02', membre: 'Awa Diallo', telephone: '+226 6• •• •• 94', produitId: 'niebe', quantiteKg: 3_500, qualite: 'B', date: '2026-09-22', paye: false },
];

export const LOTS: Lot[] = [
  { id: 'LT-01', cooperativeId: 'U-C01', produitId: 'oignon', code: 'BF-OHG-OIG-2604-07', apportIds: APPORTS.filter((a) => a.lotId === 'LT-01').map((a) => a.id), quantiteKg: 32_000, offreId: 'OF-1003', statut: 'en_vente', creeLe: '2026-04-25' },
  { id: 'LT-02', cooperativeId: 'U-C02', produitId: 'mais', code: 'BF-SLN-MAI-2610-01', apportIds: APPORTS.filter((a) => a.lotId === 'LT-02').map((a) => a.id), quantiteKg: 120_000, offreId: 'OF-1001', statut: 'en_vente', creeLe: '2026-09-18' },
];

// ---------------------------------------------------------------- Espace acheteur

let m = 0;
const msg = (h: number, auteurId: string, texte: string, extra: Partial<Conversation['messages'][number]> = {}) => ({ id: `MSG-${++m}`, date: H(h), auteurId, type: 'texte' as const, texte, ...extra });

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'CV-1', offreId: 'OF-1004', produitId: 'arachide', acheteurId: 'U-A01', vendeurId: 'U-P04', nonLusAcheteur: 0, nonLusVendeur: 0, creeLe: J(3), majLe: H(-30),
    messages: [
      msg(-60, 'U-A01', 'Bonjour, votre arachide est-elle encore disponible ? Il m’en faut 500 kg pour Ouaga.', { type: 'question_dispo' }),
      msg(-58, 'U-P04', 'Oui, disponible : 52 sacs au magasin du village.', { type: 'reponse_dispo', disponible: true }),
      msg(-57, 'U-A01', 'Pouvez-vous faire un geste sur le prix pour 5 sacs ?'),
      msg(-50, 'U-P04', 'Je vous propose 530 F/kg pour 500 kg.', { type: 'proposition', proposition: { prixKg: 530, quantiteKg: 500, statut: 'acceptee', commandeId: 'CM-4010' } }),
      msg(-49, 'U-A01', 'D’accord, je commande.'),
      msg(-30, 'U-P04', 'Paiement bien reçu en séquestre. Je trouve un car pour demain matin et je vous donne l’heure d’arrivée.'),
    ],
  },
  {
    id: 'CV-2', offreId: 'OF-1005', produitId: 'soja', acheteurId: 'U-A01', vendeurId: 'U-P04', nonLusAcheteur: 0, nonLusVendeur: 1, creeLe: J(0), majLe: H(-3),
    messages: [msg(-3, 'U-A01', 'Le soja est-il toujours disponible ? Votre offre n’a pas été confirmée depuis quelques jours.', { type: 'question_dispo' })],
  },
  {
    id: 'CV-3', offreId: 'OF-1003', produitId: 'oignon', acheteurId: 'U-A01', vendeurId: 'U-C01', nonLusAcheteur: 1, nonLusVendeur: 0, creeLe: J(1), majLe: H(-5),
    messages: [
      msg(-26, 'U-A01', 'Bonjour, quel prix pour 5 filets (400 kg) livrés à Ouaga ?'),
      msg(-5, 'U-C01', 'Pour 5 filets nous pouvons faire 315 F/kg. Expédition par car le lendemain du paiement.', { type: 'proposition', proposition: { prixKg: 315, quantiteKg: 400, statut: 'en_attente' } }),
    ],
  },
];

export const FAVORIS: Favori[] = [
  { id: 'FV-1', userId: 'U-A01', offreId: 'OF-1001', prixKgAjout: 225, creeLe: J(9) },
  { id: 'FV-2', userId: 'U-A01', offreId: 'OF-1007', prixKgAjout: 245, creeLe: J(10) },
  { id: 'FV-3', userId: 'U-A01', offreId: 'OF-1004', prixKgAjout: 540, creeLe: J(4) },
  { id: 'FV-4', userId: 'U-A01', offreId: 'OF-1008', prixKgAjout: 290, creeLe: J(25) },
];

export const ALERTES: AlerteProduit[] = [
  { id: 'AL-1', userId: 'U-A01', produitId: 'sesame', prixMaxKg: 720, rayonKm: 400, localiteId: 'OUA', active: true, creeLe: J(12) },
  { id: 'AL-2', userId: 'U-A01', produitId: 'niebe', prixMaxKg: 450, localiteId: 'OUA', active: true, creeLe: J(20) },
];

export const PANIER: LignePanier[] = [
  { id: 'PN-1', userId: 'U-A01', offreId: 'OF-1006', quantiteKg: 300, ajouteLe: J(0) },
];

/** Contenus éditoriaux (fiches pratiques, informations plateforme) — l'actualité des prix est calculée. */
export const ACTUALITES: Actualite[] = [
  { id: 'AC-1', titre: 'Acheter des céréales : contrôlez l’humidité', resume: 'Un maïs ou un sorgho à plus de 14 % d’humidité moisit vite et risque les aflatoxines. Demandez au vendeur la mesure (humidimètre) ou une photo du grain, et préférez les lots séchés et stockés en magasin.', categorie: 'Conseil', produitIds: ['mais', 'riz'], regionIds: [], date: J(6), source: 'Fiche pratique FasoAgri' },
  { id: 'AC-2', titre: 'Niébé : les sacs à triple fond évitent les bruches', resume: 'Le niébé conservé en sacs hermétiques à triple fond se garde plusieurs mois sans produit chimique. Un lot « triple fond » est un bon signe de qualité à l’achat.', categorie: 'Conseil', produitIds: ['niebe'], regionIds: [], date: J(11), source: 'Fiche pratique FasoAgri' },
  { id: 'AC-3', titre: 'Nouveau : disponibilité confirmée sous 24 h', resume: 'Chaque commande est désormais réservée et confirmée par le vendeur avant paiement. Sans réponse sous 24 h, la commande est annulée automatiquement et des offres équivalentes vous sont proposées.', categorie: 'Plateforme', produitIds: [], regionIds: [], date: J(1), source: 'Équipe FasoAgri' },
  { id: 'AC-4', titre: 'Oignon : le stock de contre-saison diminue', resume: 'Les oignons récoltés au printemps se conservent quelques mois : la fin d’année est souvent marquée par une hausse des prix avant la nouvelle récolte. Comparez le coût rendu des offres conservées en chambre froide.', categorie: 'Saison', produitIds: ['oignon'], regionIds: ['NOR', 'CNO'], date: J(3), source: 'Fiche pratique FasoAgri' },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 'NT-1', userId: 'U-A01', date: J(0), texte: 'CMD-2026-0510 : votre arachide a quitté Léo. Arrivée prévue vers ' + new Date(MAINTENANT + 1.75 * 3_600_000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' à la gare routière de Ouagadougou.', lien: '/commandes/CM-4010', lu: false, type: 'livraison' },
  { id: 'NT-2', userId: 'U-A01', date: J(0), texte: 'Union des producteurs de Solenzo a confirmé la disponibilité de votre maïs. Vous pouvez payer.', lien: '/commandes/CM-4012', lu: false, type: 'commande' },
  { id: 'NT-3', userId: 'U-A01', date: J(0), texte: 'Nouvelle proposition de prix : oignon à 315 F/kg pour 400 kg.', lien: '/messages/CV-3', lu: false, type: 'message' },
  { id: 'NT-4', userId: 'U-A01', date: J(1), texte: 'Baisse de prix sur un favori : riz paddy à 235 F/kg (au lieu de 245).', lien: '/marche/OF-1007', lu: true, type: 'favori' },
  { id: 'NT-5', userId: 'U-A01', date: J(1), texte: 'Alerte sésame : nouvelle offre à 715 F/kg à Solenzo (qualité A).', lien: '/marche/OF-1011', lu: true, type: 'alerte' },
  { id: 'NT-6', userId: 'U-P04', date: J(0), texte: 'Nouvelle commande CMD-2026-0513 : 300 kg d’arachide. Confirmez la disponibilité sous 24 h.', lien: '/commandes/CM-4014', lu: false, type: 'commande' },
  { id: 'NT-7', userId: 'U-P04', date: J(0), texte: 'Mariam Kaboré demande si votre soja est toujours disponible.', lien: '/messages/CV-2', lu: false, type: 'message' },
  { id: 'NT-8', userId: 'U-C01', date: J(0), texte: 'Nouvelle commande CMD-2026-0511 : 160 kg d’oignon. Confirmez la disponibilité sous 24 h.', lien: '/commandes/CM-4011', lu: false, type: 'commande' },
  { id: 'NT-9', userId: 'U-T01', date: J(14), texte: '2 cotations reçues pour votre demande de maïs.', lien: '/demandes/DM-2001', lu: false, type: 'commande' },
];

export const AVIS: Avis[] = [
  { id: 'AV-1', commandeId: 'CM-4001', auteurId: 'U-T01', cibleId: 'U-P03', note: 5, commentaire: 'Sacs bien cousus, poids exact.', date: J(50) },
  { id: 'AV-2', commandeId: 'CM-4001', auteurId: 'U-P03', cibleId: 'U-T01', note: 5, commentaire: 'Paiement reçu immédiatement.', date: J(50) },
  { id: 'AV-3', commandeId: 'CM-4013', auteurId: 'U-A01', cibleId: 'U-P01', note: 5, commentaire: 'Niébé très propre, aucun charançon. Bien emballé.', date: J(15), offreId: 'OF-1006', produitId: 'niebe', achatVerifie: true },
  { id: 'AV-4', commandeId: 'CM-3990', auteurId: 'U-A02', cibleId: 'U-P04', note: 4, commentaire: 'Arachide bien triée, livraison par car arrivée avec 2 h de retard.', date: J(30), offreId: 'OF-1004', produitId: 'arachide', achatVerifie: true },
  { id: 'AV-5', commandeId: 'CM-3155', auteurId: 'U-E01', cibleId: 'U-C02', note: 5, commentaire: 'Lot très propre, conforme à la fiche.', date: J(60), produitId: 'sesame', achatVerifie: true },
  { id: 'AV-6', commandeId: 'CM-3301', auteurId: 'U-A02', cibleId: 'U-C01', note: 4, commentaire: 'Bons oignons, calibre régulier. Un jour de retard.', date: J(40), offreId: 'OF-1003', produitId: 'oignon', achatVerifie: true },
];

// ---------------------------------------------------------------- Disponibilités de camions (retours à vide annoncés)

export const DISPONIBILITES: DisponibiliteCamion[] = [
  { id: 'DC-1', transporteurId: 'U-TR1', origineId: 'BOB', destinationId: 'OUA', date: '2026-10-03', capaciteT: 30, tarifTonneKm: 55, commentaire: 'Retour à vide après livraison à Bobo : prix réduit.', statut: 'active', creeLe: '2026-09-28' },
  { id: 'DC-2', transporteurId: 'U-TR2', origineId: 'OUA', date: '2026-10-06', capaciteT: 35, tarifTonneKm: 60, commentaire: 'Disponible à Ouaga, toutes destinations vers l’ouest.', statut: 'active', creeLe: '2026-09-27' },
  { id: 'DC-3', transporteurId: 'U-TR3', origineId: 'LEO', date: '2026-10-01', capaciteT: 1.5, tarifTonneKm: 120, commentaire: 'Tricycle : collecte villages autour de Léo (rayon 40 km).', statut: 'active', creeLe: '2026-09-28' },
];

// ---------------------------------------------------------------- Campagnes de collecte (coopératives)

const eng = (membre: string, kg: number, date: string, livre = false) => ({ membre, telephone: '+226 6• •• •• ••', kg, date, livre });

export const COLLECTES: Collecte[] = [
  {
    id: 'CL-1', cooperativeId: 'U-C02', produitId: 'mais', objectifKg: 50_000, qualiteMin: 'B', prixIndicatifKg: 230, dateLimite: '2026-11-25',
    engagements: [eng('Drissa Traoré', 6_000, '2026-09-20', true), eng('Mamadou Sanou', 4_000, '2026-09-21', true), eng('Kadiatou Dembélé', 3_000, '2026-09-21'), eng('Yacouba Coulibaly', 8_000, '2026-09-22'),
      eng('Aïssata Barro', 5_000, '2026-09-23'), eng('Siaka Ouattara', 7_000, '2026-09-24', true), eng('Bintou Konaté', 2_500, '2026-09-25'), eng('Seydou Dao', 2_500, '2026-09-26')],
    statut: 'ouverte', creeLe: '2026-09-18',
  },
  {
    id: 'CL-2', cooperativeId: 'U-C01', produitId: 'oignon', objectifKg: 20_000, qualiteMin: 'A', prixIndicatifKg: 320, dateLimite: '2026-10-15',
    engagements: [eng('Adama Ouédraogo', 2_400, '2026-09-25'), eng('Fatimata Sawadogo', 1_600, '2026-09-26', true), eng('Hamidou Porgo', 3_200, '2026-09-27')],
    statut: 'ouverte', creeLe: '2026-09-24',
  },
];
