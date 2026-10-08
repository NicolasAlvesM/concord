import { useEffect, useRef } from 'react'

function RemoteAudio({
  stream,
  muted
}: {
  stream: MediaStream
  muted: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  return <audio ref={ref} autoPlay muted={muted} className="hidden" />
}

export default RemoteAudio
