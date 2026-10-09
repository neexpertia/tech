import { Component, Pipe, PipeTransform, computed, inject, input } from '@angular/core';
import { MOIS_COURT, localite, produit } from '../core/data/referentiel';
import { PlateformeService } from '../core/plateforme.service';
import { Niveau } from '../core/models';

const nf = new Intl.NumberFormat('fr-FR');

/** 1234567 → « 1 234 567 FCFA » ; compact : « 1,2 M FCFA » */
@Pipe({ name: 'fcfa' })
export class FcfaPipe implements PipeTransform {
  transform(v: number | null | undefined, compact = false): string {
    if (v == null || isNaN(v)) return '—';
    if (compact && Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M FCFA`;
    if (compact && Math.abs(v) >= 1e4) return `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k FCFA`;
    return `${nf.format(Math.round(v))} FCFA`;
  }
}

/** Quantité en kg → « 12 t » ou « 850 kg » */
@Pipe({ name: 'qte' })
export class QtePipe implements PipeTransform {
  transform(v: number, unite = 'kg'): string {
    if (unite !== 'kg') return `${nf.format(v)} ${unite}${v > 1 && unite === 'tête' ? 's' : ''}`;
    return v >= 1000 ? `${nf.format(Math.round(v / 100) / 10)} t` : `${nf.format(v)} kg`;
  }
}

@Pipe({ name: 'nb' })
export class NbPipe implements PipeTransform {
  transform(v: number, dec = 0): string {
    return v.toLocaleString('fr-FR', { maximumFractionDigits: dec, minimumFractionDigits: dec });
  }
}

/** Niveau 0-3 sous forme de 3 pastilles. */
@Component({
  selector: 'app-niveau',
  template: `<span class="niv" [title]="libelle()" [attr.aria-label]="libelle()">
    @for (i of [1, 2, 3]; track i) {
      <i [class.on]="valeur() >= i" [style.background]="valeur() >= i ? couleur() : null"></i>
    }
  </span>`,
  styles: `.niv { display: inline-flex; gap: 3px; vertical-align: middle; }
    i { width: 10px; height: 10px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--border); }
    i.on { border-color: transparent; }`,
})
export class NiveauComponent {
  readonly valeur = input.required<Niveau>();
  readonly couleur = input('var(--primary)');
  readonly libelle = computed(() => ['Absent', 'Faible', 'Partiel', 'Fort'][this.valeur()]);
}

export interface SerieCourbe {
  nom: string;
  couleur: string;
  valeurs: (number | null)[];
}

/** Courbe multi-séries en SVG natif (pas de dépendance). */
@Component({
  selector: 'app-courbe',
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="titre()" preserveAspectRatio="none">
      @for (t of graduations(); track t.v) {
        <line [attr.x1]="G" [attr.x2]="W - 8" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
        <text [attr.x]="G - 6" [attr.y]="t.y + 3" text-anchor="end" class="ax">{{ t.label }}</text>
      }
      @for (m of mois(); track $index) {
        <text [attr.x]="x($index)" [attr.y]="H - 4" text-anchor="middle" class="ax">{{ m }}</text>
      }
      @for (s of series(); track s.nom) {
        <polyline [attr.points]="points(s.valeurs)" fill="none" [attr.stroke]="s.couleur" stroke-width="2" stroke-linejoin="round" />
        @for (v of s.valeurs; track $index) {
          @if (v !== null) {
            <circle [attr.cx]="x($index)" [attr.cy]="y(v)" r="3" [attr.fill]="s.couleur"><title>{{ s.nom }} · {{ mois()[$index] }} : {{ v }} FCFA</title></circle>
          }
        }
      }
    </svg>
    <div class="leg">
      @for (s of series(); track s.nom) { <span><i [style.background]="s.couleur"></i>{{ s.nom }}</span> }
    </div>`,
  styles: `svg { width: 100%; height: 240px; display: block; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .ax { fill: var(--muted); font-size: 10px; }
    .leg { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 6px; }
    .leg i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }`,
})
export class CourbeComponent {
  readonly series = input.required<SerieCourbe[]>();
  readonly titre = input('Évolution des prix');
  readonly mois = input<string[]>(MOIS_COURT);
  readonly W = 640;
  readonly H = 240;
  readonly G = 44;

