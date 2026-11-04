# FasoAgri — plateforme agricole Burkina Faso (frontend Angular)

Vendre, acheter, transporter, stocker et financer les produits agricoles, avec les prix des marchés
et un paiement sécurisé par Mobile Money. Prototype **utilisable** avec **données fictives** ; le backend
et le SGBD se branchent ensuite sans modifier les écrans (voir [docs/CONTRAT_API.md](docs/CONTRAT_API.md)).

## Lancer

```bash
npm install
npm start          # http://localhost:4200
```

**Site public (visiteurs)** : `/` (présentation, prix du jour, « Pour qui ? », « Comment ça marche »),
`/decouvrir/prix`, `/decouvrir/marche`, `/inscription` (création de compte par type d'acteur), `/connexion`.

**Espace connecté adapté à chaque acteur** : menu, tuiles d'action et indicateurs définis par rôle dans
`src/app/core/roles.ts` (`CONFIG_ROLES`) ; les rubriques sont protégées par rôle (`ACCES`).

Page de connexion : choisir un compte de démonstration parmi les 7 acteurs (ou l’administrateur).
Les actions sont enregistrées dans le navigateur ; « Profil → Réinitialiser » remet les données à zéro.

## Parcours acheteur (refonte, novembre 2026)

Tout nouvel inscrit **arrive comme acheteur** ; « Devenir vendeur » ouvre l'espace vendeur avec le même compte.
Compte de démonstration : **Mariam Kaboré** (acheteuse, Ouagadougou). Côté vendeur : **Léon Bazié** (producteur à Léo).

| Écran | Route | Ce qu'il apporte |
|---|---|---|
| Accueil boutique | `/accueil` | recherche, catégories, « À faire », livraison en cours, offres près de chez vous, favoris, actualités |
| Marché / fiche offre | `/marche`, `/marche/:id` | stock confirmé, garanties de disponibilité, avis « achat vérifié », offres équivalentes, discuter, panier |
| Panier | `/panier` | multi-vendeurs, une commande par lot |
| Favoris | `/favoris` | baisse de prix, retour en stock |
| Messages | `/messages/:id` | une discussion par produit, question de disponibilité en un clic, proposition de prix acceptée en un clic |
| Commande | `/commandes/:id` | confirmation 24 h → paiement `*144*2*1*…*PIN#` → organisation du transport → suivi (carte, heures, chauffeur, étapes) → code de remise → avis |
| Alertes | `/alertes` | notifications par type + alertes produits |
| Actualités | `/actualites` | prix, saisons, routes, nouvelles offres et conseils, classés selon vos produits et votre région |
| Devenir vendeur | `/devenir-vendeur` | producteur, coopérative ou commerçant |

Règles détaillées : [docs/CONTRAT_API.md](docs/CONTRAT_API.md) § « Règles de l'espace acheteur ».

## Les 7 acteurs et leur outil principal

| Acteur | Question (Besoins_v1) | Outil |
|---|---|---|
| Producteur | Comment vendre ma production dans de bonnes conditions ? | `/vendre-ma-recolte` : options comparées sur le net en poche |
| Coopérative | Comment agréger et vendre au meilleur débouché ? | `/collecte` : campagnes, engagements, débouchés, lot, paiement des membres |
| Collecteur | Où trouver rapidement les volumes que je peux revendre ? | `/opportunites` : lots proches, achat rendu, meilleure revente, marge |
| Acheteur (grossiste, transformateur, hôtel, exportateur, supermarché) | Où acheter assez, au bon prix, avec le moins de risque ? | `/approvisionnement` : plan multi-fournisseurs, coût rendu × risque |
| Transporteur | Comment trouver des marchandises et éviter de rouler à vide ? | `/tournees` : aller + retour chargés, marge ; annonce de camion libre |
| Entrepôt | Comment remplir avec des produits vendus et maîtriser le stock ? | `/magasin` : stock vendable / à risque, prospection |
| Institution | Que se passe-t-il réellement sur les marchés ? | `/observatoire` (aussi public) : prix réels, flux, tensions, fiabilité |

Modules communs : prix des marchés, marché (offres), demandes / cotations, commandes avec paiement séquestre,
transport et état des axes, stockage avec récépissés, USSD / SMS. Un compte **administrateur** interne vérifie les
comptes et arbitre les litiges.

## Structure

```
src/app/
  core/
    models.ts               contrat de données (= futur schéma backend)
    api/repository.ts       Repository<T> : LocalRepository (actuel) / HttpRepository (backend)
    api/db.service.ts       une collection par ressource REST
    plateforme.service.ts   règles métier (commande, séquestre, cotation, fret, warrantage, score…)
    session.service.ts      session de démonstration (à remplacer par OTP SMS)
    besoins.store.ts        collection besoins_v1 versionnée
    data/                   référentiel Burkina, données fictives, benchmark, besoins_v1.json
  features/                 un fichier par écran
  shared/                   pipes (FCFA, kg, unités locales), graphiques SVG, toasts
```

## Données

Tous les acteurs, prix, stocks et transactions sont **fictifs** (mention « fictif/fictive » sur les organisations).
Localités, provinces et unités locales sont réelles ; les prix sont calibrés sur des ordres de grandeur plausibles
(saisonnalité : récolte septembre–décembre, soudure juin–août ; maraîchage de contre-saison).
