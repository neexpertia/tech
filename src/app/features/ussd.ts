import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MARCHES, produit } from '../core/data/referentiel';
import { LIBELLE_STATUT, PlateformeService, aujourdhui } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { UI } from '../shared/ui';

const PRODUITS_USSD = ['mais', 'sorgho', 'mil', 'riz', 'niebe', 'sesame', 'oignon', 'arachide'];
const MARCHES_USSD = ['OUA', 'BOB', 'KDG', 'OHG', 'KAY', 'FAD', 'DED', 'SLN'];
const ACCUEIL = 'FasoAgri\n1. Prix du marché\n2. Vendre ma récolte\n3. Mes commandes\n4. État des routes\n5. Mon score\n0. Quitter';

/**
 * Simulateur USSD : la même logique métier, accessible depuis un téléphone simple.
 * En production, la passerelle USSD de l'opérateur appelle le backend à chaque saisie.
 */
@Component({
  selector: 'app-ussd',
  imports: [FormsModule, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Accès sans smartphone</div><h1>Simulateur USSD & SMS</h1>
        <p>Une grande partie des producteurs utilise un téléphone simple. Le même service est accessible par un code USSD (sans internet) et par SMS. Code de démonstration : <strong>*000#</strong> (fictif, attribué par l’opérateur).</p></div>
    </div>
    <div class="zone">
      <div class="tel">
        <div class="ecran">
          @if (session_()) { <pre>{{ ecran() }}</pre> } @else { <pre class="muted">Composez *000# puis Appeler</pre> }
        </div>
        <input [(ngModel)]="saisie" (keyup.enter)="envoyer()" [placeholder]="session_() ? 'Votre choix…' : '*000#'" />
        <div class="clavier">
          @for (t of touches; track t) { <button (click)="saisie = saisie + t">{{ t }}</button> }
        </div>
        <div class="toolbar" style="justify-content:space-between">
          <button class="danger" (click)="raccrocher()">✕ Annuler</button>
          <button class="primary" (click)="envoyer()">{{ session_() ? 'Envoyer' : '📞 Appeler' }}</button>
        </div>
      </div>
      <div class="card sms">
        <h2>SMS reçus</h2>
        <p class="small muted">Les notifications importantes sont aussi envoyées par SMS (commandes, paiements, alertes de prix).</p>
        <ul class="clean">
          @for (n of pf.mesNotifications().slice(0, 8); track n.id) { <li><div class="bulle">FasoAgri : {{ n.texte }}</div><div class="small muted">{{ n.date }}</div></li> }
        </ul>
        <h3 style="margin-top:12px">Commandes SMS (au 0000 fictif)</h3>
        <ul class="ticks small"><li><code>PRIX MAIS OUAGA</code> → dernier prix</li><li><code>VENDRE NIEBE 20 SACS 52000</code> → publie une offre</li><li><code>ROUTE KAYA</code> → état des axes</li></ul>
      </div>
    </div>
  </div>`,
  styles: `
    .zone { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 800px) { .zone { grid-template-columns: 1fr; } }
    .tel { background: #1d2420; border-radius: 28px; padding: 22px 18px; display: flex; flex-direction: column; gap: 10px; }
    .ecran { background: #c8d8b0; color: #1d2420; border-radius: 6px; min-height: 220px; padding: 10px; font-family: ui-monospace, monospace; font-size: 13px; }
    .ecran pre { margin: 0; white-space: pre-wrap; font: inherit; }
    .tel input { font-family: ui-monospace, monospace; }
    .clavier { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .clavier button { background: #2f3934; color: #fff; border-color: #3d4842; justify-content: center; }
    .bulle { background: var(--surface-2); border-radius: 10px; padding: 8px 10px; font-size: 13px; }
  `,
})
export class UssdPage {
  protected readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  protected readonly touches = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  protected saisie = '';
  protected readonly session_ = signal(false);
  private readonly chemin = signal<string[]>([]);
  private readonly message = signal('');

  protected readonly ecran = computed(() => this.message() || this.rendre(this.chemin()));

  private rendre(c: string[]): string {
    const liste = (ids: string[], nom: (id: string) => string) => ids.map((id, i) => `${i + 1}. ${nom(id)}`).join('\n');
    if (!c.length) return ACCUEIL;
    switch (c[0]) {
      case '1': {
        if (c.length === 1) return 'Prix : choisir le produit\n' + liste(PRODUITS_USSD, (id) => produit(id).nom);
        const p = PRODUITS_USSD[+c[1] - 1];
        if (!p) return 'Choix invalide.\n0. Retour';
        if (c.length === 2) return `${produit(p).nom} : quel marché ?\n` + liste(MARCHES_USSD, (id) => MARCHES.find((m) => m.id === id)!.nom.split(' (')[0]);
        const m = MARCHES_USSD[+c[2] - 1];
        const d = m ? this.pf.prix(p, m) : undefined;
        if (!d) return 'Pas de prix disponible.\n0. Accueil';
        const sac = produit(p).unites[1];
        return `${produit(p).nom} - ${MARCHES.find((x) => x.id === m)!.nom.split(' (')[0]}\n${d.prix} F/kg\n${sac ? `${sac.libelle}: ${Math.round(d.prix * sac.kg)} F\n` : ''}Relevé du ${d.date}\n0. Accueil`;
      }
      case '2': {
        if (!this.session.estVendeur()) return 'Service réservé aux vendeurs.\n0. Accueil';
        if (c.length === 1) return 'Vendre : quel produit ?\n' + liste(PRODUITS_USSD, (id) => produit(id).nom);
        const p = PRODUITS_USSD[+c[1] - 1];
        if (!p) return 'Choix invalide.\n0. Accueil';
        if (c.length === 2) return `${produit(p).nom}\nNombre de sacs de 100 kg ?`;
        if (c.length === 3) {
          const ref = this.pf.prixReference(p, this.session.utilisateur()!.localiteId);
          return `${c[2]} sacs\nPrix par sac (F) ?${ref ? `\nMarché: ~${Math.round(ref.prix * 100)} F/sac` : ''}`;
        }
        if (c.length === 4) return `Confirmer :\n${c[2]} sacs de ${produit(p).nom}\nà ${c[3]} F/sac\n1. Oui  2. Non`;
        return '';
      }
      case '3': {
        const moi = this.session.utilisateur()!.id;
        const cmds = this.pf.db.commandes.items().filter((x) => x.acheteurId === moi || x.vendeurId === moi).slice(0, 3);
        return (cmds.length ? cmds.map((x) => `${x.reference}\n${produit(x.produitId).nom} ${Math.round(x.quantiteKg / 100)} sacs\n${LIBELLE_STATUT[x.statut]}`).join('\n--\n') : 'Aucune commande.') + '\n0. Accueil';
      }
      case '4': {
        const a = this.pf.db.axes.items().slice(0, 3);
        return a.map((x) => `${x.origineId}-${x.destinationId}: ${x.motif}`).join('\n') + '\n0. Accueil';
      }
      case '5': {
        const s = this.pf.score(this.session.utilisateur()!.id);
        return `Score: ${s.grade} (${s.valeur}/100)\nVentes: ${s.ventes} Achats: ${s.achats}\nAvis: ${s.noteMoyenne.toFixed(1)}/5\n0. Accueil`;
      }
      default: return 'Choix invalide.\n0. Accueil';
    }
  }

  async envoyer() {
    const v = this.saisie.trim();
    this.saisie = '';
    if (!this.session_()) {
      if (v === '*000#') { this.session_.set(true); this.chemin.set([]); this.message.set(''); }
      else this.message.set('Code inconnu. Composez *000#');
      return;
    }
    const avaitMessage = !!this.message();
    this.message.set('');
    if (v === '0') {
      if (!this.chemin().length && !avaitMessage) { this.raccrocher(); return; }
      this.chemin.set([]);
      return;
    }
    const c = [...this.chemin(), v];
    if (c[0] === '2' && c.length === 5) {
      if (v === '1') {
        const p = PRODUITS_USSD[+c[1] - 1];
        const sacs = +c[2];
        const prixSac = +c[3];
        const o = await this.pf.publierOffre({
          produitId: p, quantiteKg: sacs * 100, prixKg: Math.round(prixSac / 100), qualite: 'B', localiteId: this.session.utilisateur()!.localiteId,
          disponibleLe: aujourdhui(), description: 'Offre publiée par USSD.', livraison: false,
        });
        this.message.set(`Offre publiée !\nLot ${o.lot}\nVous recevrez un SMS dès qu'un acheteur commande.\n0. Accueil`);
      } else this.message.set('Offre annulée.\n0. Accueil');
      this.chemin.set([]);
      return;
    }
    this.chemin.set(c);
  }

  raccrocher() {
    this.session_.set(false);
    this.chemin.set([]);
    this.message.set('');
  }
}
