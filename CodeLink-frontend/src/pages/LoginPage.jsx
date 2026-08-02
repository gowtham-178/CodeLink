import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Where to go after login — defaults to /
  const from = location.state?.from?.pathname ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) { setError('All fields are required.'); return }
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8 select-none">
          <Link2 className="text-indigo-400" size={28} />
          <span className="text-white text-2xl font-semibold tracking-wide">CodeLink</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h1 className="text-white font-semibold text-lg mb-1">Welcome back</h1>
          <p className="text-zinc-400 text-sm mb-6">Sign in to your account.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Username</label>
              <input
                type="text"
                placeholder="your_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-zinc-500 text-xs text-center mt-5">
            No account?{' '}
            <Link to="/register" state={{ from: location.state?.from }} className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
