import { Component, ElementRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AchatService } from '../core/achat.service';
import { localite, produit } from '../core/data/referentiel';
import { Offre } from '../core/models';
import { PlateformeService, fraicheur } from '../core/plateforme.service';
import { SessionService } from '../core/session.service';
import { IconeComponent } from './icone';
import { ToastService } from './toast';

/** Visuel produit : le pictogramme tient lieu de photo, sur un fond unique (pas de couleur par filière). */
export const VISUEL: Record<string, { ic: string }> = {
  mais: { ic: '🌽' }, sesame: { ic: '🌾' }, riz: { ic: '🍚' }, niebe: { ic: '🫘' }, arachide: { ic: '🥜' }, oignon: { ic: '🧅' }, soja: { ic: '🫛' },
};
export const visuel = (produitId: string) => ({ ic: VISUEL[produitId]?.ic ?? '🧺', bg: 'var(--surface-2)' });

@Component({
  selector: 'app-vignette',
  template: `<span class="vg" [class.grand]="grand()" aria-hidden="true">{{ v().ic }}</span>`,
  styles: `.vg { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; font-size: 24px; flex: none; background: var(--surface-2); }
    .vg.grand { width: 100%; height: 132px; border-radius: 0; font-size: 56px; }`,
})
export class VignetteComponent {
  readonly produitId = input.required<string>();
  readonly grand = input(false);
  protected readonly v = computed(() => visuel(this.produitId()));
}

/** Point + texte court : depuis quand le vendeur a confirmé avoir le produit. */
@Component({
  selector: 'app-fraicheur',
  template: `@let f = info();
    <span class="fr" [class.ok]="f.niveau === 'confirme' || f.niveau === 'recent'" [class.ko]="f.niveau === 'masque'" title="Date à laquelle le vendeur a dit qu’il avait encore ce produit."><i></i>{{ f.libelle }}</span>`,
  styles: `.fr { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-s); color: var(--gris); }
    i { width: 7px; height: 7px; border-radius: 50%; background: var(--gris); flex: none; }
    .ok i { background: var(--vert); } .ko { color: var(--rouge); } .ko i { background: var(--rouge); }`,
})
export class FraicheurComponent {
  readonly offre = input.required<Offre>();
  protected readonly info = computed(() => fraicheur(this.offre()));
}

/** Bouton favori (cœur au trait, plein quand actif). */
@Component({
  selector: 'app-coeur',
  imports: [IconeComponent],
  template: `<button type="button" class="coeur" [class.on]="on()" [attr.aria-pressed]="on()" [attr.aria-label]="on() ? 'Retirer des favoris' : 'Ajouter aux favoris'" (click)="basculer($event)"><app-ic n="favori" [taille]="18" /></button>`,
  styles: `.coeur { border-radius: 999px; width: 36px; height: 36px; padding: 0; justify-content: center; background: var(--blanc); color: var(--gris); }
    .coeur.on { color: var(--vert); border-color: var(--vert); }
    .coeur.on ::ng-deep path { fill: currentColor; }`,
})
export class CoeurComponent {
  readonly offre = input.required<Offre>();
  private readonly achat = inject(AchatService);
  private readonly toast = inject(ToastService);
  protected readonly on = computed(() => this.achat.estFavori(this.offre().id));
  async basculer(e: Event) {
    e.preventDefault(); e.stopPropagation();
    const ajoute = await this.achat.basculerFavori(this.offre());
    this.toast.afficher(ajoute ? 'Ajouté aux favoris.' : 'Retiré des favoris.');
  }
}

/**
 * Actions sur un produit : favori (toujours visible), et un menu « ⋯ » avec deux choix : Partager, Masquer.
 * Partager ouvre le partage du téléphone (WhatsApp, SMS…) ; sur ordinateur, le lien est copié.
 */
@Component({
  selector: 'app-actions-offre',
  imports: [IconeComponent, CoeurComponent],
  template: `
    <div class="actions-o" (click)="$event.preventDefault(); $event.stopPropagation()">
      <app-coeur [offre]="offre()" />
      <button type="button" class="rond" aria-label="Plus d’actions" [attr.aria-expanded]="ouvert()" (click)="ouvert.set(!ouvert())"><app-ic n="points" [taille]="20" /></button>
      @if (ouvert()) {
        <div class="menu" role="menu">
          <button role="menuitem" (click)="partager()"><app-ic n="partager" [taille]="18" />Partager</button>
          @if (masque()) {
            <button role="menuitem" (click)="demasquer()"><app-ic n="oeil" [taille]="18" />Ne plus masquer</button>
          } @else {
            <button role="menuitem" (click)="masquer()"><app-ic n="masquer" [taille]="18" />Masquer ce produit</button>
          }
        </div>
      }
    </div>`,
  styles: `
    .actions-o { position: relative; display: flex; gap: 6px; }
    .rond { border-radius: 999px; width: 36px; height: 36px; padding: 0; justify-content: center; background: var(--blanc); color: var(--gris); }
    .menu { position: absolute; right: 0; top: 42px; z-index: 20; min-width: 190px; background: var(--blanc); border: 1px solid var(--ligne); border-radius: 12px; padding: 6px; box-shadow: 0 12px 32px rgba(20, 40, 30, .14); display: flex; flex-direction: column; }
    .menu button, .menu a { display: flex; align-items: center; gap: 10px; border: 0; background: transparent; padding: 9px 10px; border-radius: 8px; color: var(--encre); font-weight: 400; text-decoration: none; text-align: left; }
    .menu button:hover, .menu a:hover { background: var(--surface-2); }
    .menu app-ic { color: var(--gris); }
    hr { border: 0; border-top: 1px solid var(--ligne); margin: 4px 0; }
  `,
})
export class ActionsOffreComponent {
  readonly offre = input.required<Offre>();
  private readonly achat = inject(AchatService);
  private readonly pf = inject(PlateformeService);
  private readonly toast = inject(ToastService);
  private readonly el = inject(ElementRef);
  protected readonly ouvert = signal(false);
  protected readonly masque = computed(() => this.achat.estMasque(this.offre().id));

