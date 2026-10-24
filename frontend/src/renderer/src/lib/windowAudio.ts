import workletUrl from './screenAudioWorklet.ts?worker&url'

// Som só da janela compartilhada (Windows): o processo main entrega um
// MessagePort com PCM do helper nativo logo antes do getDisplayMedia resolver.

let pendingPort: MessagePort | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data === 'concord:screen-audio-port' && event.ports[0]) {
      pendingPort?.close()
      pendingPort = event.ports[0]
    }
  })
}

export interface WindowAudio {
  track: MediaStreamTrack
  stop: () => void
}

/** Track com o som da janela, se o main começou a capturar; senão null. */
export async function takeWindowAudio(): Promise<WindowAudio | null> {
  const port = pendingPort
  pendingPort = null
  if (!port) return null

  const ctx = new AudioContext({ sampleRate: 48_000 })
  try {
    await ctx.audioWorklet.addModule(workletUrl)
  } catch {
    port.close()
    void ctx.close()
    window.api?.screenAudio?.stop()
    return null
  }
  const node = new AudioWorkletNode(ctx, 'concord-pcm', { outputChannelCount: [2] })
  const destination = ctx.createMediaStreamDestination()
  node.connect(destination)
  port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    node.port.postMessage(event.data, [event.data])
  }
  port.start()

  const [track] = destination.stream.getAudioTracks()
  track.contentHint = 'music'
  return {
    track,
    stop: () => {
      port.close()
      node.disconnect()
      track.stop()
      void ctx.close()
      window.api?.screenAudio?.stop()
    }
  }
}
