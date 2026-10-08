import { create } from 'zustand'

export type FriendsTab = 'all' | 'pending' | 'add'

interface UIState {
  friendsTab: FriendsTab
  setFriendsTab: (tab: FriendsTab) => void
  serverInviteModalOpen: boolean
  openServerInviteModal: () => void
  closeServerInviteModal: () => void
  createChannelModalOpen: boolean
  openCreateChannelModal: () => void
  closeCreateChannelModal: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  friendsTab: 'all',
  setFriendsTab: (friendsTab) => set({ friendsTab }),
  serverInviteModalOpen: false,
  openServerInviteModal: () => set({ serverInviteModalOpen: true }),
  closeServerInviteModal: () => set({ serverInviteModalOpen: false }),
  createChannelModalOpen: false,
  openCreateChannelModal: () => set({ createChannelModalOpen: true }),
  closeCreateChannelModal: () => set({ createChannelModalOpen: false })
}))
