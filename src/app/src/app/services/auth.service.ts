import { Injectable, signal } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

declare global {
  interface Window {
    electronAPI: any;
    auth: any;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<any | null>(null);
  private sessionSubject = new BehaviorSubject<any>(null);
  session$ = this.sessionSubject.asObservable();
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();
  private userIdSubject = new BehaviorSubject<any>(null);
  userId$ = this.userIdSubject.asObservable();

  async init(): Promise<Observable<any>> {
    const currentSession = this.sessionSubject.getValue();
    if (!currentSession) {
      await window.electronAPI.auth.restoreSession().then((session: any) => {
        this.sessionSubject.next(session);
        this.setUserId(session.user.id)
      });
    } else {
      await this.setUserId(currentSession.user.id);
    }
    return this.session$;
  }

  async setUser(session: any): Promise<Observable<any>> {
    if (session) {
      if (!this.user()) {  // Check if user is already set
        await window.electronAPI.auth.getUser().then((user: any) => {
          this.userSubject.next(user);  // Update BehaviorSubject if you are using it
          this.user.set(user);  // Update signal if you are using it
        });
      }
    }
    return this.user$;
  }

  async setUserId(userId: string): Promise<Observable<any>> {
    const currentUserId = this.userIdSubject.getValue();
    if (!currentUserId) {
      await window.electronAPI.auth.setUserId(userId).then(()=>{
        this.userIdSubject.next(userId);
        this.userId$ = this.userIdSubject.asObservable();
      });
    }
    return this.userId$;
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

  async restoreSession() {
    return window.electronAPI?.auth.restoreSession();
  }
}
