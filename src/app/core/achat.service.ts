import { Injectable, computed, inject } from '@angular/core';
import { DbService } from './api/db.service';
import { MARCHES, NOM_MOIS, distanceKm, localite, produit } from './data/referentiel';
import { AlerteProduit, CategorieActu, Commande, Conversation, MessageConv, Offre, Qualite, Role, TypeMessage } from './models';
import { PlateformeService, aujourdhui, de, fmtKg, fraicheur, maintenant, offreVisible } from './plateforme.service';
import { SessionService } from './session.service';

/** Seuil au-delà duquel un acheteur doit avoir une identité vérifiée pour payer. */
export const SEUIL_KYC_ACHAT = 500_000;

export interface ActuVue {
  id: string;
  titre: string;
  resume: string;
  categorie: CategorieActu;
  date: string;
  lien?: string;
  source: string;
  /** Calculée à partir des données de la plateforme (prix, offres, routes) */
  calculee: boolean;
  /** Pourquoi elle est proposée : « Vous suivez le maïs » */
  pourquoi?: string;
  score: number;
}

let seq = 0;
const idMsg = () => `MSG-${Date.now().toString(36)}${++seq}`;

/**
 * Parcours acheteur : favoris, panier, discussions avec les vendeurs, alertes produits,
 * offres équivalentes, actualités pertinentes et passage au statut de vendeur.
 * Les règles de commande, de paiement et de livraison restent dans PlateformeService.
 */
@Injectable({ providedIn: 'root' })
export class AchatService {
  private readonly db = inject(DbService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);

  private get moi() { return this.session.utilisateur()!.id; }
  private readonly moiId = computed(() => this.session.utilisateur()?.id);

  // ================================================================ FAVORIS

