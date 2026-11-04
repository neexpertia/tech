import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AchatService } from '../../core/achat.service';
import { LOCALITES, MODES_PAIEMENT, ModePaiement, NUMERO_SEQUESTRE, codeUssd, localite } from '../../core/data/referentiel';
import { Commande, ModeLivraison, StatutCommande } from '../../core/models';
import { LIBELLE_STATUT, PlateformeService, heure } from '../../core/plateforme.service';
import { SessionService } from '../../core/session.service';
import { ACHAT_UI } from '../../shared/achat-ui';
import { ToastService } from '../../shared/toast';
import { UI } from '../../shared/ui';

const ETAPES: { statut: StatutCommande; label: string }[] = [
  { statut: 'attente_confirmation', label: 'Commandé' },
  { statut: 'attente_paiement', label: 'Vendeur a confirmé' },
  { statut: 'sequestre', label: 'Payée' },
  { statut: 'expediee', label: 'En route' },
  { statut: 'livree', label: 'Arrivée' },
  { statut: 'terminee', label: 'Reçu' },
];

const MODES: { id: ModeLivraison; label: string }[] = [
  { id: 'car', label: 'Car de transport en commun (colis)' },
  { id: 'transporteur', label: 'Camion / transporteur' },
  { id: 'vendeur', label: 'Je livre moi-même (moto, tricycle…)' },
  { id: 'enlevement', label: 'L’acheteur vient chercher' },
];

/** Emprise du Burkina Faso pour la mini-carte de suivi */
const BB = { latMin: 9.3, latMax: 15.2, lonMin: -5.6, lonMax: 2.5 };

/** 'AAAA-MM-JJTHH:mm' (heure locale) pour <input type="datetime-local"> */
const versLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

