import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, produit } from '../../core/data/referentiel';
import { Qualite } from '../../core/models';
import { PlateformeService } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-demande-form',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <a routerLink="/demandes" class="small">← Demandes</a>
    <h1 style="margin-top:8px">Nouvelle demande d’achat</h1>
    <div class="split">
      <div class="card">
        <div class="form-grid">
          <label class="field">Type
            <select [(ngModel)]="f.type"><option value="rfq">Demande de cotation</option><option value="appel_offres">Appel d’offres (lots, critères)</option></select>
          </label>
          <label class="field">Produit
            <select [(ngModel)]="f.produitId" (ngModelChange)="f.unite = uniteDefaut($event)">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select>
          </label>
          <label class="field">Quantité<input type="number" min="1" [(ngModel)]="f.quantite" /></label>
          <label class="field">Unité<select [(ngModel)]="f.unite">@for (u of unites(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select></label>
          <label class="field">Prix maximum rendu (F/kg, optionnel)<input type="number" min="0" [(ngModel)]="f.prixMaxKg" /></label>
          <label class="field">Qualité minimale<select [(ngModel)]="f.qualiteMin"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
          <label class="field">Lieu de livraison<select [(ngModel)]="f.localiteLivraisonId">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select></label>
          <label class="field">Date limite<input type="date" [(ngModel)]="f.dateLimite" /></label>
          <label class="field">Récurrence (optionnel)
            <select [(ngModel)]="f.recurrence"><option value="">Achat ponctuel</option><option>Tous les lundis</option><option>Hebdomadaire</option><option>Mensuel</option><option>Contrat trimestriel</option><option>Contrat de campagne</option></select>
          </label>
          <label class="field full">Cahier des charges (humidité, conditionnement, documents…)<textarea rows="3" [(ngModel)]="f.description"></textarea></label>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/demandes">Annuler</a>
          <button class="primary" [disabled]="!f.quantite || session.utilisateur()?.kyc !== 'verifie'" (click)="publier()">Publier la demande</button>
        </div>
      </div>
      <div class="card">
        <h2>Ce qui se passe ensuite</h2>
        <ol class="small" style="padding-left:1.1rem">
          <li>Les vendeurs ayant des offres de ce produit sont alertés (application, SMS).</li>
          <li>Ils envoient une cotation : prix départ, quantité, délai.</li>
          <li>Vous comparez les cotations sur le <strong>coût rendu</strong> à votre porte et sur la fiabilité du vendeur.</li>
          <li>Vous acceptez → une commande est créée, payée en séquestre.</li>
        </ol>
        @if (ref(); as r) { <div class="note green">Repère : {{ f.produitId | prod }} à {{ r.marcheId | loc }} : <strong>{{ r.prix | nb }} F/kg</strong>.</div> }
        <p class="hint">Offres déjà disponibles pour ce produit : <a routerLink="/marche">{{ nbOffres() }} sur le marché</a>.</p>
      </div>
    </div>
  </div>`,
})
export class DemandeFormPage {
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  private readonly tick = signal(0);

  protected f = {
    type: 'rfq' as 'rfq' | 'appel_offres', produitId: 'mais', quantite: 100, unite: 'sac100', prixMaxKg: 0, qualiteMin: 'B' as Qualite,
    localiteLivraisonId: this.session.utilisateur()!.localiteId, dateLimite: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10), recurrence: '', description: '',
  };

  uniteDefaut(id: string) { this.tick.update((x) => x + 1); return produit(id).unites[1]?.code ?? 'kg'; }
  unites() { return produit(this.f.produitId).unites; }
  ref() { return this.pf.prixReference(this.f.produitId, this.f.localiteLivraisonId); }
  nbOffres() { return this.pf.db.offres.items().filter((o) => o.statut === 'active' && o.produitId === this.f.produitId).length; }

  async publier() {
    const u = this.unites().find((x) => x.code === this.f.unite) ?? this.unites()[0];
    const d = await this.pf.publierDemande({
      produitId: this.f.produitId, quantiteKg: Math.round(this.f.quantite * u.kg), qualiteMin: this.f.qualiteMin,
      localiteLivraisonId: this.f.localiteLivraisonId, dateLimite: this.f.dateLimite, type: this.f.type,
      description: this.f.description || '—', ...(this.f.prixMaxKg ? { prixMaxKg: this.f.prixMaxKg } : {}),
      ...(this.f.recurrence ? { recurrence: this.f.recurrence } : {}),
    });
    this.toast.afficher('Demande publiée, les vendeurs sont alertés.');
    this.router.navigate(['/demandes', d.id]);
  }
}
