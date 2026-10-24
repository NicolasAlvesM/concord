import { useEffect } from 'react'
import router from '../router'
import { useCallStore } from '../store/callStore'

/**
 * Liga o app ao modo segundo plano do processo main: menu da bandeja
 * (silenciar/sair), cliques em notificações e o "Sair" que encerra a chamada.
 */
function BackgroundBridge(): null {
  const status = useCallStore((s) => s.status)
  const muted = useCallStore((s) => s.muted)
  const background = window.api?.background

  useEffect(() => {
    background?.setCallState({ inCall: status === 'active', muted })
  }, [background, status, muted])

  useEffect(() => {
    if (!background) return
    const offMute = background.onToggleMute(() => {
      if (useCallStore.getState().status === 'active') useCallStore.getState().toggleMute()
    })
    const offQuit = background.onQuitRequested(() => {
      // Sai da chamada (avisa os outros) antes de fechar de verdade.
      useCallStore.getState().endCall()
      background.quit()
    })
    const offNavigate = background.onNavigate((route) => {
      void router.navigate(route)
    })
    return () => {
      offMute()
      offQuit()
      offNavigate()
    }
  }, [background])

  return null
}

export default BackgroundBridge
