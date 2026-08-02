const BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}/api/auth`

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    try { const j = await res.json(); err.message = j.message ?? err.message } catch (_) {}
    throw err
  }
  return res.json()
}

// POST /api/auth/register → { token, username }
export const register = (username, password) => post('/register', { username, password })

// POST /api/auth/login → { token, username }
export const login = (username, password) => post('/login', { username, password })
