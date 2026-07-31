import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { createRoom } from '../services/roomApi'

export default function EditorHeader({ expiresAt, viewerCount }) {
  const { dark, toggle } = useTheme()
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)

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

  function formatExpiry(iso) {
    if (!iso) return null
    const ms = new Date(iso) - Date.now()
    if (ms <= 0) return 'Expired'
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    if (h >= 1) return `Expires in ${h}h ${m}m`
    return `Expires in ${m}m`
  }

  const expiryLabel = formatExpiry(expiresAt)

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 select-none">
        <span className="text-indigo-400 text-xl">🔗</span>
        <span className="font-semibold text-white text-sm tracking-wide">CodeLink</span>
      </div>

      <div className="flex-1" />

      {/* Viewer count */}
      {viewerCount > 0 && (
        <span className="text-zinc-500 text-xs hidden sm:block">
          {viewerCount} {viewerCount === 1 ? 'person' : 'people'} viewing
        </span>
      )}

      {/* Expiry label */}
      {expiryLabel && (
        <span className="text-zinc-400 text-xs hidden md:block">{expiryLabel}</span>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title="Toggle theme"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors text-base"
      >
        {dark ? '☀️' : '🌙'}
      </button>

      {/* New Room — opens in a new tab */}
      <button
        onClick={handleNewRoom}
        disabled={creating}
        className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium transition-colors"
        title="Open a fresh room in a new tab"
      >
        {creating ? '…' : '+ New Room'}
      </button>

      {/* Share — copies current URL */}
      <button
        onClick={handleShare}
        className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
      >
        {copied ? '✓ Copied!' : 'Share'}
      </button>
    </header>
  )
}
