export const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }]

export interface PeerHandlers {
  onLocalCandidate?: (candidate: RTCIceCandidate) => void
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onSignalingStateChange?: (state: RTCSignalingState) => void
}

export function createPeerConnection(handlers: PeerHandlers = {}): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  pc.onicecandidate = (event) => {
    if (event.candidate) handlers.onLocalCandidate?.(event.candidate)
  }

  pc.ontrack = (event) => {
    const [stream] = event.streams
    if (stream) handlers.onRemoteStream?.(stream)
  }

  pc.onconnectionstatechange = () => {
    handlers.onConnectionStateChange?.(pc.connectionState)
  }

  pc.onsignalingstatechange = () => {
    handlers.onSignalingStateChange?.(pc.signalingState)
  }

  return pc
}

export async function getAudioStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  })
}

// Captura de tela (Fase 3). O picker visual é o modal do app — o Electron
// resolve a fonte escolhida via setDisplayMediaRequestHandler no processo main.
// Rejeita com NotAllowedError quando o usuário cancela.
export async function getDisplayStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: false
  })
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'detail'
  })
  return stream
}

// Câmera local (Fase 4). Só vídeo — o microfone já vem de getAudioStream().
export async function getCameraStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: false
  })
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'motion'
  })
  return stream
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  return offer
}

export async function createAnswer(
  pc: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  return answer
}

// Regra determinística anti-glare do mesh: entre dois participantes,
// quem tem o ID lexicograficamente menor inicia a oferta.
export function shouldInitiateOffer(myId: string, peerId: string): boolean {
  return myId < peerId
}

export interface MeshOptions {
  myId: string
  stream: MediaStream | null
  createHandlers: (peerId: string) => PeerHandlers
}

// Cria uma RTCPeerConnection por participante (mesh). A negociação
// (quem manda offer) fica a cargo do chamador via shouldInitiateOffer.
export function connectMesh(
  participants: Array<{ id: string }>,
  options: MeshOptions
): Map<string, RTCPeerConnection> {
  const connections = new Map<string, RTCPeerConnection>()
  for (const participant of participants) {
    if (participant.id === options.myId) continue
    const pc = createPeerConnection(options.createHandlers(participant.id))
    options.stream?.getTracks().forEach((track) => {
      pc.addTrack(track, options.stream as MediaStream)
    })
    connections.set(participant.id, pc)
  }
  return connections
}
