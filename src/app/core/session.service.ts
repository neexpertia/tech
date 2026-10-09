import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DbService } from './api/db.service';
import { Role, Utilisateur } from './models';

const CLE = 'agri-bf.session';

export const LIBELLE_ROLE: Record<Role, string> = {
  producteur: 'Producteur', cooperative: 'Coopérative', acheteur: 'Acheteur', transporteur: 'Transporteur',
  entrepot: 'Entrepôt', collecteur: 'Collecteur', institution: 'Institution / organisme public', admin: 'Administrateur',
};

export const ROLES_VENDEURS: Role[] = ['producteur', 'cooperative', 'collecteur'];
export const ROLES_ACHETEURS: Role[] = ['acheteur', 'collecteur'];

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

  private lire() {
    try { return localStorage.getItem(CLE); } catch { return null; }
  }

  connecter(id: string) {
    this.userId.set(id);
    try { localStorage.setItem(CLE, id); } catch { /* ignore */ }
    this.router.navigateByUrl('/accueil');
  }

  deconnecter() {
    this.userId.set(null);
    try { localStorage.removeItem(CLE); } catch { /* ignore */ }
    this.router.navigateByUrl('/');
  }

  a(...roles: Role[]) {
    const r = this.role();
    return !!r && (roles.includes(r) || r === 'admin');
  }
}
