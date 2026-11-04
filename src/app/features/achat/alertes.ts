import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { LOCALITES, PRODUITS } from '../../core/data/referentiel';
import { Notification, Qualite, TypeNotification } from '../../core/models';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

const ICONES: Record<TypeNotification, string> = { commande: 'commandes', livraison: 'camion', paiement: 'argent', message: 'messages', favori: 'favori', alerte: 'alertes', compte: 'carteid', autre: 'alertes' };
const FILTRES: { id: 'tout' | TypeNotification | 'suivi'; label: string }[] = [
  { id: 'tout', label: 'Tout' }, { id: 'commande', label: 'Commandes' }, { id: 'suivi', label: 'Livraison & paiement' }, { id: 'message', label: 'Messages' }, { id: 'alerte', label: 'Alertes & favoris' },
];

/** Alertes : notifications (commandes, livraisons, messages…) et alertes produits personnalisées. */
@Component({
  selector: 'app-alertes',
  imports: [FormsModule, RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head">
      <h1>Alertes</h1>
      @if (pf.nonLues()) { <button (click)="pf.toutLire()">Tout marquer comme lu</button> }
    </div>
    <div class="split">
      <div class="card">
        <div class="chips" style="margin-bottom:10px">@for (f of filtres; track f.id) { <button class="chip" [class.on]="filtre() === f.id" (click)="filtre.set(f.id)">{{ f.label }}</button> }</div>
        <ul class="clean">
          @for (n of liste(); track n.id) {
            <li class="notif" [class.nonlu]="!n.lu" (click)="ouvrir(n)">
              <app-ic class="ic" [n]="icone(n)" [taille]="18" /><span class="t">{{ n.texte }}</span><span class="small muted">{{ n.date }}</span>
            </li>
          } @empty { <li class="vide">Aucune notification.</li> }
        </ul>
      </div>
      @if (session.peutAcheter()) {
        <div>
          <div class="card">
            <h2>Me prévenir quand…</h2>
            <ul class="clean">
              @for (a of achat.mesAlertes(); track a.id) {
                @let n = achat.correspondances(a).length;
                <li class="al" [class.off]="!a.active">
                  <div class="t"><strong>{{ a.produitId | prod }}</strong>@if (a.prixMaxKg) { ≤ {{ a.prixMaxKg }} F/kg }@if (a.qualiteMin) { · {{ a.qualiteMin | qualite }} ou mieux }
                    <div class="small muted">{{ a.rayonKm ? 'à moins de ' + a.rayonKm + ' km de ' + (a.localiteId | loc) : 'tout le pays' }}</div>
                    @if (n) { <a class="small" routerLink="/marche" [queryParams]="{ produit: a.produitId }">{{ n }} offre(s) correspondent maintenant →</a> }</div>
                  <button class="ghost small" (click)="achat.basculerAlerte(a)">{{ a.active ? 'Pause' : 'Activer' }}</button>
                  <button class="ghost small" (click)="achat.supprimerAlerte(a.id)" aria-label="Supprimer">✕</button>
                </li>
              } @empty { <li class="muted small">Aucune alerte.</li> }
            </ul>
            <h3 class="section">Nouvelle alerte</h3>
            <div class="form-grid">
              <label class="field">Produit<select [(ngModel)]="f.produitId">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select></label>
              <label class="field">Prix max (F/kg)<input type="number" min="0" [(ngModel)]="f.prixMaxKg" placeholder="optionnel" /></label>
              <label class="field">Qualité minimale<select [(ngModel)]="f.qualiteMin"><option value="">Indifférent</option><option value="A">Premier choix</option><option value="B">Bonne qualité ou mieux</option></select></label>
              <label class="field">Distance max<select [(ngModel)]="f.rayonKm"><option [ngValue]="0">Tout le pays</option><option [ngValue]="100">100 km</option><option [ngValue]="250">250 km</option><option [ngValue]="400">400 km</option></select></label>
              <label class="field full">Autour de<select [(ngModel)]="f.localiteId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
            </div>
            <div class="actions"><button class="primary" (click)="creer()">Créer l’alerte</button></div>
          </div>

        </div>
      }
    </div>
  </div>`,
  styles: `
    .notif { display: flex; gap: 10px; align-items: center; cursor: pointer; }
    .notif:hover .t { text-decoration: underline; }
    .ic { color: var(--gris); } .nonlu .ic { color: var(--vert); }
    .t { flex: 1; min-width: 0; }
    .nonlu .t { font-weight: 600; } .nonlu .ic { filter: none; }
    .al { display: flex; gap: 8px; align-items: center; } .al.off { opacity: .55; }
  `,
})
export class AlertesPage {
  readonly produit = input<string>();
  protected readonly pf = inject(PlateformeService);
  protected readonly achat = inject(AchatService);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly filtres = FILTRES;
  protected readonly filtre = signal<(typeof FILTRES)[number]['id']>('tout');
  protected f = { produitId: PRODUITS[0].id, prixMaxKg: undefined as number | undefined, qualiteMin: '' as '' | Qualite, rayonKm: 0, localiteId: this.session.utilisateur()?.localiteId ?? 'OUA' };

  ngOnInit() { const p = this.produit(); if (p) this.f.produitId = p; }

  protected readonly liste = computed(() => {
    const f = this.filtre();
    return this.pf.mesNotifications().filter((n) => f === 'tout' || (f === 'suivi' ? ['livraison', 'paiement'].includes(n.type ?? '') : f === 'alerte' ? ['alerte', 'favori'].includes(n.type ?? '') : n.type === f));
  });
  icone(n: Notification) { return ICONES[n.type ?? 'autre']; }

  async ouvrir(n: Notification) {
    if (!n.lu) await this.pf.db.notifications.update(n.id, { lu: true });
    if (n.lien) this.router.navigateByUrl(n.lien);
  }

  async creer() {
    await this.achat.creerAlerte({ produitId: this.f.produitId, prixMaxKg: this.f.prixMaxKg || undefined, qualiteMin: this.f.qualiteMin || undefined, rayonKm: this.f.rayonKm || undefined, localiteId: this.f.localiteId });
    this.toast.afficher('Alerte créée : vous serez prévenu dès qu’une offre correspond.');
  }
}
