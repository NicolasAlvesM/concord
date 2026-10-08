import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../api/users'

interface RequireAuthProps {
  children: React.ReactElement
}

function RequireAuth({ children }: RequireAuthProps): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!accessToken || user) return

    let cancelled = false
    getMe()
      .then((me) => {
        if (!cancelled) {
          setUser(me)
        }
      })
      .catch(() => {
        if (!cancelled) {
          useAuthStore.getState().clear()
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, user, setUser])

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
      </div>
    )
  }

  return children
}

export default RequireAuth
