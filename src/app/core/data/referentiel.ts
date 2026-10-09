import { Localite, ModuleDef, Produit, Region } from '../models';

/**
 * Référentiel Burkina Faso.
 * Localités et provinces réelles, coordonnées approchées.
 * Découpage régional : 13 régions historiques — À METTRE À JOUR selon la réforme
 * administrative de 2025 (table `regions` côté backend).
 */

export const AUJOURDHUI = '2026-09-29';

export const REGIONS: Region[] = [
  { id: 'BMH', nom: 'Boucle du Mouhoun', chefLieu: 'Dédougou' },
  { id: 'CAS', nom: 'Cascades', chefLieu: 'Banfora' },
  { id: 'CEN', nom: 'Centre', chefLieu: 'Ouagadougou' },
  { id: 'CES', nom: 'Centre-Est', chefLieu: 'Tenkodogo' },
  { id: 'CNO', nom: 'Centre-Nord', chefLieu: 'Kaya' },
  { id: 'COU', nom: 'Centre-Ouest', chefLieu: 'Koudougou' },
  { id: 'CSU', nom: 'Centre-Sud', chefLieu: 'Manga' },
  { id: 'EST', nom: 'Est', chefLieu: 'Fada N’Gourma' },
  { id: 'HBS', nom: 'Hauts-Bassins', chefLieu: 'Bobo-Dioulasso' },
  { id: 'NOR', nom: 'Nord', chefLieu: 'Ouahigouya' },
  { id: 'PCE', nom: 'Plateau-Central', chefLieu: 'Ziniaré' },
  { id: 'SAH', nom: 'Sahel', chefLieu: 'Dori' },
  { id: 'SUO', nom: 'Sud-Ouest', chefLieu: 'Gaoua' },
];

export const LOCALITES: Localite[] = [
  { id: 'OUA', nom: 'Ouagadougou (Sankaryaré)', province: 'Kadiogo', regionId: 'CEN', lat: 12.371, lon: -1.519, marche: true },
  { id: 'BOB', nom: 'Bobo-Dioulasso', province: 'Houet', regionId: 'HBS', lat: 11.177, lon: -4.297, marche: true },
  { id: 'KDG', nom: 'Koudougou', province: 'Boulkiemdé', regionId: 'COU', lat: 12.253, lon: -2.363, marche: true },
  { id: 'OHG', nom: 'Ouahigouya', province: 'Yatenga', regionId: 'NOR', lat: 13.578, lon: -2.421, marche: true },
  { id: 'KAY', nom: 'Kaya', province: 'Sanmatenga', regionId: 'CNO', lat: 13.092, lon: -1.084, marche: true },
  { id: 'KGS', nom: 'Kongoussi', province: 'Bam', regionId: 'CNO', lat: 13.326, lon: -1.533, marche: false },
  { id: 'FAD', nom: 'Fada N’Gourma', province: 'Gourma', regionId: 'EST', lat: 12.062, lon: 0.358, marche: true },
  { id: 'DED', nom: 'Dédougou', province: 'Mouhoun', regionId: 'BMH', lat: 12.463, lon: -3.461, marche: true },
  { id: 'SLN', nom: 'Solenzo', province: 'Banwa', regionId: 'BMH', lat: 12.179, lon: -4.083, marche: true },
  { id: 'BFR', nom: 'Banfora', province: 'Comoé', regionId: 'CAS', lat: 10.633, lon: -4.761, marche: true },
  { id: 'ORD', nom: 'Orodara', province: 'Kénédougou', regionId: 'HBS', lat: 10.979, lon: -4.909, marche: false },
  { id: 'BAM', nom: 'Bama (Vallée du Kou)', province: 'Houet', regionId: 'HBS', lat: 11.383, lon: -4.414, marche: false },
  { id: 'TNK', nom: 'Tenkodogo', province: 'Boulgou', regionId: 'CES', lat: 11.780, lon: -0.370, marche: true },
  { id: 'PTG', nom: 'Pouytenga', province: 'Kouritenga', regionId: 'CES', lat: 12.250, lon: -0.428, marche: true },
  { id: 'BGR', nom: 'Bagré', province: 'Boulgou', regionId: 'CES', lat: 11.476, lon: -0.548, marche: false },
  { id: 'MNG', nom: 'Manga', province: 'Zoundwéogo', regionId: 'CSU', lat: 11.664, lon: -1.073, marche: true },
  { id: 'LEO', nom: 'Léo', province: 'Sissili', regionId: 'COU', lat: 11.100, lon: -2.100, marche: true },
  { id: 'GAO', nom: 'Gaoua', province: 'Poni', regionId: 'SUO', lat: 10.325, lon: -3.175, marche: true },
  { id: 'ZNR', nom: 'Ziniaré', province: 'Oubritenga', regionId: 'PCE', lat: 12.582, lon: -1.297, marche: false },
  { id: 'DRI', nom: 'Dori', province: 'Séno', regionId: 'SAH', lat: 14.035, lon: -0.034, marche: true },
];

