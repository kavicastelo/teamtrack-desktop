import { Injectable, signal } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {toObservable} from '@angular/core/rxjs-interop';

declare global {
  interface Window {
    electronAPI: any;
    auth: any;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Reactive state
  readonly session = signal<any | null>(null);
  readonly user = signal<any | null>(null);
  readonly userId = signal<string | null>(null);

  // Optional Observables (if you want RxJS compat)
  readonly session$ = toObservable(this.session);
  readonly user$ = toObservable(this.user);
  readonly userId$ = toObservable(this.userId);

  constructor() {}

  /** Restore session from local (Electron) */
  async init() {
    const session = await window.electronAPI.auth.restoreSession();
    if (session) {
      this.session.set(session);
      this.userId.set(session.user?.id ?? null);
      const user = await window.electronAPI.auth.getUser(session.user.id);
      this.user.set(user);
    } else {
      this.session.set(null);
      this.user.set(null);
      this.userId.set(null);
    }
  }

  /** Handle OAuth callback (from deep link) */
  async handleCallback(url: string) {
    const result = await window.electronAPI.auth.handleCallback(url);
    if (result?.session) {
      this.session.set(result.session);
      this.userId.set(result.user?.id ?? null);
      const user = await window.electronAPI.auth.getUser(result.user.id);
      this.user.set(user);
    }
  }

  async signOut() {
    await window.electronAPI.auth.signOut();
    this.session.set(null);
    this.user.set(null);
    this.userId.set(null);
  }

  async signIn(email: string) {
    return await window.electronAPI.auth.signInEmail(email);
  }

  async signInWithGoogle() {
    await window.electronAPI.auth.signInGoogle();
  }

  async inviteUser(payload: { email: string; role: string; teamId?: string }) {
    return await window.electronAPI.auth.inviteUser(payload);
  }

  async listUsers() {
    return await window.electronAPI.auth.listUsers();
  }

  async listLocalUsers() {
    return await window.electronAPI.auth.listLocalUsers();
  }

  async getUser(userId?: string) {
    return window.electronAPI?.auth.getUser(userId);
  }

  async updateUserRole(payload: { userId: string; role: string; teamId?: string }) {
    return await window.electronAPI.auth.updateUserRole(payload);
  }

  async removeUser(payload: { userId: string; hardDelete?: boolean }) {
    return await window.electronAPI.auth.removeUser(payload);
  }

  async updatePassword(password: any) {
    return window.electronAPI?.auth.updatePassword(password);
  }

  async updateProfile(profile: any) {
    return window.electronAPI?.auth.updateProfile(profile);
  }

  async restoreSession() {
    return window.electronAPI?.auth.restoreSession();
  }
}
