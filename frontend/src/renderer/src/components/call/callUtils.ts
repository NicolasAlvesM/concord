import { useEffect, useState } from 'react'

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (startedAt === null) {
      const reset = setTimeout(() => setElapsed(0), 0)
      return () => clearTimeout(reset)
    }
    const tick = (): void => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const initial = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [startedAt])
  return elapsed
}
