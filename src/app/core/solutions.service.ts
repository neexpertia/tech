import { Injectable, inject } from '@angular/core';
import {
  LOCALITES, MARCHES, MOIS_COURT, PARAM_PRIX, PRODUITS, REGIONS, coutTransportKg, distanceKm, localite, produit,
} from './data/referentiel';
import { Fret, Offre, Qualite } from './models';
import { PlateformeService, aujourdhui } from './plateforme.service';

/**
 * Réponses calculées aux préoccupations des acteurs (collection besoins_v1).
 * Chaque méthode répond à UNE question et renvoie des résultats chiffrés et actionnables.
 * Hypothèses de calcul regroupées ici pour être ajustées (ou servies par le backend).
 */
export const HYP = {
  fraisMarchePct: 3,          // taxes, commission d'intermédiaire, manutention sur un marché physique
  margeCollecteurPct: 12,     // écart usuel prix bord champ / prix de gros du marché proche
  retenueCoopPct: 3,
  stockageFkgMois: 2.5,       // ≈ 250 F / sac de 100 kg / mois
  coutRouteCamionKm: 450,     // carburant + usure, camion 20-35 t (FCFA/km)
  coutRouteTricycleKm: 60,
  lotCamionPleinKg: 10_000,  // en dessous : camion partagé, car ou tricycle → tarif au kg plus élevé
  majorationPetitLot: 0.8,   // jusqu'à +80 % pour un très petit lot
};

export type Risque = 'faible' | 'moyen' | 'élevé';

export interface OptionVente {
  type: 'acheteur' | 'marche' | 'collecteur' | 'stockage' | 'cooperative';
  titre: string;
  detail: string;
  prixBrutKg: number;
  deductions: { label: string; kg: number }[];
  netKg: number;
  volumeKg: number;
  netTotal: number;
  quand: string;
  risque: Risque;
  pourquoiRisque: string;
  action: { label: string; route: string; query?: Record<string, string> };
}

export interface LignePlan {
  offre: Offre;
  kg: number;
  rendu: { km: number; transport: number; pertes: number; total: number };
  risque: number;
  niveau: Risque;
  raisons: string[];
}

export interface Tournee {
  aller: Fret;
  retour?: Fret;
  approcheKm: number;
  chargeKm: number;
  videKm: number;
  revenu: number;
  cout: number;
  marge: number;
  revenuKm: number;
  tauxVide: number;
}

/** Index du mois courant dans les profils saisonniers (octobre = 0). */
const idxMois = (d = new Date()) => (d.getMonth() + 3) % 12;

@Injectable({ providedIn: 'root' })
export class SolutionsService {
  private readonly pf = inject(PlateformeService);
  private get db() { return this.pf.db; }

  /** Transport au kg : tarif camion plein, majoré pour les petits lots. */
  transportKg(km: number, kg: number) {
    const base = coutTransportKg(km);
    const f = kg >= HYP.lotCamionPleinKg ? 1 : 1 + HYP.majorationPetitLot * (1 - kg / HYP.lotCamionPleinKg);
    return Math.round(base * f);
  }

  private pertes(prixKg: number, produitId: string, km: number) {
    return Math.round((prixKg * produit(produitId).pertePct) / 100 * Math.min(1, km / 400));
  }

