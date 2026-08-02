import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, Copy, Check, Plus, Trash2, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createRoom, deleteRoom } from '../services/roomApi'

export default function EditorHeader({ roomId, ownerUsername, viewerCount }) {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [copied,   setCopied]   = useState(false)
  const [creating, setCreating] = useState(false)

  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNewRoom() {
    if (creating) return
    setCreating(true)
    try {
      const room = await createRoom()
      window.open(`${window.location.origin}/${room.roomId}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Failed to create room', err)
    } finally {
      setCreating(false)
    }
  }

  function openDelete() {
    setDeleteOpen(true)
    setDeleteError('')
  }

  async function handleDelete(e) {
    e.preventDefault()
    setDeleteError('')
    setDeleting(true)
    try {
      await deleteRoom(roomId)
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete room.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-2 shrink-0">
        <div className="flex items-center gap-2 select-none shrink-0">
          <Link2 className="text-indigo-400" size={18} />
          <span className="font-semibold text-white text-sm tracking-wide">CodeLink</span>
        </div>

        {ownerUsername && (
          <span className="text-zinc-600 text-xs hidden sm:block shrink-0">
            by <span className="text-zinc-400">{ownerUsername}</span>
          </span>
        )}

        <div className="flex-1" />

        {viewerCount > 0 && (
          <span className="text-zinc-500 text-xs hidden md:block shrink-0">
            {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
          </span>
        )}

        <HeaderBtn
          onClick={openDelete}
          title="Delete room"
          className="bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 text-zinc-400"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </HeaderBtn>

        <HeaderBtn
          onClick={handleNewRoom}
          disabled={creating}
          title="Open a new room in a new tab"
          className="bg-zinc-700 hover:bg-zinc-600 text-white"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">{creating ? '…' : 'New Room'}</span>
        </HeaderBtn>

        <HeaderBtn
          onClick={handleShare}
          title="Copy link to clipboard"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Share'}</span>
        </HeaderBtn>

        <button
          onClick={() => { logout(); navigate('/login') }}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors shrink-0"
        >
          <LogOut size={15} />
        </button>
      </header>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base mb-1">Delete room?</h2>
            <p className="text-zinc-400 text-sm mb-5">This is permanent and cannot be undone.</p>
            {deleteError && <p className="text-red-400 text-xs mb-3">{deleteError}</p>}
            <form onSubmit={handleDelete} className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function HeaderBtn({ children, className = '', disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 shrink-0 ${className}`}
    >
      {children}
    </button>
  )
}
