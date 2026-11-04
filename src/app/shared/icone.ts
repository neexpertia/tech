import { Component, computed, input } from '@angular/core';

/** Icônes au trait, une seule couleur (currentColor). Remplacent les emojis de la navigation. */
const P: Record<string, string> = {
  accueil: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  marche: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  panier: 'M4 9h16l-1.5 10.2a1 1 0 0 1-1 .8H6.5a1 1 0 0 1-1-.8zM8 9l4-5 4 5',
  favori: 'M12 20s-7-4.4-9-9.1C1.7 7.6 4 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.8 1.3-1.7 2.7-2.8 4.7-2.8 3.3 0 5.6 3.1 4.3 6.4C19 15.6 12 20 12 20z',
  commandes: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  messages: 'M4 5h16v11H8l-4 4z',
  alertes: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  actus: 'M5 4h12v16H6a2 2 0 0 1-2-2V6M17 8h3v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4',
  prix: 'M4 19 9.5 13l4 4L20 9M15 9h5v5',
  liste: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  cible: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  pousse: 'M12 21V11M12 11C12 7 9 4 4 4c0 4 3 7 8 7zM12 13c0-3 2.5-6 7-6 0 3.5-2.5 6-7 6z',
  camion: 'M2 6h12v10H2zM14 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  carte: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  route: 'M7 3 4 21M17 3l3 18M12 4v3M12 11v3M12 18v2',
  attention: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  oeil: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  barres: 'M5 20V11M12 20V5M19 20v-7',
  reglages: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-2.9 1.2V20h-3v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 4.6 15H4v-3h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1 2.1-2.1.1.1A1.7 1.7 0 0 0 10.3 5.8V4h3v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0 1.2 2.9H20v3h-.1',
  groupe: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M18 14c2.2.6 4 2.9 4 6',
  argent: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v.01M18 14v.01',
  boussole: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  balance: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',
  dossier: 'M3 6h6l2 2h10v11H3z',
  carteid: 'M3 5h18v14H3zM8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16c.5-1.7 1.6-2.5 3-2.5s2.5.8 3 2.5M14 9h4M14 13h4',
  idee: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
  recherche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  telephone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  check: 'M4 12.5 9.5 18 20 6',
  horloge: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bouclier: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5',
  sortie: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  points: 'M5 12h.01M12 12h.01M19 12h.01',
  partager: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  masquer: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lien: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  entrepot: 'M3 9 12 4l9 5v11H3zM7 20v-7h10v7M7 16h10',
};

/** Emojis encore utilisés dans la configuration des rôles → icône correspondante */
const ALIAS: Record<string, string> = {
  '🏠': 'accueil', '🛒': 'marche', '🧺': 'panier', '❤️': 'favori', '📦': 'commandes', '💬': 'messages', '🔔': 'alertes',
  '📰': 'actus', '📈': 'prix', '📋': 'liste', '🎯': 'cible', '🌱': 'pousse', '🚚': 'camion', '🗺️': 'carte', '🛣️': 'route',
  '⚠️': 'attention', '🔭': 'oeil', '📊': 'barres', '⚙️': 'reglages', '🤝': 'groupe', '💸': 'argent', '🧭': 'boussole',
  '⚖️': 'balance', '🗂️': 'dossier', '🪪': 'carteid', '💡': 'idee', '🏬': 'entrepot',
};

@Component({
  selector: 'app-ic',
  template: `@if (d()) {
    <svg viewBox="0 0 24 24" [attr.width]="taille()" [attr.height]="taille()" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="d()" /></svg>
  } @else { <span aria-hidden="true">{{ n() }}</span> }`,
  styles: `:host { display: inline-flex; align-items: center; justify-content: center; flex: none; } svg { display: block; }`,
})
export class IconeComponent {
  readonly n = input.required<string>();
  readonly taille = input(20);
  protected readonly d = computed(() => P[ALIAS[this.n()] ?? this.n()]);
}