  // ======================================================================
  // 1. PRODUCTEUR — « Comment vendre ma production dans de bonnes conditions ? »
  // ======================================================================
  optionsVente(produitId: string, kg: number, localiteId: string, qualite: Qualite, userId?: string): OptionVente[] {
    const opts: OptionVente[] = [];
    const nomP = produit(produitId).nom.toLowerCase();

    // a) Acheteurs qui ont publié une demande (paiement en séquestre)
    for (const d of this.db.demandes.items().filter((d) => d.statut === 'ouverte' && d.produitId === produitId && qualite <= d.qualiteMin && d.acheteurId !== userId)) {
      // Prix réaliste : le plafond de l'acheteur, mais pas plus de 3 % au-dessus du marché de destination
      const marcheDest = this.pf.prixReference(produitId, d.localiteLivraisonId)?.prix;
      const ref = d.prixMaxKg && marcheDest ? Math.min(d.prixMaxKg, Math.round(marcheDest * 1.03)) : (d.prixMaxKg ?? marcheDest);
      if (!ref) continue;
      const km = distanceKm(localiteId, d.localiteLivraisonId);
      const t = this.transportKg(km, kg), p = this.pertes(ref, produitId, km);
      const deja = this.db.cotations.items().filter((c) => c.demandeId === d.id && c.statut === 'acceptee').reduce((s, c) => s + c.quantiteKg, 0);
      const vol = Math.min(kg, Math.max(0, d.quantiteKg - deja));
      if (!vol) continue;
      const s = this.pf.score(d.acheteurId);
      opts.push({
        type: 'acheteur', titre: `Vendre à ${this.pf.nom(d.acheteurId)}`,
        detail: `Prix négociable jusqu’à ${d.prixMaxKg ?? ref} F/kg (retenu : ${ref}). Demande de ${d.quantiteKg >= 1000 ? Math.round(d.quantiteKg / 1000) + ' t' : d.quantiteKg + ' kg'} livrée à ${localite(d.localiteLivraisonId).nom} avant le ${d.dateLimite}${d.recurrence ? ` (${d.recurrence.toLowerCase()})` : ''}.`,
        prixBrutKg: ref, deductions: [{ label: `Transport ${km} km`, kg: t }, { label: 'Pertes en route', kg: p }],
        netKg: ref - t - p, volumeKg: vol, netTotal: (ref - t - p) * vol, quand: `avant le ${d.dateLimite}`,
        risque: 'faible', pourquoiRisque: `Paiement bloqué en séquestre avant expédition · acheteur ${s.grade !== '–' ? 'noté ' + s.grade : 'vérifié'}`,
        action: { label: 'Envoyer ma cotation', route: `/demandes/${d.id}` },
      });
    }

    // b) Marchés de gros (vente directe sur place)
    const marches = MARCHES.map((m) => {
      const pr = this.pf.prix(produitId, m.id)?.prix;
      if (!pr) return null;
      const km = distanceKm(localiteId, m.id);
      const t = this.transportKg(km, kg), p = this.pertes(pr, produitId, km), f = Math.round(pr * HYP.fraisMarchePct / 100);
      return { m, pr, km, t, p, f, net: pr - t - p - f };
    }).filter((x) => !!x).sort((a, b) => b.net - a.net).slice(0, 3);
    for (const x of marches) {
      opts.push({
        type: 'marche', titre: `Aller vendre au marché de ${x.m.nom.split(' (')[0]}`,
        detail: `Dernier prix de gros relevé : ${x.pr} F/kg.`,
        prixBrutKg: x.pr, deductions: [{ label: `Transport ${x.km} km`, kg: x.t }, { label: 'Pertes en route', kg: x.p }, { label: `Taxes et intermédiaires (${HYP.fraisMarchePct} %)`, kg: x.f }],
        netKg: x.net, volumeKg: kg, netTotal: x.net * kg, quand: 'dès maintenant',
        risque: 'moyen', pourquoiRisque: 'Prix négocié sur place, pas de garantie de paiement, déplacement à organiser',
        action: { label: 'Voir les prix', route: '/prix', query: { vue: 'produit' } },
      });
    }

    // c) Vente bord champ à un collecteur
    const refLocal = this.pf.prixReference(produitId, localiteId);
    if (refLocal) {
      const pr = Math.round(refLocal.prix * (1 - HYP.margeCollecteurPct / 100));
      opts.push({
        type: 'collecteur', titre: 'Vendre bord champ à un collecteur',
        detail: `Enlèvement chez vous, sans transport. Prix habituel ≈ ${100 - HYP.margeCollecteurPct} % du prix de ${localite(refLocal.marcheId).nom.split(' (')[0]}.`,
        prixBrutKg: refLocal.prix, deductions: [{ label: `Marge du collecteur (${HYP.margeCollecteurPct} %)`, kg: refLocal.prix - pr }],
        netKg: pr, volumeKg: kg, netTotal: pr * kg, quand: 'dès maintenant',
        risque: 'moyen', pourquoiRisque: 'Paiement souvent partiel ou différé hors plateforme ; poids et prix à vérifier',
        action: { label: 'Publier mon offre (les collecteurs sont alertés)', route: '/marche/nouvelle' },
      });
    }

    // d) Stocker en magasin puis vendre plus tard
    const prod = produit(produitId);
    if (refLocal && prod.conservationJ >= 90) {
      const s = PARAM_PRIX[produitId].saison, i0 = idxMois();
      let best: { k: number; prix: number; net: number; stock: number; interet: number; pert: number } | null = null;
      for (let k = 1; k <= Math.min(9, Math.floor(prod.conservationJ / 30)); k++) {
        const prixFutur = Math.round(refLocal.prix * s[(i0 + k) % 12] / s[i0]);
        const stock = Math.round(HYP.stockageFkgMois * k);
        const interet = 0;
        const pert = Math.round(refLocal.prix * prod.pertePct / 100 * Math.min(1, (30 * k) / prod.conservationJ) / 2);
        const net = prixFutur - stock - interet - pert;
        if (!best || net > best.net) best = { k, prix: prixFutur, net, stock, interet, pert };
      }
      if (best && best.net > refLocal.prix * 0.9) {
        const mois = MOIS_COURT[(i0 + best.k) % 12];
        opts.push({
          type: 'stockage', titre: `Stocker au magasin et vendre en ${mois}`,
          detail: `Prix attendu ≈ ${best.prix} F/kg en ${mois} (tendance des 12 derniers mois). Le récépissé du magasin garantit votre stock.`,
          prixBrutKg: best.prix, deductions: [{ label: `Magasin (${best.k} mois)`, kg: best.stock }, { label: 'Pertes de conservation', kg: best.pert }],
          netKg: best.net, volumeKg: kg, netTotal: best.net * kg, quand: `dans ${best.k} mois (${mois})`,
          risque: 'moyen', pourquoiRisque: 'Le prix futur n’est pas garanti et l’argent arrive plus tard ; stock sécurisé par récépissé',
          action: { label: 'Déposer au magasin', route: '/stockage' },
        });
      }
    }

    // e) Vente groupée via une coopérative proche qui collecte ce produit
    for (const c of this.db.collectes.items().filter((c) => c.statut === 'ouverte' && c.produitId === produitId && qualite <= c.qualiteMin)) {
      const coop = this.pf.utilisateur(c.cooperativeId);
      if (!coop) continue;
      const km = distanceKm(localiteId, coop.localiteId);
      if (km > 80) continue;
      const t = this.transportKg(km, kg), r = Math.round(c.prixIndicatifKg * HYP.retenueCoopPct / 100);
      opts.push({
        type: 'cooperative', titre: `Rejoindre la collecte de ${coop.nom}`,
        detail: `Objectif ${Math.round(c.objectifKg / 1000)} t avant le ${c.dateLimite}${c.demandeId ? ', déjà vendu à un acheteur' : ''}.`,
        prixBrutKg: c.prixIndicatifKg, deductions: [{ label: `Transport jusqu’au magasin (${km} km)`, kg: t }, { label: `Retenue coopérative (${HYP.retenueCoopPct} %)`, kg: r }],
        netKg: c.prixIndicatifKg - t - r, volumeKg: kg, netTotal: (c.prixIndicatifKg - t - r) * kg, quand: `avant le ${c.dateLimite}`,
        risque: 'faible', pourquoiRisque: 'Vente groupée, paiement Mobile Money de chaque membre à la vente',
        action: { label: 'Contacter la coopérative', route: '/notifications' },
      });
    }
    return opts.sort((a, b) => b.netKg - a.netKg);
  }

