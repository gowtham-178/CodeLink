import { createContext, useCallback, useContext, useState } from 'react'
import { login as apiLogin, register as apiRegister } from '../services/authApi'

const TOKEN_KEY = 'cl_token'
const USER_KEY  = 'cl_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

function saveSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, username)
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, username)
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(
    () => localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || null
  )

  const login = useCallback(async (usernameInput, password) => {
    const data = await apiLogin(usernameInput, password)
    saveSession(data.token, data.username)
    setUsername(data.username)
    return data
  }, [])

  const register = useCallback(async (usernameInput, password) => {
    const data = await apiRegister(usernameInput, password)
    saveSession(data.token, data.username)
    setUsername(data.username)
    return data
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUsername(null)
  }, [])

  return (
    <AuthContext.Provider value={{ username, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
