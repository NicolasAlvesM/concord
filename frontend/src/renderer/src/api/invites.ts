import { request } from './client'

export interface ServerInvite {
  id: string
  server_id: string
  server_name?: string
  server_icon_url?: string | null
  inviter_id: string
  inviter_username?: string
  invitee_id: string
  invitee_username?: string
  status?: string
  created_at?: string
}

export function listInvites(): Promise<ServerInvite[]> {
  return request<ServerInvite[]>('/invites')
}

export function listServerInvites(serverId: string): Promise<ServerInvite[]> {
  return request<ServerInvite[]>(`/servers/${serverId}/invites`)
}

export function acceptInvite(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/invites/${id}/accept`, { method: 'POST' })
}

export function declineInvite(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/invites/${id}/decline`, { method: 'POST' })
}
