import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONCURRENTS, FONCTIONNALITES } from '../../core/data/benchmark';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-benchmark',
  imports: [RouterLink, ...UI],
  template: `
  <div class="page">
    <div class="page-head"><div><div class="eyebrow">Projet</div><h1>Benchmark : TAIM54 · NukuConnect · FasoAgri</h1>
      <p>Ce que font les autres plateformes, ce que nous reprenons, et ce que nous ajoutons pour le contexte du Burkina Faso. Chaque ligne renvoie à l’écran qui la réalise.</p></div></div>

    <div class="grid g2">
      @for (c of concurrents; track c.id) {
        <div class="card">
          <h2>{{ c.nom }}</h2>
          <p class="small">{{ c.resume }}</p>
          <p class="small"><strong>Pour nous :</strong> {{ c.pourNous }}</p>
          <div class="small muted">Sources : @for (s of c.sources; track s.url; let l = $last) { <a [href]="s.url" target="_blank" rel="noopener">{{ s.label }}</a>{{ l ? '' : ' · ' }} }</div>
        </div>
      }
    </div>

    <div class="grid g4 section">
      <div class="card kpi"><div class="v">{{ stats().reprises }}</div><div class="l">fonctionnalités reprises des concurrents</div></div>
      <div class="card kpi"><div class="v">{{ stats().ajouts }}</div><div class="l">ajouts spécifiques au Burkina</div></div>
      <div class="card kpi"><div class="v">{{ stats().faites }}</div><div class="l">déjà utilisables dans le prototype</div></div>
      <div class="card kpi"><div class="v">{{ stats().aFaire }}</div><div class="l">partielles ou à faire</div></div>
    </div>

    <div class="chips section">
      @for (d of domaines; track d) { <button class="chip" [class.on]="domaine() === d" (click)="domaine.set(d)">{{ d }}</button> }
    </div>
    <div class="table-wrap" style="margin-top:10px">
      <table>
        <thead><tr><th>Fonctionnalité</th><th>TAIM54</th><th>NukuConnect</th><th>FasoAgri</th><th>Pourquoi pour le Burkina</th></tr></thead>
        <tbody>
          @for (x of liste(); track x.id) {
            <tr [class.ajout]="x.domaine === 'Burkina'">
              <td><strong>{{ x.nom }}</strong><div class="small muted">{{ x.domaine }}</div></td>
              <td><app-niveau [valeur]="x.taim54" couleur="#6b4fbb" /></td>
              <td><app-niveau [valeur]="x.nuku" couleur="#c9821b" /></td>
              <td><app-niveau [valeur]="x.nous.niveau" />
                @if (x.nous.route) { <a class="small" [routerLink]="x.nous.route"> ouvrir →</a> } @else { <span class="badge warn">à faire</span> }</td>
              <td class="small">{{ x.pourquoiBurkina }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="hint">Lignes vertes : fonctionnalités absentes ou faibles chez les deux concurrents, ajoutées pour répondre aux besoins exprimés dans besoins_v1.</p>
  </div>`,
  styles: `tr.ajout td { background: var(--primary-soft); } td app-niveau { white-space: nowrap; }`,
})
export class BenchmarkPage {
  protected readonly concurrents = CONCURRENTS;
  protected readonly domaines = ['Tous', ...new Set(FONCTIONNALITES.map((f) => f.domaine))];
  protected readonly domaine = signal('Tous');
  protected readonly liste = computed(() => FONCTIONNALITES.filter((f) => this.domaine() === 'Tous' || f.domaine === this.domaine()));
  protected readonly stats = computed(() => ({
    reprises: FONCTIONNALITES.filter((f) => f.domaine !== 'Burkina').length,
    ajouts: FONCTIONNALITES.filter((f) => f.domaine === 'Burkina').length,
    faites: FONCTIONNALITES.filter((f) => f.nous.niveau === 3).length,
    aFaire: FONCTIONNALITES.filter((f) => f.nous.niveau < 3).length,
  }));
}