  // ======================================================================
  // 2. COOPÉRATIVE — agréger et vendre au meilleur débouché
  // ======================================================================
  avancementCollecte(collecteId: string) {
    const c = this.db.collectes.get(collecteId)!;
    const engage = c.engagements.reduce((s, e) => s + e.kg, 0);
    const livre = c.engagements.filter((e) => e.livre).reduce((s, e) => s + e.kg, 0);
    const jours = Math.max(0, Math.round((Date.parse(c.dateLimite) - Date.parse(aujourdhui())) / 864e5));
    const d = c.demandeId ? this.db.demandes.get(c.demandeId) : undefined;
    return { engage, livre, pctEngage: Math.min(100, (engage / c.objectifKg) * 100), pctLivre: Math.min(100, (livre / c.objectifKg) * 100), manque: Math.max(0, c.objectifKg - engage), jours, demande: d };
  }

  /** Débouchés pour un lot agrégé : acheteurs, marchés, stockage — classés par net à la porte du magasin. */
  debouches(produitId: string, kg: number, localiteId: string, qualite: Qualite, coopId: string) {
    return this.optionsVente(produitId, kg, localiteId, qualite, coopId).filter((o) => o.type !== 'collecteur' && o.type !== 'cooperative');
  }

  // ======================================================================
  // 3. ACHETEUR — assez de volume, au bon prix, avec le moins de risque
  // ======================================================================
  planAppro(produitId: string, kg: number, destinationId: string, qualiteMin: Qualite, dateLimite: string, acheteurId: string, prudence = true) {
    const axes = this.db.axes.items();
    const candidats: LignePlan[] = this.db.offres.items()
      .filter((o) => o.statut === 'active' && o.produitId === produitId && o.qualite <= qualiteMin && o.vendeurId !== acheteurId && o.quantiteRestanteKg > 0)
      .map((o) => {
        const rendu = this.pf.coutRendu(o.prixKg, produitId, o.localiteId, destinationId);
        const v = this.pf.utilisateur(o.vendeurId);
        const s = this.pf.score(o.vendeurId);
        const raisons: string[] = [];
        let r = 0;
        if (v?.kyc !== 'verifie') { r += 30; raisons.push('vendeur non vérifié'); }
        if (s.grade === 'D') { r += 25; raisons.push('mauvais historique'); } else if (s.grade === 'C') { r += 15; raisons.push('historique moyen'); }
        else if (s.grade === '–') { r += 12; raisons.push('pas encore d’historique'); }
        if (s.litiges) { r += 10; raisons.push(`${s.litiges} litige(s)`); }
        if (o.entrepotId) raisons.push('stock en magasin (récépissé)'); else { r += 8; raisons.push('stock non vérifié'); }
        if (o.disponibleLe > dateLimite) { r += 30; raisons.push(`disponible seulement le ${o.disponibleLe}`); }
        const axe = axes.find((a) => [a.origineId, a.destinationId].includes(o.localiteId) && [a.origineId, a.destinationId].includes(destinationId));
        if (axe?.niveau === 'deconseille') { r += 25; raisons.push(`axe signalé : ${axe.motif.toLowerCase()}`); } else if (axe?.niveau === 'prudence') { r += 8; raisons.push(`axe : ${axe.motif.toLowerCase()}`); }
        const niveau: Risque = r < 15 ? 'faible' : r < 35 ? 'moyen' : 'élevé';
        return { offre: o, kg: 0, rendu, risque: r, niveau, raisons };
      })
      // coût ajusté du risque : 1 point de risque ≈ +0,5 % sur le prix
      .sort((a, b) => a.rendu.total * (1 + a.risque / 200) - b.rendu.total * (1 + b.risque / 200));

    const lignes: LignePlan[] = [];
    let reste = kg;
    for (const c of candidats) {
      if (reste <= 0) break;
      if (prudence && c.niveau === 'élevé') continue;
      const q = Math.min(reste, c.offre.quantiteRestanteKg);
      lignes.push({ ...c, kg: q });
      reste -= q;
    }
    const couvert = kg - reste;
    const total = lignes.reduce((s, l) => s + l.kg * l.rendu.total, 0);
    const coutMoyen = couvert ? Math.round(total / couvert) : 0;
    const refDest = this.pf.prixReference(produitId, destinationId);
    const risqueMoyen = couvert ? lignes.reduce((s, l) => s + l.risque * l.kg, 0) / couvert : 0;
    return {
      lignes, candidats, couvert, reste, total, coutMoyen,
      prixMarcheDest: refDest?.prix,
      ecartMarchePct: refDest ? ((coutMoyen - refDest.prix) / refDest.prix) * 100 : 0,
      risqueGlobal: (risqueMoyen < 15 ? 'faible' : risqueMoyen < 35 ? 'moyen' : 'élevé') as Risque,
      nbFournisseurs: new Set(lignes.map((l) => l.offre.vendeurId)).size,
      exclus: prudence ? candidats.filter((c) => c.niveau === 'élevé').length : 0,
    };
  }

