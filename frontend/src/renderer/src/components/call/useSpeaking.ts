import { useEffect, useState } from 'react'

const ANALYSER_FFT_SIZE = 256

// Indicador de falante: analisa o volume de cada stream remota via WebAudio.
function useSpeaking(streams: Record<string, MediaStream>): Set<string> {
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const entries = Object.entries(streams)
    const Ctor = window.AudioContext
    if (entries.length === 0 || !Ctor) {
      const clear = setTimeout(() => setSpeaking(new Set()), 0)
      return () => clearTimeout(clear)
    }

    const ctx = new Ctor()
    void ctx.resume()
    const analysers = entries.map(([id, stream]) => {
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = ANALYSER_FFT_SIZE
      source.connect(analyser)
      return { id, analyser }
    })
    const data = new Uint8Array(ANALYSER_FFT_SIZE)
    const timer = setInterval(() => {
      const next = new Set<string>()
      for (const { id, analyser } of analysers) {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (const v of data) sum += v
        if (sum / data.length > 8) next.add(id)
      }
      setSpeaking((prev) => {
        if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev
        return next
      })
    }, 250)

    return () => {
      clearInterval(timer)
      for (const { analyser } of analysers) analyser.disconnect()
      void ctx.close()
    }
  }, [streams])

  return speaking
}

export default useSpeaking
