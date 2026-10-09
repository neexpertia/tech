import { Role } from './models';

/**
 * Les 7 acteurs de la plateforme et l'interface adaptée à chacun :
 * nom de l'espace, sa question (besoins), menu, tuiles du tableau de bord.
 * L'outil qui répond à la question de l'acteur est toujours en premier.
 * L'administrateur est un compte interne de la plateforme, pas un acteur.
 */

export interface LienMenu { route: string; label: string; icone: string; query?: Record<string, string> }
export interface GroupeMenu { titre: string; liens: LienMenu[] }
export interface Tuile { icone: string; titre: string; texte: string; route: string; query?: Record<string, string> }

export interface ConfigRole {
  espace: string;
  emoji: string;
  /** La question de l'acteur (Besoins_v1) */
  question: string;
  accroche: string;
  menu: GroupeMenu[];
  tuiles: Tuile[];
}

/** Les 7 acteurs, dans l'ordre de la chaîne de valeur. */
export const ACTEURS: Exclude<Role, 'admin'>[] = ['producteur', 'cooperative', 'collecteur', 'acheteur', 'transporteur', 'entrepot', 'institution'];

const L = (route: string, label: string, icone: string, query?: Record<string, string>): LienMenu => ({ route, label, icone, ...(query ? { query } : {}) });
const T = (icone: string, titre: string, texte: string, route: string, query?: Record<string, string>): Tuile => ({ icone, titre, texte, route, ...(query ? { query } : {}) });

const ACCUEIL = L('/accueil', 'Tableau de bord', '🏠');
const PRIX = L('/prix', 'Prix des marchés', '📈');
const COMMANDES = L('/commandes', 'Mes commandes', '📦');
const CONSEIL = L('/conseil', 'Météo & conseils', '🌦️');
const TRANSPORT = L('/transport', 'Transport', '🚚');
const STOCKAGE = L('/stockage', 'Stockage en magasin', '🏬');
const APPRO = L('/approvisionnement', 'Plan d’approvisionnement', '🎯');
const OBSERVATOIRE = L('/observatoire', 'Observatoire des marchés', '🔭');
const VENDRE = L('/vendre-ma-recolte', 'Vendre au meilleur prix', '💡');

