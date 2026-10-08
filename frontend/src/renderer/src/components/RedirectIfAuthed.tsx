import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function RedirectIfAuthed({ children }: { children: React.ReactElement }): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (accessToken) return <Navigate to="/" replace />
  return children
}

export default RedirectIfAuthed
