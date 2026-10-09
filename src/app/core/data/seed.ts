import {
  Collecte, DisponibiliteCamion,
  Apport, Avis, Commande, Demande, Depot, Entrepot, Fret, Lot,
  Notification, Offre, RelevePrix, SignalementAxe, Utilisateur, Cotation,
} from '../models';
import { MARCHES, MOIS, PARAM_PRIX, PRODUITS, TARIF_KG_KM, distanceKm, hash, prng } from './referentiel';

/**
 * JEU DE DONNÉES FICTIF — Burkina Faso.
 * Noms de personnes et d'organisations inventés (mention « fictif/fictive »).
 * Numéros de téléphone masqués. Prix calibrés sur des ordres de grandeur plausibles.
 */

const u = (id: string, nom: string, role: Utilisateur['role'], localiteId: string, extra: Partial<Utilisateur> = {}): Utilisateur => ({
  id, nom, role, localiteId, telephone: `+226 7${id.length % 9} •• •• ${String(hash(id) % 90 + 10)} ${String(hash(nom) % 90 + 10)}`,
  langue: 'fr', kyc: 'verifie', pieces: ['CNIB'], inscritLe: '2025-11-10', ...extra,
});

export const UTILISATEURS: Utilisateur[] = [
  u('U-P01', 'Salif Ouédraogo', 'producteur', 'OHG', { langue: 'mos', inscritLe: '2025-10-14' }),
  u('U-P02', 'Awa Sawadogo', 'producteur', 'KGS', { langue: 'mos', inscritLe: '2026-01-08' }),
  u('U-P03', 'Issa Traoré', 'producteur', 'SLN', { langue: 'dyu', inscritLe: '2025-10-20' }),
  u('U-P04', 'Paul Compaoré', 'producteur', 'BGR', { inscritLe: '2026-02-02' }),
  u('U-P05', 'Rasmata Zida', 'producteur', 'KAY', { langue: 'mos', kyc: 'en_attente', pieces: [], inscritLe: '2026-09-25' }),
  u('U-C01', 'Union des groupements maraîchers du Yatenga (fictive)', 'cooperative', 'OHG', { organisation: 'Union UGMY', membres: 312, pieces: ['Récépissé OHADA/SCOOPS', 'PV d’AG'], inscritLe: '2025-10-05' }),
  u('U-C02', 'Coopérative Wend-Panga de Solenzo (fictive)', 'cooperative', 'SLN', { organisation: 'SCOOPS Wend-Panga', membres: 186, pieces: ['Récépissé OHADA/SCOOPS'], langue: 'dyu', inscritLe: '2025-10-05' }),
  u('U-C03', 'Union des productrices de karité de la Sissili (fictive)', 'cooperative', 'LEO', { organisation: 'UPKS', membres: 540, pieces: ['Récépissé OHADA/SCOOPS', 'Certification bio (en cours)'], inscritLe: '2025-12-01' }),
  u('U-C04', 'Coopérative rizicole de Bagré (fictive)', 'cooperative', 'BGR', { organisation: 'CRB', membres: 420, pieces: ['Récépissé OHADA/SCOOPS'], inscritLe: '2025-11-18' }),
  u('U-C05', 'Union des producteurs de mangue du Kénédougou (fictive)', 'cooperative', 'ORD', { organisation: 'UPMK', membres: 95, pieces: ['Récépissé OHADA/SCOOPS', 'GlobalG.A.P.'], langue: 'dyu', inscritLe: '2026-01-20' }),
  u('U-K01', 'Ets Zongo & Frères – Sankaryaré (fictif)', 'acheteur', 'OUA', { categorie: 'Grossiste / commerçant', organisation: 'Ets Zongo & Frères', pieces: ['RCCM', 'IFU'], inscritLe: '2025-10-03' }),
  u('U-K02', 'Barro Collecte Céréales (fictif)', 'collecteur', 'BOB', { organisation: 'Barro Collecte', pieces: ['RCCM', 'IFU'], langue: 'dyu', inscritLe: '2025-10-12' }),
  u('U-T01', 'Faso Provende SA (fictive)', 'acheteur', 'OUA', { categorie: 'Transformateur', organisation: 'Faso Provende SA', pieces: ['RCCM', 'IFU', 'Agrément sanitaire'], inscritLe: '2025-10-02' }),
  u('U-T02', 'Mini-rizerie Nong-Taaba (fictive)', 'acheteur', 'TNK', { categorie: 'Transformateur', organisation: 'Rizerie Nong-Taaba', pieces: ['RCCM'], inscritLe: '2026-03-11' }),
  u('U-R01', 'Hôtel Kadiogo Plaza (fictif)', 'acheteur', 'OUA', { categorie: 'Hôtel / restaurant', organisation: 'Hôtel Kadiogo Plaza', pieces: ['RCCM', 'IFU'], inscritLe: '2026-01-15' }),
  u('U-R02', 'Restaurant Sahel Saveurs (fictif)', 'acheteur', 'OUA', { categorie: 'Hôtel / restaurant', organisation: 'Sahel Saveurs', pieces: ['RCCM'], inscritLe: '2026-04-02' }),
  u('U-E01', 'Burkina Sésame Export SARL (fictive)', 'acheteur', 'BOB', { categorie: 'Exportateur', organisation: 'BSE SARL', pieces: ['RCCM', 'IFU', 'Agrément exportateur'], inscritLe: '2025-10-08' }),
  u('U-E02', 'Faso Mangue Export (fictif)', 'acheteur', 'BOB', { categorie: 'Exportateur', organisation: 'Faso Mangue Export', pieces: ['RCCM', 'Agrément exportateur'], inscritLe: '2026-02-14' }),
  u('U-D01', 'Supermarché Faso Frais – Ouaga 2000 (fictif)', 'acheteur', 'OUA', { categorie: 'Supermarché / distributeur', organisation: 'Faso Frais', pieces: ['RCCM', 'IFU'], inscritLe: '2025-12-09' }),
  u('U-K03', 'Kaboré Collecte Sanmatenga (fictif)', 'collecteur', 'KAY', { organisation: 'Kaboré Collecte', pieces: ['CNIB', 'Carte de commerçant'], langue: 'mos', inscritLe: '2026-02-10' }),
  u('U-TR1', 'Transports Nikiéma (fictif)', 'transporteur', 'OUA', { organisation: 'Transports Nikiéma', capaciteT: 30, pieces: ['Carte grise', 'Assurance'], inscritLe: '2025-10-18' }),
  u('U-TR2', 'Sanou Logistique (fictif)', 'transporteur', 'BOB', { organisation: 'Sanou Logistique', capaciteT: 35, pieces: ['Carte grise', 'Assurance'], langue: 'dyu', inscritLe: '2025-11-02' }),
  u('U-TR3', 'Tricycle Express Kaya (fictif)', 'transporteur', 'KAY', { organisation: 'Tricycle Express', capaciteT: 1.5, pieces: ['Carte grise'], langue: 'mos', inscritLe: '2026-05-06' }),
  u('U-W01', 'Magasin de warrantage de Solenzo (fictif)', 'entrepot', 'SLN', { organisation: 'Magasin Solenzo', pieces: ['Agrément magasin'], inscritLe: '2025-10-05' }),
  u('U-W02', 'Entrepôt céréalier de Bobo – zone industrielle (fictif)', 'entrepot', 'BOB', { organisation: 'ECB', pieces: ['RCCM'], inscritLe: '2025-10-22' }),
  u('U-W03', 'Chambre froide maraîchère de Ouahigouya (fictive)', 'entrepot', 'OHG', { organisation: 'CFMO', pieces: ['RCCM'], inscritLe: '2026-01-10' }),
  u('U-G01', 'Observatoire régional des marchés agricoles (fictif)', 'institution', 'OUA', { organisation: 'ORMA', pieces: [], inscritLe: '2025-10-01' }),
  u('U-X01', 'Moussa Kaboré (nouvelle inscription)', 'acheteur', 'KDG', { categorie: 'Grossiste / commerçant', kyc: 'en_attente', pieces: ['CNIB'], inscritLe: '2026-09-27' }),
  u('U-ADM', 'Équipe plateforme', 'admin', 'OUA', { pieces: [], inscritLe: '2025-10-01' }),
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

export const OFFRES: Offre[] = [
  { id: 'OF-1001', vendeurId: 'U-C02', produitId: 'mais', quantiteKg: 120_000, quantiteRestanteKg: 120_000, prixKg: 225, qualite: 'A', localiteId: 'SLN', disponibleLe: '2026-10-10', description: 'Maïs jaune nouvelle récolte, séché < 13 % d’humidité, en sacs de 100 kg.', lot: 'BF-SLN-MAI-2610-01', producteurs: 64, entrepotId: 'EN-SLN', livraison: false, statut: 'active', creeLe: '2026-09-20' },
  { id: 'OF-1002', vendeurId: 'U-P03', produitId: 'sesame', quantiteKg: 4_000, quantiteRestanteKg: 4_000, prixKg: 700, qualite: 'B', localiteId: 'SLN', disponibleLe: '2026-10-25', description: 'Sésame blanc, nettoyé au tamis.', lot: 'BF-SLN-SES-2610-02', livraison: false, statut: 'active', creeLe: '2026-09-22' },
  { id: 'OF-1003', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 40_000, quantiteRestanteKg: 32_000, prixKg: 330, qualite: 'A', localiteId: 'OHG', disponibleLe: '2026-09-30', description: 'Violet de Galmi conservé en case ventilée, calibre moyen, sacs filets de 80 kg.', lot: 'BF-OHG-OIG-2604-07', producteurs: 41, livraison: true, statut: 'active', creeLe: '2026-09-15' },
  { id: 'OF-1004', vendeurId: 'U-P01', produitId: 'oignon', quantiteKg: 3_200, quantiteRestanteKg: 3_200, prixKg: 320, qualite: 'B', localiteId: 'OHG', disponibleLe: '2026-09-30', description: '40 filets, conservation traditionnelle.', lot: 'BF-OHG-OIG-2604-11', livraison: false, statut: 'active', creeLe: '2026-09-26' },
  { id: 'OF-1005', vendeurId: 'U-C04', produitId: 'riz', quantiteKg: 60_000, quantiteRestanteKg: 60_000, prixKg: 490, qualite: 'A', localiteId: 'BGR', disponibleLe: '2026-10-05', description: 'Riz étuvé par les étuveuses de la coopérative, sacs de 50 kg, tri manuel.', lot: 'BF-BGR-RIZ-2609-03', producteurs: 118, livraison: true, statut: 'active', creeLe: '2026-09-18' },
  { id: 'OF-1006', vendeurId: 'U-C03', produitId: 'karite', quantiteKg: 85_000, quantiteRestanteKg: 85_000, prixKg: 180, qualite: 'A', localiteId: 'LEO', disponibleLe: '2026-10-01', description: 'Amandes séchées, taux d’acidité contrôlé, collectées par 212 femmes.', lot: 'BF-LEO-KAR-2608-01', producteurs: 212, certification: 'Bio (en cours)', livraison: false, statut: 'active', creeLe: '2026-09-10' },
  { id: 'OF-1007', vendeurId: 'U-K02', produitId: 'mais', quantiteKg: 90_000, quantiteRestanteKg: 90_000, prixKg: 240, qualite: 'A', localiteId: 'BOB', disponibleLe: '2026-10-03', description: 'Maïs blanc et jaune, stock en entrepôt à Bobo.', lot: 'BF-BOB-MAI-2609-05', entrepotId: 'EN-BOB', livraison: true, statut: 'active', creeLe: '2026-09-21' },
  { id: 'OF-1008', vendeurId: 'U-K02', produitId: 'soja', quantiteKg: 30_000, quantiteRestanteKg: 30_000, prixKg: 290, qualite: 'B', localiteId: 'BOB', disponibleLe: '2026-10-12', description: 'Soja grain, campagne 2025.', lot: 'BF-BOB-SOJ-2609-02', entrepotId: 'EN-BOB', livraison: true, statut: 'active', creeLe: '2026-09-23' },
  { id: 'OF-1009', vendeurId: 'U-P02', produitId: 'tomate', quantiteKg: 1_500, quantiteRestanteKg: 1_500, prixKg: 340, qualite: 'A', localiteId: 'KGS', disponibleLe: '2026-09-30', description: 'Tomate de contre-saison irriguée (lac Bam), 60 caisses.', lot: 'BF-KGS-TOM-2609-09', livraison: false, statut: 'active', creeLe: '2026-09-27' },
  { id: 'OF-1010', vendeurId: 'U-P04', produitId: 'riz', quantiteKg: 5_000, quantiteRestanteKg: 5_000, prixKg: 470, qualite: 'B', localiteId: 'BGR', disponibleLe: '2026-10-02', description: '100 sacs de 50 kg.', lot: 'BF-BGR-RIZ-2609-12', livraison: false, statut: 'active', creeLe: '2026-09-24' },
  { id: 'OF-1011', vendeurId: 'U-C02', produitId: 'niebe', quantiteKg: 18_000, quantiteRestanteKg: 18_000, prixKg: 520, qualite: 'A', localiteId: 'SLN', disponibleLe: '2026-10-20', description: 'Niébé blanc variété Komcallé, stocké en sacs triple fond.', lot: 'BF-SLN-NIE-2610-03', producteurs: 27, entrepotId: 'EN-SLN', livraison: false, statut: 'active', creeLe: '2026-09-25' },
  { id: 'OF-1012', vendeurId: 'U-C01', produitId: 'pdt', quantiteKg: 12_000, quantiteRestanteKg: 12_000, prixKg: 400, qualite: 'A', localiteId: 'OHG', disponibleLe: '2026-09-30', description: 'Pomme de terre en chambre froide, sacs de 50 kg.', lot: 'BF-OHG-PDT-2603-04', producteurs: 19, entrepotId: 'EN-OHG', livraison: true, statut: 'active', creeLe: '2026-09-12' },
  { id: 'OF-1014', vendeurId: 'U-P05', produitId: 'niebe', quantiteKg: 1_500, quantiteRestanteKg: 1_500, prixKg: 450, qualite: 'B', localiteId: 'KAY', disponibleLe: '2026-10-02', description: '15 sacs de niébé, récolte de la semaine.', lot: 'BF-KAY-NIE-2609-21', livraison: false, statut: 'active', creeLe: '2026-09-28' },
  { id: 'OF-1015', vendeurId: 'U-P01', produitId: 'mil', quantiteKg: 2_000, quantiteRestanteKg: 2_000, prixKg: 280, qualite: 'B', localiteId: 'OHG', disponibleLe: '2026-10-05', description: '20 sacs de mil local.', lot: 'BF-OHG-MIL-2609-14', livraison: false, statut: 'active', creeLe: '2026-09-27' },
  { id: 'OF-1016', vendeurId: 'U-P02', produitId: 'oignon', quantiteKg: 2_400, quantiteRestanteKg: 2_400, prixKg: 300, qualite: 'A', localiteId: 'KGS', disponibleLe: '2026-09-30', description: '30 filets, conservés en case.', lot: 'BF-KGS-OIG-2604-19', livraison: false, statut: 'active', creeLe: '2026-09-26' },
  { id: 'OF-1013', vendeurId: 'U-P03', produitId: 'mais', quantiteKg: 8_000, quantiteRestanteKg: 0, prixKg: 230, qualite: 'B', localiteId: 'SLN', disponibleLe: '2026-09-15', description: '80 sacs.', lot: 'BF-SLN-MAI-2609-08', livraison: false, statut: 'epuisee', creeLe: '2026-09-05' },
];

// ---------------------------------------------------------------- Demandes (RFQ & appels d'offres)

export const DEMANDES: Demande[] = [
  { id: 'DM-2001', acheteurId: 'U-T01', produitId: 'mais', quantiteKg: 300_000, prixMaxKg: 275, qualiteMin: 'A', localiteLivraisonId: 'OUA', dateLimite: '2026-10-31', recurrence: 'Contrat trimestriel', type: 'rfq', description: 'Maïs jaune pour aliment volaille. Humidité < 14 %, aflatoxines contrôlées. Livraison usine Kossodo.', statut: 'ouverte', creeLe: '2026-09-16' },
  { id: 'DM-2002', acheteurId: 'U-R01', produitId: 'tomate', quantiteKg: 120, prixMaxKg: 650, qualiteMin: 'A', localiteLivraisonId: 'OUA', dateLimite: '2026-10-05', recurrence: 'Tous les lundis', type: 'rfq', description: '120 kg de tomates fermes + facture chaque semaine.', statut: 'ouverte', creeLe: '2026-09-24' },
  { id: 'DM-2003', acheteurId: 'U-R01', produitId: 'oignon', quantiteKg: 60, prixMaxKg: 550, qualiteMin: 'A', localiteLivraisonId: 'OUA', dateLimite: '2026-10-05', recurrence: 'Tous les lundis', type: 'rfq', description: 'Oignon violet, calibre moyen.', statut: 'ouverte', creeLe: '2026-09-24' },
  { id: 'DM-2004', acheteurId: 'U-E01', produitId: 'sesame', quantiteKg: 200_000, prixMaxKg: 790, qualiteMin: 'A', localiteLivraisonId: 'BOB', dateLimite: '2026-11-30', type: 'rfq', description: 'Sésame blanc, pureté ≥ 99 %, traçabilité par lot exigée (export).', statut: 'ouverte', creeLe: '2026-09-19' },
  { id: 'DM-2005', acheteurId: 'U-K01', produitId: 'sorgho', quantiteKg: 250_000, prixMaxKg: 300, qualiteMin: 'B', localiteLivraisonId: 'KAY', dateLimite: '2026-11-15', type: 'appel_offres', description: 'Appel d’offres : sorgho blanc livré au dépôt de Kaya. Priorité aux coopératives. Lots de 50 t acceptés.', statut: 'ouverte', creeLe: '2026-09-12' },
  { id: 'DM-2006', acheteurId: 'U-D01', produitId: 'riz', quantiteKg: 10_000, prixMaxKg: 560, qualiteMin: 'A', localiteLivraisonId: 'OUA', dateLimite: '2026-10-15', recurrence: 'Mensuel', type: 'rfq', description: 'Riz local étuvé en sacs de 25 kg (conditionnement rayon).', statut: 'ouverte', creeLe: '2026-09-20' },
  { id: 'DM-2007', acheteurId: 'U-T02', produitId: 'riz', quantiteKg: 40_000, prixMaxKg: 520, qualiteMin: 'B', localiteLivraisonId: 'TNK', dateLimite: '2026-10-20', type: 'rfq', description: 'Paddy/étuvé pour décorticage.', statut: 'ouverte', creeLe: '2026-09-22' },
  { id: 'DM-2008', acheteurId: 'U-K01', produitId: 'niebe', quantiteKg: 25_000, prixMaxKg: 600, qualiteMin: 'B', localiteLivraisonId: 'OUA', dateLimite: '2026-10-30', type: 'rfq', description: 'Niébé pour revente Sankaryaré.', statut: 'ouverte', creeLe: '2026-09-26' },
  { id: 'DM-2009', acheteurId: 'U-K01', produitId: 'mais', quantiteKg: 30_000, prixMaxKg: 290, qualiteMin: 'B', localiteLivraisonId: 'OUA', dateLimite: '2026-09-20', type: 'rfq', description: 'Maïs blanc.', statut: 'attribuee', creeLe: '2026-09-02' },
];

export const COTATIONS: Cotation[] = [
  { id: 'CT-3001', demandeId: 'DM-2001', vendeurId: 'U-C02', prixKg: 228, quantiteKg: 120_000, localiteId: 'SLN', delaiJours: 12, message: 'Lot BF-SLN-MAI-2610-01 disponible au magasin de Solenzo. Analyse humidité jointe.', statut: 'envoyee', creeLe: '2026-09-21' },
  { id: 'CT-3002', demandeId: 'DM-2001', vendeurId: 'U-K02', prixKg: 238, quantiteKg: 90_000, localiteId: 'BOB', delaiJours: 5, message: 'Livraison possible avec notre camion partenaire.', statut: 'envoyee', creeLe: '2026-09-22' },
  { id: 'CT-3003', demandeId: 'DM-2005', vendeurId: 'U-C02', prixKg: 255, quantiteKg: 50_000, localiteId: 'SLN', delaiJours: 20, message: 'Sorgho blanc nouvelle récolte, disponible fin octobre.', statut: 'envoyee', creeLe: '2026-09-25' },
  { id: 'CT-3004', demandeId: 'DM-2002', vendeurId: 'U-P02', prixKg: 360, quantiteKg: 120, localiteId: 'KGS', delaiJours: 2, message: 'Je peux livrer chaque lundi via tricycle + car.', statut: 'envoyee', creeLe: '2026-09-27' },
  { id: 'CT-3005', demandeId: 'DM-2006', vendeurId: 'U-C04', prixKg: 500, quantiteKg: 10_000, localiteId: 'BGR', delaiJours: 6, message: 'Conditionnement 25 kg possible (+5 F/kg).', statut: 'envoyee', creeLe: '2026-09-23' },
  { id: 'CT-3006', demandeId: 'DM-2009', vendeurId: 'U-P03', prixKg: 230, quantiteKg: 8_000, localiteId: 'SLN', delaiJours: 4, message: '80 sacs.', statut: 'acceptee', creeLe: '2026-09-06' },
  { id: 'CT-3007', demandeId: 'DM-2008', vendeurId: 'U-C02', prixKg: 525, quantiteKg: 18_000, localiteId: 'SLN', delaiJours: 25, message: 'Niébé Komcallé, sacs triple fond.', statut: 'envoyee', creeLe: '2026-09-27' },
];

// ---------------------------------------------------------------- Commandes (différents stades du cycle)

const h = (date: string, statut: Commande['statut'], parId: string, note?: string) => ({ date, statut, parId, ...(note ? { note } : {}) });

export const COMMANDES: Commande[] = [
  {
    id: 'CM-4001', reference: 'CMD-2026-0412', acheteurId: 'U-K01', vendeurId: 'U-P03', produitId: 'mais', quantiteKg: 8_000, prixKg: 230,
    fraisTransport: 8_000 * 30, commissionPct: 2, origineId: 'SLN', destinationId: 'OUA', source: { type: 'cotation', id: 'CT-3006' },
    statut: 'terminee', paiement: { operateur: 'Orange Money', reference: 'OM-8841207', montant: 8_000 * 230 + 240_000, date: '2026-09-08' }, fretId: 'FR-5006',
    historique: [h('2026-09-07', 'attente_paiement', 'U-K01'), h('2026-09-08', 'sequestre', 'U-K01', 'Paiement Orange Money bloqué en séquestre'), h('2026-09-10', 'expediee', 'U-P03'), h('2026-09-12', 'livree', 'U-TR1'), h('2026-09-12', 'terminee', 'U-K01', 'Réception confirmée, fonds libérés')],
    messages: [{ date: '2026-09-07', auteurId: 'U-K01', texte: 'Merci de bien coudre les sacs.' }, { date: '2026-09-07', auteurId: 'U-P03', texte: 'D’accord, chargement mercredi matin.' }],
    creeLe: '2026-09-07',
  },
  {
    id: 'CM-4002', reference: 'CMD-2026-0431', acheteurId: 'U-R01', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 480, prixKg: 340,
    fraisTransport: 480 * 20, commissionPct: 2, origineId: 'OHG', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1003' },
    statut: 'expediee', paiement: { operateur: 'Moov Money', reference: 'MM-5520931', montant: 480 * 340 + 9_600, date: '2026-09-26' },
    historique: [h('2026-09-25', 'attente_paiement', 'U-R01'), h('2026-09-26', 'sequestre', 'U-R01'), h('2026-09-28', 'expediee', 'U-C01', 'Envoyé par car de transport en commun, colis n° 4471')],
    messages: [{ date: '2026-09-28', auteurId: 'U-C01', texte: '6 filets expédiés ce matin par car, arrivée gare de Ouaga ce soir.' }],
    creeLe: '2026-09-25',
  },
  {
    id: 'CM-4003', reference: 'CMD-2026-0438', acheteurId: 'U-D01', vendeurId: 'U-C01', produitId: 'oignon', quantiteKg: 8_000, prixKg: 330,
    fraisTransport: 8_000 * 20, commissionPct: 2, origineId: 'OHG', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1003' },
    statut: 'sequestre', paiement: { operateur: 'Sank Money', reference: 'SK-2201874', montant: 8_000 * 330 + 160_000, date: '2026-09-28' },
    historique: [h('2026-09-27', 'attente_paiement', 'U-D01'), h('2026-09-28', 'sequestre', 'U-D01')],
    messages: [], creeLe: '2026-09-27',
  },
  {
    id: 'CM-4004', reference: 'CMD-2026-0440', acheteurId: 'U-T01', vendeurId: 'U-K02', produitId: 'soja', quantiteKg: 15_000, prixKg: 290,
    fraisTransport: 15_000 * 31, commissionPct: 2, origineId: 'BOB', destinationId: 'OUA', source: { type: 'offre', id: 'OF-1008' },
    statut: 'attente_paiement', historique: [h('2026-09-28', 'attente_paiement', 'U-T01')], messages: [], creeLe: '2026-09-28',
  },
  {
    id: 'CM-4005', reference: 'CMD-2026-0397', acheteurId: 'U-E02', vendeurId: 'U-C05', produitId: 'mangue', quantiteKg: 18_000, prixKg: 120,
    fraisTransport: 18_000 * 8, commissionPct: 2, origineId: 'ORD', destinationId: 'BOB', source: { type: 'offre', id: 'OF-0950' },
    statut: 'litige', paiement: { operateur: 'Virement bancaire', reference: 'VIR-0055713', montant: 18_000 * 120 + 144_000, date: '2026-05-12' },
    historique: [h('2026-05-11', 'attente_paiement', 'U-E02'), h('2026-05-12', 'sequestre', 'U-E02'), h('2026-05-14', 'expediee', 'U-C05'), h('2026-05-15', 'livree', 'U-TR2'), h('2026-05-15', 'litige', 'U-E02', 'Écart qualité signalé')],
    messages: [{ date: '2026-05-15', auteurId: 'U-E02', texte: 'Environ 15 % des fruits ne passent pas le calibrage export.' }],
    litige: { motif: 'Qualité non conforme', description: '15 % de fruits hors calibre export. Demande de réfaction sur 2 700 kg.', ouvertLe: '2026-05-15' },
    creeLe: '2026-05-11',
  },
];

// ---------------------------------------------------------------- Transport

export const FRETS: Fret[] = [
  { id: 'FR-5001', demandeurId: 'U-C02', origineId: 'SLN', destinationId: 'OUA', produitId: 'mais', tonnage: 30, dateChargement: '2026-10-12', prixPropose: 900_000, statut: 'ouvert', candidatures: [{ transporteurId: 'U-TR2', prix: 950_000, message: 'Camion 35 t disponible à Bobo le 11/10.', date: '2026-09-27' }], creeLe: '2026-09-26' },
  { id: 'FR-5002', demandeurId: 'U-C01', origineId: 'OHG', destinationId: 'OUA', produitId: 'oignon', tonnage: 8, dateChargement: '2026-09-30', prixPropose: 180_000, statut: 'ouvert', candidatures: [], creeLe: '2026-09-28' },
  { id: 'FR-5003', demandeurId: 'U-C04', origineId: 'BGR', destinationId: 'OUA', produitId: 'riz', tonnage: 10, dateChargement: '2026-10-06', prixPropose: 230_000, statut: 'ouvert', candidatures: [], creeLe: '2026-09-25' },
  { id: 'FR-5004', demandeurId: 'U-C03', origineId: 'LEO', destinationId: 'BOB', produitId: 'karite', tonnage: 25, dateChargement: '2026-10-03', prixPropose: 720_000, statut: 'attribue', transporteurId: 'U-TR2', candidatures: [{ transporteurId: 'U-TR2', prix: 720_000, message: 'OK', date: '2026-09-20' }], creeLe: '2026-09-18' },
  { id: 'FR-5005', demandeurId: 'U-T01', origineId: 'OUA', destinationId: 'BOB', produitId: 'mais', tonnage: 25, dateChargement: '2026-10-11', prixPropose: 600_000, statut: 'ouvert', candidatures: [], creeLe: '2026-09-28' },
  { id: 'FR-5006', demandeurId: 'U-K01', commandeId: 'CM-4001', origineId: 'SLN', destinationId: 'OUA', produitId: 'mais', tonnage: 8, dateChargement: '2026-09-10', prixPropose: 240_000, statut: 'livre', transporteurId: 'U-TR1', candidatures: [], creeLe: '2026-09-07' },
  { id: 'FR-5007', demandeurId: 'U-P05', origineId: 'KAY', destinationId: 'OUA', produitId: 'niebe', tonnage: 1.2, dateChargement: '2026-10-02', prixPropose: 35_000, statut: 'ouvert', candidatures: [], creeLe: '2026-09-28' },
];

export const AXES: SignalementAxe[] = [
  { id: 'AX-1', origineId: 'SLN', destinationId: 'DED', niveau: 'prudence', motif: 'Route dégradée', commentaire: 'Nids de poule importants après les pluies, prévoir +1 h.', date: '2026-09-24', auteurId: 'U-TR2', confirmations: 6 },
  { id: 'AX-2', origineId: 'OUA', destinationId: 'KAY', niveau: 'info', motif: 'Contrôles fréquents', commentaire: 'Plusieurs postes de contrôle, documents du chargement à jour exigés.', date: '2026-09-27', auteurId: 'U-TR3', confirmations: 3 },
  { id: 'AX-3', origineId: 'KAY', destinationId: 'DRI', niveau: 'deconseille', motif: 'Circulation déconseillée', commentaire: 'Circulation déconseillée signalée par plusieurs transporteurs. Se renseigner auprès des autorités avant tout départ.', date: '2026-09-26', auteurId: 'U-TR1', confirmations: 9 },
  { id: 'AX-4', origineId: 'BGR', destinationId: 'TNK', niveau: 'prudence', motif: 'Coupure / radier submergé', commentaire: 'Radier submergé après forte pluie, passage possible le matin.', date: '2026-09-28', auteurId: 'U-C04', confirmations: 2 },
  { id: 'AX-5', origineId: 'BOB', destinationId: 'OUA', niveau: 'info', motif: 'Travaux', commentaire: 'Travaux de réhabilitation, alternat sur 2 sections.', date: '2026-09-20', auteurId: 'U-TR2', confirmations: 5 },
];

// ---------------------------------------------------------------- Stockage

export const ENTREPOTS: Entrepot[] = [
  { id: 'EN-SLN', nom: 'Magasin de warrantage de Solenzo (fictif)', gestionnaireId: 'U-W01', localiteId: 'SLN', capaciteT: 800, tarifSacMois: 250, warrantage: true },
  { id: 'EN-BOB', nom: 'Entrepôt céréalier de Bobo (fictif)', gestionnaireId: 'U-W02', localiteId: 'BOB', capaciteT: 3000, tarifSacMois: 300, warrantage: true },
  { id: 'EN-OHG', nom: 'Chambre froide maraîchère de Ouahigouya (fictive)', gestionnaireId: 'U-W03', localiteId: 'OHG', capaciteT: 150, tarifSacMois: 1500, warrantage: false },
];

export const DEPOTS: Depot[] = [
  { id: 'DP-6001', entrepotId: 'EN-SLN', deposantId: 'U-C02', produitId: 'mais', quantiteKg: 120_000, dateEntree: '2026-09-18', qualite: 'A', statut: 'en_stock', recu: 'RS-SLN-2026-118' },
  { id: 'DP-6002', entrepotId: 'EN-SLN', deposantId: 'U-C02', produitId: 'niebe', quantiteKg: 18_000, dateEntree: '2026-09-22', qualite: 'A', statut: 'en_stock', recu: 'RS-SLN-2026-121' },
  { id: 'DP-6003', entrepotId: 'EN-SLN', deposantId: 'U-P03', produitId: 'sesame', quantiteKg: 4_000, dateEntree: '2026-09-15', qualite: 'B', statut: 'en_stock', recu: 'RS-SLN-2026-112' },
  { id: 'DP-6004', entrepotId: 'EN-BOB', deposantId: 'U-K02', produitId: 'mais', quantiteKg: 90_000, dateEntree: '2026-08-30', qualite: 'A', statut: 'en_stock', recu: 'RS-BOB-2026-341' },
  { id: 'DP-6005', entrepotId: 'EN-BOB', deposantId: 'U-K02', produitId: 'soja', quantiteKg: 30_000, dateEntree: '2026-09-05', qualite: 'B', statut: 'en_stock', recu: 'RS-BOB-2026-352' },
  { id: 'DP-6006', entrepotId: 'EN-BOB', deposantId: 'U-E01', produitId: 'sesame', quantiteKg: 140_000, dateEntree: '2026-06-02', qualite: 'A', statut: 'en_stock', recu: 'RS-BOB-2026-198' },
  { id: 'DP-6008', entrepotId: 'EN-BOB', deposantId: 'U-C02', produitId: 'mais', quantiteKg: 60_000, dateEntree: '2026-03-02', qualite: 'A', statut: 'retire', recu: 'RS-BOB-2026-077', dateSortie: '2026-07-10' },
  { id: 'DP-6009', entrepotId: 'EN-BOB', deposantId: 'U-K02', produitId: 'sorgho', quantiteKg: 45_000, dateEntree: '2026-02-12', qualite: 'B', statut: 'retire', recu: 'RS-BOB-2026-061', dateSortie: '2026-06-25' },
  { id: 'DP-6010', entrepotId: 'EN-BOB', deposantId: 'U-K02', produitId: 'arachide', quantiteKg: 22_000, dateEntree: '2026-01-20', qualite: 'B', statut: 'en_stock', recu: 'RS-BOB-2026-038' },
  { id: 'DP-6007', entrepotId: 'EN-OHG', deposantId: 'U-C01', produitId: 'pdt', quantiteKg: 12_000, dateEntree: '2026-08-20', qualite: 'A', statut: 'en_stock', recu: 'RS-OHG-2026-044' },
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

export const NOTIFICATIONS: Notification[] = [
  { id: 'NT-1', userId: 'U-C02', date: '2026-09-22', texte: 'Nouvelle cotation possible : Faso Provende cherche 300 t de maïs.', lien: '/demandes/DM-2001', lu: false },
  { id: 'NT-2', userId: 'U-C02', date: '2026-09-27', texte: 'Sanou Logistique a candidaté sur votre fret Solenzo → Ouagadougou.', lien: '/transport', lu: false },
  { id: 'NT-3', userId: 'U-T01', date: '2026-09-22', texte: '2 cotations reçues pour votre demande de maïs.', lien: '/demandes/DM-2001', lu: false },
  { id: 'NT-4', userId: 'U-C01', date: '2026-09-28', texte: 'Faso Frais a payé la commande CMD-2026-0438 (fonds en séquestre). Vous pouvez expédier.', lien: '/commandes/CM-4003', lu: false },
];

export const AVIS: Avis[] = [
  { id: 'AV-1', commandeId: 'CM-4001', auteurId: 'U-K01', cibleId: 'U-P03', note: 5, commentaire: 'Sacs bien cousus, poids exact.', date: '2026-09-12' },
  { id: 'AV-2', commandeId: 'CM-4001', auteurId: 'U-P03', cibleId: 'U-K01', note: 5, commentaire: 'Paiement reçu immédiatement.', date: '2026-09-12' },
  { id: 'AV-3', commandeId: 'CM-3301', auteurId: 'U-D01', cibleId: 'U-C01', note: 4, commentaire: 'Bonne qualité, 1 jour de retard.', date: '2026-08-10' },
  { id: 'AV-4', commandeId: 'CM-3290', auteurId: 'U-T01', cibleId: 'U-K02', note: 4, commentaire: 'Humidité conforme.', date: '2026-07-22' },
  { id: 'AV-5', commandeId: 'CM-3155', auteurId: 'U-E01', cibleId: 'U-C02', note: 5, commentaire: 'Lot très propre.', date: '2026-02-11' },
];

// ---------------------------------------------------------------- Disponibilités de camions (retours à vide annoncés)

export const DISPONIBILITES: DisponibiliteCamion[] = [
  { id: 'DC-1', transporteurId: 'U-TR1', origineId: 'BOB', destinationId: 'OUA', date: '2026-10-03', capaciteT: 30, tarifTonneKm: 55, commentaire: 'Retour à vide après livraison à Bobo : prix réduit.', statut: 'active', creeLe: '2026-09-28' },
  { id: 'DC-2', transporteurId: 'U-TR2', origineId: 'OUA', date: '2026-10-06', capaciteT: 35, tarifTonneKm: 60, commentaire: 'Disponible à Ouaga, toutes destinations vers l’ouest.', statut: 'active', creeLe: '2026-09-27' },
  { id: 'DC-3', transporteurId: 'U-TR3', origineId: 'KAY', date: '2026-10-01', capaciteT: 1.5, tarifTonneKm: 120, commentaire: 'Tricycle : collecte villages autour de Kaya (rayon 40 km).', statut: 'active', creeLe: '2026-09-28' },
];

// ---------------------------------------------------------------- Campagnes de collecte (coopératives)

const eng = (membre: string, kg: number, date: string, livre = false) => ({ membre, telephone: '+226 6• •• •• ••', kg, date, livre });

export const COLLECTES: Collecte[] = [
  {
    id: 'CL-1', cooperativeId: 'U-C02', produitId: 'sorgho', objectifKg: 50_000, qualiteMin: 'B', prixIndicatifKg: 250, dateLimite: '2026-10-25', demandeId: 'DM-2005',
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
