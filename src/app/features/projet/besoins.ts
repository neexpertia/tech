import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BesoinsStore } from '../../core/besoins.store';
import { MODULES } from '../../core/data/referentiel';
import { Besoin, ModuleId, Segment } from '../../core/models';

const SEGMENTS: Segment[] = ['Offre', 'Demande', 'Logistique', 'Finance & risque', 'Pilotage public'];

@Component({
  selector: 'app-besoins',
  imports: [FormsModule, RouterLink],
  template: `
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Collection besoins_v1 · version {{ store.version() }} · mise à jour {{ store.collection().majLe }}</div>
        <h1>Besoins des acteurs</h1>
        <p>Reprise de <em>Besoins_v1.docx</em> : {{ store.items().length }} acteurs, {{ store.nbPreoccupations() }} préoccupations. Chaque préoccupation est reliée au module (écran) qui y répond. Modifiable ici, sauvegardée dans le navigateur, exportable en JSON pour diffuser la version suivante.</p>
      </div>
      <div class="toolbar">
        <button (click)="vue.set(vue() === 'fiches' ? 'matrice' : 'fiches')">{{ vue() === 'fiches' ? '▦ Matrice modules' : '☰ Fiches' }}</button>
        <button (click)="exporter()">⬇ Exporter JSON</button>
        <label class="btn">⬆ Importer<input type="file" accept=".json,application/json" hidden (change)="importer($event)" /></label>
        @if (store.modifiee()) { <button class="danger" (click)="reinitialiser()">↺ Réinitialiser</button> }
      </div>
    </div>
    @if (message()) { <div class="note" [class.green]="!erreur()" style="margin-bottom:14px">{{ message() }}</div> }

    @if (vue() === 'matrice') {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Acteur</th>@for (m of modules; track m.id) { <th [title]="m.description"><a [routerLink]="m.route">{{ m.nom }}</a></th> }<th class="num">Total</th></tr></thead>
          <tbody>
            @for (b of store.items(); track b.id) {
              <tr>
                <td><button class="ghost" (click)="choisir(b.id); vue.set('fiches')">{{ b.emoji }} {{ b.acteur }}</button></td>
                @for (m of modules; track m.id) {
                  @let n = compte(b, m.id);
                  <td class="cell" [style.background]="n ? 'color-mix(in srgb, var(--primary) ' + (12 + n * 11) + '%, transparent)' : null">{{ n || '' }}</td>
                }
                <td class="num">{{ b.preoccupations.length }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="hint">Nombre de préoccupations de chaque acteur couvertes par chaque module. Cliquez un module pour ouvrir l’écran correspondant.</p>
    } @else {
      <div class="layout">
        <div class="card liste">
          <input type="search" placeholder="Rechercher un acteur ou un thème…" [(ngModel)]="recherche" style="width:100%" />
          <div class="chips" style="margin:8px 0">
            <button class="chip" [class.on]="!segment()" (click)="segment.set(null)">Tous</button>
            @for (s of segments; track s) { <button class="chip" [class.on]="segment() === s" (click)="segment.set(s)">{{ s }}</button> }
          </div>
          <ul class="clean">
            @for (b of filtres(); track b.id) {
              <li><button class="item" [class.sel]="b.id === actif().id" (click)="choisir(b.id)">
                <span class="em">{{ b.emoji }}</span><span><strong>{{ b.acteur }}</strong><br /><span class="small muted">{{ b.segment }} · {{ b.preoccupations.length }} préoccupations</span></span>
              </button></li>
            } @empty { <li class="muted small">Aucun résultat.</li> }
          </ul>
          <details class="ajout">
            <summary>＋ Ajouter un type d’acteur</summary>
            <div class="form">
              <input placeholder="Émoji" [(ngModel)]="nv.emoji" style="width:70px" />
              <input placeholder="Nom de l’acteur" [(ngModel)]="nv.acteur" />
              <select [(ngModel)]="nv.segment">@for (s of segments; track s) { <option [value]="s">{{ s }}</option> }</select>
              <textarea rows="2" placeholder="Sa question principale" [(ngModel)]="nv.question"></textarea>
              <button class="primary" [disabled]="!nv.acteur || !nv.question" (click)="ajouterActeur()">Ajouter</button>
            </div>
          </details>
        </div>

        @if (actif(); as b) {
          <div>
            <div class="card">
              <div class="entete">
                <span class="big">{{ b.emoji }}</span>
                <div style="flex:1;min-width:0">
                  @if (edition()) {
                    <div class="form">
                      <input [ngModel]="b.acteur" (change)="maj(b.id, 'acteur', $event)" />
                      <select [ngModel]="b.segment" (change)="maj(b.id, 'segment', $event)">@for (s of segments; track s) { <option [value]="s">{{ s }}</option> }</select>
                      <textarea rows="2" [ngModel]="b.question" (change)="maj(b.id, 'question', $event)"></textarea>
                      <textarea rows="2" placeholder="Exemple concret (optionnel)" [ngModel]="b.exemple ?? ''" (change)="maj(b.id, 'exemple', $event)"></textarea>
                    </div>
                  } @else {
                    <div class="eyebrow">{{ b.id }} · {{ b.segment }} · maj {{ b.majLe }}</div>
                    <h2>{{ b.acteur }}</h2>
                    <p class="question">« {{ b.question }} »</p>
                    @if (b.exemple) { <div class="note">Exemple : {{ b.exemple }}</div> }
                  }
                </div>
                <div class="toolbar" style="align-self:flex-start">
                  <button (click)="edition.set(!edition())">{{ edition() ? 'Terminer' : '✎ Modifier' }}</button>
                  <button class="danger ghost" title="Supprimer cet acteur" (click)="supprimerActeur(b)">🗑</button>
                </div>
              </div>
            </div>
            <div class="table-wrap section">
              <table>
                <thead><tr><th>#</th><th>Préoccupation</th><th>Priorité</th><th>Répondu par</th><th></th></tr></thead>
                <tbody>
                  @for (p of b.preoccupations; track p.id; let i = $index) {
                    <tr>
                      <td class="small muted">{{ i + 1 }}</td>
                      <td><strong>{{ p.theme }}</strong>@if (p.question) { <div class="small muted">{{ p.question }}</div> }</td>
                      <td><select [ngModel]="p.priorite" (ngModelChange)="store.modifierPreoccupation(b.id, p.id, { priorite: $event })" [class]="'prio p' + p.priorite">
                        <option [ngValue]="1">Critique</option><option [ngValue]="2">Important</option><option [ngValue]="3">Utile</option></select></td>
                      <td><div class="chips">
                        @for (m of modules; track m.id) {
                          @if (edition()) { <button class="chip" [class.on]="p.modules.includes(m.id)" [title]="m.description" (click)="store.basculerModule(b.id, p.id, m.id)">{{ m.nom }}</button> }
                          @else if (p.modules.includes(m.id)) { <a class="chip on" [routerLink]="m.route" [title]="m.description">{{ m.nom }} →</a> }
                        }
                        @if (!p.modules.length) { <span class="badge ko">non couvert</span> }
                      </div></td>
                      <td>@if (edition()) { <button class="ghost danger" title="Supprimer" (click)="store.supprimerPreoccupation(b.id, p.id)">✕</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="card section">
              <h3>Ajouter une préoccupation</h3>
              <div class="form row">
                <input placeholder="Thème (ex. Délais de paiement)" [(ngModel)]="np.theme" />
                <input placeholder="Question réelle (optionnel)" [(ngModel)]="np.question" />
                <select [(ngModel)]="np.priorite"><option [ngValue]="1">Critique</option><option [ngValue]="2">Important</option><option [ngValue]="3">Utile</option></select>
                <button class="primary" [disabled]="!np.theme" (click)="ajouterPreoccupation(b.id)">Ajouter</button>
              </div>
              <p class="hint">En mode « Modifier », rattachez la préoccupation aux modules qui y répondent.</p>
            </div>
          </div>
        }
      </div>
    }
  </div>`,
  styles: `
    .layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .item { width: 100%; text-align: left; border: 0; background: transparent; display: flex; gap: 10px; align-items: center; padding: 6px; border-radius: 8px; }
    .item.sel { background: var(--primary-soft); }
    .em { font-size: 22px; width: 28px; text-align: center; } .big { font-size: 42px; line-height: 1; }
    .entete { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .question { font-size: 16px; font-style: italic; }
    .form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .form.row { flex-direction: row; flex-wrap: wrap; } .form.row input { flex: 1 1 200px; }
    .ajout { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
    .ajout summary { cursor: pointer; color: var(--primary); font-weight: 500; }
    .prio { font-size: 12px; padding: 3px 6px; } .prio.p1 { color: var(--danger); } .prio.p2 { color: var(--accent); }
    a.chip { text-decoration: none; }
    th a { color: inherit; } .cell { text-align: center; font-weight: 600; }
  `,
})
export class BesoinsPage {
  protected readonly store = inject(BesoinsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly modules = MODULES;
  protected readonly segments = SEGMENTS;
  protected readonly vue = signal<'fiches' | 'matrice'>('fiches');
  protected readonly segment = signal<Segment | null>(null);
  protected readonly selection = signal<string | null>(this.route.snapshot.queryParamMap.get('a'));
  protected readonly edition = signal(false);
  protected readonly message = signal('');
  protected readonly erreur = signal(false);
  private readonly _recherche = signal('');
  get recherche() { return this._recherche(); }
  set recherche(v: string) { this._recherche.set(v); }

  protected nv = { emoji: '🧑🏾', acteur: '', segment: 'Demande' as Segment, question: '' };
  protected np = { theme: '', question: '', priorite: 2 as 1 | 2 | 3 };

  protected readonly filtres = computed(() => {
    const q = this._recherche().toLowerCase().trim();
    return this.store.items().filter((b) => (!this.segment() || b.segment === this.segment()) &&
      (!q || b.acteur.toLowerCase().includes(q) || b.preoccupations.some((p) => p.theme.toLowerCase().includes(q))));
  });
  protected readonly actif = computed(() => this.store.besoin(this.selection() ?? '') ?? this.filtres()[0] ?? this.store.items()[0]);

  compte(b: Besoin, m: ModuleId) { return b.preoccupations.filter((p) => p.modules.includes(m)).length; }

  choisir(id: string) {
    this.selection.set(id);
    this.edition.set(false);
    this.router.navigate([], { queryParams: { a: id }, replaceUrl: true });
  }

  maj(id: string, champ: 'acteur' | 'segment' | 'question' | 'exemple', e: Event) {
    const v = (e.target as HTMLInputElement).value.trim();
    if (champ !== 'exemple' && !v) return;
    this.store.modifierActeur(id, { [champ]: champ === 'exemple' && !v ? undefined : v });
  }

  ajouterActeur() {
    this.store.ajouterActeur({ emoji: this.nv.emoji || '🧑🏾', acteur: this.nv.acteur.trim(), segment: this.nv.segment, question: this.nv.question.trim() });
    const n = this.store.items()[this.store.items().length - 1];
    this.nv = { emoji: '🧑🏾', acteur: '', segment: 'Demande', question: '' };
    this.choisir(n.id);
    this.edition.set(true);
    this.info(`Acteur « ${n.acteur} » ajouté (${n.id}).`);
  }

  supprimerActeur(b: Besoin) {
    if (!confirm(`Supprimer « ${b.acteur} » et ses ${b.preoccupations.length} préoccupations ?`)) return;
    this.store.supprimerActeur(b.id);
    this.selection.set(null);
    this.info(`« ${b.acteur} » supprimé.`);
  }

  ajouterPreoccupation(id: string) {
    this.store.ajouterPreoccupation(id, { theme: this.np.theme.trim(), ...(this.np.question.trim() ? { question: this.np.question.trim() } : {}), priorite: this.np.priorite, modules: [] });
    this.np = { theme: '', question: '', priorite: 2 };
    this.edition.set(true);
  }

  exporter() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([this.store.exporterJson()], { type: 'application/json' }));
    a.download = `besoins_v1.v${this.store.version()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async importer(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const err = this.store.importerJson(await f.text());
    input.value = '';
    if (err) { this.erreur.set(true); this.message.set(err); }
    else this.info(`Collection importée : version ${this.store.version()}, ${this.store.items().length} acteurs.`);
  }

  reinitialiser() {
    if (!confirm('Revenir à la version d’origine (Besoins_v1.docx) ?')) return;
    this.store.reinitialiser();
    this.info('Collection réinitialisée.');
  }

  private info(m: string) {
    this.erreur.set(false);
    this.message.set(m);
    setTimeout(() => this.message() === m && this.message.set(''), 5000);
  }
}