  // ======================================================================
  // 4. TRANSPORTEUR — trouver des marchandises, ne pas rouler à vide
  // ======================================================================
  tournees(positionId: string, capaciteT: number, depuis = aujourdhui()): Tournee[] {
    const coutKm = capaciteT < 3 ? HYP.coutRouteTricycleKm : HYP.coutRouteCamionKm;
    const ouverts = this.db.frets.items().filter((f) => f.statut === 'ouvert' && f.tonnage <= capaciteT && f.dateChargement >= depuis);
    const res: Tournee[] = [];
    for (const a of ouverts) {
      const approcheKm = distanceKm(positionId, a.origineId);
      if (approcheKm > (capaciteT < 3 ? 60 : 500)) continue;
      const chargeA = distanceKm(a.origineId, a.destinationId);
      const retours = ouverts.filter((r) => r !== a && r.dateChargement >= a.dateChargement);
      const options: (Fret | undefined)[] = [undefined, ...retours];
      for (const r of options) {
        const approcheR = r ? distanceKm(a.destinationId, r.origineId) : 0;
        if (r && approcheR > 150) continue;
        const chargeKm = chargeA + (r ? distanceKm(r.origineId, r.destinationId) : 0);
        const fin = r ? r.destinationId : a.destinationId;
        const videKm = approcheKm + approcheR + distanceKm(fin, positionId);
        const revenu = a.prixPropose + (r?.prixPropose ?? 0);
        const cout = (chargeKm + videKm) * coutKm;
        res.push({ aller: a, retour: r, approcheKm, chargeKm, videKm, revenu, cout, marge: revenu - cout, revenuKm: revenu / (chargeKm + videKm), tauxVide: videKm / (chargeKm + videKm) });
      }
    }
    // garder la meilleure combinaison par aller, puis trier par marge
    const parAller = new Map<string, Tournee>();
    for (const t of res) if (!parAller.has(t.aller.id) || parAller.get(t.aller.id)!.marge < t.marge) parAller.set(t.aller.id, t);
    return [...parAller.values()].sort((a, b) => b.marge - a.marge);
  }

