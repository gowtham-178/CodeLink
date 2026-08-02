import { getToken } from '../contexts/AuthContext'

const BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}/api`

async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    try { const j = await res.json(); err.message = j.message ?? err.message } catch (_) {}
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

// POST /api/rooms
export const createRoom = (password, signal) =>
  apiFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({ password }),
    signal,
  })

// POST /api/rooms/join
export const joinRoomByPassword = (password, signal) =>
  apiFetch('/rooms/join', {
    method: 'POST',
    body: JSON.stringify({ password }),
    signal,
  })

// GET /api/rooms/:roomId
export const getRoom = (roomId, signal) =>
  apiFetch(`/rooms/${roomId}`, { signal })

// DELETE /api/rooms/:roomId
export const deleteRoom = (roomId) =>
  apiFetch(`/rooms/${roomId}`, { method: 'DELETE' })
