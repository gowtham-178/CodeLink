import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Link2, Plus, LogIn, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createRoom } from '../services/roomApi'

export default function CreateRoomPage() {
  const navigate = useNavigate()
  const { username, logout } = useAuth()

  const location = useLocation()
  const roomNotFound = location.state?.roomNotFound ?? false

  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [joinInput, setJoinInput]     = useState('')
  const [joinError, setJoinError]     = useState('')

  async function handleCreate() {
    setCreateError('')
    setCreating(true)
    try {
      const room = await createRoom()
      navigate(`/${room.roomId}`)
    } catch (err) {
      setCreateError(err.message || 'Failed to create room.')
    } finally {
      setCreating(false)
    }
  }

  function handleJoin(e) {
    e.preventDefault()
    const raw = joinInput.trim()
    if (!raw) { setJoinError('Enter a room ID or link.'); return }

    let roomId = raw
    try {
      const url = new URL(raw)
      roomId = url.pathname.split('/').filter(Boolean).at(-1) ?? raw
    } catch (_) {}

    if (!roomId) { setJoinError('Could not read a room ID from that input.'); return }
    navigate(`/${roomId}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8 select-none">
          <Link2 className="text-indigo-400" size={28} />
          <span className="text-white text-2xl font-semibold tracking-wide">CodeLink</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6">

          {/* Room-not-found banner */}
          {roomNotFound && (
            <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              That room doesn't exist or has expired.
            </p>
          )}

          {/* Auth strip */}
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-xs">
              Signed in as <span className="text-zinc-200 font-medium">{username}</span>
            </p>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>

          <div className="border-t border-zinc-800" />

          {/* Create Room */}
          <div className="flex flex-col gap-2">
            <h2 className="text-white font-semibold text-sm">Create a room</h2>
            <p className="text-zinc-500 text-xs">Start a new shared editor.</p>
            {createError && <p className="text-red-400 text-xs">{createError}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </div>

          <div className="border-t border-zinc-800" />

          {/* Join Room */}
          <div className="flex flex-col gap-2">
            <h2 className="text-white font-semibold text-sm">Join a room</h2>
            <p className="text-zinc-500 text-xs">Paste a room link or ID you received.</p>
            <form onSubmit={handleJoin} className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="https://… or room ID"
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value); setJoinError('') }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors"
              >
                <LogIn size={15} />
                Join Room
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
