import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DbService } from './api/db.service';
import { Role, Utilisateur } from './models';

const CLE = 'agri-bf.session';

export const LIBELLE_ROLE: Record<Role, string> = {
  producteur: 'Producteur', cooperative: 'Coopérative', acheteur: 'Acheteur', transporteur: 'Transporteur',
  entrepot: 'Entrepôt', collecteur: 'Collecteur', institution: 'Institution / organisme public', admin: 'Administrateur',
  vendeur: 'Vendeur',
};

/** Espace affiché : un vendeur bascule entre « Acheter » et « Vendre ». */
export type Mode = 'achat' | 'vente';
const CLE_MODE = 'agri-bf.mode';

export const ROLES_VENDEURS: Role[] = ['vendeur', 'producteur', 'cooperative', 'collecteur'];
export const ROLES_ACHETEURS: Role[] = ['acheteur', 'vendeur', 'collecteur'];
/** Tous ceux qui peuvent acheter sur le marché (un vendeur reste aussi acheteur). */
export const ROLES_ACHAT: Role[] = ['acheteur', 'vendeur', 'producteur', 'cooperative', 'collecteur'];

/**
 * Session de démonstration : choix d'un compte fictif, sans mot de passe.
 * À remplacer par l'authentification du backend (OTP SMS recommandé).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly db = inject(DbService);
  private readonly router = inject(Router);
  private readonly userId = signal<string | null>(this.lire());

  readonly utilisateur = computed<Utilisateur | undefined>(() => {
    const id = this.userId();
    return id ? this.db.utilisateurs.items().find((u) => u.id === id) : undefined;
  });
  readonly role = computed(() => this.utilisateur()?.role);
  readonly estVendeur = computed(() => ROLES_VENDEURS.includes(this.role()!));
  readonly estAcheteur = computed(() => ROLES_ACHETEURS.includes(this.role()!));
  readonly peutAcheter = computed(() => ROLES_ACHAT.includes(this.role()!));

  /** Mode courant d'un vendeur ; un acheteur est toujours en mode « achat ». */
  private readonly modeBrut = signal<Mode>(this.lireMode());
  readonly mode = computed<Mode>(() => (this.role() === 'vendeur' ? this.modeBrut() : 'achat'));
  /** Configuration d'espace à afficher (menu, accueil) */
  readonly espace = computed<Role>(() => {
    const r = this.role();
    if (r === 'vendeur') return this.modeBrut() === 'vente' ? 'vendeur' : 'acheteur';
    return r ?? 'acheteur';
  });

  private lireMode(): Mode { try { return localStorage.getItem(CLE_MODE) === 'vente' ? 'vente' : 'achat'; } catch { return 'achat'; } }
  changerMode(m: Mode) {
    this.modeBrut.set(m);
    try { localStorage.setItem(CLE_MODE, m); } catch { /* ignore */ }
    this.router.navigateByUrl('/accueil');
  }

  private lire() {
    try { return localStorage.getItem(CLE); } catch { return null; }
  }

  /** À la connexion, on arrive toujours dans l'espace acheteur. */
  connecter(id: string) {
    this.userId.set(id);
    this.modeBrut.set('achat');
    try { localStorage.setItem(CLE_MODE, 'achat'); } catch { /* ignore */ }
    try { localStorage.setItem(CLE, id); } catch { /* ignore */ }
    let retour: string | null = null;
    try { retour = sessionStorage.getItem('agri-bf.retour'); sessionStorage.removeItem('agri-bf.retour'); } catch { /* ignore */ }
    this.router.navigateByUrl(retour || '/accueil');
  }

  deconnecter() {
    this.userId.set(null);
    try { localStorage.removeItem(CLE); } catch { /* ignore */ }
    this.router.navigateByUrl('/');
  }

  a(...roles: Role[]) {
    const r = this.role();
    if (!r) return false;
    if (r === 'admin' || roles.includes(r)) return true;
    // Un vendeur a tous les droits d'un acheteur et d'un producteur-vendeur.
    return r === 'vendeur' && (roles.includes('acheteur') || roles.includes('producteur'));
  }
}
