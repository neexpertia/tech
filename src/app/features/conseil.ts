import { Component, computed, inject, signal } from '@angular/core';
import { REGIONS, hash, localite, prng } from '../core/data/referentiel';
import { SessionService } from '../core/session.service';
import { UI } from '../shared/ui';

/** Calendrier cultural indicatif (zone soudano-sahélienne). 1 = janvier. */
const CALENDRIER: { culture: string; semis: number[]; entretien: number[]; recolte: number[] }[] = [
  { culture: 'Maïs', semis: [6, 7], entretien: [7, 8], recolte: [9, 10] },
  { culture: 'Sorgho', semis: [6, 7], entretien: [7, 8, 9], recolte: [10, 11] },
  { culture: 'Mil', semis: [6, 7], entretien: [7, 8], recolte: [10] },
  { culture: 'Niébé', semis: [7], entretien: [8, 9], recolte: [10, 11] },
  { culture: 'Sésame', semis: [7], entretien: [8, 9], recolte: [10, 11] },
  { culture: 'Arachide', semis: [6, 7], entretien: [7, 8], recolte: [9, 10] },
  { culture: 'Riz irrigué (Bagré, Kou)', semis: [1, 2, 7], entretien: [3, 4, 8, 9], recolte: [5, 11, 12] },
  { culture: 'Oignon (contre-saison)', semis: [10, 11], entretien: [12, 1, 2], recolte: [2, 3, 4] },
  { culture: 'Tomate (contre-saison)', semis: [10], entretien: [11, 12], recolte: [1, 2, 3] },
  { culture: 'Mangue', semis: [], entretien: [11, 12, 1, 2], recolte: [4, 5, 6] },
];

const FICHES = [
  { titre: 'Réussir le séchage du maïs avant stockage', theme: 'Post-récolte', resume: 'Viser moins de 13 % d’humidité : séchage sur bâche, test du sel en bocal ou humidimètre. Un maïs humide moisit et développe des aflatoxines refusées par les usines.' },
  { titre: 'Conserver le niébé sans insecticide (sacs triple fond)', theme: 'Stockage', resume: 'Remplir, chasser l’air, fermer chaque sac séparément. Les bruches meurent faute d’oxygène. Conservation 6 à 8 mois.' },
  { titre: 'Warrantage : comment ça marche ?', theme: 'Finance', resume: 'Déposer la récolte dans un magasin agréé, obtenir un crédit à 70 % de la valeur, vendre en période de hausse et rembourser. Gain moyen : l’écart entre le prix de récolte et le prix de soudure.' },
  { titre: 'Conserver l’oignon en case ventilée', theme: 'Stockage', resume: 'Récolter à maturité, ressuyer 10 jours à l’ombre, trier, stocker en couche mince sur claies aérées. Pertes réduites de moitié par rapport au tas au sol.' },
  { titre: 'Qualité du sésame pour l’export', theme: 'Qualité', resume: 'Couper à maturité, sécher en gerbes debout, battre sur bâche, vanner. Pureté ≥ 99 %, sans sable ni graines étrangères.' },
  { titre: 'Micro-dose d’engrais pour sorgho et mil', theme: 'Production', resume: 'Une capsule (≈ 6 g) de NPK par poquet au semis : meilleur rendement pour un coût réduit d’engrais.' },
];

const FORMATIONS = [
  { titre: 'Gestion d’une coopérative (SCOOPS) et répartition des revenus', duree: '2 jours', lieu: 'Bobo-Dioulasso', date: '2026-10-14' },
  { titre: 'Bonnes pratiques de stockage et warrantage', duree: '1 jour', lieu: 'Solenzo', date: '2026-10-21' },
  { titre: 'Maraîchage de contre-saison et irrigation solaire', duree: '3 jours', lieu: 'Ouahigouya', date: '2026-10-28' },
  { titre: 'Utiliser FasoAgri par téléphone simple (USSD)', duree: '½ journée', lieu: 'En ligne / radio communautaire', date: '2026-10-07' },
];

