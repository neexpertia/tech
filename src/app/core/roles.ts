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
/** Les deux profils proposés aux utilisateurs. */
export const PROFILS: Role[] = ['acheteur', 'vendeur'];

export const ACTEURS: Exclude<Role, 'admin'>[] = ['producteur', 'cooperative', 'collecteur', 'acheteur', 'transporteur', 'entrepot', 'institution'];

const L = (route: string, label: string, icone: string, query?: Record<string, string>): LienMenu => ({ route, label, icone, ...(query ? { query } : {}) });
const T = (icone: string, titre: string, texte: string, route: string, query?: Record<string, string>): Tuile => ({ icone, titre, texte, route, ...(query ? { query } : {}) });

const ACCUEIL = L('/accueil', 'Tableau de bord', '🏠');
const PRIX = L('/prix', 'Prix des marchés', '📈');
const COMMANDES = L('/commandes', 'Mes commandes', '📦');

const TRANSPORT = L('/transport', 'Transport', '🚚');

const APPRO = L('/approvisionnement', 'Plan d’achat', '🎯');
const MESSAGES = L('/messages', 'Messages', '💬');
const FAVORIS = L('/favoris', 'Favoris', '❤️');
const PANIER = L('/panier', 'Panier', '🧺');
const ACTUS = L('/actualites', 'Actualités', '📰');
const ALERTES = L('/alertes', 'Alertes', '🔔');
/** Un vendeur reste acheteur : il garde ses favoris, son panier et ses achats. */
const ACHATS_VENDEUR = { titre: 'Mes achats', liens: [L('/marche', 'Acheter sur le marché', '🛒'), FAVORIS, PANIER] };
const OBSERVATOIRE = L('/observatoire', 'Observatoire des marchés', '🔭');


