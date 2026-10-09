import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import * as S from '../data/seed';
import {
  Apport, Avis, Collecte, DisponibiliteCamion, Commande, Cotation, Demande, Depot, Entrepot, Fret, Lot,
  Notification, Offre, RelevePrix, SignalementAxe, Utilisateur,
} from '../models';
import { API_CONFIG, Entite, HttpRepository, LocalRepository, Repository } from './repository';

/**
 * Point d'accès unique aux collections. Le nom de chaque ressource correspond
 * à l'endpoint REST attendu côté backend (ex. GET /api/v1/offres).
 */
@Injectable({ providedIn: 'root' })
export class DbService {
  private readonly config = inject(API_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly locaux: LocalRepository<Entite>[] = [];

  private repo<T extends Entite>(ressource: string, seed: T[], prefixe: string): Repository<T> {
    if (this.config.mode === 'http') return new HttpRepository<T>(this.http, `${this.config.baseUrl}/${ressource}`);
    const r = new LocalRepository<T>(ressource, seed, prefixe);
    this.locaux.push(r as unknown as LocalRepository<Entite>);
    return r;
  }

  readonly utilisateurs = this.repo<Utilisateur>('utilisateurs', S.UTILISATEURS, 'U');
  readonly releves = this.repo<RelevePrix>('releves-prix', S.RELEVES, 'RP');
  readonly offres = this.repo<Offre>('offres', S.OFFRES, 'OF');
  readonly demandes = this.repo<Demande>('demandes', S.DEMANDES, 'DM');
  readonly cotations = this.repo<Cotation>('cotations', S.COTATIONS, 'CT');
  readonly commandes = this.repo<Commande>('commandes', S.COMMANDES, 'CM');
  readonly frets = this.repo<Fret>('frets', S.FRETS, 'FR');
  readonly axes = this.repo<SignalementAxe>('signalements-axes', S.AXES, 'AX');
  readonly entrepots = this.repo<Entrepot>('entrepots', S.ENTREPOTS, 'EN');
  readonly depots = this.repo<Depot>('depots', S.DEPOTS, 'DP');
  readonly apports = this.repo<Apport>('apports', S.APPORTS, 'AP');
  readonly lots = this.repo<Lot>('lots', S.LOTS, 'LT');
  readonly notifications = this.repo<Notification>('notifications', S.NOTIFICATIONS, 'NT');
  readonly avis = this.repo<Avis>('avis', S.AVIS, 'AV');
  readonly disponibilites = this.repo<DisponibiliteCamion>('disponibilites-camions', S.DISPONIBILITES, 'DC');
  readonly collectes = this.repo<Collecte>('collectes', S.COLLECTES, 'CL');

  /** Remet toutes les données de démonstration à zéro (mode local uniquement). */
  reinitialiserDemo() {
    this.locaux.forEach((r) => r.reinitialiser());
  }
}
