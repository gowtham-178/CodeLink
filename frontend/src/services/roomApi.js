const BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}/api`

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// POST /api/rooms — generates a new room, returns { roomId, code, expiresAt }
export const createRoom = (signal) =>
  apiFetch('/rooms', { method: 'POST', signal })

// GET /api/rooms/:roomId — loads existing content, returns { roomId, code, expiresAt }
export const getRoom = (roomId, signal) =>
  apiFetch(`/rooms/${roomId}`, { signal })
