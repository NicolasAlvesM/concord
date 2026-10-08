import { request } from './client'
import type { User } from '../store/authStore'

export function getMe(): Promise<User> {
  return request<User>('/users/me')
}

export function searchUsers(username: string): Promise<User[]> {
  return request<User[]>(`/users/search?username=${encodeURIComponent(username)}`)
}
