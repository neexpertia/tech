import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Notification } from '../core/models';
import { PlateformeService } from '../core/plateforme.service';

@Component({
  selector: 'app-notifications',
  template: `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Notifications</div><h1>Vos alertes</h1><p>Également envoyées par SMS selon vos préférences.</p></div>
      @if (pf.nonLues()) { <button (click)="pf.toutLire()">Tout marquer comme lu</button> }
    </div>
    <div class="card">
      <ul class="clean">
        @for (n of pf.mesNotifications(); track n.id) {
          <li class="notif" [class.nonlu]="!n.lu" (click)="ouvrir(n)">
            <span class="point"></span><span class="t">{{ n.texte }}</span><span class="small muted">{{ n.date }}</span>
          </li>
        } @empty { <li class="vide">Aucune notification.</li> }
      </ul>
    </div>
  </div>`,
  styles: `
    .notif { display: flex; gap: 10px; align-items: center; cursor: pointer; }
    .notif:hover .t { text-decoration: underline; }
    .t { flex: 1; }
    .point { width: 8px; height: 8px; border-radius: 50%; background: transparent; flex: none; }
    .nonlu .point { background: var(--primary); } .nonlu .t { font-weight: 600; }
  `,
})
export class NotificationsPage {
  protected readonly pf = inject(PlateformeService);
  private readonly router = inject(Router);

  async ouvrir(n: Notification) {
    if (!n.lu) await this.pf.db.notifications.update(n.id, { lu: true });
    if (n.lien) this.router.navigateByUrl(n.lien);
  }
}
