import { createContext, useContext, useReducer } from 'react'

const RoomContext = createContext(null)

const initialState = {
  code: '',
  language: 'javascript',
  connected: false,
  viewerCount: 0,
  expiresAt: null,   // ISO string — shown in header
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.payload }
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload }
    case 'SET_VIEWER_COUNT':
      return { ...state, viewerCount: action.payload }
    case 'SET_EXPIRES_AT':
      return { ...state, expiresAt: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function RoomProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <RoomContext.Provider value={{ state, dispatch }}>
      {children}
    </RoomContext.Provider>
  )
}

export const useRoom = () => useContext(RoomContext)