@Component({
  selector: 'app-conseil',
  imports: [...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Conseil agricole</div><h1>Calendrier, météo et fiches pratiques</h1>
        <p>Informations utiles au quotidien, diffusables aussi par SMS et messages vocaux en mooré, dioula et fulfuldé.</p></div>
    </div>

    <div class="card">
      <h2>Météo — {{ loc() }} <span class="small muted">prévisions indicatives (source météo à brancher)</span></h2>
      <div class="meteo">
        @for (j of meteo(); track j.jour) {
          <div class="jour"><div class="small muted">{{ j.jour }}</div><div class="ic">{{ j.icone }}</div><div><strong>{{ j.tmax }}°</strong> / {{ j.tmin }}°</div><div class="small">{{ j.pluie }} mm</div></div>
        }
      </div>
      @if (conseilMeteo()) { <p class="note green small" style="margin-top:10px">{{ conseilMeteo() }}</p> }
    </div>

    <div class="card section">
      <h2>Calendrier cultural</h2>
      <div class="table-wrap">
        <table class="cal">
          <thead><tr><th>Culture</th>@for (m of mois; track $index) { <th [class.auj]="$index + 1 === moisCourant">{{ m }}</th> }</tr></thead>
          <tbody>
            @for (c of calendrier; track c.culture) {
              <tr><td class="small">{{ c.culture }}</td>
                @for (m of mois; track $index) {
                  @let k = $index + 1;
                  <td [class.auj]="k === moisCourant" [class.semis]="c.semis.includes(k)" [class.entr]="c.entretien.includes(k)" [class.rec]="c.recolte.includes(k)"></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="leg small"><span><i class="semis"></i>Semis / repiquage</span><span><i class="entr"></i>Entretien</span><span><i class="rec"></i>Récolte</span></div>
    </div>

    <div class="grid g2 section">
      <div class="card">
        <h2>Fiches pratiques</h2>
        <div class="chips" style="margin-bottom:8px">@for (t of themes; track t) { <button class="chip" [class.on]="theme() === t" (click)="theme.set(t)">{{ t }}</button> }</div>
        <ul class="clean">@for (f of fiches(); track f.titre) { <li><strong>{{ f.titre }}</strong> <span class="badge">{{ f.theme }}</span><p class="small" style="margin:4px 0 0">{{ f.resume }}</p></li> }</ul>
      </div>
      <div class="card">
        <h2>Formations à venir</h2>
        <ul class="clean">@for (f of formations; track f.titre) { <li><strong>{{ f.titre }}</strong><div class="small muted">{{ f.date }} · {{ f.duree }} · {{ f.lieu }}</div></li> }</ul>
        <p class="hint">Inscription et attestations gérées par le backend (organisme de formation partenaire).</p>
      </div>
    </div>
  </div>`,
  styles: `
    .meteo { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; }
    .jour { background: var(--surface-2); border-radius: 8px; padding: 8px 4px; } .ic { font-size: 24px; }
    @media (max-width: 680px) { .meteo { grid-template-columns: repeat(4, 1fr); } }
    .cal td, .cal th { padding: 6px 4px; text-align: center; min-width: 32px; }
    .cal td:first-child, .cal th:first-child { text-align: left; min-width: 150px; }
    td.semis, i.semis { background: #9ccc65; } td.entr, i.entr { background: #ffe082; } td.rec, i.rec { background: #f0a04b; }
    th.auj { color: var(--primary); } td.auj { outline: 2px solid var(--primary); outline-offset: -2px; }
    .leg { display: flex; gap: 16px; margin-top: 8px; color: var(--muted); } .leg i { display: inline-block; width: 14px; height: 10px; margin-right: 4px; border-radius: 2px; }
  `,
})
export class ConseilPage {
  private readonly session = inject(SessionService);
  protected readonly calendrier = CALENDRIER;
  protected readonly formations = FORMATIONS;
  protected readonly mois = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  protected readonly moisCourant = new Date().getMonth() + 1;
  protected readonly themes = ['Tous', ...new Set(FICHES.map((f) => f.theme))];
  protected readonly theme = signal('Tous');
  protected readonly fiches = computed(() => FICHES.filter((f) => this.theme() === 'Tous' || f.theme === this.theme()));

  protected readonly loc = computed(() => {
    const l = localite(this.session.utilisateur()!.localiteId);
    return `${l.nom} (${REGIONS.find((r) => r.id === l.regionId)?.nom})`;
  });

  /** Météo FICTIVE déterministe — fin de saison des pluies. */
  protected readonly meteo = computed(() => {
    const l = localite(this.session.utilisateur()!.localiteId);
    const rnd = prng(hash(l.id + new Date().toISOString().slice(0, 10)));
    const nord = (l.lat - 10) / 4.5; // 0 sud → 1 nord
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 864e5);
      const pluie = rnd() < 0.45 - nord * 0.25 ? Math.round(rnd() * 25) : 0;
      return {
        jour: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        icone: pluie > 10 ? '⛈️' : pluie > 0 ? '🌦️' : rnd() < 0.5 ? '☀️' : '⛅',
        tmax: Math.round(32 + nord * 4 + rnd() * 3), tmin: Math.round(22 + nord * 2 + rnd() * 2), pluie,
      };
    });
  });

  protected readonly conseilMeteo = computed(() => {
    const total = this.meteo().reduce((s, j) => s + j.pluie, 0);
    return total > 20 ? `≈ ${total} mm de pluie prévus cette semaine : retarder le séchage et le battage au sol, protéger les récoltes sous bâche.`
      : 'Semaine plutôt sèche : bonne période pour la récolte et le séchage des céréales et légumineuses.';
  });
}