export const CONFIG_ROLES: Record<Role, ConfigRole> = {
  producteur: {
    espace: 'Espace producteur', emoji: '👨🏾‍🌾',
    question: 'Comment vendre ma production dans de bonnes conditions ?',
    accroche: 'Vendez votre récolte au bon prix, et soyez payé à coup sûr.',
    menu: [
      { titre: 'Vendre', liens: [ACCUEIL, VENDRE, L('/marche', 'Mes offres', '🧺', { vue: 'mes' }), L('/demandes', 'Acheteurs qui cherchent', '📋'), COMMANDES] },
      { titre: 'Décider', liens: [PRIX, STOCKAGE, L('/transport', 'Trouver un transport', '🚚'), CONSEIL] },
      { titre: 'Sans internet', liens: [L('/ussd', 'Code USSD / SMS', '📱')] },
    ],
    tuiles: [
      T('💡', 'Où vendre au meilleur prix ?', 'Toutes les options, net en poche', '/vendre-ma-recolte'),
      T('🧺', 'Publier mon offre', 'Les acheteurs sont alertés', '/marche/nouvelle'),
      T('📋', 'Acheteurs qui cherchent', 'Paiement garanti en séquestre', '/demandes'),
      T('🏬', 'Stocker ou vendre ?', 'Magasin avec récépissé', '/stockage'),
    ],
  },
  cooperative: {
    espace: 'Espace coopérative', emoji: '🤝',
    question: 'Comment agréger efficacement la production de plusieurs producteurs et la vendre au meilleur débouché ?',
    accroche: 'Regroupez la production de vos membres et vendez au meilleur débouché.',
    menu: [
      { titre: 'Agréger', liens: [ACCUEIL, L('/collecte', 'Campagnes de collecte', '🎯'), L('/cooperative', 'Apports des membres', '🤝'), L('/cooperative', 'Lots & paiement des membres', '💸', { vue: 'lots' })] },
      { titre: 'Vendre', liens: [VENDRE, L('/marche', 'Nos offres', '🧺', { vue: 'mes' }), L('/demandes', 'Demandes & appels d’offres', '📋'), COMMANDES, PRIX] },
      { titre: 'Logistique', liens: [TRANSPORT, STOCKAGE, CONSEIL, L('/ussd', 'Code USSD / SMS', '📱')] },
    ],
    tuiles: [
      T('🎯', 'Lancer une collecte', 'À partir d’un acheteur, suivi des engagements', '/collecte'),
      T('🏆', 'Meilleur débouché', 'Net à la porte du magasin', '/collecte'),
      T('📋', 'Répondre aux acheteurs', 'Demandes et appels d’offres', '/demandes'),
      T('💸', 'Payer les membres', 'Répartition Mobile Money', '/cooperative', { vue: 'lots' }),
    ],
  },
  collecteur: {
    espace: 'Espace collecteur', emoji: '🧭',
    question: 'Où trouver rapidement les volumes que je peux revendre ?',
    accroche: 'Trouvez vite les volumes que vous pouvez revendre, avec une marge sûre.',
    menu: [
      { titre: 'Acheter', liens: [ACCUEIL, L('/opportunites', 'Opportunités autour de moi', '🧭'), L('/marche', 'Lots disponibles', '🛒'), APPRO] },
      { titre: 'Revendre', liens: [L('/vendre-ma-recolte', 'Où revendre au mieux', '💡'), L('/marche', 'Mes offres', '🧺', { vue: 'mes' }), L('/demandes', 'Acheteurs qui cherchent', '📋'), COMMANDES] },
      { titre: 'Logistique', liens: [TRANSPORT, STOCKAGE, PRIX] },
    ],
    tuiles: [
      T('🧭', 'Volumes à revendre', 'Autour de mon point de collecte', '/opportunites'),
      T('💡', 'Où revendre ?', 'Acheteur ou marché, net après frais', '/vendre-ma-recolte'),
      T('📋', 'Acheteurs qui cherchent', 'Demandes en cours', '/demandes'),
      T('🚚', 'Transport groupé', 'Camions et tricycles', '/transport'),
    ],
  },
  acheteur: {
    espace: 'Espace acheteur', emoji: '🧑🏾‍💼',
    question: 'Où acheter suffisamment de produit, au bon prix, avec le moins de risque possible ?',
    accroche: 'Grossistes, transformateurs, hôtels, exportateurs, supermarchés : achetez le volume voulu, au bon prix, sans risque.',
    menu: [
      { titre: 'Acheter', liens: [ACCUEIL, APPRO, L('/marche', 'Offres disponibles', '🛒'), L('/demandes', 'Mes demandes', '📋', { vue: 'miennes' }), COMMANDES] },
      { titre: 'Décider', liens: [PRIX, TRANSPORT, STOCKAGE] },
    ],
    tuiles: [
      T('🎯', 'Plan d’approvisionnement', 'Volume, prix et risque en une fois', '/approvisionnement'),
      T('📋', 'Demander des cotations', 'Les vendeurs vous répondent', '/demandes/nouvelle'),
      T('📈', 'Comparer les zones', 'Où acheter moins cher ?', '/prix', { vue: 'produit' }),
      T('📦', 'Livraisons en cours', 'Réception et paiement libéré', '/commandes'),
    ],
  },
  transporteur: {
    espace: 'Espace transporteur', emoji: '🚚',
    question: 'Comment trouver des marchandises à transporter et éviter de rouler à vide ?',
    accroche: 'Trouvez des cargaisons et ne roulez plus à vide.',
    menu: [
      { titre: 'Mon activité', liens: [ACCUEIL, L('/tournees', 'Planifier mes tournées', '🗺️'), L('/transport', 'Cargaisons disponibles', '📦'), L('/transport', 'Mes trajets', '🛣️', { vue: 'miens' }), L('/transport', 'État des axes', '⚠️', { vue: 'axes' })] },
    ],
    tuiles: [
      T('🗺️', 'Ne plus rouler à vide', 'Aller + retour chargés, marge réelle', '/tournees'),
      T('📦', 'Cargaisons disponibles', 'Adaptées à ma charge utile', '/transport'),
      T('🛣️', 'Mes trajets', 'Chargement, livraison', '/transport', { vue: 'miens' }),
      T('⚠️', 'État des routes', 'Signaler / consulter', '/transport', { vue: 'axes' }),
    ],
  },
  entrepot: {
    espace: 'Espace entrepôt', emoji: '🏬',
    question: 'Comment remplir mon entrepôt avec des produits qui vont réellement être vendus, tout en maîtrisant le stock ?',
    accroche: 'Remplissez votre magasin avec des produits qui seront vendus, et maîtrisez le stock.',
    menu: [
      { titre: 'Mon magasin', liens: [ACCUEIL, L('/magasin', 'Piloter mon magasin', '🎯'), L('/stockage', 'Entrées & récépissés', '🏬')] },
      { titre: 'Marché', liens: [PRIX, TRANSPORT] },
    ],
    tuiles: [
      T('🎯', 'Stock vendable ou à risque ?', 'Et remplir la place libre', '/magasin'),
      T('➕', 'Enregistrer une entrée', 'Émettre un récépissé', '/stockage'),
      T('📈', 'Valeur des stocks', 'Au prix du marché', '/prix'),
      T('🚚', 'Sorties & transport', 'Bourse de fret', '/transport'),
    ],
  },
  institution: {
    espace: 'Espace institution', emoji: '🏛️',
    question: 'Que se passe-t-il réellement sur les marchés agricoles ?',
    accroche: 'Voyez ce qui se passe réellement sur les marchés agricoles.',
    menu: [
      { titre: 'Observatoire', liens: [ACCUEIL, OBSERVATOIRE, L('/pilotage', 'Régions & exports', '📊'), PRIX, L('/stockage', 'Stocks en magasin', '🏬'), L('/transport', 'Axes routiers', '⚠️', { vue: 'axes' })] },
    ],
    tuiles: [
      T('🔭', 'Que se passe-t-il sur les marchés ?', 'Prix réels, flux, tensions, fiabilité', '/observatoire'),
      T('📊', 'Régions', 'Offre, demande, stocks ; exports CSV', '/pilotage'),
      T('📈', 'Évolution des prix', '12 mois, tous marchés', '/prix', { vue: 'produit' }),
      T('⚠️', 'Axes routiers', 'Coupures et circulation déconseillée', '/transport', { vue: 'axes' }),
    ],
  },
  admin: {
    espace: 'Administration', emoji: '⚙️', question: '', accroche: 'Supervision de la plateforme (compte interne).',
    menu: [
      { titre: 'Supervision', liens: [ACCUEIL, L('/admin', 'Comptes & litiges', '⚙️'), L('/commandes', 'Toutes les commandes', '📦'), OBSERVATOIRE] },
      { titre: 'Outils des acteurs', liens: [VENDRE, L('/collecte', 'Collectes', '🎯'), L('/opportunites', 'Opportunités collecte', '🧭'), APPRO, L('/tournees', 'Tournées', '🗺️'), L('/magasin', 'Magasins', '🏬')] },
      { titre: 'Modules', liens: [PRIX, L('/marche', 'Marché', '🛒'), L('/demandes', 'Demandes', '📋'), L('/cooperative', 'Coopératives', '🤝'), TRANSPORT, STOCKAGE, L('/pilotage', 'Régions', '📊'), CONSEIL, L('/ussd', 'USSD', '📱')] },
      { titre: 'Projet', liens: [L('/projet/benchmark', 'Benchmark', '⚖️'), L('/projet/besoins', 'Besoins (collection)', '🗂️')] },
    ],
    tuiles: [
      T('🪪', 'Vérifier les comptes', 'Identités en attente', '/admin'),
      T('⚖️', 'Arbitrer les litiges', 'Fonds bloqués', '/admin'),
      T('🔭', 'Observatoire', 'Activité des marchés', '/observatoire'),
      T('🗂️', 'Besoins des acteurs', 'Collection besoins_v1', '/projet/besoins'),
    ],
  },
};

