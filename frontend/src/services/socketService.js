import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

let client = null
let subscription = null

/**
 * Connect to the WebSocket broker and subscribe to a room's topic.
 *
 * @param {object} opts
 * @param {string}   opts.roomId        - Room to subscribe to
 * @param {function} opts.onMessage     - Called with the parsed message object on every broadcast
 * @param {function} [opts.onConnect]   - Called when STOMP session is established
 * @param {function} [opts.onDisconnect]- Called on clean disconnect
 */
export function connect({ roomId, onMessage, onConnect, onDisconnect }) {
  disconnect() // clean up any stale client first

  client = new Client({
    webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
    reconnectDelay: 3000,

    // Pass roomId as a STOMP connect header so the server can track viewers
    connectHeaders: { roomId },

    onConnect: () => {
      subscription?.unsubscribe()
      subscription = client.subscribe(`/topic/room/${roomId}`, (frame) => {
        try {
          onMessage(JSON.parse(frame.body))
        } catch (_) {}
      })
      onConnect?.()
    },

    onDisconnect: () => onDisconnect?.(),
    onStompError: (frame) => console.error('STOMP error', frame),
  })

  client.activate()
}

/**
 * Publish a code edit to the server.
 * Destination: /app/room/{roomId}/edit
 * Body: { code: string }
 */
export function publishEdit(roomId, code) {
  if (client?.connected) {
    client.publish({
      destination: `/app/room/${roomId}/edit`,
      body: JSON.stringify({ code }),
    })
  }
}

export function disconnect() {
  subscription?.unsubscribe()
  subscription = null
  client?.deactivate()
  client = null
}

export function isConnected() {
  return client?.connected ?? false
}
