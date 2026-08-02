import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getToken } from '../contexts/AuthContext'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'

let client = null
let subscription = null
let sessionId = null

// Generate a stable ID once per page load — never changes
const LOCAL_SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

export function getSessionId() {
  return LOCAL_SESSION_ID
}

export function connect({ roomId, onMessage, onConnect, onDisconnect }) {
  disconnect()

  client = new Client({
    webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
    reconnectDelay: 3000,
    connectHeaders: {
      Authorization: `Bearer ${getToken() ?? ''}`,
      roomId,
    },
    onConnect: (frame) => {
      sessionId = LOCAL_SESSION_ID
      subscription?.unsubscribe()
      subscription = client.subscribe(`/topic/room/${roomId}`, (frame) => {
        try { onMessage(JSON.parse(frame.body)) } catch (_) {}
      })
      onConnect?.()
    },
    onDisconnect: () => { onDisconnect?.() },
    onStompError: (frame) => console.error('STOMP error', frame),
  })

  client.activate()
}

export function publishSync(roomId) {
  if (client?.connected) {
    client.publish({ destination: `/app/room/${roomId}/sync`, body: '{}' })
  }
}

export function publishEdit(roomId, code) {
  if (client?.connected) {
    client.publish({
      destination: `/app/room/${roomId}/edit`,
      body: JSON.stringify({ code, senderSession: LOCAL_SESSION_ID }),
    })
  }
}


export function disconnect() {
  subscription?.unsubscribe()
  subscription = null
  client?.deactivate()
  client = null
  sessionId = null
}

export function isConnected() {
  return client?.connected ?? false
}
