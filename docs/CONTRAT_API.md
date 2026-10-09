# Contrat backend — FasoAgri

Le frontend Angular fonctionne aujourd'hui en **mode local** (données fictives dans le navigateur).
Pour le brancher sur votre backend et votre SGBD :

```ts
// src/app/app.config.ts
{ provide: API_CONFIG, useValue: { mode: 'http', baseUrl: 'https://votre-serveur/api/v1' } }
```

Aucun écran n'est à modifier : tout passe par `Repository<T>` (`src/app/core/api/repository.ts`).
Les interfaces TypeScript de `src/app/core/models.ts` sont le contrat des données (noms de champs identiques en JSON).

## 1. Ressources CRUD attendues

Chaque ressource expose `GET /{r}`, `POST /{r}`, `PATCH /{r}/{id}`, `DELETE /{r}/{id}` (JSON).

| Ressource (URL) | Interface | Clé | Remarques |
|---|---|---|---|
| `utilisateurs` | `Utilisateur` | `id` | rôle, KYC, langue, localité |
| `releves-prix` | `RelevePrix` | `id` | prix FCFA/kg ; filtrer par `produitId`, `localiteId`, `date` |
| `offres` | `Offre` | `id` | `quantiteRestanteKg` décrémentée à chaque commande |
| `demandes` | `Demande` | `id` | RFQ ou appel d'offres |
| `cotations` | `Cotation` | `id` | réponse d'un vendeur à une demande |
| `commandes` | `Commande` | `id` | historique et messages embarqués (peuvent devenir des tables filles) |
| `frets` | `Fret` | `id` | candidatures embarquées |
| `signalements-axes` | `SignalementAxe` | `id` | |
| `entrepots` | `Entrepot` | `id` | |
| `depots` | `Depot` | `id` | récépissé d'entrepôt |
| `apports` | `Apport` | `id` | apport d'un membre de coopérative |
| `lots` | `Lot` | `id` | lot coopératif → offre |
| `notifications` | `Notification` | `id` | à doubler par SMS |
| `avis` | `Avis` | `id` | note 1–5 après commande terminée |
| `disponibilites-camions` | `DisponibiliteCamion` | `id` | camion libre annoncé (retour à vide) ; réservable par les chargeurs |
| `collectes` | `Collecte` | `id` | campagne de collecte d'une coopérative, engagements des membres embarqués |

### Réponses aux préoccupations des acteurs (calculs)

Calculées aujourd'hui dans `src/app/core/solutions.service.ts` (hypothèses regroupées dans `HYP`). À servir par le backend en lecture :

| Question | Endpoint suggéré | Calcul |
|---|---|---|
| Producteur : où vendre ? | `GET /solutions/options-vente?produit&kg&localite&qualite` | acheteurs (prix plafonné au marché +3 %), marchés, collecteur, warrantage, coopérative → net/kg après transport, pertes, frais ; risque |
| Coopérative : agréger et vendre | `GET /collectes/{id}/avancement`, `GET /solutions/debouches` | engagé / livré / manquant ; débouchés classés par net au magasin |
| Acheteur : volume, prix, risque | `GET /solutions/plan-appro?produit&kg&destination&qualite&date` | combinaison d'offres par coût rendu × (1 + risque/200) ; risque = KYC, score, récépissé, date, état de l'axe |
| Transporteur : ne pas rouler à vide | `GET /solutions/tournees?position&capacite&date` | aller + meilleur retour ≤ 150 km ; marge = revenu − km × coût/km |
| Entrepôt : stock vendable | `GET /entrepots/{id}/analyse` | âge / conservation, demandes ouvertes, tendance 3 mois → vendable / à surveiller / à risque ; prospects |
| Collecteur : volumes à revendre | `GET /solutions/opportunites?localite&rayon` | achat rendu vs meilleure revente nette → marge |
| Institution : que se passe-t-il ? | `GET /observatoire` | prix relevés vs payés (même date), dispersion, flux inter-régions, offre/collecte/stock/demande, couverture des relevés |

En production, `GET` doit être **filtré côté serveur** selon l'utilisateur connecté (ses commandes, ses crédits…) et paginé.

## 2. Règles métier à porter côté serveur

Elles sont aujourd'hui dans `src/app/core/plateforme.service.ts`. À transformer en endpoints « action » transactionnels :

