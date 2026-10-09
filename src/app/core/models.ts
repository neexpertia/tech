// =====================================================================
// Modèle de domaine — plateforme agricole Burkina Faso.
// Ces interfaces sont le CONTRAT avec le futur backend : chaque entité
// correspond à une table / ressource REST (voir docs/CONTRAT_API.md).
// =====================================================================

export type ID = string;
export type DateISO = string; // AAAA-MM-JJ ou ISO complet

// ---------------------------------------------------------------- Référentiels

export interface Region { id: ID; nom: string; chefLieu: string }

export interface Localite {
  id: ID;
  nom: string;
  province: string;
  regionId: ID;
  lat: number;
  lon: number;
  /** Marché suivi par la plateforme (relevés de prix) */
  marche: boolean;
}

export type CategorieProduit = 'Céréales' | 'Légumineuses & oléagineux' | 'Maraîchage' | 'Fruits' | 'Produits forestiers' | 'Élevage';

export interface UniteLocale {
  code: string;
  libelle: string;
  /** Équivalent en kg (approximation usuelle) */
  kg: number;
}

export interface Produit {
  id: ID;
  nom: string;
  categorie: CategorieProduit;
  unites: UniteLocale[];
  perissable: boolean;
  conservationJ: number;
  pertePct: number;
  /** Mois de récolte principaux (1-12) */
  recolte: number[];
}

// ---------------------------------------------------------------- Comptes

export type Role =
  | 'producteur' | 'cooperative' | 'acheteur' | 'transporteur' | 'entrepot' | 'collecteur' | 'institution'
  | 'admin'; // administrateur interne de la plateforme (pas un acteur)

/** Métier de l'acheteur (information, pas un rôle distinct). */
export type CategorieAcheteur = 'Grossiste / commerçant' | 'Transformateur' | 'Hôtel / restaurant' | 'Exportateur' | 'Supermarché / distributeur';

export type StatutKyc = 'en_attente' | 'verifie' | 'rejete';

export interface Utilisateur {
  id: ID;
  nom: string;
  role: Role;
  organisation?: string;
  telephone: string;
  localiteId: ID;
  langue: 'fr' | 'mos' | 'dyu' | 'ful';
  kyc: StatutKyc;
  pieces: string[]; // libellés des pièces fournies
  inscritLe: DateISO;
  membres?: number; // coopératives
  categorie?: CategorieAcheteur; // acheteurs
  capaciteT?: number; // transporteurs (charge utile)
}

export interface Avis { id: ID; commandeId: ID; auteurId: ID; cibleId: ID; note: 1 | 2 | 3 | 4 | 5; commentaire: string; date: DateISO }

// ---------------------------------------------------------------- Prix

export interface RelevePrix {
  id: ID;
  produitId: ID;
  localiteId: ID;
  date: DateISO;
  /** FCFA / kg, prix de gros */
  prix: number;
  source: 'agent' | 'transaction' | 'utilisateur';
  auteurId?: ID;
}

// ---------------------------------------------------------------- Commerce

export type Qualite = 'A' | 'B' | 'C';

export interface Offre {
  id: ID;
  vendeurId: ID;
  produitId: ID;
  quantiteKg: number;
  quantiteRestanteKg: number;
  prixKg: number;
  qualite: Qualite;
  localiteId: ID;
  disponibleLe: DateISO;
  description: string;
  lot: string; // code de traçabilité
  producteurs?: number;
  certification?: string;
  entrepotId?: ID;
  livraison: boolean;
  statut: 'active' | 'epuisee' | 'retiree';
  creeLe: DateISO;
}

export interface Demande {
  id: ID;
  acheteurId: ID;
  produitId: ID;
  quantiteKg: number;
  prixMaxKg?: number;
  qualiteMin: Qualite;
  localiteLivraisonId: ID;
  dateLimite: DateISO;
  recurrence?: string;
  type: 'rfq' | 'appel_offres';
  description: string;
  statut: 'ouverte' | 'attribuee' | 'close';
  creeLe: DateISO;
}

export interface Cotation {
  id: ID;
  demandeId: ID;
  vendeurId: ID;
  prixKg: number;
  quantiteKg: number;
  localiteId: ID;
  delaiJours: number;
  message: string;
  statut: 'envoyee' | 'acceptee' | 'refusee';
  creeLe: DateISO;
}

export type StatutCommande =
  | 'attente_paiement' | 'sequestre' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';

export type Operateur = 'Orange Money' | 'Moov Money' | 'Sank Money' | 'Virement bancaire';

export interface Commande {
  id: ID;
  reference: string;
  acheteurId: ID;
  vendeurId: ID;
  produitId: ID;
  quantiteKg: number;
  prixKg: number;
  fraisTransport: number;
  commissionPct: number;
  origineId: ID;
  destinationId: ID;
  source: { type: 'offre' | 'cotation'; id: ID };
  statut: StatutCommande;
  paiement?: { operateur: Operateur; reference: string; montant: number; date: DateISO };
  fretId?: ID;
  historique: { date: DateISO; statut: StatutCommande; parId: ID; note?: string }[];
  messages: { date: DateISO; auteurId: ID; texte: string }[];
  litige?: { motif: string; description: string; ouvertLe: DateISO; resolution?: string };
  creeLe: DateISO;
}

