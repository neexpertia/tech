import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MARCHES, produit } from '../../core/data/referentiel';
import { Role } from '../../core/models';
import { PlateformeService } from '../../core/plateforme.service';
import { ACTEURS, CONFIG_ROLES } from '../../core/roles';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';

const ORDRE: Role[] = [...ACTEURS];

@Component({
  selector: 'app-landing',
  imports: [RouterLink, ...UI],
  template: `
  <section class="hero">
    <div class="in">
      <div class="txt">
        <span class="pill">Pour les filières agricoles du Burkina Faso</span>
        <h1>Vendez, achetez et financez vos produits agricoles en toute confiance</h1>
        <p>Prix des marchés du jour, acheteurs vérifiés, paiement sécurisé par Orange Money, Moov Money ou Sank Money, transport et stockage : tout au même endroit, sur smartphone ou par code USSD.</p>
        <div class="cta">
          <a class="btn primary grand" routerLink="/inscription">Créer mon compte gratuit</a>
          <a class="btn grand" routerLink="/decouvrir/prix">Voir les prix du jour</a>
        </div>
      </div>
      <div class="card prixjour">
        <div class="small muted">Ouagadougou (Sankaryaré) · dernier relevé</div>
        <table class="small">
          <tbody>
            @for (l of prixJour(); track l.id) {
              <tr><td>{{ l.nom }}</td><td class="num"><strong>{{ l.prix | nb }} F/kg</strong></td><td class="num muted">{{ l.sac }}</td>
                <td class="num"><span class="badge" [class.ko]="l.var > 3" [class.ok]="l.var < -3">{{ l.var > 0 ? '▲' : l.var < 0 ? '▼' : '=' }}</span></td></tr>
            }
          </tbody>
        </table>
        <a class="small" routerLink="/decouvrir/prix">Prix sur {{ nbMarches }} marchés →</a>
      </div>
    </div>
  </section>

  <section class="in stats">
    <div><strong>{{ stats().offres }}</strong><span>offres disponibles</span></div>
    <div><strong>{{ stats().tonnes | nb }} t</strong><span>proposées à la vente</span></div>
    <div><strong>{{ stats().producteurs | nb }}</strong><span>producteurs connectés</span></div>
    <div><strong>{{ nbMarches }}</strong><span>marchés suivis</span></div>
  </section>

  <section class="in bloc" id="comment">
    <h2>Comment ça marche</h2>
    <div class="etapes">
      @for (e of etapes; track e.titre; let i = $index) {
        <div class="card"><span class="num-e">{{ i + 1 }}</span><div class="ic">{{ e.icone }}</div><h3>{{ e.titre }}</h3><p class="small">{{ e.texte }}</p></div>
      }
    </div>
    <div class="note green" style="margin-top:16px">🔒 <strong>Paiement sécurisé :</strong> l’argent de l’acheteur est bloqué sur un compte séquestre et versé au vendeur seulement quand la marchandise est reçue. En cas de problème, la plateforme arbitre.</div>
  </section>

  <section class="in bloc" id="acteurs">
    <h2>Un espace adapté à chaque acteur</h2>
    <p class="muted">Chaque acteur de la filière a ses propres questions. Son espace lui donne directement les outils qui y répondent.</p>
    <div class="acteurs">
      @for (a of acteurs; track a.role) {
        <div class="card acteur">
          <div class="haut"><span class="em">{{ a.c.emoji }}</span><h3>{{ a.c.espace.replace('Espace ', '') }}</h3></div>
          <p class="small q">« {{ a.c.accroche }} »</p>
          <ul class="ticks small">@for (t of a.c.tuiles; track t.titre) { <li>{{ t.titre }}</li> }</ul>
          <a class="btn" routerLink="/inscription" [queryParams]="{ role: a.role }">Créer mon espace →</a>
        </div>
      }
    </div>
  </section>

  <section class="in bloc">
    <h2>Dernières offres <a class="small" routerLink="/decouvrir/marche">Voir tout le marché →</a></h2>
    <div class="grid g3">
      @for (o of dernieres(); track o.id) {
        <a class="card lien-carte" [routerLink]="['/decouvrir/marche', o.id]">
          <span class="badge" [class.ok]="o.qualite === 'A'">Qualité {{ o.qualite }}</span> @if (o.producteurs) { <span class="badge info">{{ o.producteurs }} producteurs</span> }
          <h3 style="margin-top:6px">{{ o.produitId | prod }} · {{ o.quantiteRestanteKg | qte }}</h3>
          <div><strong>{{ o.prixKg | nb }} F/kg</strong> <span class="small muted">— {{ o.quantiteRestanteKg | enUnite: o.produitId }}</span></div>
          <div class="small muted">📍 {{ o.localiteId | loc }} · {{ o.vendeurId | qui }}</div>
        </a>
      }
    </div>
  </section>

  <section class="in bloc">
    <h2>Accessible à tous</h2>
    <div class="grid g4">
      <div class="card"><div class="ic">📱</div><h3>Sans smartphone</h3><p class="small">Code USSD et SMS pour consulter les prix et vendre depuis un téléphone simple, sans internet.</p></div>
      <div class="card"><div class="ic">🗣️</div><h3>Dans votre langue</h3><p class="small">Français, mooré, dioula et fulfuldé pour les messages et alertes.</p></div>
      <div class="card"><div class="ic">💳</div><h3>Mobile Money</h3><p class="small">Orange Money, Moov Money et Sank Money, avec séquestre.</p></div>
      <div class="card"><div class="ic">🤝</div><h3>Coopératives</h3><p class="small">Regroupement des apports et paiement de chaque membre.</p></div>
    </div>
  </section>

  <section class="in final card">
    <h2>Prêt à commencer ?</h2>
    <p>L’inscription est gratuite. Votre identité est vérifiée pour protéger tous les membres.</p>
    <div class="cta"><a class="btn primary grand" routerLink="/inscription">Créer mon compte</a><a class="btn grand" routerLink="/connexion">J’ai déjà un compte</a></div>
  </section>`,
  styles: `
    .in { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .hero { background: linear-gradient(160deg, #0f4a30, var(--primary)); color: #fff; padding: 48px 0; }
    .hero .in { display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; align-items: center; }
    .hero h1 { font-size: 2.3rem; line-height: 1.15; }
    .hero p { font-size: 16px; opacity: .92; }
    .pill { display: inline-block; background: rgba(255,255,255,.15); padding: 4px 12px; border-radius: 999px; font-size: 13px; margin-bottom: 12px; }
    .cta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .grand { padding: 10px 18px; font-size: 15px; }
    .hero .btn:not(.primary) { background: transparent; color: #fff; border-color: rgba(255,255,255,.5); }
    .hero .btn.primary { background: #f2b33d; border-color: #f2b33d; color: #1d2420; }
    .prixjour { color: var(--text); }
    .prixjour td { padding: 6px 6px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: -24px; }
    .stats div { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
    .stats strong { font-size: 1.6rem; color: var(--primary); }
    .stats span { color: var(--muted); font-size: 13px; }
    .bloc { margin-top: 44px; scroll-margin-top: 80px; }
    .bloc h2 { font-size: 1.5rem; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .etapes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .etapes .card { position: relative; }
    .num-e { position: absolute; top: 10px; right: 14px; font-size: 28px; font-weight: 700; color: var(--primary-soft); }
    .ic { font-size: 28px; }
    .acteurs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .acteur { display: flex; flex-direction: column; gap: 6px; }
    .acteur .haut { display: flex; gap: 10px; align-items: center; } .acteur h3::first-letter { text-transform: uppercase; } .acteur .em { font-size: 28px; } .acteur h3 { margin: 0; }
    .acteur .q { font-style: italic; color: var(--muted); margin: 0; }
    .acteur .btn { margin-top: auto; align-self: flex-start; }
    .final { text-align: center; margin-top: 44px; padding: 32px; } .final .cta { justify-content: center; }
    @media (max-width: 860px) {
      .hero .in { grid-template-columns: 1fr; } .hero h1 { font-size: 1.7rem; }
      .stats, .etapes { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class LandingPage {
  private readonly pf = inject(PlateformeService);
  protected readonly session = inject(SessionService);
  protected readonly nbMarches = MARCHES.length;
  protected readonly acteurs = ORDRE.map((role) => ({ role, c: CONFIG_ROLES[role] }));
  protected readonly etapes = [
    { icone: '🧺', titre: 'Publier', texte: 'Le producteur ou la coopérative publie son offre en sacs ; l’acheteur publie son besoin.' },
    { icone: '⚖️', titre: 'Comparer', texte: 'Prix du marché, coût rendu jusqu’à chez vous, avis et fiabilité des partenaires.' },
    { icone: '💳', titre: 'Payer en sécurité', texte: 'Paiement Mobile Money bloqué en séquestre jusqu’à la livraison.' },
    { icone: '🚚', titre: 'Livrer & être payé', texte: 'Transport trouvé sur la bourse de fret ; le vendeur est payé à la réception.' },
  ];

  protected readonly prixJour = computed(() => ['mais', 'sorgho', 'mil', 'riz', 'niebe', 'oignon'].map((id) => {
    const d = this.pf.prix(id, 'OUA');
    const p = produit(id);
    const u = p.unites[1];
    return { id, nom: p.nom, prix: d?.prix ?? 0, var: d?.precedent ? ((d.prix - d.precedent) / d.precedent) * 100 : 0, sac: u ? `${Math.round((d?.prix ?? 0) * u.kg).toLocaleString('fr-FR')} F / ${u.code.replace('sac', 'sac ')}` : '' };
  }));

  protected readonly stats = computed(() => {
    const offres = this.pf.db.offres.items().filter((o) => o.statut === 'active');
    const us = this.pf.db.utilisateurs.items();
    return {
      offres: offres.length,
      tonnes: Math.round(offres.reduce((s, o) => s + o.quantiteRestanteKg, 0) / 1000),
      producteurs: us.filter((u) => u.role === 'producteur').length + us.filter((u) => u.role === 'cooperative').reduce((s, u) => s + (u.membres ?? 0), 0),
    };
  });

  protected readonly dernieres = computed(() => [...this.pf.db.offres.items()].filter((o) => o.statut === 'active').sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, 6));
}