  @HostListener('document:click', ['$event'])
  fermer(e: Event) { if (!this.el.nativeElement.contains(e.target)) this.ouvert.set(false); }

  private lien() { return `${location.origin}/decouvrir/marche/${this.offre().id}`; }
  private texte() {
    const o = this.offre();
    return `${produit(o.produitId).nom} à ${o.prixKg} F/kg, ${localiteNom(o.localiteId)} (${this.pf.nom(o.vendeurId)}) sur FasoAgri`;
  }

  async partager() {
    this.ouvert.set(false);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ title: 'FasoAgri', text: this.texte(), url: this.lien() }); return; } catch { return; } }
    await this.copier();
  }
  async copier() {
    this.ouvert.set(false);
    try { await navigator.clipboard.writeText(this.lien()); this.toast.afficher('Lien copié : collez-le dans WhatsApp ou un SMS.'); } catch { this.toast.afficher(this.lien()); }
  }
  async masquer() {
    this.ouvert.set(false);
    const id = this.offre().id;
    await this.achat.masquer(id);
    this.toast.afficher('Produit masqué. Vous ne le verrez plus dans vos listes.', { label: 'Annuler', fn: () => this.achat.demasquer(id) });
  }
  async demasquer() {
    this.ouvert.set(false);
    await this.achat.demasquer(this.offre().id);
    this.toast.afficher('Le produit apparaît de nouveau.');
  }
}

/**
 * Carte produit unique pour tout l'espace acheteur (accueil, marché, favoris) :
 * image, prix livré chez vous, vendeur et lieu, disponibilité. Rien d'autre.
 */
@Component({
  selector: 'app-carte-offre',
  imports: [RouterLink, VignetteComponent, FraicheurComponent, ActionsOffreComponent],
  template: `@let o = offre();
    <a class="carte" [routerLink]="[base(), o.id]">
      <div class="img"><app-vignette [produitId]="o.produitId" [grand]="true" />
        @if (economie() > 0) { <span class="eco">−{{ economie() }} %</span> }
        @if (connecte() && !aMoi()) { <span class="fav"><app-actions-offre [offre]="o" /></span> }</div>
      <div class="corps">
        <div class="nom">{{ nom() }}</div>
        <div class="prix">{{ prixLivre() }} F<span>/kg livré</span></div>
        <div class="qui">{{ vendeur() }}, {{ ville() }}</div>
        <app-fraicheur [offre]="o" />
      </div>
    </a>`,
  styles: `
    :host { display: block; }
    .carte { display: flex; flex-direction: column; height: 100%; background: var(--blanc); border: 1px solid var(--ligne); border-radius: var(--radius); color: inherit; text-decoration: none; }
    .img { border-radius: var(--radius) var(--radius) 0 0; }
    .img app-vignette ::ng-deep .vg { border-radius: calc(var(--radius) - 1px) calc(var(--radius) - 1px) 0 0; }
    .carte:hover { border-color: var(--vert); }
    .img { position: relative; }
    .eco { position: absolute; left: 10px; top: 10px; background: var(--vert); color: #fff; font-size: var(--t-s); font-weight: 700; border-radius: 999px; padding: 2px 9px; }
    .fav { position: absolute; right: 10px; top: 10px; }
    .corps { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 600; }
    .prix { font-size: var(--t-l); font-weight: 700; font-variant-numeric: tabular-nums; }
    .prix span { font-size: var(--t-s); font-weight: 400; color: var(--gris); margin-left: 3px; }
    .qui { font-size: var(--t-s); color: var(--gris); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class CarteOffreComponent {
  readonly offre = input.required<Offre>();
  /** Base de lien : /marche (connecté) ou /decouvrir/marche (visiteur) */
  readonly base = input('/marche');
  private readonly pf = inject(PlateformeService);
  private readonly session = inject(SessionService);
  protected readonly connecte = computed(() => !!this.session.utilisateur());
  protected readonly aMoi = computed(() => this.offre().vendeurId === this.session.utilisateur()?.id);
  private readonly dest = computed(() => this.session.utilisateur()?.localiteId ?? 'OUA');
  protected readonly nom = computed(() => produit(this.offre().produitId).nom);
  protected readonly prixLivre = computed(() => { const o = this.offre(); return this.pf.coutRendu(o.prixKg, o.produitId, o.localiteId, this.dest()).total.toLocaleString('fr-FR'); });
  protected readonly vendeur = computed(() => this.pf.nom(this.offre().vendeurId).replace(/ \(fictif\)| \(fictive\)/, ''));
  protected readonly ville = computed(() => localiteNom(this.offre().localiteId));
  /** Écart avec le prix habituel du marché le plus proche (positif = moins cher) */
  protected readonly economie = computed(() => {
    const o = this.offre();
    const ref = this.pf.prixReference(o.produitId, o.localiteId);
    return ref ? Math.round(((ref.prix - o.prixKg) / ref.prix) * 100) : 0;
  });
}

const localiteNom = (id: string) => localite(id)?.nom.split(' (')[0] ?? id;

export const ACHAT_UI = [VignetteComponent, FraicheurComponent, CoeurComponent, ActionsOffreComponent, CarteOffreComponent, IconeComponent];
