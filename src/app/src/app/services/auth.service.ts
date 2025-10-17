import { Injectable, signal } from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<any | null>(null);

  async init() {
    const session = await window.electronAPI.auth.restoreSession();
    if (session) {
      const user = await window.electronAPI.auth.getUser();
      this.user.set(user);
    }
  }

  async signIn(email: string) {
    return await window.electronAPI.auth.signInEmail(email);
  }

  async signInWithGoogle() {
    await window.electronAPI.auth.signInGoogle();
  }

  async signOut() {
    await window.electronAPI.auth.signOut();
    this.user.set(null);
  }
}
