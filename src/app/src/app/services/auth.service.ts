import { Injectable, signal } from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
    auth: any;
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

  async inviteUser(payload: { email: string; role: string; teamId?: string }) {
    return await window.electronAPI.auth.inviteUser(payload);
  }

  async listUsers() {
    return await window.electronAPI.auth.listUsers();
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

  async handleCallback(url: string) {
    return window.electronAPI?.auth.handleCallback(url);
  }
}
