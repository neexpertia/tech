import { Component, Injectable, inject, signal } from '@angular/core';

export interface ActionToast { label: string; fn: () => void }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  /** Action proposée dans le message (ex. « Annuler ») */
  readonly action = signal<ActionToast | null>(null);
  private t?: ReturnType<typeof setTimeout>;

  afficher(m: string, action?: ActionToast) {
    this.message.set(m);
    this.action.set(action ?? null);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.fermer(), action ? 6000 : 3500);
  }

  fermer() { this.message.set(''); this.action.set(null); }
}

@Component({
  selector: 'app-toast',
  template: `@if (toast.message()) {
    <div class="toast" role="status">{{ toast.message() }}
      @if (toast.action(); as a) { <button class="act" (click)="a.fn(); toast.fermer()">{{ a.label }}</button> }
    </div> }`,
  styles: `.act { margin-left: 12px; background: transparent; border: 0; color: inherit; text-decoration: underline; padding: 0; font-weight: 700; }`,
})
export class ToastComponent {
  protected readonly toast = inject(ToastService);
}