  private readonly bornes = computed(() => {
    const all = this.series().flatMap((s) => s.valeurs).filter((v): v is number => v !== null);
    if (!all.length) return { min: 0, max: 1 };
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.1 || max * 0.1 || 1;
    return { min: Math.max(0, min - pad), max: max + pad };
  });

  readonly graduations = computed(() => {
    const { min, max } = this.bornes();
    return [0, 1, 2, 3, 4].map((i) => {
      const v = min + ((max - min) * i) / 4;
      const label = max >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : Math.round(v).toLocaleString('fr-FR');
      return { v, y: this.y(v), label };
    });
  });

  x(i: number) {
    const n = Math.max(1, this.mois().length - 1);
    return this.G + ((this.W - this.G - 16) * i) / n;
  }
  y(v: number) {
    const { min, max } = this.bornes();
    return 12 + (this.H - 36) * (1 - (v - min) / (max - min));
  }
  points(vals: (number | null)[]) {
    return vals.map((v, i) => (v === null ? null : `${this.x(i)},${this.y(v)}`)).filter(Boolean).join(' ');
  }
}

/** Petites barres horizontales. */
@Component({
  selector: 'app-barres',
  imports: [NbPipe],
  template: `
    @for (l of lignes(); track l.label) {
      <div class="row">
        <span class="lab" [title]="l.label">{{ l.label }}</span>
        <div class="bar"><span [style.width.%]="(l.valeur / max()) * 100" [style.background]="l.couleur ?? null"></span></div>
        <span class="val num">{{ l.valeur | nb }}{{ suffixe() }}</span>
      </div>
    }`,
  styles: `.row { display: grid; grid-template-columns: minmax(90px, 38%) 1fr 64px; gap: 10px; align-items: center; padding: 4px 0; font-size: 12.5px; }
    .lab { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
})
export class BarresComponent {
  readonly lignes = input.required<{ label: string; valeur: number; couleur?: string }[]>();
  readonly suffixe = input('');
  readonly max = computed(() => Math.max(1, ...this.lignes().map((l) => l.valeur)));
}

@Pipe({ name: 'loc' })
export class LocPipe implements PipeTransform {
  transform(id: string | undefined): string { return id ? (localite(id)?.nom ?? id) : '—'; }
}

@Pipe({ name: 'prod' })
export class ProdPipe implements PipeTransform {
  transform(id: string | undefined): string { return id ? (produit(id)?.nom ?? id) : '—'; }
}

/** Nom d'un utilisateur à partir de son id. */
@Pipe({ name: 'qui', pure: false })
export class QuiPipe implements PipeTransform {
  private readonly pf = inject(PlateformeService);
  transform(id: string | undefined): string { return id ? this.pf.nom(id) : '—'; }
}

/** Convertit des kg dans une unité locale du produit : 2500 | enUnite:'mais':'sac100' → « 25 sacs de 100 kg » */
@Pipe({ name: 'enUnite' })
export class EnUnitePipe implements PipeTransform {
  transform(kg: number, produitId: string, code?: string): string {
    const p = produit(produitId);
    const u = p.unites.find((x) => x.code === code) ?? p.unites[1] ?? p.unites[0];
    const n = kg / u.kg;
    return `≈ ${n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 1 : 0 })} × ${u.libelle.toLowerCase()}`;
  }
}

/** Bouton / badge de note en étoiles. */
@Component({
  selector: 'app-etoiles',
  template: `<span class="et" [attr.aria-label]="note() + ' sur 5'">@for (i of [1, 2, 3, 4, 5]; track i) {<span [class.on]="note() >= i - 0.25">★</span>}</span>`,
  styles: `.et { color: var(--border); letter-spacing: 1px; } .on { color: #e0a100; }`,
})
export class EtoilesComponent {
  readonly note = input.required<number>();
}

export const UI = [FcfaPipe, QtePipe, NbPipe, NiveauComponent, CourbeComponent, BarresComponent, LocPipe, ProdPipe, QuiPipe, EnUnitePipe, EtoilesComponent];
