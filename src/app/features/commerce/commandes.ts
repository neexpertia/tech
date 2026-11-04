import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LIBELLE_STATUT, PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';
import { ACHAT_UI } from '../../shared/achat-ui';
import { Commande } from '../../core/models';

@Component({
  selector: 'app-commandes',
  imports: [RouterLink, ...UI, ...ACHAT_UI],
  styles: `.pr { display: flex; gap: 8px; align-items: center; } .pr app-vignette ::ng-deep .vg { width: 34px; height: 34px; font-size: 18px; }`,
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>{{ admin() ? 'Toutes les commandes' : session.mode() === 'vente' ? 'Commandes reçues' : 'Mes achats' }}</h1>
      </div>
    </div>
    <div class="tabs">
      @for (t of onglets; track t.id) { <button [class.on]="onglet() === t.id" (click)="onglet.set(t.id)">{{ t.label }} ({{ compte(t.id) }})</button> }
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Référence</th><th>Produit</th><th>Sens</th><th>Partenaire</th><th class="num">Montant</th><th>Trajet</th><th>Statut</th><th>Prochaine étape</th></tr></thead>
        <tbody>
          @for (c of liste(); track c.id) {
            @let achat = c.acheteurId === moi();
            <tr>
              <td><a [routerLink]="['/commandes', c.id]"><strong>{{ c.reference }}</strong></a></td>
              <td><div class="pr"><app-vignette [produitId]="c.produitId" /><div>{{ c.produitId | prod }}<div class="small muted">{{ c.quantiteKg | qte }}</div></div></div></td>
              <td><span class="badge" [class.info]="achat" [class.ok]="!achat">{{ admin() ? '—' : achat ? 'Achat' : 'Vente' }}</span></td>
              <td class="small">{{ (achat ? c.vendeurId : c.acheteurId) | qui }}</td>
              <td class="num">{{ pf.montant(c).total | fcfa: true }}</td>
              <td class="small">{{ c.origineId | loc }} → {{ c.destinationId | loc }}</td>
              <td><span class="badge" [class.ok]="c.statut === 'terminee'" [class.ko]="c.statut === 'litige' || c.statut === 'annulee'"  [class.warn]="c.statut === 'attente_paiement' || c.statut === 'attente_confirmation'" [class.info]="['sequestre', 'expediee', 'livree'].includes(c.statut)">{{ libelle[c.statut] }}</span></td>
              <td class="small">@let a = action(c); @if (a.moi) { <a [routerLink]="['/commandes', c.id]"><strong>{{ a.texte }} →</strong></a> } @else { <span class="muted">{{ a.texte }}</span> }<div class="muted">{{ c.creeLe }}</div></td>
            </tr>
          } @empty { <tr><td colspan="8" class="vide">Aucune commande. <a routerLink="/marche">Parcourir le marché →</a></td></tr> }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class CommandesPage {
  protected readonly pf = inject(PlateformeService);
  protected readonly session = inject(SessionService);
  protected readonly libelle = LIBELLE_STATUT;
  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly admin = computed(() => this.session.role() === 'admin');
  protected readonly onglets = [
    { id: 'action', label: 'À faire' }, { id: 'cours', label: 'En cours' }, { id: 'terminees', label: 'Terminées' }, { id: 'litiges', label: 'Litiges' }, { id: 'toutes', label: 'Toutes' },
  ] as const;
  protected readonly onglet = signal<'action' | 'cours' | 'terminees' | 'litiges' | 'toutes'>('cours');

  private readonly miennes = computed(() =>
    this.pf.db.commandes.items().filter((c) => this.admin() || (this.session.role() === 'vendeur'
      ? (this.session.mode() === 'vente' ? c.vendeurId === this.moi() : c.acheteurId === this.moi())
      : c.acheteurId === this.moi() || c.vendeurId === this.moi())).sort((a, b) => b.creeLe.localeCompare(a.creeLe)),
  );
  private filtre(id: string) {
    return this.miennes().filter((c) =>
      id === 'action' ? this.action(c).moi : id === 'cours' ? !['terminee', 'annulee', 'litige'].includes(c.statut) : id === 'terminees' ? ['terminee', 'annulee'].includes(c.statut) : id === 'litiges' ? c.statut === 'litige' : true);
  }
  compte(id: string) { return this.filtre(id).length; }

  /** Ce qui reste à faire, et par qui. */
  action(c: Commande): { texte: string; moi: boolean } {
    const a = c.acheteurId === this.moi(), v = c.vendeurId === this.moi();
    switch (c.statut) {
      case 'attente_confirmation': return v ? { texte: 'Confirmer la disponibilité', moi: true } : { texte: 'Le vendeur confirme (24 h)', moi: false };
      case 'attente_paiement': return a ? { texte: 'Payer', moi: true } : { texte: 'Paiement attendu', moi: false };
      case 'sequestre': return v ? { texte: c.livraison ? 'Marquer le départ' : 'Organiser la livraison', moi: true } : { texte: c.livraison ? 'Départ prévu' : 'Livraison en préparation', moi: false };
      case 'expediee': return a ? { texte: 'Suivre la livraison', moi: true } : { texte: 'En route', moi: v };
      case 'livree': return a ? { texte: 'Confirmer la réception', moi: true } : { texte: 'Réception attendue', moi: false };
      case 'terminee': return (a || v) && !this.pf.db.avis.items().some((x) => x.commandeId === c.id && x.auteurId === this.moi()) ? { texte: 'Laisser un avis', moi: true } : { texte: 'Terminée', moi: false };
      case 'litige': return { texte: 'Arbitrage en cours', moi: this.admin() };
      default: return { texte: 'Annulée', moi: false };
    }
  }

  ngOnInit() { if (this.compte('action')) this.onglet.set('action'); }
  protected readonly liste = computed(() => this.filtre(this.onglet()));
}