const sac = (kg: number) => ({ code: `sac${kg}`, libelle: `Sac de ${kg} kg`, kg });
const KG = { code: 'kg', libelle: 'Kilogramme', kg: 1 };
const TONNE = { code: 't', libelle: 'Tonne', kg: 1000 };
const TINE = { code: 'tine', libelle: 'Tine (≈ 17 kg)', kg: 17 };
const YORUBA = { code: 'yoruba', libelle: 'Plat yoruba (≈ 2,5 kg)', kg: 2.5 };

export const PRODUITS: Produit[] = [
  { id: 'mais', nom: 'Maïs', categorie: 'Céréales', unites: [KG, sac(100), sac(50), TINE, YORUBA, TONNE], perissable: false, conservationJ: 240, pertePct: 3, recolte: [9, 10, 11] },
  { id: 'sorgho', nom: 'Sorgho blanc', categorie: 'Céréales', unites: [KG, sac(100), TINE, YORUBA, TONNE], perissable: false, conservationJ: 300, pertePct: 3, recolte: [10, 11, 12] },
  { id: 'mil', nom: 'Mil', categorie: 'Céréales', unites: [KG, sac(100), TINE, YORUBA, TONNE], perissable: false, conservationJ: 300, pertePct: 3, recolte: [10, 11] },
  { id: 'riz', nom: 'Riz local étuvé', categorie: 'Céréales', unites: [KG, sac(50), sac(25), YORUBA, TONNE], perissable: false, conservationJ: 365, pertePct: 1, recolte: [11, 12, 4, 5] },
  { id: 'niebe', nom: 'Niébé', categorie: 'Légumineuses & oléagineux', unites: [KG, sac(100), TINE, YORUBA, TONNE], perissable: false, conservationJ: 240, pertePct: 4, recolte: [10, 11] },
  { id: 'sesame', nom: 'Sésame', categorie: 'Légumineuses & oléagineux', unites: [KG, sac(80), TONNE], perissable: false, conservationJ: 365, pertePct: 1, recolte: [10, 11] },
  { id: 'arachide', nom: 'Arachide coque', categorie: 'Légumineuses & oléagineux', unites: [KG, sac(100), TINE, TONNE], perissable: false, conservationJ: 240, pertePct: 2, recolte: [9, 10] },
  { id: 'soja', nom: 'Soja', categorie: 'Légumineuses & oléagineux', unites: [KG, sac(100), TONNE], perissable: false, conservationJ: 300, pertePct: 2, recolte: [10, 11] },
  { id: 'oignon', nom: 'Oignon (violet de Galmi)', categorie: 'Maraîchage', unites: [KG, { code: 'filet', libelle: 'Sac filet (≈ 80 kg)', kg: 80 }, TONNE], perissable: true, conservationJ: 120, pertePct: 8, recolte: [2, 3, 4] },
  { id: 'tomate', nom: 'Tomate', categorie: 'Maraîchage', unites: [KG, { code: 'caisse', libelle: 'Caisse (≈ 25 kg)', kg: 25 }, { code: 'panier', libelle: 'Panier (≈ 15 kg)', kg: 15 }], perissable: true, conservationJ: 7, pertePct: 18, recolte: [1, 2, 3] },
  { id: 'pdt', nom: 'Pomme de terre', categorie: 'Maraîchage', unites: [KG, sac(50), TONNE], perissable: true, conservationJ: 60, pertePct: 8, recolte: [2, 3] },
  { id: 'mangue', nom: 'Mangue (Amélie, Kent)', categorie: 'Fruits', unites: [KG, { code: 'cageot', libelle: 'Cageot (≈ 20 kg)', kg: 20 }, TONNE], perissable: true, conservationJ: 10, pertePct: 20, recolte: [4, 5, 6] },
  { id: 'anacarde', nom: 'Noix de cajou brute', categorie: 'Fruits', unites: [KG, sac(80), TONNE], perissable: false, conservationJ: 365, pertePct: 1, recolte: [3, 4, 5] },
  { id: 'karite', nom: 'Amandes de karité', categorie: 'Produits forestiers', unites: [KG, sac(85), TONNE], perissable: false, conservationJ: 240, pertePct: 2, recolte: [6, 7, 8] },
  { id: 'poulet', nom: 'Poulet local (bicyclette)', categorie: 'Élevage', unites: [{ code: 'tete', libelle: 'Tête (≈ 1,2 kg)', kg: 1.2 }, KG], perissable: true, conservationJ: 3, pertePct: 3, recolte: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

export const localite = (id: string) => LOCALITES.find((l) => l.id === id)!;
export const produit = (id: string) => PRODUITS.find((p) => p.id === id)!;
export const region = (id: string) => REGIONS.find((r) => r.id === id)!;
export const MARCHES = LOCALITES.filter((l) => l.marche);

/** Distance routière estimée (vol d'oiseau × 1,15, calibré sur Ouagadougou–Bobo ≈ 360 km). */
export function distanceKm(a: string, b: string): number {
  if (a === b) return 0;
  const A = localite(a), B = localite(b);
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(B.lat - A.lat) / 2) ** 2 + Math.cos(rad(A.lat)) * Math.cos(rad(B.lat)) * Math.sin(rad(B.lon - A.lon) / 2) ** 2;
  return Math.max(10, Math.round((2 * 6371 * Math.asin(Math.sqrt(h)) * 1.15) / 5) * 5);
}

/** Tarif routier moyen, FCFA / kg / km (≈ 800 000 FCFA pour 30 t Bobo → Ouaga). */
export const TARIF_KG_KM = 0.075;
export const MANUTENTION_KG = 4;
export const COMMISSION_PCT = 2;

export const coutTransportKg = (km: number) => (km > 0 ? Math.round(km * TARIF_KG_KM + MANUTENTION_KG) : 0);

/**
 * Paramètres de génération des prix (FCFA/kg, prix de gros en zone de production)
 * et profil saisonnier octobre → septembre. Soudure juin–août pour les céréales.
 */
export const PARAM_PRIX: Record<string, { base: number; zones: string[]; saison: number[] }> = {
  mais:     { base: 215, zones: ['SLN', 'BOB', 'DED', 'BFR'], saison: [0.86, 0.82, 0.84, 0.90, 0.95, 1.00, 1.06, 1.12, 1.20, 1.25, 1.22, 1.02] },
  sorgho:   { base: 245, zones: ['DED', 'SLN', 'KDG', 'FAD'], saison: [0.90, 0.85, 0.86, 0.90, 0.95, 1.00, 1.06, 1.12, 1.18, 1.22, 1.20, 1.05] },
  mil:      { base: 290, zones: ['OHG', 'KAY', 'DED', 'DRI'], saison: [0.90, 0.86, 0.87, 0.90, 0.95, 1.00, 1.05, 1.10, 1.16, 1.20, 1.18, 1.05] },
  riz:      { base: 480, zones: ['BGR', 'BAM', 'DED'], saison: [1.00, 0.97, 0.95, 0.96, 0.98, 1.00, 1.01, 1.02, 1.04, 1.05, 1.05, 1.03] },
  niebe:    { base: 470, zones: ['KAY', 'OHG', 'FAD', 'KDG'], saison: [0.88, 0.84, 0.86, 0.92, 0.98, 1.03, 1.08, 1.13, 1.18, 1.20, 1.15, 1.00] },
  sesame:   { base: 720, zones: ['DED', 'SLN', 'FAD', 'KDG'], saison: [0.92, 0.90, 0.95, 1.00, 1.03, 1.05, 1.05, 1.04, 1.03, 1.02, 1.00, 0.97] },
  arachide: { base: 340, zones: ['FAD', 'LEO', 'GAO', 'DED'], saison: [0.88, 0.86, 0.90, 0.95, 1.00, 1.04, 1.08, 1.12, 1.14, 1.12, 1.05, 0.92] },
  soja:     { base: 285, zones: ['BOB', 'BFR', 'LEO'], saison: [0.90, 0.88, 0.92, 0.96, 1.00, 1.04, 1.07, 1.10, 1.12, 1.10, 1.05, 0.96] },
  oignon:   { base: 260, zones: ['OHG', 'KGS', 'KAY'], saison: [1.30, 1.40, 1.30, 1.05, 0.75, 0.62, 0.68, 0.80, 0.95, 1.10, 1.25, 1.30] },
  tomate:   { base: 230, zones: ['KGS', 'OHG', 'BAM'], saison: [1.40, 1.10, 0.80, 0.60, 0.55, 0.65, 0.90, 1.20, 1.50, 1.70, 1.60, 1.50] },
  pdt:      { base: 330, zones: ['OHG', 'KGS'], saison: [1.20, 1.25, 1.10, 0.95, 0.78, 0.75, 0.85, 0.95, 1.05, 1.15, 1.20, 1.20] },
  mangue:   { base: 110, zones: ['ORD', 'BFR', 'BOB'], saison: [1.50, 1.60, 1.60, 1.50, 1.30, 1.05, 0.75, 0.65, 0.80, 1.20, 1.40, 1.50] },
  anacarde: { base: 380, zones: ['BFR', 'ORD', 'GAO'], saison: [1.02, 1.04, 1.06, 1.08, 1.05, 0.95, 0.92, 0.95, 1.00, 1.00, 1.00, 1.00] },
  karite:   { base: 190, zones: ['LEO', 'GAO', 'MNG', 'TNK'], saison: [1.05, 1.08, 1.10, 1.12, 1.14, 1.12, 1.10, 1.05, 0.90, 0.85, 0.88, 0.95] },
  poulet:   { base: 2100, zones: ['PTG', 'KDG', 'FAD', 'TNK'], saison: [1.00, 1.00, 1.15, 1.05, 0.98, 1.00, 1.05, 1.00, 0.98, 1.00, 1.02, 1.00] },
};

export const MOIS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
export const MOIS_COURT = ['oct.', 'nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.'];
export const NOM_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Modules fonctionnels — utilisés par la collection besoins_v1 pour relier besoin → écran. */
export const MODULES: ModuleDef[] = [
  { id: 'observatoire', nom: 'Prix des marchés', description: 'Relevés de prix, unités locales, tendances, alertes.', route: '/prix' },
  { id: 'bourse', nom: 'Marché & demandes', description: 'Offres, demandes de cotation, appels d’offres, commandes.', route: '/marche' },
  { id: 'logistique', nom: 'Transport', description: 'Bourse de fret, retours à vide, état des axes.', route: '/transport' },
  { id: 'stockage', nom: 'Stockage en magasin', description: 'Magasins, dépôts, récépissés, stock vendable ou à risque.', route: '/magasin' },
  { id: 'qualite', nom: 'Qualité & traçabilité', description: 'Grades A/B/C, codes de lot, origine, certifications.', route: '/marche' },
  { id: 'paiement', nom: 'Paiement séquestre', description: 'Orange Money, Moov Money, Sank Money ; déblocage à la réception.', route: '/commandes' },
  { id: 'finance', nom: 'Confiance & score', description: 'Identité vérifiée, avis, historique, score de confiance.', route: '/profil' },
  { id: 'intrants', nom: 'Conseil agricole', description: 'Calendrier cultural, météo, fiches pratiques.', route: '/conseil' },
  { id: 'pilotage', nom: 'Pilotage', description: 'Tableaux de bord ONG / institutions, zones, volumes.', route: '/pilotage' },
];
