import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import {
  startCall as startCallApi,
  endCall as endCallApi,
  getCallState,
  type CallStateResponse
} from '../api/calls'
import {
  createPeerConnection,
  getAudioStream,
  getCameraStream,
  getDisplayStream,
  createOffer,
  createAnswer,
  connectMesh,
  shouldInitiateOffer,
  type PeerHandlers
} from '../lib/rtc'
import { useChatStore } from './chatStore'
import { useAuthStore } from './authStore'
import { showToast } from './toastStore'

export type CallStatus = 'idle' | 'ringing' | 'outgoing' | 'active'
export type CallKind = 'dm' | 'channel'
/** Origem do vídeo negociado — vai no metadado `media` da offer. */
export type VideoKind = 'screen' | 'camera'

export interface CallUserInfo {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

interface InvitePayload {
  call_id: string
  type: string
  initiator: CallUserInfo
  conversation_id?: string | null
}

interface RingPayload {
  call_id: string
  callee: CallUserInfo
}

interface ResponsePayload {
  call_id: string
  user: CallUserInfo
}

interface SignalRelayPayload {
  call_id: string
  from_user_id: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  /** metadado da renegociação — indica a origem do vídeo que a offer adiciona */
  media?: VideoKind
}

interface StatePayload {
  call_id: string
  user: CallUserInfo
}

interface ScreenSharePayload {
  call_id: string
  user: CallUserInfo
  active: boolean
}

interface EndedPayload {
  call_id: string
}

function upsertParticipant(list: CallUserInfo[], user: CallUserInfo): CallUserInfo[] {
  return list.some((p) => p.id === user.id) ? list : [...list, user]
}

interface CallState {
  status: CallStatus
  callId: string | null
  type: CallKind | null
  conversationId: string | null
  channelId: string | null
  participants: CallUserInfo[]
  isInitiator: boolean
  streams: Record<string, MediaStream>
  /** userId -> stream de tela remota (Fase 3) */
  screenStreams: Record<string, MediaStream>
  /** stream de tela local enquanto isScreenSharing (reativo p/ preview) */
  localScreenStream: MediaStream | null
  isScreenSharing: boolean
  /** userId -> stream de câmera remota (Fase 4, DM) */
  videoStreams: Record<string, MediaStream>
  /** stream da câmera local enquanto ligada (reativo p/ preview espelhado) */
  localCameraStream: MediaStream | null
  /** quem está compartilhando tela segundo o backend (registry) */
  screenSharers: string[]
  /** tela em foco no layout expandido (estilo Go Live) */
  focusedScreenUserId: string | null
  muted: boolean
  deafened: boolean
  startedAt: number | null
  /** incrementa a cada evento call:* relevante — usado pela UI p/ revalidar listas */
  listVersion: number
  /** chamadas ativas por canal do servidor aberto (polling da sidebar) */
  serverCalls: Record<string, CallStateResponse>

