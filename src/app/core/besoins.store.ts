import { Injectable, computed, effect, signal } from '@angular/core';
import seed from './data/besoins_v1.json';
import { MODULES } from './data/referentiel';
import { Besoin, BesoinsCollection, ModuleId, Preoccupation } from './models';

const CLE_STOCKAGE = 'agrivision.besoins_v1.v2'; // v2 : 7 acteurs
const SEED = seed as BesoinsCollection;

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Store de la collection « besoins_v1 ».
 * - Initialisé depuis src/app/core/data/besoins_v1.json (reprise de Besoins_v1.docx)
 * - Modifiable dans l'interface ; chaque modification incrémente la version
 * - Persisté localement (navigateur) ; export / import JSON pour partager une nouvelle version
 */
@Injectable({ providedIn: 'root' })
export class BesoinsStore {
  private readonly etat = signal<BesoinsCollection>(this.charger());

  readonly collection = this.etat.asReadonly();
  readonly items = computed(() => [...this.etat().items].sort((a, b) => a.ordre - b.ordre));
  readonly version = computed(() => this.etat().version);
  readonly modifiee = computed(() => this.etat().version !== SEED.version || this.etat().majLe !== SEED.majLe);

  readonly nbPreoccupations = computed(() => this.items().reduce((s, b) => s + b.preoccupations.length, 0));

  /** Taux de couverture par nos modules : préoccupations rattachées à au moins un module. */
  readonly couverture = computed(() => {
    const toutes = this.items().flatMap((b) => b.preoccupations);
    const couvertes = toutes.filter((p) => p.modules.length > 0).length;
    return toutes.length ? Math.round((couvertes / toutes.length) * 100) : 0;
  });

  /** Nombre de préoccupations adressées par chaque module. */
  readonly parModule = computed(() =>
    MODULES.map((m) => {
      const prs = this.items().flatMap((b) => b.preoccupations.filter((p) => p.modules.includes(m.id)).map((p) => ({ p, b })));
      return { module: m, total: prs.length, critiques: prs.filter((x) => x.p.priorite === 1).length, acteurs: new Set(prs.map((x) => x.b.id)).size };
    }),
  );

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLE_STOCKAGE, JSON.stringify(this.etat()));
      } catch {
        /* stockage indisponible : la session reste utilisable */
      }
    });
  }

  private charger(): BesoinsCollection {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (brut) {
        const c = JSON.parse(brut) as BesoinsCollection;
        if (c.collection === 'besoins_v1' && Array.isArray(c.items)) return c;
      }
    } catch {
      /* ignore */
    }
    return structuredClone(SEED);
  }

  private muter(fn: (items: Besoin[]) => Besoin[]) {
    this.etat.update((c) => ({ ...c, version: c.version + 1, majLe: aujourdhui(), items: fn(structuredClone(c.items)) }));
  }

  besoin(id: string) {
    return this.items().find((b) => b.id === id);
  }

  ajouterActeur(b: Omit<Besoin, 'id' | 'ordre' | 'majLe' | 'preoccupations'>) {
    this.muter((items) => {
      const n = Math.max(0, ...items.map((i) => Number(i.id.slice(1)) || 0)) + 1;
      const id = `A${String(n).padStart(2, '0')}`;
      return [...items, { ...b, id, ordre: Math.max(0, ...items.map((i) => i.ordre)) + 1, preoccupations: [], majLe: aujourdhui() }];
    });
  }

  modifierActeur(id: string, patch: Partial<Pick<Besoin, 'acteur' | 'emoji' | 'segment' | 'question' | 'exemple'>>) {
    this.muter((items) => items.map((b) => (b.id === id ? { ...b, ...patch, majLe: aujourdhui() } : b)));
  }

  supprimerActeur(id: string) {
    this.muter((items) => items.filter((b) => b.id !== id));
  }

  ajouterPreoccupation(acteurId: string, p: Omit<Preoccupation, 'id'>) {
    this.muter((items) =>
      items.map((b) => {
        if (b.id !== acteurId) return b;
        const n = Math.max(0, ...b.preoccupations.map((x) => Number(x.id.split('-P')[1]) || 0)) + 1;
        const nouvelle: Preoccupation = { ...p, id: `${b.id}-P${String(n).padStart(2, '0')}` };
        return { ...b, majLe: aujourdhui(), preoccupations: [...b.preoccupations, nouvelle] };
      }),
    );
  }

  modifierPreoccupation(acteurId: string, pid: string, patch: Partial<Omit<Preoccupation, 'id'>>) {
    this.muter((items) =>
      items.map((b) =>
        b.id !== acteurId ? b : { ...b, majLe: aujourdhui(), preoccupations: b.preoccupations.map((p) => (p.id === pid ? { ...p, ...patch } : p)) },
      ),
    );
  }

  basculerModule(acteurId: string, pid: string, m: ModuleId) {
    const p = this.besoin(acteurId)?.preoccupations.find((x) => x.id === pid);
    if (!p) return;
    const modules = p.modules.includes(m) ? p.modules.filter((x) => x !== m) : [...p.modules, m];
    this.modifierPreoccupation(acteurId, pid, { modules });
  }

  supprimerPreoccupation(acteurId: string, pid: string) {
    this.muter((items) =>
      items.map((b) => (b.id !== acteurId ? b : { ...b, majLe: aujourdhui(), preoccupations: b.preoccupations.filter((p) => p.id !== pid) })),
    );
  }

  exporterJson(): string {
    return JSON.stringify(this.etat(), null, 2);
  }

  importerJson(texte: string): string | null {
    try {
      const c = JSON.parse(texte) as BesoinsCollection;
      if (c.collection !== 'besoins_v1' || !Array.isArray(c.items)) return 'Fichier invalide : collection « besoins_v1 » attendue.';
      for (const b of c.items) {
        if (!b.id || !b.acteur || !Array.isArray(b.preoccupations)) return `Élément invalide : ${JSON.stringify(b).slice(0, 80)}…`;
      }
      this.etat.set(c);
      return null;
    } catch (e) {
      return `JSON illisible : ${(e as Error).message}`;
    }
  }

  reinitialiser() {
    this.etat.set(structuredClone(SEED));
  }
}
