import { request } from './client'

export type PresenceMap = Record<string, boolean>

export function fetchPresence(userIds: string[]): Promise<PresenceMap> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return Promise.resolve({})
  return request<PresenceMap>(`/presence?ids=${encodeURIComponent(unique.join(','))}`)
}
