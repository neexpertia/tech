import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { LOCALITES, coutTransportKg, distanceKm } from '../../core/data/referentiel';
import { Conversation, MessageConv } from '../../core/models';
import { PlateformeService, heure, offreVisible } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

/** Messagerie par produit : chaque discussion est rattachée à une offre (avant, pendant et après l'achat). */
@Component({
  selector: 'app-messages',
  imports: [FormsModule, RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head">
      <h1>Messages</h1>
    </div>
    <div class="boite" [class.avec-fil]="!!conv()">
      <aside class="card liste">
        @for (c of achat.mesConversations(); track c.id) {
          @let dernier = c.messages.at(-1);
          <a class="conv" [class.on]="c.id === id()" [routerLink]="['/messages', c.id]">
            <app-vignette [produitId]="c.produitId" />
            <div class="t">
              <div class="l1"><strong>{{ c.produitId | prod }}</strong><span class="small muted">{{ quand(c.majLe) }}</span></div>
              <div class="small">{{ (c.acheteurId === moi() ? c.vendeurId : c.acheteurId) | qui }} <span class="badge">{{ c.acheteurId === moi() ? 'vendeur' : 'acheteur' }}</span></div>
              <div class="small muted apercu">{{ dernier ? apercu(dernier) : 'Nouvelle discussion' }}</div>
            </div>
            @if (achat.nonLus(c)) { <span class="pastille">{{ achat.nonLus(c) }}</span> }
          </a>
        } @empty { <p class="vide small">Aucune discussion. Sur une offre du <a routerLink="/marche">marché</a>, touchez « Discuter avec le vendeur ».</p> }
      </aside>

      <section class="card fil">
        @if (conv(); as c) {
          @let o = offre();
          <a class="small retour" routerLink="/messages">← Toutes les discussions</a>
          <div class="tete">
            <app-vignette [produitId]="c.produitId" />
            <div class="t">
              <strong>{{ c.produitId | prod }} · {{ (c.acheteurId === moi() ? c.vendeurId : c.acheteurId) | qui }}</strong>
              @if (o) { <div class="small muted">{{ o.prixKg | nb }} F/kg · {{ o.quantiteRestanteKg | qte }} · {{ o.localiteId | loc }} · @if (dispo()) { <app-fraicheur [offre]="o" /> } @else { <span class="badge ko">plus disponible</span> }</div> }
            </div>
            @if (o) { <a class="btn" [routerLink]="['/marche', o.id]">Voir l’offre</a> }
          </div>

          <div class="msgs" #zone>
            @for (m of c.messages; track m.id) {
              @switch (m.type) {
                @case ('systeme') { <div class="sys">{{ m.texte }}</div> }
                @case ('proposition') {
                  <div class="bulle prop" [class.moi]="m.auteurId === moi()">
                    <div class="small muted">Prix proposé · {{ m.auteurId | qui }} · {{ quand(m.date) }}</div>
                    <div class="pp"><strong>{{ m.proposition!.prixKg | nb }} F/kg</strong> × {{ m.proposition!.quantiteKg | qte }} = <strong>{{ m.proposition!.prixKg * m.proposition!.quantiteKg | fcfa }}</strong></div>
                    @if (o && m.proposition!.prixKg < o.prixKg) { <div class="small"><span class="badge ok">−{{ o.prixKg - m.proposition!.prixKg }} F/kg par rapport à l’offre</span></div> }
                    @switch (m.proposition!.statut) {
                      @case ('acceptee') { <div class="small"><span class="badge ok">Acceptée</span> @if (m.proposition!.commandeId) { <a [routerLink]="['/commandes', m.proposition!.commandeId]">Voir la commande →</a> }</div> }
                      @case ('refusee') { <div class="small"><span class="badge">Déclinée</span></div> }
                      @default {
                        @if (estAcheteur() && dispo()) {
                          @if (accepter() === m.id) {
                            <div class="form-grid" style="margin-top:8px">
                              <label class="field">Livrer à<select [(ngModel)]="destination">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
                              <label class="field"><span><input type="checkbox" [(ngModel)]="transport" /> Inclure le transport (≈ {{ transportEstime(m) | fcfa }})</span></label>
                            </div>
                            <div class="toolbar" style="margin-top:8px"><button class="primary" (click)="valider(c, m)">Commander à ce prix</button><button (click)="accepter.set(null)">Annuler</button></div>
                          } @else {
                            <div class="toolbar" style="margin-top:8px"><button class="primary" (click)="accepter.set(m.id)">Accepter et commander</button><button (click)="achat.refuserProposition(c, m.id)">Décliner</button></div>
                          }
                        } @else { <div class="small"><span class="badge warn">En attente de réponse</span></div> }
                      }
                    }
                  </div>
                }
                @default {
                  <div class="bulle" [class.moi]="m.auteurId === moi()" [class.oui]="m.type === 'reponse_dispo' && m.disponible" [class.non]="m.type === 'reponse_dispo' && m.disponible === false">
                    <div class="small muted">{{ m.auteurId | qui }} · {{ quand(m.date) }}</div>
                    {{ m.texte }}
                    @if (m.type === 'question_dispo' && estVendeur() && !repondu(m)) {
                      <div class="toolbar" style="margin-top:8px">
                        <button class="primary" (click)="repondre(c, true)">Oui, je l’ai</button>
                        <button class="danger" (click)="repondre(c, false)">Je ne l’ai plus</button>
                      </div>
                    }
                  </div>
                }
              }
            } @empty { <p class="muted small sys">Écrivez votre premier message ou utilisez une question rapide ci-dessous.</p> }
          </div>

          <div class="rapides chips">
            @if (estAcheteur()) {
              <button class="chip" (click)="achat.demanderDisponibilite(c)">Est-ce toujours disponible ?</button>
              <button class="chip" (click)="texte = 'Quel est votre meilleur prix pour ' + (o?.quantiteRestanteKg && o!.quantiteRestanteKg > 500 ? '500 kg' : 'cette quantité') + ' ?'">Meilleur prix ?</button>
              <button class="chip" (click)="texte = 'Pouvez-vous expédier à ' + maVille() + ' ? Par quel moyen et en combien de temps ?'">Livraison à {{ maVille() }} ?</button>
              <button class="chip" (click)="texte = 'Pouvez-vous m’envoyer une photo du lot ?'">Photo du lot</button>
            } @else if (estVendeur()) {
              <button class="chip" (click)="proposer.set(!proposer())">Proposer un prix</button>
              @if (o) { <button class="chip" (click)="repondre(c, true)">J’ai encore le produit</button> }
            }
          </div>
          @if (proposer()) {
            <div class="form-grid propo">
              <label class="field">Prix (F/kg)<input type="number" min="1" [(ngModel)]="prixProp" /></label>
              <label class="field">Quantité (kg)<input type="number" min="1" [(ngModel)]="qteProp" /></label>
              <div class="actions" style="align-self:end;margin:0"><button class="primary" [disabled]="!prixProp || !qteProp" (click)="envoyerProposition(c)">Envoyer la proposition</button></div>
            </div>
          }
          <div class="saisie">
            <input placeholder="Écrire un message…" [(ngModel)]="texte" (keyup.enter)="envoyer(c)" aria-label="Message" />
            <button class="primary" [disabled]="!texte.trim()" (click)="envoyer(c)">Envoyer</button>
          </div>
        } @else {
          <div class="vide">Choisissez une discussion.</div>
        }
      </section>
    </div>
  </div>`,
  styles: `
    .boite { display: grid; grid-template-columns: 320px 1fr; gap: 14px; align-items: start; }
    .liste { padding: 6px; max-height: calc(100vh - 200px); overflow: auto; }
    .conv { display: flex; gap: 10px; align-items: center; padding: 10px; border-radius: 10px; text-decoration: none; color: var(--text); position: relative; }
    .conv:hover { background: var(--surface-2); } .conv.on { background: var(--primary-soft); }
    .conv .t { flex: 1; min-width: 0; } .l1 { display: flex; justify-content: space-between; gap: 6px; }
    .apercu { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pastille { background: var(--vert); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 0 7px; line-height: 18px; }
    .fil { display: flex; flex-direction: column; min-height: 520px; }
    .retour { display: none; }
    .tete { display: flex; gap: 10px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
    .tete .t { flex: 1; min-width: 0; }
    .msgs { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 12px 0; overflow: auto; max-height: 52vh; }
    .bulle { background: var(--surface-2); padding: 8px 12px; border-radius: 12px; max-width: 78%; align-self: flex-start; }
    .bulle.moi { align-self: flex-end; background: var(--primary-soft); }
    .bulle.oui { border-left: 3px solid var(--primary); } .bulle.non { border-left: 3px solid var(--danger); }
    .bulle.prop { border: 1px solid var(--vert); background: var(--blanc); }
    .pp { font-size: 15px; margin: 4px 0; }
    .sys { align-self: center; font-size: 12px; color: var(--muted); background: var(--surface-2); padding: 3px 10px; border-radius: 999px; }
    .rapides { margin: 6px 0; }
    .propo { background: var(--surface-2); padding: 10px; border-radius: 10px; margin-bottom: 8px; }
    .saisie { display: flex; gap: 8px; } .saisie input { flex: 1; padding: 9px 12px; }
    @media (max-width: 860px) {
      .boite { grid-template-columns: 1fr; }
      .boite.avec-fil .liste { display: none; }
      .boite:not(.avec-fil) .fil { display: none; }
      .retour { display: inline-block; margin-bottom: 8px; }
      .bulle { max-width: 92%; }
    }
  `,
})
export class MessagesPage {
  readonly id = input<string>();
  protected readonly achat = inject(AchatService);
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;

  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly conv = computed(() => (this.id() ? this.pf.db.conversations.get(this.id()!) : undefined));
  protected readonly offre = computed(() => (this.conv() ? this.pf.db.offres.get(this.conv()!.offreId) : undefined));
  protected readonly dispo = computed(() => !!this.offre() && offreVisible(this.offre()!));
  protected readonly estAcheteur = computed(() => this.conv()?.acheteurId === this.moi());
  protected readonly estVendeur = computed(() => this.conv()?.vendeurId === this.moi());
  protected readonly maVille = computed(() => (this.session.utilisateur()?.localiteId ? LOCALITES.find((l) => l.id === this.session.utilisateur()!.localiteId)!.nom.split(' (')[0] : 'Ouagadougou'));

  protected readonly accepter = signal<string | null>(null);
  protected readonly proposer = signal(false);
  protected texte = '';
  protected prixProp = 0;
  protected qteProp = 0;
  protected destination = this.session.utilisateur()?.localiteId ?? 'OUA';
  protected transport = true;

  constructor() {
    effect(() => { const c = this.conv(); if (c) this.achat.marquerLu(c); });
    effect(() => { const o = this.offre(); if (o) { this.prixProp = o.prixKg; this.qteProp = Math.min(o.quantiteRestanteKg, 500); } });
  }

  quand(iso: string) {
    const d = new Date(iso);
    return new Date().toDateString() === d.toDateString() ? heure(iso) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  apercu(m: MessageConv) { return (m.auteurId === this.moi() ? 'Vous : ' : '') + (m.type === 'proposition' ? `Prix proposé : ${m.proposition!.prixKg} F/kg` : m.texte); }
  repondu(q: MessageConv) { const c = this.conv()!; const i = c.messages.indexOf(q); return c.messages.slice(i + 1).some((m) => m.type === 'reponse_dispo'); }
  transportEstime(m: MessageConv) { const o = this.offre(); return o ? coutTransportKg(distanceKm(o.localiteId, this.destination)) * m.proposition!.quantiteKg : 0; }

  async envoyer(c: Conversation) {
    if (!this.texte.trim()) return;
    await this.achat.envoyer(c, this.texte.trim());
    this.texte = '';
  }
  async repondre(c: Conversation, oui: boolean) {
    await this.achat.repondreDisponibilite(c, oui);
    this.toast.afficher(oui ? 'Réponse envoyée, stock reconfirmé sur l’offre.' : 'Réponse envoyée, offre marquée épuisée.');
  }
  async envoyerProposition(c: Conversation) {
    await this.achat.proposer(c, +this.prixProp, +this.qteProp);
    this.proposer.set(false);
    this.toast.afficher('Proposition envoyée : l’acheteur peut l’accepter en un clic.');
  }
  async valider(c: Conversation, m: MessageConv) {
    try {
      const cmd = await this.achat.accepterProposition(c, m.id, this.destination, this.transport);
      this.toast.afficher(`Commande ${cmd.reference} émise au prix négocié. Vous pouvez payer.`);
      this.router.navigate(['/commandes', cmd.id]);
    } catch (e) { this.toast.afficher((e as Error).message); }
  }
}
