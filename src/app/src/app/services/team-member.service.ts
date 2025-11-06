import {Injectable} from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
    tm: any;
  }
}

@Injectable({ providedIn: 'root' })
export class TeamMemberService {

  async createTeamMember(payload: any) {
    return window.electronAPI.tm.createTeamMember(payload);
  }

  async updateTeamMember(payload: any) {
    return window.electronAPI.tm.updateTeamMember(payload);
  }

  async updateTeamMemberRole(payload: any) {
    return window.electronAPI.tm.updateTeamMemberRole(payload);
  }

  async deleteTeamMember(memberId: string) {
    return window.electronAPI.tm.deleteTeamMember(memberId);
  }

  async listTeamMembers(teamId: string|null) {
    return window.electronAPI.tm.listTeamMembers(teamId);
  }
}
