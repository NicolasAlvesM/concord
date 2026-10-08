import { createHashRouter, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Friends from './pages/Friends'
import ServerView from './pages/ServerView'
import DmChat from './pages/DmChat'
import Invites from './pages/Invites'
import Login from './pages/Login'
import Register from './pages/Register'
import RequireAuth from './components/RequireAuth'
import RedirectIfAuthed from './components/RedirectIfAuthed'
import AppShell from './components/AppShell'

export const router = createHashRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'friends', element: <Friends /> },
      { path: 'invites', element: <Invites /> },
      { path: 'dm/:userId', element: <DmChat /> },
      { path: 'servers/:id', element: <ServerView /> },
      { path: 'servers/:id/channels/:channelId', element: <ServerView /> }
    ]
  },
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <Login />
      </RedirectIfAuthed>
    )
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthed>
        <Register />
      </RedirectIfAuthed>
    )
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])

export default router