const TOUS: Role[] = [...ACTEURS, 'admin'];

/** Rôles autorisés par rubrique (l'admin a toujours accès). */
export const ACCES: Record<string, Role[]> = {
  accueil: TOUS, prix: TOUS, notifications: TOUS, profil: TOUS,
  conseil: ['producteur', 'cooperative'],
  ussd: ['producteur', 'cooperative', 'collecteur'],
  marche: ['producteur', 'cooperative', 'collecteur', 'acheteur', 'institution'],
  vendre: ['producteur', 'cooperative', 'collecteur'],
  demandes: ['producteur', 'cooperative', 'collecteur', 'acheteur'],
  acheter: ['acheteur', 'collecteur'],
  commandes: ['producteur', 'cooperative', 'collecteur', 'acheteur'],
  cooperative: ['cooperative'],
  transport: TOUS,
  stockage: ['producteur', 'cooperative', 'collecteur', 'acheteur', 'entrepot', 'institution'],
  pilotage: ['institution'],
  vendreAssistant: ['producteur', 'cooperative', 'collecteur'],
  appro: ['acheteur', 'collecteur'],
  tournees: ['transporteur'],
  magasin: ['entrepot'],
  opportunites: ['collecteur'],
  observatoire: ['institution'],
  admin: [],
  projet: [],
};
