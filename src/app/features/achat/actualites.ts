import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { CategorieActu } from '../../core/models';
import { produit } from '../../core/data/referentiel';

const ICONE: Record<CategorieActu, string> = { Prix: '', Saison: '', Routes: '', Marché: '', Conseil: '', Plateforme: '' };

/** Actualités agricoles triées par pertinence pour l'utilisateur (produits suivis, région, trajets). */
@Component({
  selector: 'app-actualites',
  imports: [RouterLink],
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Actualités</h1><p>Choisies d’après les produits que vous suivez et votre région.</p></div>
    </div>
    <div class="chips" style="margin:10px 0 14px">
      <button class="chip" [class.on]="!cat()" (click)="cat.set(null)">Tout</button>
      @for (c of cats; track c) { <button class="chip" [class.on]="cat() === c" (click)="cat.set(c)">{{ c }}</button> }
    </div>
    <div class="grid g2">
      @for (a of liste(); track a.id) {
        <article class="card actu" [class.une]="$first && !cat()">
          <div class="haut"><span class="cat-a">{{ a.categorie }}</span><span class="small muted">{{ a.date }}</span></div>
          <h3>{{ a.titre }}</h3>
          <p class="small">{{ a.resume }}</p>
          <div class="pied small muted">
            <span>{{ a.pourquoi ?? '' }}</span>
            @if (a.lien) { <a [routerLink]="lien(a.lien).path" [queryParams]="lien(a.lien).query">Voir</a> }
          </div>
        </article>
      } @empty { <div class="card vide">Aucune actualité pour le moment.</div> }
    </div>
  </div>`,
  styles: `
    .actu { display: flex; flex-direction: column; gap: 6px; }
    .cat-a { font-size: var(--t-s); color: var(--vert); font-weight: 600; }
    .actu.une { grid-column: 1 / -1; }
    .actu.une h3 { font-size: var(--t-l); }
    .haut { display: flex; justify-content: space-between; align-items: center; }
    .pied { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; flex-wrap: wrap; }
  `,
})
export class ActualitesPage {
  private readonly achat = inject(AchatService);
  protected readonly icone = ICONE;
  protected readonly cats = Object.keys(ICONE) as CategorieActu[];
  protected readonly cat = signal<CategorieActu | null>(null);
  protected readonly liste = computed(() => this.achat.actualites().filter((a) => !this.cat() || a.categorie === this.cat()));
  protected readonly interets = computed(() => [...this.achat.interets().keys()].map((p) => produit(p).nom));
  lien(l: string) { const [path, q] = l.split('?'); return { path, query: q ? Object.fromEntries(new URLSearchParams(q)) : {} }; }
}
