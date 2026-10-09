import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LOCALITES, PRODUITS, produit } from '../../core/data/referentiel';
import { Qualite } from '../../core/models';
import { PlateformeService, aujourdhui } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-offre-form',
  imports: [FormsModule, RouterLink, ...UI],
  template: `
  <div class="page">
    <a routerLink="/marche" class="small">← Marché</a>
    <h1 style="margin-top:8px">Publier une offre</h1>
    <div class="split">
      <div class="card">
        <div class="form-grid">
          <label class="field">Produit
            <select [ngModel]="f().produitId" (ngModelChange)="maj({ produitId: $event, unite: 'kg', uniteQte: produitUnite($event) })">@for (p of produits; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }</select>
          </label>
          <label class="field">Lieu d’enlèvement
            <select [ngModel]="f().localiteId" (ngModelChange)="maj({ localiteId: $event })">@for (l of localites; track l.id) { <option [value]="l.id">{{ l.nom }}</option> }</select>
          </label>
          <label class="field">Quantité
            <input type="number" min="1" [ngModel]="f().quantite" (ngModelChange)="maj({ quantite: $event })" />
          </label>
          <label class="field">Unité
            <select [ngModel]="f().uniteQte" (ngModelChange)="maj({ uniteQte: $event })">@for (u of unites(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select>
          </label>
          <label class="field">Prix demandé (FCFA)
            <input type="number" min="1" [ngModel]="f().prix" (ngModelChange)="maj({ prix: $event })" />
          </label>
          <label class="field">Prix exprimé par
            <select [ngModel]="f().unite" (ngModelChange)="maj({ unite: $event })">@for (u of unites(); track u.code) { <option [value]="u.code">{{ u.libelle }}</option> }</select>
          </label>
          <label class="field">Qualité
            <select [ngModel]="f().qualite" (ngModelChange)="maj({ qualite: $event })"><option value="A">A — premier choix, trié, sec</option><option value="B">B — standard</option><option value="C">C — tout-venant</option></select>
          </label>
          <label class="field">Disponible à partir du
            <input type="date" [ngModel]="f().disponibleLe" (ngModelChange)="maj({ disponibleLe: $event })" />
          </label>
          <label class="field">Stocké dans un entrepôt partenaire
            <select [ngModel]="f().entrepotId" (ngModelChange)="maj({ entrepotId: $event })"><option value="">Non (chez moi)</option>@for (e of entrepots(); track e.id) { <option [value]="e.id">{{ e.nom }}</option> }</select>
          </label>
          <label class="field">Nombre de producteurs (lot groupé)
            <input type="number" min="0" [ngModel]="f().producteurs" (ngModelChange)="maj({ producteurs: $event })" />
          </label>
          <label class="field">Certification / label (optionnel)
            <input [ngModel]="f().certification" (ngModelChange)="maj({ certification: $event })" placeholder="Bio, GlobalG.A.P., …" />
          </label>
          <label class="field"><span><input type="checkbox" [ngModel]="f().livraison" (ngModelChange)="maj({ livraison: $event })" /> Je peux organiser la livraison</span></label>
          <label class="field full">Description (humidité, variété, conditionnement…)
            <textarea rows="3" [ngModel]="f().description" (ngModelChange)="maj({ description: $event })"></textarea>
          </label>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/marche">Annuler</a>
          <button class="primary" [disabled]="!valide() || envoi()" (click)="publier()">Publier l’offre</button>
        </div>
        @if (session.utilisateur()?.kyc !== 'verifie') { <p class="note">Votre compte doit être vérifié pour publier.</p> }
      </div>

      <div class="card">
        <h2>Récapitulatif</h2>
        <div class="ligne"><span>Quantité</span><strong>{{ calc().kg | nb }} kg</strong></div>
        <div class="ligne"><span>Prix</span><strong>{{ calc().prixKg | nb }} F/kg</strong></div>
        <div class="ligne"><span>Valeur du lot</span><strong>{{ calc().kg * calc().prixKg | fcfa }}</strong></div>
        <div class="ligne"><span>Vous recevez à la vente</span><span>{{ calc().kg * calc().prixKg | fcfa }}</span></div>
        <p class="hint">Les frais de service (2 %) sont payés par l’acheteur.</p>
        <h3 style="margin-top:14px">Repère de prix</h3>
        @if (calc().ref; as r) {
          <p class="small">Dernier prix de gros à <strong>{{ r.marcheId | loc }}</strong> : <strong>{{ r.prix | nb }} F/kg</strong>.</p>
          @let e = ((calc().prixKg - r.prix) / r.prix) * 100;
          <span class="badge" [class.ok]="e <= 5 && e >= -15" [class.warn]="e > 5" [class.ko]="e < -15">{{ e > 0 ? '+' : '' }}{{ e | nb }} % par rapport au marché</span>
          @if (e < -15) { <p class="small" style="margin-top:6px">Votre prix est nettement sous le marché : vous pourriez vendre plus cher.</p> }
          @if (e > 10) { <p class="small" style="margin-top:6px">Prix élevé : les acheteurs comparent le coût rendu, l’offre risque de rester sans preneur.</p> }
        } @else { <p class="small muted">Pas de relevé récent à proximité.</p> }
        <p class="hint" style="margin-top:12px">Un code de lot est généré automatiquement pour la traçabilité. Les acheteurs ayant une demande ouverte sur ce produit seront alertés.</p>
      </div>
    </div>
  </div>`,
})
export class OffreFormPage {
  protected readonly session = inject(SessionService);
  private readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly produits = PRODUITS;
  protected readonly localites = LOCALITES;
  protected readonly envoi = signal(false);

  protected readonly f = signal({
    produitId: 'mais', localiteId: this.session.utilisateur()!.localiteId, quantite: 10, uniteQte: 'sac100', prix: 0, unite: 'kg',
    qualite: 'A' as Qualite, disponibleLe: aujourdhui(), entrepotId: '', producteurs: 0, certification: '', livraison: false, description: '',
  });

  maj(p: Partial<ReturnType<typeof this.f>>) { this.f.update((x) => ({ ...x, ...p })); }
  produitUnite(id: string) { return produit(id).unites[1]?.code ?? 'kg'; }
  unites() { return produit(this.f().produitId).unites; }
  entrepots() { return this.pf.db.entrepots.items(); }

  protected readonly calc = computed(() => {
    const f = this.f();
    const p = produit(f.produitId);
    const uq = p.unites.find((u) => u.code === f.uniteQte) ?? p.unites[0];
    const up = p.unites.find((u) => u.code === f.unite) ?? p.unites[0];
    return { kg: Math.round((f.quantite || 0) * uq.kg), prixKg: Math.round((f.prix || 0) / up.kg), ref: this.pf.prixReference(f.produitId, f.localiteId) };
  });

  valide() {
    return this.calc().kg > 0 && this.calc().prixKg > 0 && this.session.utilisateur()?.kyc === 'verifie';
  }

  async publier() {
    this.envoi.set(true);
    const f = this.f();
    const c = this.calc();
    const o = await this.pf.publierOffre({
      produitId: f.produitId, quantiteKg: c.kg, prixKg: c.prixKg, qualite: f.qualite, localiteId: f.localiteId,
      disponibleLe: f.disponibleLe, description: f.description || '—', livraison: f.livraison,
      ...(f.producteurs ? { producteurs: f.producteurs } : {}), ...(f.certification ? { certification: f.certification } : {}),
      ...(f.entrepotId ? { entrepotId: f.entrepotId } : {}),
    });
    this.toast.afficher(`Offre publiée — lot ${o.lot}`);
    this.router.navigate(['/marche', o.id]);
  }
}