  // ======================================================================
  // 5. ENTREPÔT — remplir avec des produits réellement vendus, maîtriser le stock
  // ======================================================================
  analyseEntrepot(entrepotId: string) {
    const e = this.db.entrepots.get(entrepotId)!;
    const i0 = idxMois();
    const tous = this.db.depots.items().filter((d) => d.entrepotId === e.id);
    const presents = tous.filter((d) => d.statut !== 'retire');
    const stocks = presents.map((d) => {
      const p = produit(d.produitId);
      const age = Math.round((Date.parse(aujourdhui()) - Date.parse(d.dateEntree)) / 864e5);
      const demandes = this.db.demandes.items().filter((x) => x.statut === 'ouverte' && x.produitId === d.produitId && d.qualite <= x.qualiteMin);
      const volDemande = demandes.reduce((s, x) => s + x.quantiteKg, 0);
      const s = PARAM_PRIX[d.produitId].saison;
      const tendance = ((s[(i0 + 3) % 12] - s[i0]) / s[i0]) * 100;
      const usure = age / p.conservationJ;
      const statut: 'vendable' | 'a_surveiller' | 'a_risque' =
        usure > 0.8 || (!demandes.length && tendance < 0 && usure > 0.5) ? 'a_risque' : usure > 0.5 || (!demandes.length && tendance < 0) ? 'a_surveiller' : 'vendable';
      return { d, p, age, usure, demandes, volDemande, tendance, statut, valeur: this.pf.valeurDepot(d.id) };
    }).sort((a, b) => b.usure - a.usure);

    const occupeKg = presents.reduce((s, d) => s + d.quantiteKg, 0);
    const sorties = tous.filter((d) => d.statut === 'retire' && d.dateSortie);
    const dureeMoy = sorties.length ? Math.round(sorties.reduce((s, d) => s + (Date.parse(d.dateSortie!) - Date.parse(d.dateEntree)) / 864e5, 0) / sorties.length) : 0;
    const revenuMois = Math.round((occupeKg / 100) * e.tarifSacMois);

    // Prospects : lots proches non stockés, collectes de coopératives, récoltes imminentes dans la zone
    const proches = this.db.offres.items()
      .filter((o) => o.statut === 'active' && !o.entrepotId && distanceKm(o.localiteId, e.localiteId) <= 150 && produit(o.produitId).conservationJ >= 60)
      .map((o) => ({ o, km: distanceKm(o.localiteId, e.localiteId) })).sort((a, b) => b.o.quantiteRestanteKg - a.o.quantiteRestanteKg);
    const collectes = this.db.collectes.items().filter((c) => c.statut === 'ouverte' && distanceKm(this.pf.utilisateur(c.cooperativeId)!.localiteId, e.localiteId) <= 150);
    const moisProchains = [1, 2].map((k) => ((new Date().getMonth() + k) % 12) + 1);
    const recoltes = PRODUITS.filter((p) => p.conservationJ >= 90 && p.recolte.some((m) => moisProchains.includes(m)) && PARAM_PRIX[p.id].zones.some((z) => distanceKm(z, e.localiteId) <= 150));
    return { e, stocks, occupeKg, libreKg: e.capaciteT * 1000 - occupeKg, taux: occupeKg / (e.capaciteT * 1000) * 100, dureeMoy, nbSorties: sorties.length, revenuMois, proches, collectes, recoltes };
  }

