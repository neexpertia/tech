import { Fonctionnalite } from '../models';

/**
 * Benchmark fonctionnel — sources publiques consultées le 29/09/2026 :
 *  TAIM54      https://taim54.com  ·  https://taim54.com/about
 *  NukuConnect https://nukuconnect.com  ·  /a-propos  ·  /marketplace  ·  /nos-formations
 * Niveaux : 0 absent · 1 faible · 2 partiel · 3 fort. « nous » = ce prototype.
 */

export const CONCURRENTS = [
  {
    id: 'taim54', nom: 'TAIM54',
    resume: 'Marketplace B2B panafricaine « 54 pays », assistée par IA, 11+ secteurs dont agriculture. Flux RFQ → bon de commande, fournisseurs vérifiés, paiement Stripe, suivi logistique, litiges.',
    pourNous: 'Bonne référence pour le parcours d’achat B2B (demande de cotation, vérification, litiges). Trop généraliste et sans ancrage local : pas de prix de marché, pas de Mobile Money, pas de collecte ni de stockage.',
    sources: [{ label: 'taim54.com', url: 'https://taim54.com/' }, { label: 'À propos', url: 'https://taim54.com/about' }],
  },
  {
    id: 'nuku', nom: 'NukuConnect',
    resume: 'Startup agritech togolaise (Lomé) : marketplace producteurs–acheteurs, Mobile Money (Moov, Mixx), traçabilité QR, livraison avec suivi GPS, formations, assistant IA, forte composante aquaculture.',
    pourNous: 'Bonne référence côté producteur (formation, traçabilité, Mobile Money). Mais pas de gros volumes ni d’agrégation coopérative, pas de prix de marché, pas de warrantage ni de crédit, pas d’accès sans smartphone.',
    sources: [{ label: 'nukuconnect.com', url: 'https://nukuconnect.com/' }, { label: 'À propos', url: 'https://nukuconnect.com/a-propos/' }, { label: 'Formations', url: 'https://nukuconnect.com/nos-formations/' }],
  },
];

const f = (id: string, domaine: string, nom: string, taim54: 0 | 1 | 2 | 3, nuku: 0 | 1 | 2 | 3, nous: 0 | 1 | 2 | 3, route: string | undefined, pourquoiBurkina: string): Fonctionnalite =>
  ({ id, domaine, nom, taim54, nuku, nous: { niveau: nous, route }, pourquoiBurkina });

export const FONCTIONNALITES: Fonctionnalite[] = [
  // Repris des concurrents
  f('F01', 'Commerce', 'Catalogue d’offres avec filtres', 3, 3, 3, '/marche', 'Socle : repris des deux plateformes.'),
  f('F02', 'Commerce', 'Demande de cotation (RFQ) et comparaison', 3, 1, 3, '/demandes', 'Repris de TAIM54 : usines, grossistes et ONG achètent par demande de prix.'),
  f('F03', 'Commerce', 'Appels d’offres (lots, cahier des charges)', 2, 0, 3, '/demandes', 'Achats institutionnels et humanitaires de céréales (stocks, distributions).'),
  f('F04', 'Confiance', 'Vérification des comptes (KYC)', 3, 2, 3, '/admin', 'CNIB, RCCM, récépissé de coopérative.'),
  f('F05', 'Confiance', 'Avis et notes entre partenaires', 1, 2, 3, '/profil', 'La réputation remplace la relation personnelle.'),
  f('F06', 'Confiance', 'Gestion des litiges avec arbitrage', 3, 1, 3, '/commandes', 'Repris de TAIM54 : fonds bloqués jusqu’à l’arbitrage.'),
  f('F07', 'Paiement', 'Paiement sécurisé (séquestre)', 3, 2, 3, '/commandes', 'Réponse à « l’acheteur va-t-il vraiment payer ? ».'),
  f('F08', 'Qualité', 'Traçabilité par code de lot', 1, 3, 3, '/marche', 'Repris de NukuConnect : exigé à l’export (sésame, mangue, karité, cajou).'),
  f('F09', 'Producteur', 'Formations & fiches pratiques', 0, 3, 2, '/conseil', 'Repris de NukuConnect, orienté post-récolte et stockage.'),
  f('F10', 'Producteur', 'Catalogue d’intrants', 1, 3, 0, undefined, 'Hors périmètre : les fournisseurs d’intrants ne font pas partie des 7 acteurs.'),
  f('F11', 'Logistique', 'Suivi de livraison', 2, 3, 2, '/commandes', 'Statuts et messages ; GPS à brancher côté backend.'),
  // Ajouts spécifiques au contexte Burkina
  f('B01', 'Burkina', 'Mobile Money local (Orange Money, Moov Money, Sank Money)', 0, 1, 3, '/commandes', 'Les réseaux utilisés au Burkina ; TAIM54 = Stripe, NukuConnect = réseaux togolais.'),
  f('B02', 'Burkina', 'Prix des marchés (Sankaryaré, Bobo, Pouytenga…)', 0, 0, 3, '/prix', 'Question n°1 de 9 acteurs sur 14 ; aucune des deux plateformes ne publie de prix.'),
  f('B03', 'Burkina', 'Unités locales (sac, tine, plat yoruba)', 0, 0, 3, '/prix', 'Les transactions se font en sacs et tines, pas en kg.'),
  f('B04', 'Burkina', 'Coût rendu (prix + transport + pertes)', 0, 0, 3, '/prix', 'Comparer maïs de Solenzo et de Bobo livré à Ouagadougou.'),
  f('B05', 'Burkina', 'Agrégation coopérative & répartition des paiements', 0, 0, 3, '/cooperative', 'La vente passe par les SCOOPS et unions ; paiement de chaque membre.'),
  f('B06', 'Burkina', 'Warrantage (crédit sur stock)', 0, 0, 3, '/stockage', 'Pratique répandue au Burkina : éviter de brader à la récolte.'),
  f('B07', 'Burkina', 'Score de confiance (historique, avis, litiges)', 0, 0, 3, '/profil', 'Réputation vérifiable entre acteurs ; réutilisable plus tard auprès des banques.'),
  f('B08', 'Burkina', 'Bourse de fret (camions, tricycles), retours à vide', 0, 1, 3, '/transport', 'Coût de transport élevé, trajets retour souvent à vide.'),
  f('B09', 'Burkina', 'Signalement de l’état des axes', 0, 0, 3, '/transport', 'Routes dégradées en saison des pluies, circulation déconseillée sur certains axes.'),
  f('B10', 'Burkina', 'Accès USSD / SMS sans smartphone', 0, 0, 2, '/ussd', 'Beaucoup de producteurs ont un téléphone simple ou une connexion faible.'),
  f('B11', 'Burkina', 'Langues locales (mooré, dioula, fulfuldé) — messages vocaux', 0, 0, 1, '/profil', 'Préférence de langue enregistrée ; messages vocaux à produire avec le backend.'),
  f('B12', 'Burkina', 'Calendrier cultural & météo locale', 0, 1, 2, '/conseil', 'Soudure, contre-saison, séchage : décider quand vendre.'),
  f('B13', 'Burkina', 'Observatoire des marchés pour les institutions', 0, 0, 3, '/observatoire', 'Prix réels, flux, tensions offre / demande, fiabilité des relevés.'),
  f('B14', 'Burkina', 'Mode hors-ligne (PWA)', 0, 0, 0, undefined, 'À faire : réseau instable en zone rurale.'),
];
