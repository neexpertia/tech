import { Component, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  private t?: ReturnType<typeof setTimeout>;

  afficher(m: string) {
    this.message.set(m);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.message.set(''), 3500);
  }
}

@Component({
  selector: 'app-toast',
  template: `@if (toast.message()) { <div class="toast" role="status">{{ toast.message() }}</div> }`,
})
export class ToastComponent {
  protected readonly toast = inject(ToastService);
}
