import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Operateur, StatutCommande } from '../../core/models';
import { LIBELLE_STATUT, PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

const ETAPES: { statut: StatutCommande; label: string }[] = [
  { statut: 'attente_paiement', label: 'Commande' },
  { statut: 'sequestre', label: 'Payée (séquestre)' },
  { statut: 'expediee', label: 'Expédiée' },
  { statut: 'livree', label: 'Livrée' },
  { statut: 'terminee', label: 'Réceptionnée · fonds libérés' },
];

@Component({
  selector: 'app-commande-detail',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <a routerLink="/commandes" class="small">← Commandes</a>
    @if (cmd(); as c) {
      @let m = pf.montant(c);
      <div class="page-head" style="margin-top:8px">
        <div>
          <div class="eyebrow">{{ c.reference }} · créée le {{ c.creeLe }}</div>
          <h1>{{ c.produitId | prod }} — {{ c.quantiteKg | qte }} à {{ c.prixKg | nb }} F/kg</h1>
          <p>{{ c.origineId | loc }} → {{ c.destinationId | loc }} · vendeur <strong>{{ c.vendeurId | qui }}</strong> · acheteur <strong>{{ c.acheteurId | qui }}</strong></p>
        </div>
        <span class="badge big" [class.ok]="c.statut === 'terminee'" [class.ko]="c.statut === 'litige' || c.statut === 'annulee'" [class.info]="c.statut !== 'terminee'">{{ libelle[c.statut] }}</span>
      </div>

      <div class="card etapes">
        @for (e of etapes; track e.statut; let i = $index) {
          <div class="etape" [class.fait]="rang() >= i" [class.courant]="rang() === i">
            <span class="rond">{{ rang() > i ? '✓' : i + 1 }}</span><span class="small">{{ e.label }}</span>
          </div>
        }
      </div>
      @if (c.statut === 'litige') { <div class="note section"><strong>Litige : {{ c.litige?.motif }}</strong> — {{ c.litige?.description }} (ouvert le {{ c.litige?.ouvertLe }}). Les fonds restent bloqués jusqu’à l’arbitrage.</div> }

      <div class="split section">
        <div>
          <div class="card">
            <h2>Actions</h2>
            <div class="toolbar">
              @if (estAcheteur() && c.statut === 'attente_paiement') {
                <button class="primary" (click)="modal.set('payer')">💳 Payer {{ m.total | fcfa }}</button>
                <button class="danger" (click)="annuler()">Annuler</button>
              }
              @if (estVendeur() && c.statut === 'sequestre') {
                <button class="primary" (click)="modal.set('expedier')">📦 Déclarer l’expédition</button>
                @if (!c.fretId && c.fraisTransport) { <button (click)="transport()">🚚 Demander un transporteur</button> }
              }
              @if (estAcheteur() && ['expediee', 'livree'].includes(c.statut)) {
                <button class="primary" (click)="recevoir()">✅ Confirmer la réception</button>
                <button class="danger" (click)="modal.set('litige')">⚠️ Signaler un problème</button>
              }
              @if (admin() && c.statut === 'litige') { <button class="primary" (click)="modal.set('arbitrer')">⚖️ Arbitrer le litige</button> }
              @if (c.statut === 'terminee' && (estAcheteur() || estVendeur()) && !dejaNote()) { <button (click)="modal.set('noter')">★ Noter {{ (estAcheteur() ? c.vendeurId : c.acheteurId) | qui }}</button> }
              @if (!actionDisponible()) { <span class="muted small">{{ attente() }}</span> }
            </div>
            @if (c.fretId) { <p class="small" style="margin-top:8px">🚚 Transport : fret {{ c.fretId }} — <a routerLink="/transport">suivre</a></p> }
          </div>

          <div class="card section">
            <h2>Échanges</h2>
            <div class="fil">
              @for (msg of c.messages; track $index) {
                <div class="msg" [class.moi]="msg.auteurId === moi()"><div class="small muted">{{ msg.auteurId | qui }} · {{ msg.date }}</div>{{ msg.texte }}</div>
              } @empty { <p class="muted small">Aucun message.</p> }
            </div>
            @if (estAcheteur() || estVendeur()) {
              <div class="toolbar" style="margin-top:8px"><input style="flex:1" placeholder="Écrire un message…" [(ngModel)]="texte" (keyup.enter)="envoyer()" /><button (click)="envoyer()" [disabled]="!texte.trim()">Envoyer</button></div>
            }
          </div>

          <div class="card section">
            <h2>Historique</h2>
            <ul class="clean small">
              @for (h of c.historique; track $index) { <li><strong>{{ h.date }}</strong> — {{ libelle[h.statut] }} <span class="muted">par {{ h.parId | qui }}</span>@if (h.note) { · {{ h.note }} }</li> }
            </ul>
          </div>
        </div>

        <div class="card">
          <h2>Montants</h2>
          <div class="ligne"><span>Marchandise ({{ c.quantiteKg | nb }} kg × {{ c.prixKg | nb }} F)</span><span>{{ m.marchandise | fcfa }}</span></div>
          <div class="ligne"><span>Transport</span><span>{{ m.transport | fcfa }}</span></div>
          <div class="ligne"><span>Frais de service ({{ c.commissionPct }} %)</span><span>{{ m.commission | fcfa }}</span></div>
          <div class="ligne total"><span>Total acheteur</span><span>{{ m.total | fcfa }}</span></div>
          <div class="ligne"><span>Net versé au vendeur</span><span>{{ m.netVendeur | fcfa }}</span></div>
          @if (c.paiement; as p) {
            <div class="note green" style="margin-top:10px">Payé le {{ p.date }} par <strong>{{ p.operateur }}</strong> — réf. {{ p.reference }}<br />
              {{ c.statut === 'terminee' ? 'Fonds libérés au vendeur.' : 'Fonds en séquestre : libérés à la confirmation de réception.' }}</div>
          }
          <p class="small muted" style="margin-top:10px">{{ c.quantiteKg | enUnite: c.produitId }}</p>
          @if (c.source.type === 'offre') { <a class="small" [routerLink]="['/marche', c.source.id]">Voir l’offre d’origine →</a> }
        </div>
      </div>

      @if (modal()) {
        <div class="modal-fond" (click)="modal.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            @switch (modal()) {
              @case ('payer') {
                <h2>Payer {{ m.total | fcfa }}</h2>
                <p class="small muted">Le montant est bloqué sur un compte séquestre et versé au vendeur après votre confirmation de réception.</p>
                <div class="ops">
                  @for (o of operateurs; track o) { <button class="op" [class.on]="operateur === o" (click)="operateur = o">{{ o }}</button> }
                </div>
                @if (operateur !== 'Virement bancaire') {
                  <label class="field">Numéro Mobile Money<input type="tel" [(ngModel)]="numero" placeholder="+226 7• •• •• ••" /></label>
                  <p class="hint">Simulation : en production, une demande de confirmation est envoyée sur le téléphone (saisie du code secret sur le téléphone, jamais sur la plateforme).</p>
                } @else { <p class="small">Coordonnées du compte séquestre fournies par le backend.</p> }
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!operateur" (click)="payer()">Confirmer le paiement</button></div>
              }
              @case ('expedier') {
                <h2>Déclarer l’expédition</h2>
                <label class="field">Moyen / référence (camion, car, n° de colis…)<textarea rows="2" [(ngModel)]="note"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="expedier()">Confirmer</button></div>
              }
              @case ('litige') {
                <h2>Signaler un problème</h2>
                <label class="field">Motif<select [(ngModel)]="motif"><option>Qualité non conforme</option><option>Quantité manquante</option><option>Retard de livraison</option><option>Marchandise endommagée</option><option>Autre</option></select></label>
                <label class="field" style="margin-top:8px">Description (quantités, photos à joindre côté backend)<textarea rows="3" [(ngModel)]="note"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="danger" [disabled]="!note" (click)="litige()">Ouvrir le litige</button></div>
              }
              @case ('arbitrer') {
                <h2>Arbitrer le litige</h2>
                <p class="small">{{ c.litige?.description }}</p>
                <label class="field">Décision<textarea rows="3" [(ngModel)]="note" placeholder="Ex. réfaction de 10 % sur le prix, remboursement partiel…"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!note" (click)="arbitrer()">Clore le litige</button></div>
              }
              @case ('noter') {
                <h2>Noter votre partenaire</h2>
                <div class="ops">@for (n of [1, 2, 3, 4, 5]; track n) { <button class="op" [class.on]="noteEtoiles === n" (click)="noteEtoiles = n">{{ n }} ★</button> }</div>
                <label class="field">Commentaire<textarea rows="2" [(ngModel)]="note"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="noter()">Publier l’avis</button></div>
              }
            }
          </div>
        </div>
      }
    } @else { <div class="vide">Commande introuvable.</div> }
  </div>`,
  styles: `
    .big { font-size: 13px; padding: 4px 12px; }
    .etapes { display: flex; gap: 6px; justify-content: space-between; flex-wrap: wrap; }
    .etape { display: flex; align-items: center; gap: 8px; color: var(--muted); flex: 1 1 120px; }
    .rond { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-weight: 700; font-size: 12px; flex: none; }
    .etape.fait { color: var(--text); } .etape.fait .rond { background: var(--primary); color: #fff; }
    .etape.courant .rond { box-shadow: 0 0 0 4px var(--primary-soft); }
    .fil { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow: auto; }
    .msg { background: var(--surface-2); padding: 8px 10px; border-radius: 10px; max-width: 80%; }
    .msg.moi { align-self: flex-end; background: var(--primary-soft); }
    .ops { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
    .op.on { background: var(--primary); color: #fff; border-color: var(--primary); }
  `,
})
export class CommandeDetailPage {
  readonly id = input.required<string>();
  protected readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly libelle = LIBELLE_STATUT;
  protected readonly etapes = ETAPES;
  protected readonly operateurs: Operateur[] = ['Orange Money', 'Moov Money', 'Sank Money', 'Virement bancaire'];
  protected readonly modal = signal<'payer' | 'expedier' | 'litige' | 'arbitrer' | 'noter' | null>(null);
  protected operateur: Operateur = 'Orange Money';
  protected numero = '';
  protected note = '';
  protected motif = 'Qualité non conforme';
  protected noteEtoiles = 5;
  protected texte = '';

  protected readonly cmd = computed(() => this.pf.db.commandes.get(this.id()));
  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly estAcheteur = computed(() => this.cmd()?.acheteurId === this.moi());
  protected readonly estVendeur = computed(() => this.cmd()?.vendeurId === this.moi());
  protected readonly admin = computed(() => this.session.role() === 'admin');
  protected readonly dejaNote = computed(() => this.pf.db.avis.items().some((a) => a.commandeId === this.id() && a.auteurId === this.moi()));
  protected readonly rang = computed(() => {
    const s = this.cmd()!.statut;
    const hist = this.cmd()!.historique.map((h) => h.statut);
    if (s === 'litige' || s === 'annulee') return Math.max(...hist.map((x) => ETAPES.findIndex((e) => e.statut === x)));
    return ETAPES.findIndex((e) => e.statut === s);
  });

  protected readonly actionDisponible = computed(() => {
    const c = this.cmd()!;
    return (this.estAcheteur() && ['attente_paiement', 'expediee', 'livree'].includes(c.statut)) || (this.estVendeur() && c.statut === 'sequestre') ||
      (this.admin() && c.statut === 'litige') || (c.statut === 'terminee' && (this.estAcheteur() || this.estVendeur()) && !this.dejaNote());
  });

  attente() {
    const c = this.cmd()!;
    switch (c.statut) {
      case 'attente_paiement': return 'En attente du paiement de l’acheteur.';
      case 'sequestre': return 'Fonds sécurisés — en attente d’expédition par le vendeur.';
      case 'expediee': case 'livree': return 'En attente de la confirmation de réception par l’acheteur.';
      case 'litige': return 'Litige en cours d’arbitrage par la plateforme.';
      default: return 'Commande clôturée.';
    }
  }

  private fin(m: string) { this.modal.set(null); this.note = ''; this.toast.afficher(m); }

  async payer() { await this.pf.payer(this.cmd()!, this.operateur); this.fin('Paiement reçu et placé en séquestre.'); }
  async expedier() { await this.pf.expedier(this.cmd()!, this.note); this.fin('Expédition déclarée, l’acheteur est prévenu.'); }
  async recevoir() {
    if (!confirm('Confirmer que la marchandise est reçue et conforme ? Les fonds seront versés au vendeur.')) return;
    await this.pf.confirmerReception(this.cmd()!); this.fin('Réception confirmée, vendeur payé.');
  }
  async litige() { await this.pf.ouvrirLitige(this.cmd()!, this.motif, this.note); this.fin('Litige ouvert, fonds bloqués.'); }
  async arbitrer() { await this.pf.resoudreLitige(this.cmd()!, this.note); this.fin('Litige clos.'); }
  async noter() { await this.pf.noter(this.cmd()!, this.noteEtoiles as 1, this.note); this.fin('Merci pour votre avis.'); }
  async annuler() { if (confirm('Annuler cette commande ?')) { await this.pf.annuler(this.cmd()!); this.fin('Commande annulée.'); } }
  async transport() { await this.pf.demanderTransport(this.cmd()!); this.toast.afficher('Fret publié : les transporteurs sont alertés.'); }
  async envoyer() {
    if (!this.texte.trim()) return;
    await this.pf.message(this.cmd()!, this.texte.trim());
    this.texte = '';
  }
}
