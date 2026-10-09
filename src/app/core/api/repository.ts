import { HttpClient } from '@angular/common/http';
import { InjectionToken, Signal, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Couche d'accès aux données.
 * ------------------------------------------------------------
 * Toute l'application passe par `Repository<T>`. Deux implémentations :
 *  - LocalRepository : données fictives persistées dans le navigateur (mode actuel)
 *  - HttpRepository  : appelle votre backend REST  →  GET/POST/PATCH/DELETE {baseUrl}/{ressource}
 * Pour brancher le backend : dans app.config.ts, passer API_CONFIG.mode à 'http'
 * et renseigner baseUrl. Aucun écran n'est à modifier.
 */

export interface ApiConfig {
  mode: 'local' | 'http';
  baseUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  factory: () => ({ mode: 'local', baseUrl: '/api/v1' }),
});

export interface Entite { id: string }

export interface Repository<T extends Entite> {
  /** Cache réactif de la collection (rechargé depuis la source) */
  readonly items: Signal<T[]>;
  get(id: string): T | undefined;
  charger(): Promise<void>;
  create(item: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

const PREFIXE = 'agri-bf.v3.';

let compteur = 0;
export function nouvelId(prefixe: string) {
  compteur = (compteur + 1) % 1000;
  return `${prefixe}-${Date.now().toString(36).toUpperCase()}${String(compteur).padStart(3, '0')}`;
}

export class LocalRepository<T extends Entite> implements Repository<T> {
  private readonly etat = signal<T[]>([]);
  readonly items = this.etat.asReadonly();

  constructor(private readonly ressource: string, private readonly seed: T[], private readonly prefixeId: string) {
    this.etat.set(this.lire());
  }

  private lire(): T[] {
    try {
      const brut = localStorage.getItem(PREFIXE + this.ressource);
      if (brut) return JSON.parse(brut) as T[];
    } catch { /* stockage indisponible */ }
    return structuredClone(this.seed);
  }

  private ecrire(v: T[]) {
    this.etat.set(v);
    try { localStorage.setItem(PREFIXE + this.ressource, JSON.stringify(v)); } catch { /* ignore */ }
  }

  get(id: string) { return this.etat().find((x) => x.id === id); }

  async charger() { this.etat.set(this.lire()); }

  async create(item: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const e = { ...item, id: item.id ?? nouvelId(this.prefixeId) } as T;
    this.ecrire([e, ...this.etat()]);
    return e;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    let maj!: T;
    this.ecrire(this.etat().map((x) => (x.id === id ? (maj = { ...x, ...patch }) : x)));
    if (!maj) throw new Error(`${this.ressource}/${id} introuvable`);
    return maj;
  }

  async remove(id: string) { this.ecrire(this.etat().filter((x) => x.id !== id)); }

  reinitialiser() {
    try { localStorage.removeItem(PREFIXE + this.ressource); } catch { /* ignore */ }
    this.etat.set(structuredClone(this.seed));
  }
}

/** Implémentation REST prête à l'emploi pour le futur backend. */
export class HttpRepository<T extends Entite> implements Repository<T> {
  private readonly etat = signal<T[]>([]);
  readonly items = this.etat.asReadonly();

  constructor(private readonly http: HttpClient, private readonly url: string) {
    this.charger().catch((e) => console.error(`Chargement ${url}`, e));
  }

  get(id: string) { return this.etat().find((x) => x.id === id); }

  async charger() { this.etat.set(await firstValueFrom(this.http.get<T[]>(this.url))); }

  async create(item: Omit<T, 'id'> & { id?: string }) {
    const e = await firstValueFrom(this.http.post<T>(this.url, item));
    this.etat.update((l) => [e, ...l]);
    return e;
  }

  async update(id: string, patch: Partial<T>) {
    const e = await firstValueFrom(this.http.patch<T>(`${this.url}/${id}`, patch));
    this.etat.update((l) => l.map((x) => (x.id === id ? e : x)));
    return e;
  }

  async remove(id: string) {
    await firstValueFrom(this.http.delete(`${this.url}/${id}`));
    this.etat.update((l) => l.filter((x) => x.id !== id));
  }
}
