import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService, SEUIL_KYC_ACHAT } from '../../core/achat.service';
import { COMMISSION_PCT, DELAI_CONFIRMATION_H, LOCALITES, coutTransportKg, distanceKm } from '../../core/data/referentiel';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

/** Panier multi-vendeurs : une commande est émise par lot, chaque vendeur confirme sa disponibilité. */
@Component({
  selector: 'app-panier',
  imports: [FormsModule, RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Panier</h1><p>Chaque vendeur confirme sous {{ delai }} h. Vous payez ensuite.</p></div>
    </div>
    @if (achat.panier().length) {
      <div class="split">
        <div class="card">
          @for (x of achat.panier(); track x.l.id) {
            <div class="ligne-p" [class.ko]="!x.valide">
              <app-vignette [produitId]="x.o?.produitId ?? ''" />
              <div class="info">
                @if (x.o; as o) {
                  <a [routerLink]="['/marche', o.id]"><strong>{{ o.produitId | prod }}</strong></a> · {{ o.prixKg | nb }} F/kg
                  <div class="small muted">{{ o.vendeurId | qui }} · {{ o.localiteId | loc }} · <app-fraicheur [offre]="o" /></div>
                  @if (!x.valide) { <div class="small" style="color:var(--danger)">{{ o.quantiteRestanteKg <= 0 || o.statut !== 'active' ? 'Plus disponible' : x.l.quantiteKg > o.quantiteRestanteKg ? 'Quantité supérieure au disponible (' + (o.quantiteRestanteKg | qte) + ')' : 'Non commandable' }}</div> }
                } @else { <strong>Offre supprimée</strong> }
              </div>
              <label class="q"><input type="number" min="1" [ngModel]="x.l.quantiteKg" (change)="modifier(x.l.id, $event)" /> kg</label>
              <span class="num"><strong>{{ x.sousTotal | fcfa }}</strong></span>
              <button class="ghost" (click)="achat.retirerLigne(x.l.id)" aria-label="Retirer">✕</button>
            </div>
          }
        </div>
        <div class="card collant">
          <h2>Récapitulatif</h2>
          <div class="form-grid">
            <label class="field full">Livrer à<select [ngModel]="destination()" (ngModelChange)="destination.set($event)">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
            <label class="field full"><span><input type="checkbox" [ngModel]="transport()" (ngModelChange)="transport.set($event)" /> Inclure le transport</span></label>
          </div>
          @let t = totaux();
          <div style="margin-top:10px">
            <div class="ligne"><span>Marchandise ({{ t.n }} lot{{ t.n > 1 ? 's' : '' }})</span><span>{{ t.marchandise | fcfa }}</span></div>
            <div class="ligne"><span>Transport estimé</span><span>{{ t.transport | fcfa }}</span></div>
            <div class="ligne"><span>Frais de service ({{ commission }} %)</span><span>{{ t.commission | fcfa }}</span></div>
            <div class="ligne total"><span>Total estimé</span><span>{{ t.total | fcfa }}</span></div>
          </div>
          @if (t.vendeurs > 1) { <p class="hint">{{ t.vendeurs }} vendeurs : {{ t.n }} commandes séparées, payées une par une après confirmation.</p> }
          @if (kyc()) { <p class="note">Au-delà de {{ seuil | fcfa }}, votre identité doit être vérifiée. <a routerLink="/profil">Ajouter une pièce →</a></p> }
          <button class="primary large" [disabled]="!t.n || kyc()" (click)="commander()">Émettre {{ t.n > 1 ? 'les ' + t.n + ' commandes' : 'la commande' }}</button>
          <p class="hint">Rien n’est débité maintenant. Vous payez chaque commande par Mobile Money une fois la disponibilité confirmée.</p>
        </div>
      </div>
    } @else {
      <div class="card vide">Votre panier est vide. <a routerLink="/marche">Parcourir le marché →</a> @if (achat.mesFavoris().length) { ou <a routerLink="/favoris">vos favoris</a> }</div>
    }
  </div>`,
  styles: `
    .ligne-p { display: grid; grid-template-columns: 44px 1fr auto 110px 32px; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--border); }
    .ligne-p:last-child { border-bottom: 0; }
    .ligne-p.ko { opacity: .7; }
    .info { min-width: 0; }
    .q input { width: 90px; }
    .collant { position: sticky; top: 70px; }
    .large { width: 100%; justify-content: center; padding: 10px; margin-top: 12px; font-size: 15px; }
    @media (max-width: 640px) { .ligne-p { grid-template-columns: 44px 1fr 32px; } .ligne-p .q, .ligne-p .num { grid-column: 2; } }
  `,
})
export class PanierPage {
  protected readonly achat = inject(AchatService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly localites = LOCALITES;
  protected readonly commission = COMMISSION_PCT;
  protected readonly delai = DELAI_CONFIRMATION_H;
  protected readonly seuil = SEUIL_KYC_ACHAT;
  protected readonly destination = signal(this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly transport = signal(true);

  protected readonly totaux = computed(() => {
    const v = this.achat.panier().filter((x) => x.valide);
    const marchandise = v.reduce((s, x) => s + x.sousTotal, 0);
    const transport = this.transport() ? v.reduce((s, x) => s + coutTransportKg(distanceKm(x.o!.localiteId, this.destination())) * x.l.quantiteKg, 0) : 0;
    const commission = Math.round((marchandise * COMMISSION_PCT) / 100);
    return { n: v.length, vendeurs: new Set(v.map((x) => x.o!.vendeurId)).size, marchandise, transport, commission, total: marchandise + transport + commission };
  });
  protected readonly kyc = computed(() => this.totaux().total > SEUIL_KYC_ACHAT && this.session.utilisateur()?.kyc !== 'verifie');

  modifier(id: string, e: Event) { const v = +(e.target as HTMLInputElement).value; if (v > 0) this.achat.modifierLigne(id, v); }

  async commander() {
    const cmds = await this.achat.commanderPanier(this.destination(), this.transport());
    this.toast.afficher(`${cmds.length} commande(s) émise(s) : quantités réservées, les vendeurs confirment sous ${DELAI_CONFIRMATION_H} h.`);
    this.router.navigate(cmds.length === 1 ? ['/commandes', cmds[0].id] : ['/commandes']);
  }
}
