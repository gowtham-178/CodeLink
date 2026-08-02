import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Editor, { loader } from '@monaco-editor/react'
import { useRoom } from '../contexts/RoomContext'
import { useTheme } from '../contexts/ThemeContext'
import { getRoom } from '../services/roomApi'
import * as socket from '../services/socketService'
import { getSessionId, publishSync } from '../services/socketService'
import EditorHeader from '../components/EditorHeader'
import IconRail from '../components/IconRail'

// Disable JS/TS error squiggles — plain text should never show red underlines
loader.init().then(monaco => {
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  })
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  })
})

const PLACEHOLDER =
  "Write or paste code here then share.\nAnyone you share the link with will see it as it's typed!"

export default function EditorPage() {
  const { roomId }  = useParams()
  const navigate    = useNavigate()
  const { state, dispatch } = useRoom()
  const { theme }   = useTheme()
  const editorRef = useRef(null)
  const isRemoteEditRef = useRef(false)

  const dispatchRef = useRef(dispatch)
  useEffect(() => { dispatchRef.current = dispatch })

  const handleMessage = useCallback((msg) => {
    if (typeof msg.code === 'string') {
      if (msg.senderSession === getSessionId()) return
      const editor = editorRef.current
      if (editor) {
        const model = editor.getModel()
        if (model) {
          const currentCode = model.getValue()
          if (currentCode !== msg.code) {
            isRemoteEditRef.current = true
            try {
              const pos = editor.getPosition()
              model.pushEditOperations(
                [], [{ range: model.getFullModelRange(), text: msg.code }], () => null
              )
              if (pos) editor.setPosition(pos)
            } finally {
              isRemoteEditRef.current = false
            }
          }
        }
      }
      dispatchRef.current({ type: 'SET_CODE',         payload: msg.code })
      dispatchRef.current({ type: 'SET_VIEWER_COUNT', payload: msg.viewerCount ?? 0 })
    } else if (typeof msg.viewerCount === 'number') {
      dispatchRef.current({ type: 'SET_VIEWER_COUNT', payload: msg.viewerCount })
    }
  }, [])

  // ── Load room content (public) + optionally connect WebSocket (auth only) ──
  useEffect(() => {
    if (!roomId) return
    const controller = new AbortController()
    let active = true

    getRoom(roomId, controller.signal)
      .then(room => {
        if (!active) return
        dispatch({ type: 'SET_ROOM_META', payload: {
          ownerUsername: room.ownerUsername ?? null,
          createdAt:     room.createdAt,
        }})
        // Don't apply HTTP code — WebSocket sync is the single source of truth
        socket.connect({
          roomId,
          onMessage:    handleMessage,
          onConnect:    () => {
            dispatch({ type: 'SET_CONNECTED', payload: true })
            publishSync(roomId)
          },
          onDisconnect: () => dispatch({ type: 'SET_CONNECTED', payload: false }),
        })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        // Room not found → go home. Don't redirect to login on 401 —
        // GET is public and should never 401.
        navigate('/', { replace: true })
      })

    return () => {
      active = false
      controller.abort()
      socket.disconnect()
      dispatch({ type: 'RESET' })
    }
  }, [roomId])

  function handleEditorChange(value) {
    if (isRemoteEditRef.current) return
    socket.publishEdit(roomId, value ?? '')
  }

  const statusColor = state.connected ? 'bg-green-500' : 'bg-zinc-600'

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <EditorHeader
        roomId={roomId}
        ownerUsername={state.ownerUsername}
        viewerCount={state.viewerCount}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative">
          <Editor
            height="100%"
            language={state.language}
            theme={theme}
            onChange={handleEditorChange}
            onMount={editor => { editorRef.current = editor }}
            options={{
              fontSize: 14,
              minimap:                    { enabled: false },
              wordWrap:                   'on',
              lineNumbers:                'off',
              scrollBeyondLastLine:       false,
              automaticLayout:            true,
              quickSuggestions:           false,
              suggestOnTriggerCharacters: false,
              parameterHints:             { enabled: false },
              wordBasedSuggestions:       'off',
              snippetSuggestions:         'none',
              inlineSuggest:              { enabled: false },
              suggest:                    { enabled: false },
              hover:                      { enabled: false },
              contextmenu:                false,
              commandPalette:             false,
              lightbulb:                  { enabled: 'off' },
              renderLineHighlight:        'none',
              occurrencesHighlight:       'off',
              selectionHighlight:         false,
              matchBrackets:              'never',
              folding:                    false,
              glyphMargin:                false,
              lineDecorationsWidth:       0,
            }}
          />

          {state.code === '' && (
            <div
              className="absolute top-0 left-0 pointer-events-none select-none"
              style={{
                top: '6px', left: '10px',
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: '14px', lineHeight: '21px',
                color: theme !== 'light' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)',
                whiteSpace: 'pre',
              }}
            >
              {PLACEHOLDER}
            </div>
          )}
        </div>

        <IconRail language={state.language} code={state.code} />
      </div>

      {/* Status strip */}
      <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-3 text-xs text-zinc-500 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        <span>
          {state.connected ? 'Connected' : 'Connecting…'}
        </span>
        {state.viewerCount > 0 && (
          <span className="ml-auto">
            {state.viewerCount} {state.viewerCount === 1 ? 'viewer' : 'viewers'}
          </span>
        )}
      </div>
    </div>
  )
}