  readonly mesFavoris = computed(() => {
    const id = this.moiId();
    return this.db.favoris.items().filter((f) => f.userId === id)
      .map((f) => {
        const o = this.db.offres.get(f.offreId);
        if (!o) return null;
        const dispo = offreVisible(o);
        const baisse = o.prixKg < f.prixKgAjout ? f.prixKgAjout - o.prixKg : 0;
        return { f, o, dispo, baisse, fraicheur: fraicheur(o) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Number(b.dispo) - Number(a.dispo) || b.baisse - a.baisse || b.f.creeLe.localeCompare(a.f.creeLe));
  });

  estFavori(offreId: string) {
    return this.db.favoris.items().some((f) => f.userId === this.moiId() && f.offreId === offreId);
  }

  async basculerFavori(o: Offre) {
    const f = this.db.favoris.items().find((x) => x.userId === this.moi && x.offreId === o.id);
    if (f) { await this.db.favoris.remove(f.id); return false; }
    await this.db.favoris.create({ userId: this.moi, offreId: o.id, prixKgAjout: o.prixKg, creeLe: aujourdhui() });
    return true;
  }

  // ================================================================ MASQUER

  /** Offres masquées par l'utilisateur : retirées de l'accueil, du marché et des suggestions. */
  readonly idsMasques = computed(() => new Set(this.db.masques.items().filter((m) => m.userId === this.moiId()).map((m) => m.offreId)));
  estMasque(offreId: string) { return this.idsMasques().has(offreId); }
  async masquer(offreId: string) {
    if (!this.estMasque(offreId)) await this.db.masques.create({ userId: this.moi, offreId, creeLe: aujourdhui() });
  }
  async demasquer(offreId: string) {
    for (const m of this.db.masques.items().filter((m) => m.userId === this.moi && m.offreId === offreId)) await this.db.masques.remove(m.id);
  }

  // ================================================================ PANIER

  readonly panier = computed(() => {
    const id = this.moiId();
    return this.db.panier.items().filter((l) => l.userId === id).map((l) => {
      const o = this.db.offres.get(l.offreId);
      const valide = !!o && offreVisible(o) && l.quantiteKg <= o.quantiteRestanteKg && o.vendeurId !== id;
      return { l, o, valide, sousTotal: o ? o.prixKg * l.quantiteKg : 0 };
    });
  });
  readonly nbPanier = computed(() => this.panier().length);

  async ajouterAuPanier(offreId: string, quantiteKg: number) {
    const ex = this.db.panier.items().find((l) => l.userId === this.moi && l.offreId === offreId);
    if (ex) return this.db.panier.update(ex.id, { quantiteKg });
    return this.db.panier.create({ userId: this.moi, offreId, quantiteKg, ajouteLe: aujourdhui() });
  }
  modifierLigne(id: string, quantiteKg: number) { return this.db.panier.update(id, { quantiteKg }); }
  retirerLigne(id: string) { return this.db.panier.remove(id); }

  /** Émet une commande par ligne valide (une par vendeur et par lot). */
  async commanderPanier(destinationId: string, avecTransport: boolean): Promise<Commande[]> {
    const faites: Commande[] = [];
    for (const x of this.panier().filter((p) => p.valide)) {
      faites.push(await this.pf.commanderOffre(x.o!.id, x.l.quantiteKg, destinationId, avecTransport, { origineAchat: 'panier' }));
      await this.db.panier.remove(x.l.id);
    }
    return faites;
  }

  // ================================================================ OFFRES ÉQUIVALENTES

  /** Offres visibles du même produit, triées par coût rendu à destination. */
  alternatives(produitId: string, destinationId: string, exclure?: string, n = 3) {
    return this.db.offres.items()
      .filter((o) => o.produitId === produitId && o.id !== exclure && offreVisible(o) && o.vendeurId !== this.moiId() && !this.idsMasques().has(o.id))
      .map((o) => ({ o, rendu: this.pf.coutRendu(o.prixKg, o.produitId, o.localiteId, destinationId).total, fraicheur: fraicheur(o) }))
      .sort((a, b) => a.rendu - b.rendu)
      .slice(0, n);
  }

  // ================================================================ MESSAGERIE (par produit)

  readonly mesConversations = computed(() => {
    const id = this.moiId();
    return this.db.conversations.items()
      .filter((c) => c.acheteurId === id || c.vendeurId === id)
      .sort((a, b) => b.majLe.localeCompare(a.majLe));
  });

  nonLus(c: Conversation) { return c.acheteurId === this.moiId() ? c.nonLusAcheteur : c.nonLusVendeur; }
  readonly nbNonLus = computed(() => this.mesConversations().reduce((s, c) => s + this.nonLus(c), 0));

  /** Ouvre (ou crée) la discussion de l'acheteur courant avec le vendeur d'une offre. */
  async discussion(o: Offre) {
    const ex = this.db.conversations.items().find((c) => c.offreId === o.id && c.acheteurId === this.moi);
    if (ex) return ex;
    return this.db.conversations.create({
      offreId: o.id, produitId: o.produitId, acheteurId: this.moi, vendeurId: o.vendeurId, messages: [],
      nonLusAcheteur: 0, nonLusVendeur: 0, majLe: maintenant(), creeLe: aujourdhui(),
    });
  }

  private async poster(c: Conversation, m: Omit<MessageConv, 'id' | 'date' | 'auteurId'>, notif?: string) {
    const fresh = this.db.conversations.get(c.id)!;
    const parAcheteur = fresh.acheteurId === this.moi;
    const msg: MessageConv = { id: idMsg(), date: maintenant(), auteurId: this.moi, ...m };
    await this.db.conversations.update(c.id, {
      messages: [...fresh.messages, msg], majLe: msg.date,
      nonLusAcheteur: parAcheteur ? 0 : fresh.nonLusAcheteur + 1,
      nonLusVendeur: parAcheteur ? fresh.nonLusVendeur + 1 : 0,
    });
    const dest = parAcheteur ? fresh.vendeurId : fresh.acheteurId;
    await this.pf.notifier(dest, notif ?? `${this.pf.nom(this.moi)} (${produit(fresh.produitId).nom.toLowerCase()}) : « ${m.texte.slice(0, 70)} »`, `/messages/${c.id}`, 'message');
    return msg;
  }

  envoyer(c: Conversation, texte: string, type: TypeMessage = 'texte') { return this.poster(c, { type, texte }); }

  demanderDisponibilite(c: Conversation, quantiteKg?: number) {
    const p = produit(c.produitId).nom.toLowerCase();
    return this.poster(c, { type: 'question_dispo', texte: `Bonjour, votre ${p} est-il toujours disponible${quantiteKg ? ` pour ${fmtKg(quantiteKg)}` : ''} ?` },
      `${this.pf.nom(this.moi)} demande si votre ${p} est toujours disponible.`);
  }

  /** Réponse en un clic du vendeur ; « oui » reconfirme aussi le stock de l'offre. */
  async repondreDisponibilite(c: Conversation, disponible: boolean, quantiteKg?: number) {
    const o = this.db.offres.get(c.offreId);
    if (o) {
      if (disponible) await this.pf.confirmerStock(o.id, quantiteKg ? { quantiteRestanteKg: quantiteKg } : {});
      else await this.db.offres.update(o.id, { statut: 'epuisee', quantiteRestanteKg: 0, stockConfirmeLe: aujourdhui() });
    }
    const texte = disponible ? `Oui, toujours disponible${quantiteKg ? ` : ${fmtKg(quantiteKg)}` : o ? ` : ${fmtKg(o.quantiteRestanteKg)}` : ''}.` : 'Désolé, ce lot n’est plus disponible.';
    return this.poster(c, { type: 'reponse_dispo', texte, disponible });
  }

  /** Le vendeur propose un prix pour une quantité ; l'acheteur peut l'accepter en un clic. */
  proposer(c: Conversation, prixKg: number, quantiteKg: number) {
    return this.poster(c, { type: 'proposition', texte: `Je vous propose ${prixKg} F/kg pour ${fmtKg(quantiteKg)}.`, proposition: { prixKg, quantiteKg, statut: 'en_attente' } },
      `Nouvelle proposition de prix : ${produit(c.produitId).nom.toLowerCase()} à ${prixKg} F/kg pour ${fmtKg(quantiteKg)}.`);
  }

  /** Accepter la proposition = émettre la commande au prix négocié (réservée, sans attente de confirmation supplémentaire). */
  async accepterProposition(c: Conversation, msgId: string, destinationId: string, avecTransport: boolean) {
    const fresh = this.db.conversations.get(c.id)!;
    const m = fresh.messages.find((x) => x.id === msgId)!;
    const p = m.proposition!;
    const cmd = await this.pf.commanderOffre(fresh.offreId, p.quantiteKg, destinationId, avecTransport, { prixKg: p.prixKg, origineAchat: 'negociation' });
    // Le vendeur vient de proposer : sa proposition vaut confirmation de disponibilité.
    await this.pf.confirmerDisponibilite(this.db.commandes.get(cmd.id)!, 'Prix négocié dans la messagerie — disponibilité confirmée par la proposition du vendeur');
    await this.db.conversations.update(c.id, { messages: this.db.conversations.get(c.id)!.messages.map((x) => (x.id === msgId ? { ...x, proposition: { ...p, statut: 'acceptee', commandeId: cmd.id } } : x)) });
    await this.poster(c, { type: 'systeme', texte: `Proposition acceptée : commande ${cmd.reference} émise.` });
    return cmd;
  }

  async refuserProposition(c: Conversation, msgId: string) {
    await this.db.conversations.update(c.id, { messages: this.db.conversations.get(c.id)!.messages.map((x) => (x.id === msgId && x.proposition ? { ...x, proposition: { ...x.proposition, statut: 'refusee' } } : x)) });
    await this.poster(c, { type: 'systeme', texte: 'Proposition déclinée.' });
  }

  async marquerLu(c: Conversation) {
    const parAcheteur = c.acheteurId === this.moi;
    if ((parAcheteur ? c.nonLusAcheteur : c.nonLusVendeur) === 0) return;
    await this.db.conversations.update(c.id, parAcheteur ? { nonLusAcheteur: 0 } : { nonLusVendeur: 0 });
  }

  // ================================================================ ALERTES PRODUITS

  readonly mesAlertes = computed(() => this.db.alertes.items().filter((a) => a.userId === this.moiId()));

  /** Offres visibles qui correspondent aujourd'hui à une alerte */
  correspondances(a: AlerteProduit) {
    return this.db.offres.items().filter((o) => o.produitId === a.produitId && offreVisible(o)
      && (!a.prixMaxKg || o.prixKg <= a.prixMaxKg) && (!a.qualiteMin || o.qualite <= a.qualiteMin)
      && (!a.rayonKm || distanceKm(o.localiteId, a.localiteId) <= a.rayonKm));
  }

  creerAlerte(a: { produitId: string; prixMaxKg?: number; qualiteMin?: Qualite; rayonKm?: number; localiteId: string }) {
    return this.db.alertes.create({ ...a, userId: this.moi, active: true, creeLe: aujourdhui() });
  }
  basculerAlerte(a: AlerteProduit) { return this.db.alertes.update(a.id, { active: !a.active }); }
  supprimerAlerte(id: string) { return this.db.alertes.remove(id); }

  // ================================================================ DEVENIR VENDEUR

  /**
   * Un acheteur devient vendeur : son espace bascule sur l'outil vendeur (il garde ses achats,
   * favoris et messages). Publier une offre nécessite la vérification des pièces.
   */
  async devenirVendeur(type: 'producteur' | 'cooperative' | 'commercant', p: { produits: string[]; piece: string; localiteId: string; organisation?: string; membres?: number }) {
    const u = this.session.utilisateur()!;
    const pieces = u.pieces.includes(p.piece) ? u.pieces : [...u.pieces, p.piece];
    await this.db.utilisateurs.update(u.id, {
      role: 'vendeur', typeVendeur: type, vendeurDepuis: aujourdhui(), produitsVendus: p.produits, pieces, localiteId: p.localiteId,
      kyc: u.kyc === 'verifie' ? 'verifie' : 'en_attente', categorie: undefined,
      ...(p.organisation ? { organisation: p.organisation, nom: p.organisation } : {}), ...(p.membres ? { membres: p.membres } : {}),
    });
    await this.pf.notifier('U-ADM', `${u.nom} est devenu vendeur (${type}) — pièce à vérifier : ${p.piece}.`, '/admin', 'compte');
    await this.pf.notifier(u.id, u.kyc === 'verifie'
      ? 'Votre espace vendeur est ouvert : publiez votre première offre.'
      : 'Votre espace vendeur est ouvert. Vos pièces sont en cours de vérification (48 h) avant votre première publication.', '/marche/nouvelle', 'compte');
  }

  // ================================================================ ACTUALITÉS PERTINENTES

  /** Produits qui intéressent l'utilisateur, déduits de son activité. */
  readonly interets = computed(() => {
    const id = this.moiId();
    const s = new Map<string, string>();
    const add = (p: string | undefined, raison: string) => { if (p && produit(p) && !s.has(p)) s.set(p, raison); };
    for (const c of this.db.commandes.items().filter((c) => c.acheteurId === id)) add(c.produitId, 'Vous en avez acheté');
    for (const x of this.panier()) add(x.o?.produitId, 'Dans votre panier');
    for (const f of this.mesFavoris()) add(f.o.produitId, 'Dans vos favoris');
    for (const a of this.mesAlertes()) add(a.produitId, 'Vous avez une alerte');
    for (const c of this.mesConversations()) add(c.produitId, 'Vous en discutez');
    for (const p of this.session.utilisateur()?.produitsVendus ?? []) add(p, 'Vous le vendez');
    return s;
  });

  readonly actualites = computed<ActuVue[]>(() => {
    const u = this.session.utilisateur();
    const loc = u?.localiteId ?? 'OUA';
    const regionId = localite(loc).regionId;
    const interets = this.interets();
    const suivis = interets.size ? [...interets.keys()] : this.db.offres.items().filter(offreVisible).map((o) => o.produitId).filter((v, i, a) => a.indexOf(v) === i);
    const marche = [...MARCHES].sort((a, b) => distanceKm(a.id, loc) - distanceKm(b.id, loc))[0];
    const out: ActuVue[] = [];
    const bonus = (p: string) => (interets.has(p) ? 3 : 0);

    // 1. Mouvements de prix sur le marché de référence
    for (const p of suivis) {
      const d = this.pf.prix(p, marche.id);
      if (!d?.precedent) continue;
      const v = ((d.prix - d.precedent) / d.precedent) * 100;
      if (Math.abs(v) < 2) continue;
      const nom = produit(p).nom;
      out.push({
        id: `prix-${p}`, categorie: 'Prix', calculee: true, date: d.date, source: 'Relevés FasoAgri', lien: '/prix',
        titre: `${nom} : ${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % à ${marche.nom.split(' (')[0]}`,
        resume: `Dernier relevé : ${d.prix} F/kg (contre ${d.precedent}). ${v < 0 ? 'Prix en baisse : bon moment pour comparer les offres et acheter.' : 'Prix en hausse : regardez les vendeurs des zones de production, souvent moins chers même avec le transport.'}`,
        pourquoi: interets.get(p), score: 4 + bonus(p) + Math.min(3, Math.abs(v) / 3),
      });
    }

    // 2. Saison : récoltes en cours ce mois-ci
    const mois = new Date().getMonth() + 1;
    const enRecolte = suivis.filter((p) => produit(p).recolte.includes(mois));
    if (enRecolte.length) {
      const noms = enRecolte.map((p) => produit(p).nom.toLowerCase()).join(', ');
      out.push({
        id: `saison-${mois}`, categorie: 'Saison', calculee: true, date: aujourdhui(), source: 'Calendrier cultural',
        titre: `Récolte en cours en ${NOM_MOIS[mois - 1]} : ${noms}`,
        resume: 'Période de récolte : les offres sont nombreuses et les prix généralement plus bas. Vérifiez le séchage et la qualité avant d’acheter.',
        pourquoi: enRecolte.some((p) => interets.has(p)) ? 'Produits que vous suivez' : undefined, score: 3 + (enRecolte.some((p) => interets.has(p)) ? 2 : 0),
      });
    }

    // 3. Marché : nouvelles offres de la semaine sur les produits suivis
    for (const p of suivis) {
      const nouv = this.db.offres.items().filter((o) => o.produitId === p && offreVisible(o) && o.vendeurId !== u?.id && (Date.parse(aujourdhui()) - Date.parse(o.creeLe)) / 86_400_000 <= 7);
      if (!nouv.length) continue;
      const min = Math.min(...nouv.map((o) => o.prixKg));
      out.push({
        id: `offres-${p}`, categorie: 'Marché', calculee: true, date: nouv.map((o) => o.creeLe).sort().pop()!, source: 'Marché FasoAgri', lien: `/marche?produit=${p}`,
        titre: `${nouv.length} nouvelle${nouv.length > 1 ? 's' : ''} offre${nouv.length > 1 ? 's' : ''} ${de(produit(p).nom)} cette semaine`,
        resume: `À partir de ${min} F/kg, ${fmtKg(nouv.reduce((s, o) => s + o.quantiteRestanteKg, 0))} au total. Stock confirmé par les vendeurs.`,
        pourquoi: interets.get(p), score: 3 + bonus(p),
      });
    }

    // 4. Routes : axes signalés dans la région ou sur le trajet de mes commandes en cours
    const trajets = this.db.commandes.items().filter((c) => c.acheteurId === u?.id && ['sequestre', 'expediee'].includes(c.statut)).flatMap((c) => [c.origineId, c.destinationId]);
    for (const a of this.db.axes.items().filter((a) => a.niveau !== 'info')) {
      const proche = [a.origineId, a.destinationId].some((l) => localite(l).regionId === regionId || trajets.includes(l));
      if (!proche) continue;
      out.push({
        id: `axe-${a.id}`, categorie: 'Routes', calculee: true, date: a.date, source: `${a.confirmations} transporteur(s)`, lien: '/transport',
        titre: `${localite(a.origineId).nom.split(' (')[0]} ↔ ${localite(a.destinationId).nom.split(' (')[0]} : ${a.motif.toLowerCase()}`,
        resume: a.commentaire, pourquoi: trajets.length ? 'Sur un trajet de vos livraisons ou dans votre région' : 'Dans votre région', score: a.niveau === 'deconseille' ? 5 : 3,
      });
    }

    // 5. Contenus éditoriaux ciblés
    for (const a of this.db.actualites.items()) {
      const cible = !a.produitIds.length || a.produitIds.some((p) => interets.has(p));
      const reg = !a.regionIds.length || a.regionIds.includes(regionId);
      out.push({
        id: a.id, titre: a.titre, resume: a.resume, categorie: a.categorie, date: a.date, source: a.source, lien: a.lien, calculee: false,
        pourquoi: a.produitIds.find((p) => interets.has(p)) ? interets.get(a.produitIds.find((p) => interets.has(p))!) : undefined,
        score: (cible ? 3 : 0) + (reg ? 1 : 0) + (a.categorie === 'Plateforme' ? 1 : 0),
      });
    }

    const age = (d: string) => Math.max(0, (Date.parse(aujourdhui()) - Date.parse(d.slice(0, 10))) / 86_400_000);
    return out.map((x) => ({ ...x, score: x.score - Math.min(4, age(x.date) / 7) })).sort((a, b) => b.score - a.score);
  });
}
