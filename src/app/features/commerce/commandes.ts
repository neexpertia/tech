import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LIBELLE_STATUT, PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-commandes',
  imports: [RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Suivi</div><h1>{{ admin() ? 'Toutes les commandes' : 'Mes commandes' }}</h1>
        <p>Chaque commande suit le même parcours : paiement en séquestre → expédition → réception confirmée → fonds libérés.</p></div>
    </div>
    <div class="tabs">
      @for (t of onglets; track t.id) { <button [class.on]="onglet() === t.id" (click)="onglet.set(t.id)">{{ t.label }} ({{ compte(t.id) }})</button> }
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Référence</th><th>Produit</th><th>Sens</th><th>Partenaire</th><th class="num">Montant</th><th>Trajet</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>
          @for (c of liste(); track c.id) {
            @let achat = c.acheteurId === moi();
            <tr>
              <td><a [routerLink]="['/commandes', c.id]"><strong>{{ c.reference }}</strong></a></td>
              <td>{{ c.produitId | prod }}<div class="small muted">{{ c.quantiteKg | qte }}</div></td>
              <td><span class="badge" [class.info]="achat" [class.ok]="!achat">{{ admin() ? '—' : achat ? 'Achat' : 'Vente' }}</span></td>
              <td class="small">{{ (achat ? c.vendeurId : c.acheteurId) | qui }}</td>
              <td class="num">{{ pf.montant(c).total | fcfa: true }}</td>
              <td class="small">{{ c.origineId | loc }} → {{ c.destinationId | loc }}</td>
              <td><span class="badge" [class.ok]="c.statut === 'terminee'" [class.ko]="c.statut === 'litige' || c.statut === 'annulee'" [class.warn]="c.statut === 'attente_paiement'" [class.info]="['sequestre', 'expediee', 'livree'].includes(c.statut)">{{ libelle[c.statut] }}</span></td>
              <td class="small">{{ c.creeLe }}</td>
            </tr>
          } @empty { <tr><td colspan="8" class="vide">Aucune commande. <a routerLink="/marche">Parcourir le marché →</a></td></tr> }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class CommandesPage {
  protected readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  protected readonly libelle = LIBELLE_STATUT;
  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly admin = computed(() => this.session.role() === 'admin');
  protected readonly onglets = [
    { id: 'cours', label: 'En cours' }, { id: 'terminees', label: 'Terminées' }, { id: 'litiges', label: 'Litiges' }, { id: 'toutes', label: 'Toutes' },
  ] as const;
  protected readonly onglet = signal<'cours' | 'terminees' | 'litiges' | 'toutes'>('cours');

  private readonly miennes = computed(() =>
    this.pf.db.commandes.items().filter((c) => this.admin() || c.acheteurId === this.moi() || c.vendeurId === this.moi()).sort((a, b) => b.creeLe.localeCompare(a.creeLe)),
  );
  private filtre(id: string) {
    return this.miennes().filter((c) =>
      id === 'cours' ? !['terminee', 'annulee', 'litige'].includes(c.statut) : id === 'terminees' ? ['terminee', 'annulee'].includes(c.statut) : id === 'litiges' ? c.statut === 'litige' : true);
  }
  compte(id: string) { return this.filtre(id).length; }
  protected readonly liste = computed(() => this.filtre(this.onglet()));
}
