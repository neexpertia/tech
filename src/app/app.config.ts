import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { API_CONFIG } from './core/api/repository';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    { provide: LOCALE_ID, useValue: 'fr' },
    // ⇩ Pour brancher le backend : { mode: 'http', baseUrl: 'https://votre-serveur/api/v1' }
    { provide: API_CONFIG, useValue: { mode: 'local', baseUrl: '/api/v1' } },
  ],
};
