import { request } from './client'

export interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  updated_at: string
}

export interface ConversationOtherUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface ConversationLastMessage {
  id: string
  author_id: string
  content: string
  created_at: string
}

export interface ConversationSummary extends Conversation {
  other_user: ConversationOtherUser
  last_message?: ConversationLastMessage
}

export function listConversations(): Promise<ConversationSummary[]> {
  return request<ConversationSummary[]>('/conversations')
}

export function getOrCreateConversationWith(userId: string): Promise<Conversation> {
  return request<Conversation>(`/conversations/with/${userId}`)
}