  // ======================================================================
  // 6. COLLECTEUR — où trouver vite des volumes à revendre
  // ======================================================================
  opportunites(localiteId: string, rayonKm: number, collecteurId: string, produitId = '') {
    return this.db.offres.items()
      .filter((o) => o.statut === 'active' && o.vendeurId !== collecteurId && (!produitId || o.produitId === produitId))
      .map((o) => ({ o, km: distanceKm(localiteId, o.localiteId) }))
      .filter((x) => x.km <= rayonKm)
      .map(({ o, km }) => {
        // coût d'achat rendu à mon point de collecte
        const achat = o.prixKg + this.transportKg(km, o.quantiteRestanteKg);
        const reventes = this.optionsVente(o.produitId, o.quantiteRestanteKg, localiteId, o.qualite, collecteurId)
          .filter((v) => v.type === 'acheteur' || v.type === 'marche');
        const best = reventes[0];
        const margeKg = best ? best.netKg - achat : 0;
        return { o, km, achat, best, margeKg, margeTotal: margeKg * Math.min(o.quantiteRestanteKg, best?.volumeKg ?? o.quantiteRestanteKg) };
      })
      .sort((a, b) => b.margeTotal - a.margeTotal);
  }

  /** Volumes disponibles par localité autour d'un point (carte). */
  volumesAutour(localiteId: string, rayonKm: number) {
    return LOCALITES.map((l) => {
      const km = distanceKm(localiteId, l.id);
      const offres = this.db.offres.items().filter((o) => o.statut === 'active' && o.localiteId === l.id);
      return { l, km, kg: offres.reduce((s, o) => s + o.quantiteRestanteKg, 0), n: offres.length, produits: [...new Set(offres.map((o) => produit(o.produitId).nom))] };
    }).filter((x) => x.km <= rayonKm && x.kg > 0).sort((a, b) => a.km - b.km);
  }