  startDMCall: (conversationId: string, peer: CallUserInfo) => Promise<void>
  startChannelCall: (channelId: string) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
  toggleCamera: () => Promise<void>
  setFocusedScreenUser: (userId: string | null) => void
  setServerCalls: (map: Record<string, CallStateResponse>) => void
  joinVoiceChannel: (channelId: string) => Promise<void>
  handleWsEvent: (event: WsEvent) => void
}

const peers = new Map<string, RTCPeerConnection>()
const pendingCandidates = new Map<string, RTCIceCandidateInit[]>()
let localStream: MediaStream | null = null
let transitioning = false

// Compartilhamento de tela (não-reativo; o estado reativo é localScreenStream)
let localScreenStream: MediaStream | null = null
// Câmera local (não-reativa; o estado reativo é localCameraStream)
let localCameraStream: MediaStream | null = null
/** peerId -> origem do próximo vídeo remoto desse par (metadado da offer recebida) */
const remoteVideoHint = new Map<string, VideoKind>()
/** peerId -> renegociação adiada esperando stable (preserva o metadado; true = sem vídeo) */
const pendingNegotiation = new Map<string, VideoKind | true>()

function stopLocalStream(): void {
  localStream?.getTracks().forEach((t) => t.stop())
  localStream = null
}

export const useCallStore = create<CallState>()((set, get) => {
  const signal = (toUserId: string, body: Record<string, unknown>): void => {
    const callId = get().callId
    if (!callId) return
    useChatStore
      .getState()
      .sendEvent('call:signal', { call_id: callId, to_user_id: toUserId, ...body })
  }

  const makePeerHandlers = (peerId: string): PeerHandlers => ({
    onLocalCandidate: (candidate: RTCIceCandidate): void => {
      signal(peerId, { candidate: candidate.toJSON() })
    },
    onRemoteStream: (stream: MediaStream): void => {
      if (stream.getVideoTracks().length === 0) {
        set((s) => ({ streams: { ...s.streams, [peerId]: stream } }))
        return
      }
      // Classificação em camadas: (1) metadado `media` da offer recebida;
      // (2) contentHint da track remota ('motion' câmera / 'detail' tela);
      // (3) complementar — se o par já tem um tipo classificado, o novo é o
      // outro; (4) fallback pelo tipo de chamada (DM = câmera, canal = tela).
      let kind = remoteVideoHint.get(peerId)
      remoteVideoHint.delete(peerId)
      if (!kind) {
        const hint = stream.getVideoTracks()[0]?.contentHint
        if (hint === 'motion') kind = 'camera'
        else if (hint === 'detail') kind = 'screen'
      }
      const s = get()
      if (!kind) {
        const hasCamera = Boolean(s.videoStreams[peerId])
        const hasScreen = Boolean(s.screenStreams[peerId])
        if (hasCamera && !hasScreen) kind = 'screen'
        else if (hasScreen && !hasCamera) kind = 'camera'
      }
      kind ??= s.type === 'dm' ? 'camera' : 'screen'
      if (kind === 'screen') {
        set((s) => ({
          screenStreams: { ...s.screenStreams, [peerId]: stream },
          focusedScreenUserId: s.focusedScreenUserId ?? peerId,
          participants: upsertParticipant(s.participants, {
            id: peerId,
            username: '',
            display_name: s.participants.find((p) => p.id === peerId)?.display_name ?? 'Usuário'
          })
        }))
        return
      }
      // Câmera remota: o par remove a track ao desligar — o evento 'mute'
      // sincroniza a UI (remove o tile); 'unmute' restaura; 'ended' é definitivo.
      const removeCamera = (): void => {
        set((s) => {
          const videoStreams = { ...s.videoStreams }
          delete videoStreams[peerId]
          return { videoStreams }
        })
      }
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('mute', removeCamera)
        track.addEventListener('unmute', () => {
          set((s) => ({
            videoStreams: { ...s.videoStreams, [peerId]: stream },
            participants: upsertParticipant(s.participants, {
              id: peerId,
              username: '',
              display_name: s.participants.find((p) => p.id === peerId)?.display_name ?? 'Usuário'
            })
          }))
        })
        track.addEventListener('ended', () => {
          track.removeEventListener('mute', removeCamera)
          removeCamera()
        })
      })
      set((s) => ({
        videoStreams: { ...s.videoStreams, [peerId]: stream },
        participants: upsertParticipant(s.participants, {
          id: peerId,
          username: '',
          display_name: s.participants.find((p) => p.id === peerId)?.display_name ?? 'Usuário'
        })
      }))
    },
    onConnectionStateChange: (state: RTCPeerConnectionState): void => {
      if (state !== 'failed') return
      if (get().type === 'channel') {
        showToast.error('Conexão com um participante falhou.')
        detachPeer(peerId)
      } else {
        showToast.error('Falha na conexão da chamada.')
        get().endCall()
      }
    },
    onSignalingStateChange: (state: RTCSignalingState): void => {
      if (state !== 'stable') return
      const pc = peers.get(peerId)
      const kind = pendingNegotiation.get(peerId)
      if (!pc || kind === undefined) return
      pendingNegotiation.delete(peerId)
      void negotiatePeer(peerId, kind === true ? undefined : kind)
    }
  })

