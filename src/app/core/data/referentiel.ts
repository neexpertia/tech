import { Localite, ModuleDef, Produit, Region } from '../models';

/**
 * Référentiel Burkina Faso.
 * Localités et provinces réelles, coordonnées approchées.
 * Découpage régional : 13 régions historiques — À METTRE À JOUR selon la réforme
 * administrative de 2025 (table `regions` côté backend).
 */

export const AUJOURDHUI = '2026-09-29';

export const REGIONS: Region[] = [
  { id: 'CEN', nom: 'Centre', chefLieu: 'Ouagadougou' },
  { id: 'COU', nom: 'Centre-Ouest', chefLieu: 'Koudougou' },

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
  { id: 'sesame', nom: 'Sésame', categorie: 'Légumineuses & oléagineux', unites: [KG, sac(80), TONNE], perissable: false, conservationJ: 365, pertePct: 1, recolte: [10, 11] },
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
  sesame:   { base: 720, zones: ['DED', 'SLN', 'FAD', 'KDG'], saison: [0.92, 0.90, 0.95, 1.00, 1.03, 1.05, 1.05, 1.04, 1.03, 1.02, 1.00, 0.97] },
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
  { id: 'qualite', nom: 'Qualité & traçabilité', description: 'Grades A/B/C, codes de lot, origine, certifications.', route: '/marche' },
  { id: 'paiement', nom: 'Paiement séquestre', description: 'Orange Money, Moov Money, Sank Money ; déblocage à la réception.', route: '/commandes' },
  { id: 'finance', nom: 'Confiance & score', description: 'Identité vérifiée, avis, historique, score de confiance.', route: '/profil' },
  { id: 'intrants', nom: 'Conseil agricole', description: 'Calendrier cultural, météo, fiches pratiques.', route: '/conseil' },
  { id: 'pilotage', nom: 'Pilotage', description: 'Tableaux de bord ONG / institutions, zones, volumes.', route: '/pilotage' },
];