// ---------------------------------------------------------------- Transport

export interface Fret {
  id: ID;
  demandeurId: ID;
  commandeId?: ID;
  origineId: ID;
  destinationId: ID;
  produitId: ID;
  tonnage: number;
  dateChargement: DateISO;
  prixPropose: number;
  statut: 'ouvert' | 'attribue' | 'en_route' | 'livre';
  transporteurId?: ID;
  candidatures: { transporteurId: ID; prix: number; message: string; date: DateISO }[];
  creeLe: DateISO;
}

/** Capacité de transport annoncée par un transporteur (ex. camion vide au retour). */
export interface DisponibiliteCamion {
  id: ID;
  transporteurId: ID;
  origineId: ID;
  destinationId?: ID; // vide = toutes destinations
  date: DateISO;
  capaciteT: number;
  tarifTonneKm: number; // FCFA / t / km proposé
  commentaire: string;
  statut: 'active' | 'reservee' | 'expiree';
  creeLe: DateISO;
}

export interface SignalementAxe {
  id: ID;
  origineId: ID;
  destinationId: ID;
  niveau: 'info' | 'prudence' | 'deconseille';
  motif: 'Route dégradée' | 'Coupure / radier submergé' | 'Contrôles fréquents' | 'Circulation déconseillée' | 'Travaux';
  commentaire: string;
  date: DateISO;
  auteurId: ID;
  confirmations: number;
}

// ---------------------------------------------------------------- Stockage & finance

export interface Entrepot {
  id: ID;
  nom: string;
  gestionnaireId: ID;
  localiteId: ID;
  capaciteT: number;
  tarifSacMois: number; // FCFA par sac de 100 kg et par mois
  /** Magasin agréé : émet des récépissés reconnus (base du warrantage avec une banque). */
  warrantage: boolean;
}

export interface Depot {
  id: ID;
  entrepotId: ID;
  deposantId: ID;
  produitId: ID;
  quantiteKg: number;
  dateEntree: DateISO;
  qualite: Qualite;
  statut: 'en_stock' | 'retire';
  recu: string; // n° de récépissé
  dateSortie?: DateISO;
}

// ---------------------------------------------------------------- Coopérative

export interface Apport {
  id: ID;
  cooperativeId: ID;
  membre: string;
  telephone: string;
  produitId: ID;
  quantiteKg: number;
  qualite: Qualite;
  date: DateISO;
  lotId?: ID;
  paye: boolean;
}

/** Campagne de collecte d'une coopérative : objectif de volume et engagements des membres. */
export interface Collecte {
  id: ID;
  cooperativeId: ID;
  produitId: ID;
  objectifKg: number;
  qualiteMin: Qualite;
  prixIndicatifKg: number;
  dateLimite: DateISO;
  demandeId?: ID; // collecte lancée pour répondre à un acheteur
  engagements: { membre: string; telephone: string; kg: number; date: DateISO; livre: boolean }[];
  statut: 'ouverte' | 'close';
  lotId?: ID;
  creeLe: DateISO;
}

export interface Lot {
  id: ID;
  cooperativeId: ID;
  produitId: ID;
  code: string;
  apportIds: ID[];
  quantiteKg: number;
  offreId?: ID;
  statut: 'constitue' | 'en_vente' | 'vendu' | 'reparti';
  creeLe: DateISO;
}

export interface Notification { id: ID; userId: ID; date: DateISO; texte: string; lien?: string; lu: boolean }

// ---------------------------------------------------------------- Collection besoins_v1

export type ModuleId =
  | 'observatoire' | 'bourse' | 'logistique' | 'stockage' | 'qualite'
  | 'paiement' | 'finance' | 'intrants' | 'pilotage';

export interface ModuleDef { id: ModuleId; nom: string; description: string; route: string }

export type Segment = 'Offre' | 'Demande' | 'Logistique' | 'Finance & risque' | 'Pilotage public';

export interface Preoccupation {
  id: string;
  theme: string;
  question?: string;
  priorite: 1 | 2 | 3;
  modules: ModuleId[];
}

export interface Besoin {
  id: string;
  ordre: number;
  emoji: string;
  acteur: string;
  segment: Segment;
  question: string;
  exemple?: string;
  preoccupations: Preoccupation[];
  majLe: string;
}

export interface BesoinsCollection {
  collection: 'besoins_v1';
  version: number;
  majLe: string;
  source: string;
  items: Besoin[];
}

// ---------------------------------------------------------------- Benchmark

export type Niveau = 0 | 1 | 2 | 3;

export interface Fonctionnalite {
  id: string;
  domaine: string;
  nom: string;
  taim54: Niveau;
  nuku: Niveau;
  /** Présent dans notre plateforme (route de l'écran) ou prévu */
  nous: { niveau: Niveau; route?: string };
  pourquoiBurkina: string;
}
