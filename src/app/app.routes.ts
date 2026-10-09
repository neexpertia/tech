import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, Routes } from '@angular/router';
import { ACCES } from './core/roles';
import { SessionService } from './core/session.service';
import { ToastService } from './shared/toast';
import { EspaceLayout } from './features/layout/espace';
import { PublicLayout } from './features/layout/public';

/** Espace connecté : session requise, puis rôle autorisé pour la rubrique (data.acces). */
const acces: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.utilisateur()) return router.parseUrl('/connexion');
  const cle = route.data['acces'] as string | undefined;
  const roles = cle ? ACCES[cle] : undefined;
  if (!roles || session.a(...roles)) return true;
  inject(ToastService).afficher('Cette rubrique n’est pas disponible pour votre profil.');
  return router.parseUrl('/accueil');
};

const p = (titre: string) => `${titre} · FasoAgri`;
const r = (path: string, titre: string, cle: string, load: () => Promise<any>) => ({ path, title: p(titre), data: { acces: cle }, canActivate: [acces], loadComponent: load });

export const routes: Routes = [
  // ---------------------------------------------------------------- Site public (visiteurs)
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', pathMatch: 'full', title: 'FasoAgri — marchés agricoles du Burkina Faso', loadComponent: () => import('./features/public/landing').then((m) => m.LandingPage) },
      { path: 'decouvrir/prix', title: p('Prix des marchés'), loadComponent: () => import('./features/prix').then((m) => m.PrixPage) },
      { path: 'decouvrir/marche', title: p('Marché'), loadComponent: () => import('./features/commerce/marche').then((m) => m.MarchePage) },
      { path: 'decouvrir/marche/:id', title: p('Offre'), loadComponent: () => import('./features/commerce/offre-detail').then((m) => m.OffreDetailPage) },
      { path: 'decouvrir/observatoire', title: p('Observatoire des marchés'), loadComponent: () => import('./features/solutions/observatoire').then((m) => m.ObservatoirePage) },
      { path: 'connexion', title: p('Connexion'), loadComponent: () => import('./features/connexion').then((m) => m.ConnexionPage) },
      { path: 'inscription', title: p('Créer un compte'), loadComponent: () => import('./features/public/inscription').then((m) => m.InscriptionPage) },
    ],
  },
  // ---------------------------------------------------------------- Espace connecté (adapté au rôle)
  {
    path: '',
    component: EspaceLayout,
    children: [
      r('accueil', 'Tableau de bord', 'accueil', () => import('./features/accueil').then((m) => m.AccueilPage)),
      r('vendre-ma-recolte', 'Vendre ma récolte', 'vendreAssistant', () => import('./features/solutions/vendre').then((m) => m.VendrePage)),
      r('collecte', 'Campagnes de collecte', 'cooperative', () => import('./features/solutions/collecte').then((m) => m.CollectePage)),
      r('approvisionnement', 'Plan d’approvisionnement', 'appro', () => import('./features/solutions/approvisionnement').then((m) => m.ApprovisionnementPage)),
      r('tournees', 'Planifier mes tournées', 'tournees', () => import('./features/solutions/tournees').then((m) => m.TourneesPage)),
      r('magasin', 'Piloter mon magasin', 'magasin', () => import('./features/solutions/magasin').then((m) => m.MagasinPage)),
      r('opportunites', 'Opportunités de collecte', 'opportunites', () => import('./features/solutions/opportunites').then((m) => m.OpportunitesPage)),
      r('observatoire', 'Observatoire des marchés', 'observatoire', () => import('./features/solutions/observatoire').then((m) => m.ObservatoirePage)),
      r('prix', 'Prix des marchés', 'prix', () => import('./features/prix').then((m) => m.PrixPage)),
      r('marche', 'Marché', 'marche', () => import('./features/commerce/marche').then((m) => m.MarchePage)),
      r('marche/nouvelle', 'Publier une offre', 'vendre', () => import('./features/commerce/offre-form').then((m) => m.OffreFormPage)),
      r('marche/:id', 'Offre', 'marche', () => import('./features/commerce/offre-detail').then((m) => m.OffreDetailPage)),
      r('demandes', 'Demandes', 'demandes', () => import('./features/commerce/demandes').then((m) => m.DemandesPage)),
      r('demandes/nouvelle', 'Nouvelle demande', 'acheter', () => import('./features/commerce/demande-form').then((m) => m.DemandeFormPage)),
      r('demandes/:id', 'Demande', 'demandes', () => import('./features/commerce/demande-detail').then((m) => m.DemandeDetailPage)),
      r('commandes', 'Commandes', 'commandes', () => import('./features/commerce/commandes').then((m) => m.CommandesPage)),
      r('commandes/:id', 'Commande', 'commandes', () => import('./features/commerce/commande-detail').then((m) => m.CommandeDetailPage)),
      r('cooperative', 'Ma coopérative', 'cooperative', () => import('./features/cooperative').then((m) => m.CooperativePage)),
      r('transport', 'Transport', 'transport', () => import('./features/transport').then((m) => m.TransportPage)),
      r('stockage', 'Stockage & warrantage', 'stockage', () => import('./features/stockage').then((m) => m.StockagePage)),
      r('conseil', 'Météo & conseils', 'conseil', () => import('./features/conseil').then((m) => m.ConseilPage)),
      r('pilotage', 'Pilotage', 'pilotage', () => import('./features/pilotage').then((m) => m.PilotagePage)),
      r('ussd', 'Simulateur USSD', 'ussd', () => import('./features/ussd').then((m) => m.UssdPage)),
      r('notifications', 'Notifications', 'notifications', () => import('./features/notifications').then((m) => m.NotificationsPage)),
      r('profil', 'Profil', 'profil', () => import('./features/profil').then((m) => m.ProfilPage)),
      r('admin', 'Administration', 'admin', () => import('./features/admin').then((m) => m.AdminPage)),
      r('projet/benchmark', 'Benchmark', 'projet', () => import('./features/projet/benchmark').then((m) => m.BenchmarkPage)),
      r('projet/besoins', 'Besoins', 'projet', () => import('./features/projet/besoins').then((m) => m.BesoinsPage)),
    ],
  },
  { path: '**', redirectTo: '' },
];