  /** Anexa as tracks da tela local a um PC (sem duplicar senders). */
  const attachScreenTracks = (pc: RTCPeerConnection): void => {
    if (!localScreenStream) return
    localScreenStream.getTracks().forEach((track) => {
      const already = pc.getSenders().some((sender) => sender.track === track)
      if (!already) pc.addTrack(track, localScreenStream as MediaStream)
    })
  }

  /** Anexa as tracks da câmera local a um PC (sem duplicar senders). */
  const attachCameraTracks = (pc: RTCPeerConnection): void => {
    if (!localCameraStream) return
    localCameraStream.getTracks().forEach((track) => {
      const already = pc.getSenders().some((sender) => sender.track === track)
      if (!already) pc.addTrack(track, localCameraStream as MediaStream)
    })
  }

  const ensurePeerConnection = (peerId: string): RTCPeerConnection => {
    const existing = peers.get(peerId)
    if (existing) {
      attachScreenTracks(existing)
      attachCameraTracks(existing)
      return existing
    }

    const pc = createPeerConnection(makePeerHandlers(peerId))
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream as MediaStream))
    attachScreenTracks(pc)
    attachCameraTracks(pc)
    peers.set(peerId, pc)
    pendingCandidates.set(peerId, [])
    return pc
  }

  const detachPeer = (peerId: string): void => {
    peers.get(peerId)?.close()
    peers.delete(peerId)
    pendingCandidates.delete(peerId)
    remoteVideoHint.delete(peerId)
    set((s) => {
      const streams = { ...s.streams }
      delete streams[peerId]
      const screenStreams = { ...s.screenStreams }
      delete screenStreams[peerId]
      const videoStreams = { ...s.videoStreams }
      delete videoStreams[peerId]
      return {
        streams,
        screenStreams,
        videoStreams,
        focusedScreenUserId: s.focusedScreenUserId === peerId ? null : s.focusedScreenUserId,
        participants: s.participants.filter((p) => p.id !== peerId)
      }
    })
  }

  const flushCandidates = async (peerId: string): Promise<void> => {
    const pc = peers.get(peerId)
    const queued = pendingCandidates.get(peerId) ?? []
    pendingCandidates.set(peerId, [])
    if (!pc || !pc.remoteDescription) return
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // stale candidate, ignore
      }
    }
  }

  const cleanup = (): void => {
    const callId = get().callId
    if (callId) useChatStore.getState().unsubscribeRoom(`call:${callId}`)
    peers.forEach((pc) => pc.close())
    peers.clear()
    pendingCandidates.clear()
    remoteVideoHint.clear()
    pendingNegotiation.clear()
    stopLocalStream()
    localScreenStream?.getTracks().forEach((t) => t.stop())
    localScreenStream = null
    localCameraStream?.getTracks().forEach((t) => t.stop())
    localCameraStream = null
    set({
      status: 'idle',
      callId: null,
      type: null,
      conversationId: null,
      channelId: null,
      participants: [],
      isInitiator: false,
      streams: {},
      screenStreams: {},
      localScreenStream: null,
      isScreenSharing: false,
      videoStreams: {},
      localCameraStream: null,
      screenSharers: [],
      focusedScreenUserId: null,
      muted: false,
      deafened: false,
      startedAt: null
    })
  }

  const bumpList = (): void => {
    set((s) => ({ listVersion: s.listVersion + 1 }))
  }

  /**
   * Metadado da origem de vídeo para a próxima offer, derivado do estado local.
   * Com câmera E tela ativas ao mesmo tempo não há tag única — a offer vai sem
   * metadado e o receptor classifica por heurística (contentHint/complementar).
   */
  const currentVideoMeta = (): VideoKind | undefined => {
    if (get().isScreenSharing && localCameraStream) return undefined
    if (localCameraStream) return 'camera'
    if (get().isScreenSharing) return 'screen'
    return undefined
  }

  /**
   * Cria e envia uma offer para o par. Usada tanto no estabelecimento inicial
   * do mesh quanto na renegociação (compartilhamento de tela/câmera). Se o PC
   * não está estável, adia para quando voltar a stable (via onSignalingStateChange).
   */
  const negotiatePeer = async (peerId: string, media?: VideoKind): Promise<void> => {
    const pc = peers.get(peerId)
    if (!pc) return
    if (pc.signalingState !== 'stable') {
      pendingNegotiation.set(peerId, media ?? true)
      return
    }
    try {
      const offer = await createOffer(pc)
      signal(peerId, media ? { sdp: offer, media } : { sdp: offer })
    } catch {
      // PC fechado durante a negociação
    }
  }

  // Compat com os fluxos existentes (estabelecimento inicial do mesh).
  const beginNegotiationAsCaller = async (peerId: string): Promise<void> => {
    ensurePeerConnection(peerId)
    // A oferta inicial já carrega as tracks locais ativas (áudio + vídeo);
    // a tag ajuda o par a classificar o stream corretamente.
    await negotiatePeer(peerId, currentVideoMeta())
  }

  const handleSignal = async (payload: SignalRelayPayload): Promise<void> => {
    const state = get()
    const myId = useAuthStore.getState().user?.id ?? ''
    if (state.callId !== payload.call_id || payload.from_user_id === myId) {
      return
    }
    const peerId = payload.from_user_id

    if (payload.sdp) {
      const desc = payload.sdp
      if (desc.type === 'offer') {
        const pc = ensurePeerConnection(peerId)

        // Glare (os dois lados criaram offer ao mesmo tempo — ex.: dois
        // começaram a compartilhar juntos): o lado "polite" (id maior) cede
        // com rollback; o "impolite" ignora a offer conflitante.
        let rolledBack = false
        if (pc.signalingState === 'have-local-offer') {
          if (myId <= peerId) return
          try {
            await pc.setLocalDescription({ type: 'rollback' } as RTCLocalSessionDescriptionInit)
            rolledBack = true
          } catch {
            return
          }
        }

        if (payload.media) remoteVideoHint.set(peerId, payload.media)
        try {
          const answer = await createAnswer(pc, desc)
          signal(peerId, { sdp: answer })
          await flushCandidates(peerId)
        } catch {
          return
        }
        // Perdi minha offer no rollback: renegocio meu vídeo agora que está stable.
        if (rolledBack) {
          void negotiatePeer(peerId, currentVideoMeta())
        }
      } else if (desc.type === 'answer') {
        const pc = ensurePeerConnection(peerId)
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(desc)
          await flushCandidates(peerId)
        }
      }
      return
    }

    if (payload.candidate) {
      const pc = peers.get(peerId)
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch {
          // stale candidate, ignore
        }
      } else {
        const queue = pendingCandidates.get(peerId) ?? []
        queue.push(payload.candidate)
        pendingCandidates.set(peerId, queue)
      }
    }
  }

  return {
    status: 'idle',
    callId: null,
    type: null,
    conversationId: null,
    channelId: null,
    participants: [],
    isInitiator: false,
    streams: {},
    screenStreams: {},
    localScreenStream: null,
    isScreenSharing: false,
    videoStreams: {},
    localCameraStream: null,
    screenSharers: [],
    focusedScreenUserId: null,
    muted: false,
    deafened: false,
    startedAt: null,
    listVersion: 0,
    serverCalls: {},

    startDMCall: async (conversationId, peer) => {
      if (get().status !== 'idle' || transitioning) return
      transitioning = true
      try {
        localStream = await getAudioStream()
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        return
      }

      try {
        const call = await startCallApi({ type: 'dm', conversation_id: conversationId })
        set({
          status: 'outgoing',
          callId: call.id,
          type: 'dm',
          conversationId,
          channelId: null,
          participants: [peer],
          isInitiator: true,
          streams: {},
          muted: false,
          deafened: false,
          startedAt: null
        })
        useChatStore.getState().subscribeRoom(`call:${call.id}`)
      } catch (err) {
        stopLocalStream()
        showToast.error(err instanceof Error ? err.message : 'Não foi possível iniciar a chamada.')
      } finally {
        transitioning = false
      }
    },

    startChannelCall: async (channelId) => {
      if (get().status !== 'idle' || transitioning) return
      transitioning = true
      try {
        localStream = await getAudioStream()
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        return
      }

      try {
        // Idempotente no backend: se já há chamada ativa no canal, entra nela.
        const call = await startCallApi({ type: 'channel', channel_id: channelId })
        set({
          status: 'active',
          callId: call.id,
          type: 'channel',
          conversationId: null,
          channelId,
          participants: [],
          isInitiator: false,
          streams: {},
          muted: false,
          deafened: false,
          startedAt: Date.now()
        })
        useChatStore.getState().subscribeRoom(`call:${call.id}`)

        const meId = useAuthStore.getState().user?.id
        if (meId) {
          try {
            const state = await getCallState(call.id)
            const others = state.participants.filter((p) => p.user_id !== meId)
            const sharing = state.screen_sharing ?? []
            set((s) => ({
              screenSharers: sharing,
              focusedScreenUserId: s.focusedScreenUserId ?? sharing[0] ?? null,
              participants: [
                ...s.participants,
                ...others
                  .filter((p) => p.user_id && !s.participants.some((q) => q.id === p.user_id))
                  .map((p) => ({
                    id: p.user_id,
                    username: p.username ?? '',
                    display_name: p.display_name ?? p.username ?? 'Usuário',
                    avatar_url: p.avatar_url ?? null
                  }))
              ]
            }))
            const connections = connectMesh(
              others.map((p) => ({ id: p.user_id })),
              { myId: meId, stream: localStream, createHandlers: makePeerHandlers }
            )
            connections.forEach((pc, peerId) => {
              peers.set(peerId, pc)
              pendingCandidates.set(peerId, [])
              if (shouldInitiateOffer(meId, peerId)) void beginNegotiationAsCaller(peerId)
            })
          } catch {
            // estado indisponível: o mesh se forma pelos eventos call:joined
          }
        }
        bumpList()
      } catch (err) {
        stopLocalStream()
        showToast.error(err instanceof Error ? err.message : 'Não foi possível entrar na chamada.')
      } finally {
        transitioning = false
      }
    },

    acceptCall: async () => {
      const { status, callId, participants } = get()
      const peer = participants[0]
      if (status !== 'ringing' || !callId || !peer || transitioning) return
      transitioning = true
      try {
        localStream = await getAudioStream()
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        return
      }

      ensurePeerConnection(peer.id)
      // Otimista: o broadcast de call:accept pode chegar antes da assinatura da room.
      set({ status: 'active', startedAt: Date.now() })
      useChatStore.getState().sendEvent('call:accept', { call_id: callId })
      useChatStore.getState().subscribeRoom(`call:${callId}`)
      transitioning = false
    },

    declineCall: () => {
      const { status, callId } = get()
      if (status !== 'ringing' || !callId) return
      useChatStore.getState().sendEvent('call:decline', { call_id: callId })
      cleanup()
    },

    endCall: () => {
      const { callId, status, type } = get()
      if (!callId) {
        cleanup()
        return
      }
      if (status === 'ringing') {
        useChatStore.getState().sendEvent('call:decline', { call_id: callId })
      } else {
        useChatStore.getState().sendEvent('call:leave', { call_id: callId })
        // Em canal, a queda de WS já dispara HandleDisconnect no servidor.
        if (type === 'dm' && !useChatStore.getState().isWsConnected()) {
          void endCallApi(callId).catch(() => {})
        }
      }
      cleanup()
      bumpList()
    },

    toggleMute: () => {
      const next = !get().muted
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !next
      })
      set({ muted: next })
    },

    toggleDeafen: () => {
      set({ deafened: !get().deafened })
    },

    startScreenShare: async () => {
      const s = get()
      if (s.status !== 'active' || s.isScreenSharing || transitioning) return
      let stream: MediaStream
      try {
        stream = await getDisplayStream()
      } catch (err) {
        // NotAllowedError: usuário cancelou o picker — sem toast.
        if ((err as DOMException)?.name !== 'NotAllowedError') {
          showToast.error('Não foi possível compartilhar a tela.')
        }
        return
      }

      localScreenStream = stream
      const meId = useAuthStore.getState().user?.id
      const callId = get().callId
      set((prev) => ({
        isScreenSharing: true,
        localScreenStream: stream,
        screenSharers: meId
          ? Array.from(new Set([...prev.screenSharers, meId]))
          : prev.screenSharers,
        focusedScreenUserId: prev.focusedScreenUserId ?? meId ?? null
      }))

      // Parar pela barra nativa do Electron / fim da fonte encerra o share.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (get().isScreenSharing) get().stopScreenShare()
        })
      })

      useChatStore.getState().sendEvent('call:screen', { call_id: callId, active: true })

      // Renegociação com cada par — quem adiciona a track inicia a nova offer.
      peers.forEach((_pc, peerId) => {
        attachScreenTracks(peers.get(peerId) as RTCPeerConnection)
        void negotiatePeer(peerId, 'screen')
      })
    },

    stopScreenShare: () => {
      const s = get()
      if (!s.isScreenSharing && !localScreenStream) return
      const meId = useAuthStore.getState().user?.id
      const callId = s.callId
      const stream = localScreenStream
      localScreenStream = null

      const removedVideo = new Set(stream?.getVideoTracks() ?? [])
      peers.forEach((pc, peerId) => {
        pc.getSenders()
          .filter((sender) => sender.track && removedVideo.has(sender.track))
          .forEach((sender) => {
            try {
              pc.removeTrack(sender)
            } catch {
              // PC já fechado
            }
          })
        void negotiatePeer(peerId)
      })
      stream?.getTracks().forEach((t) => t.stop())

      set((prev) => ({
        isScreenSharing: false,
        localScreenStream: null,
        screenSharers: prev.screenSharers.filter((id) => id !== meId),
        focusedScreenUserId: prev.focusedScreenUserId === meId ? null : prev.focusedScreenUserId
      }))

      if (callId) {
        useChatStore.getState().sendEvent('call:screen', { call_id: callId, active: false })
      }
    },

    setFocusedScreenUser: (userId) => {
      set({ focusedScreenUserId: userId })
    },

    toggleCamera: async () => {
      const s = get()
      if (s.type === null || s.status !== 'active' || transitioning) return

      if (localCameraStream) {
        // Desligar: remove as tracks de cada PC e renegocia (o par detecta
        // o fim pelo evento 'mute' da track remota).
        const stream = localCameraStream
        localCameraStream = null
        const removedVideo = new Set(stream.getVideoTracks())
        peers.forEach((pc, peerId) => {
          pc.getSenders()
            .filter((sender) => sender.track && removedVideo.has(sender.track))
            .forEach((sender) => {
              try {
                pc.removeTrack(sender)
              } catch {
                // PC já fechado
              }
            })
          void negotiatePeer(peerId)
        })
        stream.getTracks().forEach((t) => t.stop())
        set({ localCameraStream: null })
        return
      }

      let stream: MediaStream
      try {
        stream = await getCameraStream()
      } catch (err) {
        if ((err as DOMException)?.name !== 'NotAllowedError') {
          showToast.error('Não foi possível acessar a câmera.')
        }
        return
      }

      localCameraStream = stream
      set({ localCameraStream: stream })

      // Câmera desligada pelo SO/app (ex.: fechar a fonte) desliga o share.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (get().status === 'active' && localCameraStream === stream) {
            void get().toggleCamera()
          }
        })
      })

      // Renegociação com o par — quem adiciona a track inicia a nova offer.
      peers.forEach((pc, peerId) => {
        attachCameraTracks(pc)
        void negotiatePeer(peerId, 'camera')
      })
    },

    setServerCalls: (map) => {
      set({ serverCalls: map })
    },

    joinVoiceChannel: async (channelId) => {
      const s = get()
      if (s.status !== 'idle') {
        if (s.type !== 'channel') {
          throw new Error('Você já está em uma chamada.')
        }
        if (s.channelId === channelId) {
          // Já conectado: não desconecta (estilo Discord) — a UI só exibe a view.
          return
        }
        // Entrar em outro canal de voz desconecta do atual.
        s.endCall()
      }
      await get().startChannelCall(channelId)
    },

    handleWsEvent: (event) => {
      const payload = event.payload as Record<string, unknown>
      const meId = useAuthStore.getState().user?.id

      switch (event.type) {
        case 'call:invite': {
          const p = payload as unknown as InvitePayload
          if (p.type !== 'dm' || get().status !== 'idle') return
          set({
            status: 'ringing',
            callId: p.call_id,
            type: 'dm',
            conversationId: p.conversation_id ?? null,
            channelId: null,
            participants: [p.initiator],
            isInitiator: false,
            streams: {},
            muted: false,
            deafened: false,
            startedAt: null
          })
          return
        }

        case 'call:ring': {
          const p = payload as unknown as RingPayload
          if (get().callId !== p.call_id) return
          set({ participants: upsertParticipant(get().participants, p.callee) })
          return
        }

        case 'call:accept': {
          const p = payload as unknown as ResponsePayload
          if (get().callId !== p.call_id) return
          const current = get()
          const participants = upsertParticipant(current.participants, p.user)
          if (current.status !== 'active') {
            set({ status: 'active', startedAt: Date.now(), participants })
          } else {
            set({ participants })
          }
          if (current.isInitiator && current.type === 'dm' && p.user.id) {
            void beginNegotiationAsCaller(p.user.id)
          }
          return
        }

        case 'call:decline': {
          const p = payload as unknown as ResponsePayload
          if (get().callId !== p.call_id) return
          showToast.info(`${p.user.display_name} recusou a chamada.`)
          cleanup()
          return
        }

        case 'call:signal': {
          void handleSignal(payload as unknown as SignalRelayPayload)
          return
        }

        case 'call:screen': {
          const p = payload as unknown as ScreenSharePayload
          if (get().callId !== p.call_id || p.user.id === meId) return
          set((s) => ({
            screenSharers: p.active
              ? Array.from(new Set([...s.screenSharers, p.user.id]))
              : s.screenSharers.filter((id) => id !== p.user.id),
            focusedScreenUserId: p.active
              ? (s.focusedScreenUserId ?? p.user.id)
              : s.focusedScreenUserId === p.user.id
                ? null
                : s.focusedScreenUserId,
            participants: upsertParticipant(s.participants, p.user)
          }))
          return
        }

        case 'call:joined': {
          const p = payload as unknown as StatePayload
          if (get().callId !== p.call_id) return
          const current = get()
          if (current.type === 'channel') {
            if (current.status !== 'active' || !meId || p.user.id === meId) return
            set({ participants: upsertParticipant(current.participants, p.user) })
            bumpList()
            ensurePeerConnection(p.user.id)
            if (shouldInitiateOffer(meId, p.user.id)) {
              void beginNegotiationAsCaller(p.user.id)
            } else if (currentVideoMeta()) {
              // Perdi o coin flip da oferta inicial: minhas tracks de vídeo ficam
              // fora da answer — agendo a renegociação para quando voltar a
              // stable (ou agora, se a oferta inicial do par já concluiu).
              const meta = currentVideoMeta() as VideoKind
              pendingNegotiation.set(p.user.id, meta)
              void negotiatePeer(p.user.id, meta)
            }
            return
          }
          if (current.status === 'outgoing') set({ status: 'active', startedAt: Date.now() })
          return
        }

        case 'call:left': {
          const p = payload as unknown as StatePayload
          if (get().callId !== p.call_id) return
          if (p.user.id === meId) return
          showToast.info(`${p.user.display_name} saiu da chamada.`)
          if (get().type === 'channel') {
            detachPeer(p.user.id)
            bumpList()
            return
          }
          get().endCall()
          return
        }

        case 'call:ended': {
          const p = payload as unknown as EndedPayload
          if (get().callId !== p.call_id) return
          cleanup()
          bumpList()
          return
        }

        case 'call:busy': {
          showToast.error('O usuário está ocupado em outra chamada.')
          cleanup()
          return
        }

        case 'call:error': {
          const message = (payload.message as string) ?? 'Erro na chamada.'
          showToast.error(message)
          if (get().callId === (payload.call_id as string | undefined) || !payload.call_id) {
            cleanup()
          }
          return
        }

        default:
          return
      }
    }
  }
})
