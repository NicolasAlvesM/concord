import { request } from './client'

export interface MessageAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface Message {
  id: string
  author_id: string
  author?: MessageAuthor
  channel_id?: string | null
  conversation_id?: string | null
  content: string
  created_at: string
}

export const MESSAGE_LIMIT = 50

export function listChannelMessages(channelId: string, before?: string): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/channels/${channelId}/messages?${query.toString()}`)
}

export function sendChannelMessage(channelId: string, content: string): Promise<Message> {
  return request<Message>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  })
}

export function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
  return request<void>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' })
}

export function listConversationMessages(
  conversationId: string,
  before?: string
): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/conversations/${conversationId}/messages?${query.toString()}`)
}

export function sendConversationMessage(conversationId: string, content: string): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  })
}

export function deleteConversationMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  return request<void>(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE'
  })
}
