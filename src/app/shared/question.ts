import { Component, input } from '@angular/core';

/** En-tête commun des écrans « réponse » : la question de l'acteur et la démarche proposée. */
@Component({
  selector: 'app-question',
  template: `
  <div class="q card">
    <span class="em">{{ emoji() }}</span>
    <div class="txt">
      <div class="eyebrow">{{ acteur() }} — votre question</div>
      <h1>« {{ question() }} »</h1>
      <ol class="etapes">@for (e of etapes(); track e) { <li>{{ e }}</li> }</ol>
    </div>
  </div>`,
  styles: `
    .q { display: flex; gap: 16px; align-items: flex-start; background: linear-gradient(135deg, var(--primary-soft), var(--surface) 75%); margin-bottom: 16px; }
    .em { font-size: 40px; line-height: 1; }
    h1 { font-size: 1.35rem; margin-bottom: 8px; }
    .etapes { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding-left: 1.1rem; font-size: 13px; color: var(--muted); }
    .etapes li::marker { color: var(--primary); font-weight: 700; }
  `,
})
export class QuestionComponent {
  readonly emoji = input.required<string>();
  readonly acteur = input.required<string>();
  readonly question = input.required<string>();
  readonly etapes = input<string[]>([]);
}
