import { Component, computed, inject } from '@angular/core';
import { MARCHES, MOIS_COURT, PRODUITS, REGIONS, localite } from '../core/data/referentiel';
import { PlateformeService } from '../core/plateforme.service';
import { LIBELLE_ROLE } from '../core/session.service';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-pilotage',
  imports: [...UI],
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Institution</div><h1>Régions & exports</h1>
        <p>Ce qui se passe réellement sur les marchés, calculé à partir de l’activité de la plateforme et des relevés de prix.</p></div>
      <div class="toolbar"><button (click)="exporterPrix()">⬇ Prix (CSV)</button><button (click)="exporterRegions()">⬇ Régions (CSV)</button></div>
    </div>

    <div class="grid g4">
      <div class="card kpi"><div class="v">{{ k().producteurs | nb }}</div><div class="l">producteurs touchés (dont membres de coopératives)</div></div>
      <div class="card kpi"><div class="v">{{ k().volumeT | nb }} t</div><div class="l">échangées via la plateforme</div></div>
      <div class="card kpi"><div class="v">{{ k().valeur | fcfa: true }}</div><div class="l">de transactions sécurisées</div></div>
      <div class="card kpi"><div class="v">{{ k().stockT | nb }} t</div><div class="l">stockées en magasin</div></div>
    </div>

    <div class="grid g2 section">
      <div class="card">
        <h2>Évolution des prix sur 12 mois — Ouagadougou</h2>
        <table class="small">
          <thead><tr><th>Produit</th><th class="num">{{ moisCourt[0] }} 2025</th><th class="num">Aujourd’hui</th><th class="num">Variation</th></tr></thead>
          <tbody>
            @for (l of indices(); track l.nom) {
              <tr><td>{{ l.nom }}</td><td class="num">{{ l.debut | nb }}</td><td class="num">{{ l.fin | nb }}</td>
                <td class="num"><span class="badge" [class.ko]="l.var > 15" [class.warn]="l.var > 5 && l.var <= 15" [class.ok]="l.var < -5">{{ l.var > 0 ? '+' : '' }}{{ l.var | nb }} %</span></td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>Alertes sécurité alimentaire & marchés</h2>
        <ul class="clean">
          @for (a of alertes(); track a.texte) { <li><span class="badge" [class.ko]="a.niveau === 'critique'" [class.warn]="a.niveau === 'vigilance'">{{ a.niveau }}</span> {{ a.texte }}</li> }
          @empty { <li class="muted">Aucune alerte.</li> }
        </ul>
      </div>
    </div>

    <div class="section">
      <h2>Offre et demande par région</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Région</th><th class="num">Offre active</th><th class="num">Demande ouverte</th><th>Solde</th><th class="num">Acteurs</th><th class="num">Stocks en magasin</th></tr></thead>
          <tbody>
            @for (r of regions(); track r.id) {
              <tr><td>{{ r.nom }}</td><td class="num">{{ r.offre | qte }}</td><td class="num">{{ r.demande | qte }}</td>
                <td>@if (r.offre || r.demande) { <span class="badge" [class.ok]="r.offre > r.demande" [class.ko]="r.offre < r.demande">{{ r.offre >= r.demande ? 'excédentaire' : 'déficitaire' }}</span> }</td>
                <td class="num">{{ r.acteurs }}</td><td class="num">{{ r.stock | qte }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p class="hint">Offre/demande de la plateforme uniquement ; à croiser avec les bilans céréaliers officiels.</p>
    </div>

    <div class="grid g2 section">
      <div class="card">
        <h2>Acteurs inscrits</h2>
        <app-barres [lignes]="parRole()" />
      </div>
      <div class="card">
        <h2>Prix obtenu par les vendeurs</h2>
        <p class="small">Écart moyen entre le prix de vente des commandes et le prix de gros du marché le plus proche du vendeur :</p>
        <div class="kpi"><div class="v">{{ k().premium > 0 ? '+' : '' }}{{ k().premium | nb: 1 }} %</div><div class="l">sur {{ k().nbCmd }} commandes</div></div>
        <p class="hint">Indicateur d’impact « accès au marché » : un écart positif signifie que les producteurs vendent mieux qu’au marché local.</p>
      </div>
    </div>
  </div>`,
})
export class PilotagePage {
  private readonly pf = inject(PlateformeService);
  private readonly db = this.pf.db;
  protected readonly moisCourt = MOIS_COURT;

  protected readonly k = computed(() => {
    const us = this.db.utilisateurs.items();
    const cmds = this.db.commandes.items().filter((c) => c.statut !== 'annulee');
    const premiums = cmds.map((c) => {
      const ref = this.pf.prixReference(c.produitId, c.origineId);
      return ref ? ((c.prixKg - ref.prix) / ref.prix) * 100 : null;
    }).filter((x): x is number => x !== null);
    return {
      producteurs: us.filter((u) => u.role === 'producteur').length + us.filter((u) => u.role === 'cooperative').reduce((s, u) => s + (u.membres ?? 0), 0),
      volumeT: Math.round(cmds.reduce((s, c) => s + c.quantiteKg, 0) / 1000),
      valeur: cmds.filter((c) => c.paiement).reduce((s, c) => s + (c.paiement?.montant ?? 0), 0),
      stockT: Math.round(this.db.depots.items().filter((d) => d.statut !== 'retire').reduce((s, d) => s + d.quantiteKg, 0) / 1000),
      premium: premiums.length ? premiums.reduce((s, x) => s + x, 0) / premiums.length : 0,
      nbCmd: premiums.length,
    };
  });

  protected readonly indices = computed(() => PRODUITS.map((p) => {
    const s = this.pf.serie(p.id, 'OUA').filter((x): x is number => x !== null);
    const fin = this.pf.prix(p.id, 'OUA')?.prix ?? s[s.length - 1];
    return { nom: p.nom, debut: s[0], fin, var: s[0] ? ((fin - s[0]) / s[0]) * 100 : 0 };
  }));

  protected readonly alertes = computed(() => {
    const a: { niveau: 'critique' | 'vigilance'; texte: string }[] = [];
    for (const p of PRODUITS) for (const m of MARCHES) {
      const d = this.pf.prix(p.id, m.id);
      if (d?.precedent) {
        const v = ((d.prix - d.precedent) / d.precedent) * 100;
        if (v >= 12 && p.categorie === 'Céréales') a.push({ niveau: v >= 20 ? 'critique' : 'vigilance', texte: `${p.nom} +${Math.round(v)} % à ${m.nom.split(' (')[0]} (${d.precedent} → ${d.prix} F/kg)` });
      }
    }
    for (const x of this.db.axes.items().filter((x) => x.niveau === 'deconseille'))
      a.push({ niveau: 'vigilance', texte: `Axe ${localite(x.origineId).nom} ↔ ${localite(x.destinationId).nom} : ${x.motif.toLowerCase()} — approvisionnement des marchés à surveiller.` });
    return a.slice(0, 8);
  });

  protected readonly regions = computed(() => REGIONS.map((r) => {
    const inR = (loc: string) => localite(loc).regionId === r.id;
    return {
      ...r,
      offre: this.db.offres.items().filter((o) => o.statut === 'active' && inR(o.localiteId)).reduce((s, o) => s + o.quantiteRestanteKg, 0),
      demande: this.db.demandes.items().filter((d) => d.statut === 'ouverte' && inR(d.localiteLivraisonId)).reduce((s, d) => s + d.quantiteKg, 0),
      acteurs: this.db.utilisateurs.items().filter((u) => inR(u.localiteId)).length,
      stock: this.db.depots.items().filter((d) => d.statut !== 'retire' && inR(this.db.entrepots.get(d.entrepotId)!.localiteId)).reduce((s, d) => s + d.quantiteKg, 0),
    };
  }).sort((a, b) => b.offre + b.demande - (a.offre + a.demande)));

  protected readonly parRole = computed(() => {
    const m = new Map<string, number>();
    this.db.utilisateurs.items().forEach((u) => m.set(LIBELLE_ROLE[u.role], (m.get(LIBELLE_ROLE[u.role]) ?? 0) + 1));
    return [...m].map(([label, valeur]) => ({ label, valeur })).sort((a, b) => b.valeur - a.valeur);
  });

  private telecharger(nom: string, lignes: (string | number)[][]) {
    const csv = lignes.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nom;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  exporterPrix() {
    const l: (string | number)[][] = [['produit', 'marche', 'date', 'prix_fcfa_kg', 'source']];
    for (const r of this.db.releves.items()) l.push([r.produitId, r.localiteId, r.date, r.prix, r.source]);
    this.telecharger('releves_prix.csv', l);
  }
  exporterRegions() {
    this.telecharger('regions.csv', [['region', 'offre_kg', 'demande_kg', 'acteurs', 'stock_kg'], ...this.regions().map((r) => [r.nom, r.offre, r.demande, r.acteurs, r.stock])]);
  }
}