| Action | Endpoint suggéré | Règle |
|---|---|---|
| Commander une offre | `POST /offres/{id}/commander` | vérifier `quantiteRestanteKg`, la décrémenter, créer la commande `attente_paiement` |
| Accepter une cotation | `POST /cotations/{id}/accepter` | créer la commande, réserver le stock de l'offre du vendeur, clore la demande si quantité atteinte |
| Payer | `POST /commandes/{id}/paiement` | initier le paiement Mobile Money (Orange Money, Moov Money, Sank Money) ; passer en `sequestre` **sur callback de l'opérateur**, jamais sur la seule réponse du navigateur |
| Expédier | `POST /commandes/{id}/expedition` | vendeur uniquement, statut `sequestre` requis |
| Confirmer la réception | `POST /commandes/{id}/reception` | acheteur uniquement ; libère les fonds vers le vendeur |
| Litige | `POST /commandes/{id}/litige`, `POST /commandes/{id}/arbitrage` | fonds bloqués ; arbitrage par un admin |
| Répartir un lot | `POST /lots/{id}/repartition` | paiement de chaque membre au prorata des apports, moins la retenue coopérative |
| Score | `GET /utilisateurs/{id}/score` | calcul serveur (identité, ancienneté, transactions, avis, litiges) |

Montants : `total acheteur = marchandise + transport + frais de service (2 %)` ; le vendeur reçoit la valeur de la marchandise.

## 3. Canaux et intégrations

- **Authentification** : numéro de téléphone + code SMS (OTP). La page de connexion de démonstration est à remplacer.
- **USSD / SMS** : la passerelle de l'opérateur appelle le backend à chaque saisie ; réutiliser les mêmes endpoints (voir `features/ussd.ts` pour l'arborescence des menus).
- **Mobile Money** : agrégateur de paiement avec compte séquestre et webhooks.
- **Messages vocaux** : champ `Utilisateur.langue` (`fr`, `mos` = mooré, `dyu` = dioula, `ful` = fulfuldé).
- **Référentiels** (`regions`, `localites`, `produits` + unités locales) : aujourd'hui dans `core/data/referentiel.ts`, à passer en tables. Le découpage régional est à mettre à jour selon la réforme administrative de 2025.

## 4. Modèle relationnel indicatif

```
regions(id, nom, chef_lieu)
localites(id, nom, province, region_id → regions, lat, lon, marche bool)
produits(id, nom, categorie, perissable, conservation_j, perte_pct)
unites_locales(id, produit_id → produits, code, libelle, kg)
utilisateurs(id, nom, role, categorie, organisation, telephone UNIQUE, localite_id, langue, kyc, inscrit_le, membres, capacite_t)
  -- role ∈ producteur, cooperative, collecteur, acheteur, transporteur, entrepot, institution, admin
pieces_kyc(id, utilisateur_id, type, fichier_url, statut)
releves_prix(id, produit_id, localite_id, date, prix, source, auteur_id)          -- index (produit_id, localite_id, date)
offres(id, vendeur_id, produit_id, quantite_kg, quantite_restante_kg, prix_kg, qualite, localite_id,
       disponible_le, description, lot, producteurs, certification, entrepot_id, livraison, statut, cree_le)
demandes(id, acheteur_id, produit_id, quantite_kg, prix_max_kg, qualite_min, localite_livraison_id,
         date_limite, recurrence, type, description, statut, cree_le)
cotations(id, demande_id, vendeur_id, prix_kg, quantite_kg, localite_id, delai_jours, message, statut, cree_le)
commandes(id, reference UNIQUE, acheteur_id, vendeur_id, produit_id, quantite_kg, prix_kg, frais_transport,
          commission_pct, origine_id, destination_id, source_type, source_id, statut, fret_id, cree_le)
commande_historique(id, commande_id, date, statut, par_id, note)
commande_messages(id, commande_id, date, auteur_id, texte)
paiements(id, commande_id, operateur, reference, montant, statut, date)
litiges(id, commande_id, motif, description, ouvert_le, resolution)
frets(id, demandeur_id, commande_id, origine_id, destination_id, produit_id, tonnage, date_chargement,
      prix_propose, statut, transporteur_id, cree_le)
fret_candidatures(id, fret_id, transporteur_id, prix, message, date)
signalements_axes(id, origine_id, destination_id, niveau, motif, commentaire, date, auteur_id, confirmations)
entrepots(id, nom, gestionnaire_id, localite_id, capacite_t, tarif_sac_mois, warrantage)
disponibilites_camions(id, transporteur_id, origine_id, destination_id, date, capacite_t, tarif_tonne_km, commentaire, statut, cree_le)
collectes(id, cooperative_id, produit_id, objectif_kg, qualite_min, prix_indicatif_kg, date_limite, demande_id, statut, lot_id, cree_le)
collecte_engagements(id, collecte_id, membre, telephone, kg, date, livre)
depots(id, entrepot_id, deposant_id, produit_id, quantite_kg, date_entree, date_sortie, qualite, statut, recu UNIQUE)
apports(id, cooperative_id, membre, telephone, produit_id, quantite_kg, qualite, date, lot_id, paye)
lots(id, cooperative_id, produit_id, code, quantite_kg, offre_id, statut, cree_le)
notifications(id, utilisateur_id, date, texte, lien, lu)
avis(id, commande_id, auteur_id, cible_id, note, commentaire, date)
besoins_v1 : document JSON versionné (ou tables besoins / preoccupations / preoccupation_modules)
```
