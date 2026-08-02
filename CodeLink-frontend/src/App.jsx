import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CreateRoomPage from './pages/CreateRoomPage'
import EditorPage from './pages/EditorPage'

function RequireAuth({ children }) {
  const { username } = useAuth()
  const location = useLocation()
  return username ? children : <Navigate to="/login" state={{ from: location }} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/"         element={<RequireAuth><CreateRoomPage /></RequireAuth>} />
      <Route path="/:roomId"  element={<EditorPage />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  )
}
