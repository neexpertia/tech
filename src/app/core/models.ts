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

/**
 * Deux profils pour les utilisateurs : « acheteur » (profil de départ) et « vendeur »
 * (un acheteur qui a activé la vente ; il garde tout ce que fait un acheteur).
 * Les autres valeurs sont conservées pour les outils internes et les données historiques.
 */
export type Role =
  | 'acheteur' | 'vendeur'
  | 'producteur' | 'cooperative' | 'acheteur' | 'transporteur' | 'entrepot' | 'collecteur' | 'institution'
  | 'admin'; // administrateur interne de la plateforme (pas un acteur)

/** Métier de l'acheteur (information, pas un rôle distinct). */
export type CategorieAcheteur = 'Particulier / ménage' | 'Grossiste / commerçant' | 'Transformateur' | 'Hôtel / restaurant' | 'Exportateur' | 'Supermarché / distributeur';

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
  /** Date à laquelle un acheteur est devenu vendeur (« Devenir vendeur »). */
  vendeurDepuis?: DateISO;
  /** Ce que vend le vendeur : ses propres récoltes, celles d'une coopérative, ou du négoce */
  typeVendeur?: 'producteur' | 'cooperative' | 'commercant';
  /** Produits que le vendeur déclare produire / commercialiser. */
  produitsVendus?: ID[];
}

export interface Avis {
  id: ID; commandeId: ID; auteurId: ID; cibleId: ID; note: 1 | 2 | 3 | 4 | 5; commentaire: string; date: DateISO;
  /** Avis sur le produit acheté (achat vérifié : uniquement après une commande reçue). */
  offreId?: ID;
  produitId?: ID;
  achatVerifie?: boolean;
}

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
  /** Dernière confirmation du stock par le vendeur (fraîcheur de l'offre). */
  stockConfirmeLe?: DateISO;
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
  | 'attente_confirmation' // le vendeur doit confirmer la disponibilité (24 h)
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
  /** Échéance de confirmation de disponibilité par le vendeur (ISO date-heure). */
  confirmationAvant?: string;
  /** Échéance d'expédition après paiement (ISO date-heure) : au-delà, l'acheteur peut annuler et être remboursé. */
  expeditionAvant?: string;
  /** Code à 4 chiffres remis par l'acheteur au chauffeur à la réception. */
  codeRemise?: string;
  livraison?: Livraison;
  /** Commande émise depuis le panier ou une proposition négociée dans la messagerie */
  origineAchat?: 'panier' | 'direct' | 'negociation' | 'cotation';
}

export type ModeLivraison = 'transporteur' | 'car' | 'vendeur' | 'enlevement';

/** Organisation et suivi de la livraison (renseignés par le vendeur après accord avec le chauffeur). */
export interface Livraison {
  mode: ModeLivraison;
  transporteur?: string; // compagnie / propriétaire du véhicule
  chauffeur?: string;
  telephoneChauffeur?: string;
  vehicule?: string; // immatriculation, type
  departPrevu?: string; // ISO date-heure
  arriveePrevue?: string; // ISO date-heure
  /** Lieu précis de remise dans la ville de destination */
  pointRemise?: string;
  etapes: { date: string; texte: string; lieu?: string; auteurId: ID }[];
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

export type TypeNotification = 'commande' | 'livraison' | 'paiement' | 'message' | 'favori' | 'alerte' | 'compte' | 'autre';
export interface Notification { id: ID; userId: ID; date: DateISO; texte: string; lien?: string; lu: boolean; type?: TypeNotification }

// ---------------------------------------------------------------- Espace acheteur

/** Produit que l'utilisateur ne veut plus voir dans ses listes */
export interface Masque { id: ID; userId: ID; offreId: ID; creeLe: DateISO }

export interface Favori { id: ID; userId: ID; offreId: ID; prixKgAjout: number; creeLe: DateISO }

/** Alerte produit : « préviens-moi quand une offre correspond ». */
export interface AlerteProduit {
  id: ID;
  userId: ID;
  produitId: ID;
  prixMaxKg?: number;
  qualiteMin?: Qualite;
  /** Rayon autour de la localité de livraison (km) ; vide = tout le pays */
  rayonKm?: number;
  localiteId: ID;
  active: boolean;
  creeLe: DateISO;
}

export interface LignePanier { id: ID; userId: ID; offreId: ID; quantiteKg: number; ajouteLe: DateISO }

export type TypeMessage = 'texte' | 'question_dispo' | 'reponse_dispo' | 'proposition' | 'systeme';

export interface MessageConv {
  id: string;
  date: string; // ISO date-heure
  auteurId: ID;
  type: TypeMessage;
  texte: string;
  /** reponse_dispo */
  disponible?: boolean;
  /** proposition de prix négociée par le vendeur (ou contre-proposition de l'acheteur) */
  proposition?: { prixKg: number; quantiteKg: number; statut: 'en_attente' | 'acceptee' | 'refusee'; commandeId?: ID };
}

/** Discussion acheteur ↔ vendeur à propos d'une offre (avant ou après l'achat). */
export interface Conversation {
  id: ID;
  offreId: ID;
  produitId: ID;
  acheteurId: ID;
  vendeurId: ID;
  messages: MessageConv[];
  nonLusAcheteur: number;
  nonLusVendeur: number;
  majLe: string;
  creeLe: DateISO;
}

export type CategorieActu = 'Prix' | 'Saison' | 'Routes' | 'Marché' | 'Conseil' | 'Plateforme';

/** Actualité éditoriale (publiée par l'équipe) ; les actualités calculées sont générées à la volée. */
export interface Actualite {
  id: ID;
  titre: string;
  resume: string;
  categorie: CategorieActu;
  produitIds: ID[];
  regionIds: ID[];
  date: DateISO;
  source: string;
  lien?: string;
}

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
