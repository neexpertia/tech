import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-favoris',
  imports: [RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <div class="page-head"><h1>Favoris</h1><a class="btn" routerLink="/alertes">Mes alertes</a></div>
    <p class="muted">Vous êtes prévenu si le prix baisse ou si le produit revient.</p>
    <div class="grille">
      @for (x of achat.mesFavoris(); track x.f.id) { <app-carte-offre [offre]="x.o" /> }
      @empty { <div class="vide">Touchez le cœur d’un produit pour le retrouver ici. <a routerLink="/marche">Voir le marché</a></div> }
    </div>
  </div>`,
  styles: `.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px; }`,
})
export class FavorisPage {
  protected readonly achat = inject(AchatService);
}
