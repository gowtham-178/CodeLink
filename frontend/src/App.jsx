import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import EditorPage from './pages/EditorPage'
import { createRoom } from './services/roomApi'

// Root redirector: creates a room server-side then immediately navigates
// to /:roomId. AbortController + ignore flag make it safe under React
// StrictMode's double-invoke behaviour.
function Root() {
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false

    createRoom(controller.signal)
      .then(room => {
        if (!ignore) navigate(`/${room.roomId}`, { replace: true })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        console.error('Failed to create room', err)
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <span className="text-zinc-500 text-sm animate-pulse">Starting…</span>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/:roomId" element={<EditorPage />} />
      <Route path="*" element={<Root />} />
    </Routes>
  )
}