export const CONFIG_ROLES: Record<Role, ConfigRole> = {
  producteur: {
    espace: 'Espace producteur', emoji: '👨🏾‍🌾',
    question: 'Comment vendre ma production dans de bonnes conditions ?',
    accroche: 'Vendez votre récolte au bon prix, et soyez payé à coup sûr.',
    menu: [
      { titre: 'Vendre', liens: [ACCUEIL, L('/marche', 'Mes offres', '🧺', { vue: 'mes' }), COMMANDES, MESSAGES, L('/demandes', 'Acheteurs qui cherchent', '📋')] },
      { titre: 'Décider', liens: [PRIX, ACTUS, L('/transport', 'Trouver un transport', '🚚')] },
      ACHATS_VENDEUR,
    ],
    tuiles: [
      T('🧺', 'Publier mon offre', 'Les acheteurs sont alertés', '/marche/nouvelle'),
      T('📋', 'Acheteurs qui cherchent', 'Paiement garanti', '/demandes'),

    ],
  },
  cooperative: {
    espace: 'Espace coopérative', emoji: '🤝',
    question: 'Comment agréger efficacement la production de plusieurs producteurs et la vendre au meilleur débouché ?',
    accroche: 'Regroupez la production de vos membres et vendez au meilleur débouché.',
    menu: [
      { titre: 'Agréger', liens: [ACCUEIL, L('/collecte', 'Campagnes de collecte', '🎯'), L('/cooperative', 'Apports des membres', '🤝'), L('/cooperative', 'Lots & paiement des membres', '💸', { vue: 'lots' })] },
      { titre: 'Vendre', liens: [ L('/marche', 'Nos offres', '🧺', { vue: 'mes' }), COMMANDES, MESSAGES, L('/demandes', 'Demandes & appels d’offres', '📋'), PRIX] },
      { titre: 'Logistique & infos', liens: [TRANSPORT, ACTUS] },
      ACHATS_VENDEUR,
    ],
    tuiles: [
      T('🎯', 'Lancer une collecte', 'À partir d’un acheteur, suivi des engagements', '/collecte'),

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
      { titre: 'Revendre', liens: [ L('/marche', 'Mes offres', '🧺', { vue: 'mes' }), COMMANDES, MESSAGES, L('/demandes', 'Acheteurs qui cherchent', '📋')] },
      { titre: 'Logistique & infos', liens: [TRANSPORT, PRIX, ACTUS] },
      { titre: 'Mes achats', liens: [FAVORIS, PANIER] },
    ],
    tuiles: [
      T('🧭', 'Volumes à revendre', 'Autour de mon point de collecte', '/opportunites'),
      T('💡', 'Où revendre ?', 'Acheteur ou marché, net après frais', '/vendre-ma-recolte'),
      T('📋', 'Acheteurs qui cherchent', 'Demandes en cours', '/demandes'),
      T('🚚', 'Transport groupé', 'Camions et tricycles', '/transport'),
    ],
  },
  acheteur: {
    espace: 'Espace acheteur', emoji: '🛒',
    question: 'Où acheter suffisamment de produit, au bon prix, avec le moins de risque possible ?',
    accroche: 'Ménages, restaurants, commerçants, transformateurs, exportateurs : achetez des produits disponibles, au bon prix, avec paiement protégé et livraison suivie.',
    menu: [
      { titre: 'Acheter', liens: [L('/accueil', 'Accueil', '🏠'), L('/marche', 'Marché', '🛒'), PANIER, FAVORIS] },
      { titre: 'Suivre', liens: [L('/commandes', 'Commandes', '📦'), MESSAGES, ALERTES] },
      { titre: 'S’informer', liens: [ACTUS, PRIX] },
      { titre: 'Plus', liens: [L('/demandes', 'Achats en gros', '📋', { vue: 'miennes' }), APPRO, L('/devenir-vendeur', 'Devenir vendeur', '🌱')] },
    ],
    tuiles: [
      T('🎯', 'Plan d’approvisionnement', 'Volume, prix et risque en une fois', '/approvisionnement'),
      T('📋', 'Demander des cotations', 'Les vendeurs vous répondent', '/demandes/nouvelle'),
      T('📈', 'Comparer les zones', 'Où acheter moins cher ?', '/prix', { vue: 'produit' }),
      T('📦', 'Livraisons en cours', 'Réception et paiement libéré', '/commandes'),
    ],
  },
  vendeur: {
    espace: 'Espace vendeur', emoji: '🌱',
    question: 'Comment vendre ma production dans de bonnes conditions ?',
    accroche: 'Publiez vos produits, recevez des commandes payées d’avance, organisez la livraison.',
    menu: [
      { titre: 'Vendre', liens: [L('/accueil', 'Accueil', '🏠'), L('/marche', 'Mes produits', '🧺', { vue: 'mes' }), L('/marche/nouvelle', 'Publier un produit', '🌱'), L('/commandes', 'Commandes reçues', '📦'), MESSAGES] },
      { titre: 'Trouver des acheteurs', liens: [L('/demandes', 'Acheteurs qui cherchent', '📋'), L('/vendre-ma-recolte', 'À quel prix vendre ?', '💡')] },
      { titre: 'S’informer', liens: [PRIX, ACTUS, ALERTES] },
    ],
    tuiles: [],
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
      { titre: 'Marché', liens: [PRIX, TRANSPORT] },
    ],
    tuiles: [

     
      T('📈', 'Valeur des stocks', 'Au prix du marché', '/prix'),
      T('🚚', 'Sorties & transport', 'Bourse de fret', '/transport'),
    ],
  },
  institution: {
    espace: 'Espace institution', emoji: '🏛️',
    question: 'Que se passe-t-il réellement sur les marchés agricoles ?',
    accroche: 'Voyez ce qui se passe réellement sur les marchés agricoles.',
    menu: [
      { titre: 'Observatoire', liens: [ACCUEIL, OBSERVATOIRE, L('/pilotage', 'Régions & exports', '📊'), PRIX, L('/transport', 'Axes routiers', '⚠️', { vue: 'axes' })] },
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
      { titre: 'Outils des acteurs', liens: [ L('/collecte', 'Collectes', '🎯'), L('/opportunites', 'Opportunités collecte', '🧭'), APPRO, L('/tournees', 'Tournées', '🗺️'), ] },
      { titre: 'Modules', liens: [PRIX, L('/marche', 'Marché', '🛒'), L('/demandes', 'Demandes', '📋'), L('/cooperative', 'Coopératives', '🤝'), TRANSPORT, L('/pilotage', 'Régions', '📊')] },
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
const ACHAT: Role[] = ['acheteur', 'vendeur', 'producteur', 'cooperative', 'collecteur'];

/** Rôles autorisés par rubrique (l'admin a toujours accès). */
export const ACCES: Record<string, Role[]> = {
  accueil: TOUS, prix: TOUS, notifications: TOUS, profil: TOUS, alertes: TOUS, actualites: TOUS,
  favoris: ACHAT, panier: ACHAT, messages: ACHAT, devenirVendeur: ['acheteur'],
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
  opportunites: ['collecteur'],
  observatoire: ['institution'],
  admin: [],
  projet: [],
};