@Component({
  selector: 'app-commande-detail',
  imports: [FormsModule, RouterLink, ...UI, ...ACHAT_UI],
  template: `
  <div class="page">
    <a routerLink="/commandes" class="small">← Commandes</a>
    @if (cmd(); as c) {
      @let m = pf.montant(c);
      <div class="entete">
        <app-vignette [produitId]="c.produitId" />
        <div class="t">
          <div class="eyebrow">{{ c.reference }} · émise le {{ c.creeLe }}</div>
          <h1>{{ c.produitId | prod }} — {{ c.quantiteKg | qte }} à {{ c.prixKg | nb }} F/kg</h1>
          <p class="muted">{{ c.origineId | loc }} → {{ c.destinationId | loc }} · {{ estAcheteur() ? 'vendeur' : 'acheteur' }} <strong>{{ (estAcheteur() ? c.vendeurId : c.acheteurId) | qui }}</strong>
            @if (c.origineAchat === 'negociation') { · <span class="badge info">prix négocié</span> }</p>
        </div>
        <span class="badge big" [class.ok]="c.statut === 'terminee'" [class.ko]="c.statut === 'litige' || c.statut === 'annulee'" [class.warn]="c.statut === 'attente_confirmation' || c.statut === 'attente_paiement'" [class.info]="['sequestre', 'expediee', 'livree'].includes(c.statut)">{{ libelle[c.statut] }}</span>
      </div>

      <div class="card etapes">
        @for (e of etapes; track e.statut; let i = $index) {
          <div class="etape" [class.fait]="rang() >= i" [class.courant]="rang() === i">
            <span class="rond">{{ rang() > i ? '✓' : i + 1 }}</span><span class="small">{{ e.label }}</span>
          </div>
        }
      </div>
      @if (c.statut === 'litige') { <div class="note section"><strong>Litige : {{ c.litige?.motif }}</strong> — {{ c.litige?.description }} (ouvert le {{ c.litige?.ouvertLe }}). Les fonds restent bloqués jusqu’à l’arbitrage.</div> }
      @if (c.statut === 'annulee') {
        <div class="note section"><strong>Commande annulée.</strong> {{ derniereNote() }}
          @if (estAcheteur() && alternatives().length) { <div style="margin-top:8px">Offres équivalentes disponibles :
            @for (a of alternatives(); track a.o.id) { <a class="btn" style="margin:4px 4px 0 0" [routerLink]="['/marche', a.o.id]">{{ a.o.localiteId | loc }} · {{ a.o.prixKg }} F/kg</a> }</div> }
        </div>
      }

      <div class="split section">
        <div>
          <!-- ================= Prochaine étape ================= -->
          <div class="card prochaine">
            <h2>{{ titreAction() }}</h2>
            @switch (c.statut) {
              @case ('attente_confirmation') {
                <p>Votre quantité est <strong>mise de côté</strong>. {{ estVendeur() ? 'Confirmez que vous avez toujours la marchandise' : 'Le vendeur doit confirmer qu’il a toujours la marchandise' }} avant <strong>{{ echeance(c.confirmationAvant) }}</strong>
                  <span class="badge warn">{{ restant(c.confirmationAvant) }}</span>.</p>
                @if (estVendeur()) {
                  <div class="toolbar">
                    <button class="primary" (click)="confirmerDispo()">Oui, j’ai la marchandise</button>
                    <button class="danger" (click)="modal.set('indispo')">Je ne l’ai plus</button>
                  </div>
                } @else if (estAcheteur()) {
                  <p class="small muted">Vous ne payez rien tant que le vendeur n’a pas confirmé. Sans réponse, la commande est annulée automatiquement.</p>
                  <div class="toolbar"><button (click)="discuter()">💬 Écrire au vendeur</button><button class="danger" (click)="annuler()">Annuler la commande</button></div>
                }
              }
              @case ('attente_paiement') {
                @if (estAcheteur()) {
                  <p>Le vendeur a confirmé la disponibilité. Payez <strong>{{ m.total | fcfa }}</strong> : FasoAgri garde l’argent et ne le donne au vendeur qu’après votre réception.</p>
                  <div class="toolbar"><button class="primary big-b" (click)="ouvrirPaiement()">Payer {{ m.total | fcfa }}</button><button class="danger" (click)="annuler()">Annuler</button></div>
                } @else { <p>Disponibilité confirmée — en attente du paiement de l’acheteur.</p> }
              }
              @case ('sequestre') {
                @if (estVendeur()) {
                  <p>{{ m.total | fcfa }} sont payés et gardés par FasoAgri. Trouvez un moyen de transport, convenez avec le chauffeur de l’heure de départ, de l’heure d’arrivée et du lieu de remise, puis renseignez-les : l’acheteur est prévenu.</p>
                  <div class="toolbar">
                    <button [class.primary]="!c.livraison" (click)="ouvrirLivraison()">{{ c.livraison ? 'Modifier le transport' : 'Organiser la livraison' }}</button>
                    @if (c.livraison) { <button class="primary" (click)="modal.set('depart')">Marquer le départ</button> }
                    @if (!c.fretId && c.fraisTransport && !c.livraison) { <button (click)="demanderTransporteur()">Publier un fret (transporteurs FasoAgri)</button> }
                  </div>
                } @else if (estAcheteur()) {
                  <p>Paiement reçu, votre argent est protégé. {{ c.livraison ? 'Le transport est organisé : voir le suivi.' : 'Le vendeur organise le transport ; vous serez prévenu de l’heure de départ et d’arrivée.' }}</p>
                  @if (c.expeditionAvant) { <p class="small muted">Expédition attendue avant {{ echeance(c.expeditionAvant) }}.</p> }
                  @if (enRetard()) { <div class="note">Le vendeur n’a pas expédié dans le délai. <button class="danger" (click)="annulerRetard()">Annuler et être remboursé</button></div> }
                }
              }
              @case ('expediee') {
                @if (estVendeur()) {
                  <p>La marchandise est en route. Tenez l’acheteur informé à chaque étape.</p>
                  <div class="toolbar"><button (click)="modal.set('etape')">Donner des nouvelles</button><button class="primary" (click)="arrivee()">Arrivé à destination</button></div>
                } @else if (estAcheteur()) {
                  <p>En route. Quand la marchandise arrive : vérifiez-la, donnez ce code au chauffeur, puis appuyez sur « J’ai reçu ».</p>
                  <div class="code-remise">Code de réception <strong>{{ c.codeRemise }}</strong></div>
                  <div class="toolbar"><button class="primary" (click)="recevoir()">J’ai reçu la marchandise</button><button class="danger" (click)="modal.set('litige')">Signaler un problème</button></div>
                }
              }
              @case ('livree') {
                @if (estAcheteur()) {
                  <p>Arrivée{{ c.livraison?.pointRemise ? ' : ' + c.livraison?.pointRemise : '' }}. Présentez votre code au chauffeur, contrôlez poids et qualité.</p>
                  <div class="code-remise">Code de réception <strong>{{ c.codeRemise }}</strong></div>
                  <div class="toolbar"><button class="primary" (click)="recevoir()">Marchandise reçue et conforme</button><button class="danger" (click)="modal.set('litige')">Signaler un problème</button></div>
                } @else { <p>Arrivée signalée — en attente de la confirmation de réception par l’acheteur.</p> }
              }
              @case ('terminee') {
                @if ((estAcheteur() || estVendeur()) && !dejaNote()) {
                  <p>{{ estAcheteur() ? 'Votre avis aide les autres acheteurs : il sera affiché comme « achat vérifié » sur le produit.' : 'Notez l’acheteur.' }}</p>
                  <button class="primary" (click)="modal.set('noter')">{{ estAcheteur() ? 'Noter le produit et le vendeur' : 'Noter l’acheteur' }}</button>
                } @else { <p class="muted">Commande clôturée{{ dejaNote() ? ' — merci pour votre avis.' : '.' }}</p> }
                @if (estAcheteur() && c.source.type === 'offre') { <a class="btn" [routerLink]="['/marche', c.source.id]">Racheter</a> }
              }
              @default { <p class="muted">{{ attente() }}</p> }
            }
            @if (admin() && c.statut === 'litige') { <button class="primary" (click)="modal.set('arbitrer')">Arbitrer le litige</button> }
          </div>

          <!-- ================= Suivi de livraison ================= -->
          @if (c.livraison; as l) {
            <div class="card section suivi">
              <h2>Suivi de livraison @if (c.statut === 'expediee') { <span class="badge ok live">en direct</span> }</h2>
              <svg viewBox="0 0 300 120" class="carte" role="img" [attr.aria-label]="'Trajet ' + (c.origineId | loc) + ' vers ' + (c.destinationId | loc)">
                @let a = pt(c.origineId); @let b = pt(c.destinationId); @let q = progression();
                @for (r of reperes(); track r.id) { @let rp = pt(r.id); <circle [attr.cx]="rp.x" [attr.cy]="rp.y" r="2" class="rep" /><text [attr.x]="rp.x + 4" [attr.y]="rp.y + 3" class="rept">{{ court(r.id) }}</text> }
                <line [attr.x1]="a.x" [attr.y1]="a.y" [attr.x2]="b.x" [attr.y2]="b.y" class="route" />
                <line [attr.x1]="a.x" [attr.y1]="a.y" [attr.x2]="a.x + (b.x - a.x) * q" [attr.y2]="a.y + (b.y - a.y) * q" class="fait" />
                <circle [attr.cx]="a.x" [attr.cy]="a.y" r="5" class="pa" /><text [attr.x]="a.x" [attr.y]="a.y + 17" text-anchor="middle">{{ court(c.origineId) }}</text>
                <circle [attr.cx]="b.x" [attr.cy]="b.y" r="5" class="pb" /><text [attr.x]="b.x" [attr.y]="b.y - 9" text-anchor="middle">{{ court(c.destinationId) }}</text>
                <text [attr.x]="a.x + (b.x - a.x) * q" [attr.y]="a.y + (b.y - a.y) * q + 6" text-anchor="middle" class="camion">{{ l.mode === 'vendeur' ? '🛵' : l.mode === 'car' ? '🚌' : '🚚' }}</text>
              </svg>
              <div class="bar"><span [style.width.%]="progression() * 100"></span></div>
              <div class="grid g3 horaires">
                <div><div class="small muted">Départ {{ c.statut === 'sequestre' ? 'prévu' : '' }}</div><strong>{{ jourHeure(l.departPrevu) }}</strong></div>
                <div><div class="small muted">Arrivée prévue</div><strong>{{ jourHeure(l.arriveePrevue) }}</strong>@if (eta(); as e) { <div class="small" [class.retard]="e.retard">{{ e.texte }}</div> }</div>
                <div><div class="small muted">Où récupérer</div><strong>{{ l.pointRemise || (c.destinationId | loc) }}</strong></div>
              </div>
              <div class="contact">
                <div><span class="small muted">{{ l.mode === 'car' ? 'Car' : l.mode === 'transporteur' ? 'Transporteur' : l.mode === 'vendeur' ? 'Livré par le vendeur' : 'Enlèvement' }}</span>
                  <div><strong>{{ l.chauffeur || '—' }}</strong>@if (l.transporteur) { · {{ l.transporteur }} }</div>
                  @if (l.vehicule) { <div class="small muted">{{ l.vehicule }}</div> }</div>
                @if (l.telephoneChauffeur) { <a class="btn" [attr.href]="'tel:' + l.telephoneChauffeur.replace(/\s/g, '')"><app-ic n="telephone" [taille]="18" /> Appeler</a> }
              </div>
              <ol class="fil-suivi">
                @for (e of l.etapes.slice().reverse(); track $index) {
                  <li><span class="heure">{{ jourHeure(e.date) }}</span><div>@if (e.lieu) { <strong>{{ e.lieu }}</strong> · }{{ e.texte }}<div class="small muted">{{ e.auteurId | qui }}</div></div></li>
                }
              </ol>
            </div>
          }

          <div class="card section">
            <h2>Messages @if (conv(); as cv) { <a class="small" [routerLink]="['/messages', cv.id]">Discussion produit →</a> }</h2>
            <div class="fil">
              @for (msg of c.messages; track $index) {
                <div class="msg" [class.moi]="msg.auteurId === moi()"><div class="small muted">{{ msg.auteurId | qui }} · {{ msg.date }}</div>{{ msg.texte }}</div>
              } @empty { <p class="muted small">Aucun message.</p> }
            </div>
            @if (estAcheteur() || estVendeur()) {
              <div class="toolbar" style="margin-top:8px"><input style="flex:1" placeholder="Écrire un message…" [(ngModel)]="texte" (keyup.enter)="envoyer()" /><button (click)="envoyer()" [disabled]="!texte.trim()">Envoyer</button></div>
            }
          </div>

          <details class="card section histo">
            <summary>Historique</summary>
            <ul class="clean small">
              @for (h of c.historique; track $index) { <li><strong>{{ h.date }}</strong> — {{ libelle[h.statut] }} <span class="muted">par {{ h.parId | qui }}</span>@if (h.note) { · {{ h.note }} }</li> }
            </ul>
          </details>
        </div>

        <div class="card">
          <h2>Montants</h2>
          <div class="ligne"><span>Marchandise ({{ c.quantiteKg | nb }} kg × {{ c.prixKg | nb }} F)</span><span>{{ m.marchandise | fcfa }}</span></div>
          <div class="ligne"><span>Transport</span><span>{{ m.transport | fcfa }}</span></div>
          <div class="ligne"><span>Frais de service ({{ c.commissionPct }} %)</span><span>{{ m.commission | fcfa }}</span></div>
          <div class="ligne total"><span>Total</span><span>{{ m.total | fcfa }}</span></div>
          @if (!estAcheteur()) { <div class="ligne"><span>Vous recevez</span><span>{{ m.netVendeur | fcfa }}</span></div> }
          @if (c.paiement; as p) {
            <div class="note green" style="margin-top:10px">Payé le {{ p.date }} par <strong>{{ p.operateur }}</strong> — réf. {{ p.reference }}<br />
              {{ c.statut === 'terminee' ? 'Fonds libérés au vendeur.' : c.statut === 'annulee' ? 'Fonds restitués à l’acheteur.' : 'FasoAgri garde l’argent : il sera donné au vendeur quand vous aurez reçu la marchandise.' }}</div>
          }
          <p class="small muted" style="margin-top:10px">{{ c.quantiteKg | enUnite: c.produitId }}</p>
          @if (c.source.type === 'offre') { <a class="small" [routerLink]="['/marche', c.source.id]">Voir l’offre d’origine →</a> }
        </div>
      </div>

      <!-- ================= Fenêtres ================= -->
      @if (modal()) {
        <div class="modal-fond" (click)="modal.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            @switch (modal()) {
              @case ('payer') {
                <h2>Payer {{ m.total | fcfa }}</h2>
                <p class="small muted">FasoAgri garde votre argent et ne le donne au vendeur que quand vous avez reçu la marchandise. En cas de problème, vous êtes remboursé.</p>
                <div class="ops">
                  @for (o of modes; track o.operateur) { <button class="op" [class.on]="mode().operateur === o.operateur" (click)="mode.set(o)">{{ o.operateur }}</button> }
                </div>
                @if (ussd(); as code) {
                  <div class="ussd">
                    <div class="small muted">Composez sur votre téléphone Orange Money :</div>
                    <div class="code">{{ avantPin(code) }}<mark>PIN</mark>#</div>
                    <div class="small">Numéro FasoAgri <strong>{{ numero }}</strong> · montant <strong>{{ m.total | nb }}</strong> F</div>
                    <div class="toolbar" style="margin-top:8px">
                      <a class="btn primary" [attr.href]="lienComposeur(code)">📞 Ouvrir le composeur</a>
                      <button (click)="copier(code)">Copier le code</button>
                    </div>
                  </div>
                  <p class="hint">{{ mode().instructions }} Votre code secret ne doit jamais être saisi sur la plateforme.</p>
                  <label class="field">Identifiant de la transaction (SMS de confirmation Orange)<input [(ngModel)]="refTransaction" placeholder="Ex. PP261104.0712.C88231" /></label>
                  <div class="actions"><button (click)="modal.set(null)">Plus tard</button><button class="primary" [disabled]="!refTransaction.trim()" (click)="payer()">J’ai payé</button></div>
                } @else {
                  @if (mode().operateur !== 'Virement bancaire') { <label class="field">Numéro {{ mode().operateur }}<input type="tel" [(ngModel)]="numeroClient" placeholder="+226 •• •• •• ••" /></label> }
                  <p class="hint">{{ mode().instructions }} (Simulation : la validation est immédiate.)</p>
                  <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="payer()">{{ mode().operateur === 'Virement bancaire' ? 'J’ai fait le virement' : 'Envoyer la demande de paiement' }}</button></div>
                }
              }
              @case ('indispo') {
                <h2>Marchandise plus disponible</h2>
                <p class="small">La commande sera annulée (l’acheteur n’a rien payé) et votre offre marquée épuisée. Mettez-la à jour si vous avez encore une partie du stock.</p>
                <label class="field">Motif<select [(ngModel)]="motifIndispo"><option>Déjà vendu</option><option>Quantité insuffisante</option><option>Qualité dégradée</option><option>Autre</option></select></label>
                <div class="actions"><button (click)="modal.set(null)">Retour</button><button class="danger" (click)="indispo()">Confirmer l’indisponibilité</button></div>
              }
              @case ('livraison') {
                <h2>Organiser la livraison</h2>
                <p class="small muted">Renseignez ce que vous avez convenu avec le chauffeur. L’acheteur reçoit les heures et le lieu de remise par notification et SMS.</p>
                <div class="form-grid">
                  <label class="field full">Moyen de transport<select [(ngModel)]="liv.mode">@for (x of modesLiv; track x.id) { <option [value]="x.id">{{ x.label }}</option> }</select></label>
                  @if (liv.mode !== 'enlevement') {
                    <label class="field">Compagnie / propriétaire<input [(ngModel)]="liv.transporteur" placeholder="Ex. car de ligne Léo – Ouaga" /></label>
                    <label class="field">Chauffeur<input [(ngModel)]="liv.chauffeur" placeholder="Nom du chauffeur" /></label>
                    <label class="field">Téléphone du chauffeur<input type="tel" [(ngModel)]="liv.telephoneChauffeur" placeholder="+226 •• •• •• ••" /></label>
                    <label class="field">Véhicule<input [(ngModel)]="liv.vehicule" placeholder="Immatriculation, type" /></label>
                  }
                  <label class="field">Départ prévu<input type="datetime-local" [(ngModel)]="liv.depart" /></label>
                  <label class="field">Arrivée prévue<input type="datetime-local" [(ngModel)]="liv.arrivee" /></label>
                  <label class="field full">Lieu de remise à {{ c.destinationId | loc }}<input [(ngModel)]="liv.pointRemise" placeholder="Ex. gare routière, quai des cars de Léo ; marché, porte 3…" /></label>
                </div>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!liv.depart || !liv.arrivee" (click)="organiser()">Enregistrer et prévenir l’acheteur</button></div>
              }
              @case ('depart') {
                <h2>Marquer le départ</h2>
                <label class="field">Message à l’acheteur<textarea rows="2" [(ngModel)]="note" placeholder="Ex. 5 sacs chargés dans la soute, car parti à 7 h 10."></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="expedier()">Confirmer le départ</button></div>
              }
              @case ('etape') {
                <h2>Donner des nouvelles à l’acheteur</h2>
                <div class="form-grid">
                  <label class="field">Lieu<input [(ngModel)]="lieuEtape" placeholder="Ex. Sapouy" /></label>
                  <label class="field full">Information<textarea rows="2" [(ngModel)]="note" placeholder="Ex. Contrôle passé, arrivée vers 10 h 30."></textarea></label>
                </div>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!note.trim()" (click)="etape()">Envoyer à l’acheteur</button></div>
              }
              @case ('litige') {
                <h2>Signaler un problème</h2>
                <label class="field">Motif<select [(ngModel)]="motif"><option>Qualité non conforme</option><option>Quantité manquante</option><option>Retard de livraison</option><option>Marchandise endommagée</option><option>Autre</option></select></label>
                <label class="field" style="margin-top:8px">Description (quantités, photos à joindre côté backend)<textarea rows="3" [(ngModel)]="note"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="danger" [disabled]="!note" (click)="litige()">Ouvrir le litige</button></div>
              }
              @case ('arbitrer') {
                <h2>Arbitrer le litige</h2>
                <p class="small">{{ c.litige?.description }}</p>
                <label class="field">Décision<textarea rows="3" [(ngModel)]="note" placeholder="Ex. réfaction de 10 % sur le prix, remboursement partiel…"></textarea></label>
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" [disabled]="!note" (click)="arbitrer()">Clore le litige</button></div>
              }
              @case ('noter') {
                <h2>{{ estAcheteur() ? 'Votre avis sur le produit' : 'Noter l’acheteur' }}</h2>
                <div class="ops">@for (n of [1, 2, 3, 4, 5]; track n) { <button class="op" [class.on]="noteEtoiles === n" (click)="noteEtoiles = n">{{ n }} ★</button> }</div>
                <label class="field">Commentaire<textarea rows="3" [(ngModel)]="note" [placeholder]="estAcheteur() ? 'Qualité, propreté, poids, emballage, délai…' : 'Paiement, communication…'"></textarea></label>
                @if (estAcheteur()) { <p class="hint">Publié avec la mention « ✓ Achat vérifié » sur la fiche du produit.</p> }
                <div class="actions"><button (click)="modal.set(null)">Annuler</button><button class="primary" (click)="noter()">Publier l’avis</button></div>
              }
            }
          </div>
        </div>
      }
    } @else { <div class="vide">Commande introuvable.</div> }
  </div>`,
  styles: `
    .entete { display: flex; gap: 14px; align-items: flex-start; margin: 10px 0 16px; flex-wrap: wrap; }
    .entete .t { flex: 1; min-width: 220px; } .entete h1 { margin-bottom: 2px; } .entete p { margin: 0; }
    .big { font-size: 13px; padding: 4px 12px; }
    .etapes { display: flex; gap: 6px; justify-content: space-between; flex-wrap: wrap; }
    .etape { display: flex; align-items: center; gap: 8px; color: var(--muted); flex: 1 1 110px; }
    .rond { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-weight: 700; font-size: 12px; flex: none; }
    .etape.fait { color: var(--text); } .etape.fait .rond { background: var(--primary); color: #fff; }
    .etape.courant .rond { box-shadow: 0 0 0 4px var(--primary-soft); }
    .prochaine { border-color: var(--primary); }
    .histo summary { cursor: pointer; font-weight: 600; }
    .histo[open] summary { margin-bottom: 8px; }
    .big-b { font-size: 15px; padding: 9px 16px; }
    .code-remise { display: inline-block; margin: 4px 0 12px; padding: 8px 14px; border: 2px dashed var(--primary); border-radius: 10px; background: var(--primary-soft); }
    .code-remise strong { font-size: 22px; letter-spacing: .2em; font-family: ui-monospace, monospace; margin-left: 8px; }
    .carte { width: 100%; height: 150px; background: var(--surface-2); border-radius: 10px; margin-bottom: 8px; }
    .carte .route { stroke: var(--border); stroke-width: 4; stroke-dasharray: 6 5; stroke-linecap: round; }
    .carte .fait { stroke: var(--primary); stroke-width: 4; stroke-linecap: round; }
    .carte .pa { fill: var(--muted); } .carte .pb { fill: var(--primary); }
    .carte text { font-size: 9px; fill: var(--text); font-weight: 600; } .carte .camion { font-size: 16px; }
    .carte .rep { fill: var(--border); } .carte .rept { font-size: 7px; fill: var(--muted); font-weight: 400; }
    .horaires { margin: 12px 0; }
    .retard { color: var(--danger); } .live { animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: .5; } }
    .contact { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; background: var(--surface-2); border-radius: 10px; }
    .fil-suivi { list-style: none; padding: 0; margin: 14px 0 0; border-left: 2px solid var(--primary-soft); }
    .fil-suivi li { display: grid; grid-template-columns: 135px 1fr; gap: 10px; padding: 6px 0 6px 12px; position: relative; font-size: 13px; }
    .fil-suivi li::before { content: ''; position: absolute; left: -6px; top: 11px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    .fil-suivi .heure { color: var(--muted); font-size: 12px; }
    .fil { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow: auto; }
    .msg { background: var(--surface-2); padding: 8px 10px; border-radius: 10px; max-width: 80%; }
    .msg.moi { align-self: flex-end; background: var(--primary-soft); }
    .ops { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
    .op.on { background: var(--primary); color: #fff; border-color: var(--primary); }
    .ussd { background: var(--surface-2); border-radius: 10px; padding: 12px; margin: 6px 0 10px; }
    .ussd .code { font-family: ui-monospace, monospace; font-size: 19px; font-weight: 700; margin: 6px 0; word-break: break-all; }
    .ussd mark { background: var(--accent-soft); color: var(--accent); padding: 0 4px; border-radius: 4px; }
    @media (max-width: 600px) { .fil-suivi li { grid-template-columns: 1fr; gap: 0; } }
  `,
})
export class CommandeDetailPage {
  readonly id = input.required<string>();
  protected readonly pf = inject(PlateformeService);
  private readonly achat = inject(AchatService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly libelle = LIBELLE_STATUT;
  protected readonly etapes = ETAPES;
  protected readonly modes = MODES_PAIEMENT;
  protected readonly modesLiv = MODES;
  protected readonly numero = NUMERO_SEQUESTRE;
  protected readonly modal = signal<'payer' | 'indispo' | 'livraison' | 'depart' | 'etape' | 'litige' | 'arbitrer' | 'noter' | null>(null);
  protected readonly mode = signal<ModePaiement>(MODES_PAIEMENT[0]);
  protected refTransaction = '';
  protected numeroClient = '';
  protected note = '';
  protected lieuEtape = '';
  protected motif = 'Qualité non conforme';
  protected motifIndispo = 'Déjà vendu';
  protected noteEtoiles = 5;
  protected texte = '';
  protected liv = { mode: 'car' as ModeLivraison, transporteur: '', chauffeur: '', telephoneChauffeur: '', vehicule: '', depart: '', arrivee: '', pointRemise: '' };

  /** Horloge pour le suivi (rafraîchie toutes les 30 s) */
  private readonly maintenant = signal(Date.now());
  constructor() {
    const t = setInterval(() => this.maintenant.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected readonly cmd = computed(() => this.pf.db.commandes.get(this.id()));
  protected readonly moi = computed(() => this.session.utilisateur()!.id);
  protected readonly estAcheteur = computed(() => this.cmd()?.acheteurId === this.moi());
  protected readonly estVendeur = computed(() => this.cmd()?.vendeurId === this.moi());
  protected readonly admin = computed(() => this.session.role() === 'admin');
  protected readonly dejaNote = computed(() => this.pf.db.avis.items().some((a) => a.commandeId === this.id() && a.auteurId === this.moi()));
  protected readonly enRetard = computed(() => { this.maintenant(); return this.pf.expeditionEnRetard(this.cmd()!); });
  protected readonly conv = computed(() => { const c = this.cmd(); return c && c.source.type === 'offre' ? this.pf.db.conversations.items().find((v) => v.offreId === c.source.id && v.acheteurId === c.acheteurId) : undefined; });
  protected readonly alternatives = computed(() => { const c = this.cmd(); return c ? this.achat.alternatives(c.produitId, c.destinationId, c.source.id) : []; });
  protected readonly derniereNote = computed(() => this.cmd()?.historique.at(-1)?.note ?? '');
  protected readonly ussd = computed(() => { const c = this.cmd(); return c ? codeUssd(this.mode(), this.pf.montant(c).total) : undefined; });

  protected readonly rang = computed(() => {
    const c = this.cmd()!;
    const idx = (s: StatutCommande) => ETAPES.findIndex((e) => e.statut === s);
    if (c.statut === 'litige' || c.statut === 'annulee') return Math.max(...c.historique.map((h) => idx(h.statut)));
    return idx(c.statut);
  });

  protected readonly titreAction = computed(() => {
    const c = this.cmd()!;
    const v = this.estVendeur();
    switch (c.statut) {
      case 'attente_confirmation': return v ? 'À faire : confirmer la disponibilité' : 'En attente de confirmation du vendeur';
      case 'attente_paiement': return v ? 'En attente du paiement' : 'À faire : payer';
      case 'sequestre': return v ? 'À faire : organiser la livraison' : 'Le vendeur prépare la livraison';
      case 'expediee': return 'En route';
      case 'livree': return v ? 'Arrivée signalée' : 'À faire : réceptionner';
      case 'terminee': return 'Commande terminée';
      case 'litige': return 'Litige en cours';
      default: return 'Commande annulée';
    }
  });

  /** Avancement du trajet, estimé entre l'heure de départ et l'heure d'arrivée prévues. */
  protected readonly progression = computed(() => {
    const c = this.cmd()!;
    if (['livree', 'terminee'].includes(c.statut)) return 1;
    if (c.statut !== 'expediee' || !c.livraison?.departPrevu || !c.livraison.arriveePrevue) return 0;
    const d = Date.parse(c.livraison.departPrevu), a = Date.parse(c.livraison.arriveePrevue);
    return Math.max(0.03, Math.min(0.95, (this.maintenant() - d) / Math.max(1, a - d)));
  });

  protected readonly eta = computed(() => {
    const c = this.cmd()!;
    const a = c.livraison?.arriveePrevue;
    if (!a || !['sequestre', 'expediee'].includes(c.statut)) return null;
    const min = Math.round((Date.parse(a) - this.maintenant()) / 60_000);
    const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
    return min >= 0 ? { texte: `dans ${fmt(min)}`, retard: false } : { texte: `retard de ${fmt(-min)}`, retard: c.statut === 'expediee' };
  });

  /** Cadre de la carte : zoom sur le trajet (marge 0,4°), proportions conservées, borné au pays. */
  private readonly cadre = computed(() => {
    const c = this.cmd()!;
    const a = localite(c.origineId), b = localite(c.destinationId);
    let lonMin = Math.min(a.lon, b.lon) - 0.4, lonMax = Math.max(a.lon, b.lon) + 0.4;
    let latMin = Math.min(a.lat, b.lat) - 0.4, latMax = Math.max(a.lat, b.lat) + 0.4;
    const ratio = 300 / 120;
    const w = lonMax - lonMin, h = latMax - latMin;
    if (w / h < ratio) { const d = (h * ratio - w) / 2; lonMin -= d; lonMax += d; } else { const d = (w / ratio - h) / 2; latMin -= d; latMax += d; }
    return { lonMin: Math.max(BB.lonMin, lonMin), lonMax: Math.min(BB.lonMax, lonMax), latMin: Math.max(BB.latMin, latMin), latMax: Math.min(BB.latMax, latMax) };
  });
  /** Autres villes dans le cadre (repères) */
  protected readonly reperes = computed(() => {
    const k = this.cadre(), c = this.cmd()!;
    return LOCALITES.filter((l) => l.id !== c.origineId && l.id !== c.destinationId && l.lon > k.lonMin && l.lon < k.lonMax && l.lat > k.latMin && l.lat < k.latMax);
  });
  pt(id: string) {
    const l = localite(id), k = this.cadre();
    return { x: 20 + ((l.lon - k.lonMin) / (k.lonMax - k.lonMin)) * 260, y: 20 + ((k.latMax - l.lat) / (k.latMax - k.latMin)) * 84 };
  }
  court(id: string) { return localite(id).nom.split(' (')[0]; }

  echeance(iso?: string) { return this.jourHeure(iso); }
  restant(iso?: string) {
    if (!iso) return '';
    const h = (Date.parse(iso) - this.maintenant()) / 3_600_000;
    return h <= 0 ? 'délai dépassé' : h < 1 ? `${Math.round(h * 60)} min restantes` : `${Math.floor(h)} h restantes`;
  }
  jourHeure(iso?: string) {
    if (!iso) return 'à préciser';
    const d = new Date(iso);
    const auj = new Date().toDateString() === d.toDateString();
    const dem = new Date(Date.now() + 86_400_000).toDateString() === d.toDateString();
    const j = auj ? 'Aujourd’hui' : dem ? 'Demain' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return iso.length <= 10 ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : `${j} ${heure(iso)}`;
  }

  avantPin(code: string) { return code.replace('PIN#', ''); }
  /** Lien tel: — le code secret n'est jamais inclus, l'utilisateur le tape lui-même. */
  lienComposeur(code: string) { return 'tel:' + this.avantPin(code).replace(/#/g, '%23'); }
  async copier(code: string) {
    try { await navigator.clipboard.writeText(code); this.toast.afficher('Code copié.'); } catch { this.toast.afficher(code); }
  }

  attente() {
    const c = this.cmd()!;
    return c.statut === 'litige' ? 'Litige en cours d’arbitrage par la plateforme.' : 'Commande clôturée.';
  }

  private fin(m: string) { this.modal.set(null); this.note = ''; this.lieuEtape = ''; this.toast.afficher(m); }

  ouvrirPaiement() { this.refTransaction = ''; this.mode.set(MODES_PAIEMENT[0]); this.numeroClient = this.session.utilisateur()?.telephone ?? ''; this.modal.set('payer'); }
  async payer() { await this.pf.payer(this.cmd()!, this.mode().operateur, this.ussd() ? this.refTransaction : undefined); this.fin('Paiement reçu. FasoAgri garde l’argent ; le vendeur prépare l’envoi.'); }
  async confirmerDispo() { await this.pf.confirmerDisponibilite(this.cmd()!); this.toast.afficher('Disponibilité confirmée : l’acheteur peut payer.'); }
  async indispo() { await this.pf.declarerIndisponible(this.cmd()!, this.motifIndispo); this.fin('Commande annulée, offre marquée épuisée.'); }

  ouvrirLivraison() {
    const c = this.cmd()!;
    const l = c.livraison;
    const demain7 = new Date(); demain7.setDate(demain7.getDate() + 1); demain7.setHours(7, 0, 0, 0);
    this.liv = {
      mode: l?.mode ?? (c.quantiteKg >= 3000 ? 'transporteur' : 'car'), transporteur: l?.transporteur ?? '', chauffeur: l?.chauffeur ?? '', telephoneChauffeur: l?.telephoneChauffeur ?? '',
      vehicule: l?.vehicule ?? '', depart: versLocal(l?.departPrevu ?? demain7.toISOString()),
      arrivee: versLocal(l?.arriveePrevue ?? new Date(demain7.getTime() + Math.max(1, this.pf.coutRendu(0, c.produitId, c.origineId, c.destinationId).km / 55) * 3_600_000).toISOString()),
      pointRemise: l?.pointRemise ?? '',
    };
    this.modal.set('livraison');
  }
  async organiser() {
    const v = this.liv;
    await this.pf.organiserLivraison(this.cmd()!, {
      mode: v.mode, transporteur: v.transporteur || undefined, chauffeur: v.chauffeur || undefined, telephoneChauffeur: v.telephoneChauffeur || undefined,
      vehicule: v.vehicule || undefined, departPrevu: new Date(v.depart).toISOString(), arriveePrevue: new Date(v.arrivee).toISOString(), pointRemise: v.pointRemise || undefined,
    });
    this.fin('Livraison organisée : l’acheteur connaît les heures et le lieu de remise.');
  }
  async expedier() { await this.pf.expedier(this.cmd()!, this.note); this.fin('Départ enregistré, l’acheteur suit le trajet.'); }
  async etape() { await this.pf.ajouterEtape(this.cmd()!, this.note.trim(), this.lieuEtape.trim() || undefined); this.fin('Étape envoyée à l’acheteur.'); }
  async arrivee() { await this.pf.signalerArrivee(this.cmd()!); this.toast.afficher('Arrivée signalée : l’acheteur vient avec son code.'); }
  async recevoir() {
    if (!confirm('Confirmer que la marchandise est reçue et conforme ? Les fonds seront versés au vendeur.')) return;
    await this.pf.confirmerReception(this.cmd()!); this.fin('Réception confirmée, vendeur payé. Laissez un avis sur le produit !');
  }
  async litige() { await this.pf.ouvrirLitige(this.cmd()!, this.motif, this.note); this.fin('Litige ouvert, fonds bloqués.'); }
  async arbitrer() { await this.pf.resoudreLitige(this.cmd()!, this.note); this.fin('Litige clos.'); }
  async noter() { await this.pf.noter(this.cmd()!, this.noteEtoiles as 1, this.note); this.fin('Merci pour votre avis.'); }
  async annuler() { if (confirm('Annuler cette commande ? La quantité réservée sera libérée.')) { await this.pf.annuler(this.cmd()!); this.fin('Commande annulée.'); } }
  async annulerRetard() { if (confirm('Annuler et récupérer votre argent ?')) { await this.pf.annulerPourRetard(this.cmd()!); this.fin('Commande annulée, remboursement en cours.'); } }
  async demanderTransporteur() { await this.pf.demanderTransport(this.cmd()!); this.toast.afficher('Fret publié : les transporteurs sont alertés.'); }
  async discuter() {
    const c = this.cmd()!;
    const o = c.source.type === 'offre' ? this.pf.db.offres.get(c.source.id) : undefined;
    if (!o) return;
    const cv = await this.achat.discussion(o);
    this.router.navigate(['/messages', cv.id]);
  }
  async envoyer() {
    if (!this.texte.trim()) return;
    await this.pf.message(this.cmd()!, this.texte.trim());
    this.texte = '';
  }
}