  // ======================================================================
  // 7. INSTITUTION — que se passe-t-il réellement sur les marchés ?
  // ======================================================================
  /** Prix relevé au marché suivi le plus proche, à la date la plus proche ANTÉRIEURE à `date`. */
  prixALaDate(produitId: string, localiteId: string, date: string): number | undefined {
    const proches = [...MARCHES].sort((a, b) => distanceKm(a.id, localiteId) - distanceKm(b.id, localiteId));
    for (const m of proches) {
      const r = this.db.releves.items().filter((x) => x.produitId === produitId && x.localiteId === m.id && x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (r) return r.prix;
    }
    return undefined;
  }

  observatoire() {
    const i0 = idxMois();
    const cmds = this.db.commandes.items().filter((c) => c.statut !== 'annulee');
    const releves = this.db.releves.items();
    const il30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    const prix = PRODUITS.map((p) => {
      const now = MARCHES.map((m) => this.pf.prix(p.id, m.id)?.prix).filter((x): x is number => !!x);
      const moy = now.length ? now.reduce((s, x) => s + x, 0) / now.length : 0;
      const serie = this.pf.serie(p.id, 'OUA').filter((x): x is number => x !== null);
      const an = serie[0] ?? moy;
      const tx = cmds.filter((c) => c.produitId === p.id);
      const kgTx = tx.reduce((s, c) => s + c.quantiteKg, 0);
      const prixTx = kgTx ? tx.reduce((s, c) => s + c.prixKg * c.quantiteKg, 0) / kgTx : null;
      // prix de marché À LA DATE de chaque transaction (et non d'aujourd'hui)
      const refTx = tx.length ? tx.reduce((s, c) => s + (this.prixALaDate(p.id, c.origineId, c.creeLe) ?? c.prixKg) * c.quantiteKg, 0) / kgTx : null;
      const dispersion = now.length ? (Math.max(...now) - Math.min(...now)) / moy * 100 : 0;
      return { p, moy: Math.round(moy), min: Math.min(...now), max: Math.max(...now), dispersion, var12: an ? ((moy - an) / an) * 100 : 0, kgTx, prixTx, ecartTx: prixTx && refTx ? ((prixTx - refTx) / refTx) * 100 : null };
    });

    const reg = (loc: string) => localite(loc).regionId;
    const flux = new Map<string, number>();
    for (const c of cmds) { const k = `${reg(c.origineId)}→${reg(c.destinationId)}`; flux.set(k, (flux.get(k) ?? 0) + c.quantiteKg); }
    for (const f of this.db.frets.items().filter((f) => !f.commandeId)) { const k = `${reg(f.origineId)}→${reg(f.destinationId)}`; flux.set(k, (flux.get(k) ?? 0) + f.tonnage * 1000); }
    const nomR = (id: string) => REGIONS.find((r) => r.id === id)!.nom;
    const fluxListe = [...flux].map(([k, kg]) => { const [a, b] = k.split('→'); return { de: nomR(a), vers: nomR(b), kg, interne: a === b }; }).sort((a, b) => b.kg - a.kg);

    const bilan = PRODUITS.map((p) => ({
      p,
      offre: this.db.offres.items().filter((o) => o.statut === 'active' && o.produitId === p.id).reduce((s, o) => s + o.quantiteRestanteKg, 0),
      demande: this.db.demandes.items().filter((d) => d.statut === 'ouverte' && d.produitId === p.id).reduce((s, d) => s + d.quantiteKg, 0),
      stock: this.db.depots.items().filter((d) => d.statut !== 'retire' && d.produitId === p.id).reduce((s, d) => s + d.quantiteKg, 0),
      collecte: this.db.collectes.items().filter((c) => c.statut === 'ouverte' && c.produitId === p.id).reduce((s, c) => s + c.engagements.reduce((t, e) => t + e.kg, 0), 0),
      tendance: ((PARAM_PRIX[p.id].saison[(i0 + 2) % 12] - PARAM_PRIX[p.id].saison[i0]) / PARAM_PRIX[p.id].saison[i0]) * 100,
    })).filter((b) => b.offre || b.demande || b.stock || b.collecte);

    const couverture = MARCHES.map((m) => {
      const r = releves.filter((x) => x.localiteId === m.id);
      const recents = r.filter((x) => x.date >= il30);
      const dernier = r.reduce((d, x) => (x.date > d ? x.date : d), '');
      return { m, recents: recents.length, produits: new Set(recents.map((x) => x.produitId)).size, dernier, sources: new Set(recents.map((x) => x.source)).size };
    }).sort((a, b) => a.recents - b.recents);

    const sources = { agent: 0, transaction: 0, utilisateur: 0 };
    releves.filter((x) => x.date >= il30).forEach((x) => sources[x.source]++);
    return { prix, flux: fluxListe, bilan, couverture, sources, nbTransactions: cmds.length, volumeTx: cmds.reduce((s, c) => s + c.quantiteKg, 0) };
  }
}
