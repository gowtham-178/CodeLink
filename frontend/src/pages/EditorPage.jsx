import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { useRoom } from '../contexts/RoomContext'
import { useTheme } from '../contexts/ThemeContext'
import { getRoom } from '../services/roomApi'
import * as socket from '../services/socketService'
import EditorHeader from '../components/EditorHeader'
import IconRail from '../components/IconRail'

const DEBOUNCE_MS = 300
const PLACEHOLDER =
  "Write or paste code here then share.\nAnyone you share the link with will see code as it's typed!"

export default function EditorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useRoom()
  const { dark } = useTheme()

  const editorRef = useRef(null)
  const isRemoteChange = useRef(false)
  const debounceTimer = useRef(null)
  // Tracks whether Monaco has received the initial content from Redis yet.
  // On refresh, Monaco mounts before getRoom resolves, so we need to push
  // the loaded content in explicitly once the editor is ready.
  const pendingInitialCode = useRef(null)
  const initialLoadDone = useRef(false)

  // Stable ref to the latest dispatch so handleMessage never goes stale
  const dispatchRef = useRef(dispatch)
  useEffect(() => { dispatchRef.current = dispatch })

  // ── handleMessage — defined once, reads via refs so it's always current ──
  const handleMessage = useCallback((msg) => {
    if (typeof msg.code === 'string') {
      isRemoteChange.current = true
      dispatchRef.current({ type: 'SET_CODE', payload: msg.code })
      dispatchRef.current({ type: 'SET_VIEWER_COUNT', payload: msg.viewerCount ?? 0 })
    } else if (typeof msg.viewerCount === 'number') {
      dispatchRef.current({ type: 'SET_VIEWER_COUNT', payload: msg.viewerCount })
    }
  }, []) // no deps — reads through refs

  // ── Load content + connect WebSocket ─────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

    // AbortController cancels the in-flight fetch on StrictMode's first cleanup
    const controller = new AbortController()
    // `active` guards the WS connect — if cleanup runs before the fetch
    // resolves, we skip connecting on the already-torn-down first mount.
    let active = true

    getRoom(roomId, controller.signal)
      .then(room => {
        if (!active) return
        const code = room.code ?? ''
        dispatch({ type: 'SET_EXPIRES_AT', payload: room.expiresAt })

        // Push the loaded content into Monaco.
        // Two cases:
        //  A) Editor already mounted → push directly via the model.
        //  B) Editor not yet mounted → stash in pendingInitialCode,
        //     onMount will pick it up.
        const editor = editorRef.current
        if (editor) {
          const model = editor.getModel()
          if (model) {
            model.pushEditOperations([], [{ range: model.getFullModelRange(), text: code }], () => null)
          }
        } else {
          pendingInitialCode.current = code
        }
        initialLoadDone.current = true
        dispatch({ type: 'SET_CODE', payload: code })

        socket.connect({
          roomId,
          onMessage: handleMessage,
          onConnect: () => dispatch({ type: 'SET_CONNECTED', payload: true }),
          onDisconnect: () => dispatch({ type: 'SET_CONNECTED', payload: false }),
        })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        // 404 = expired or unknown room → get a fresh one
        navigate('/', { replace: true })
      })

    return () => {
      active = false
      controller.abort()
      socket.disconnect()
      dispatch({ type: 'RESET' })
      clearTimeout(debounceTimer.current)
      pendingInitialCode.current = null
      initialLoadDone.current = false
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply remote code to Monaco preserving cursor ────────────────────────
  useEffect(() => {
    if (!isRemoteChange.current) return
    isRemoteChange.current = false
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const position = editor.getPosition()
    model.pushEditOperations(
      [],
      [{ range: model.getFullModelRange(), text: state.code }],
      () => null
    )
    if (position) editor.setPosition(position)
  }, [state.code])

  // ── Local edit: debounce → publish ───────────────────────────────────────
  function handleEditorChange(value) {
    if (isRemoteChange.current) return
    dispatch({ type: 'SET_CODE', payload: value ?? '' })
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      socket.publishEdit(roomId, value ?? '')
    }, DEBOUNCE_MS)
  }

  const statusColor = state.connected ? 'bg-green-500' : 'bg-zinc-600'

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <EditorHeader
        expiresAt={state.expiresAt}
        viewerCount={state.viewerCount}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative">
          <Editor
            height="100%"
            language={state.language}
            value={state.code}
            theme={dark ? 'vs-dark' : 'light'}
            onChange={handleEditorChange}
            onMount={editor => {
              editorRef.current = editor
              // Case B: getRoom resolved before Monaco mounted — apply now
              if (pendingInitialCode.current !== null) {
                const model = editor.getModel()
                if (model) {
                  model.pushEditOperations(
                    [],
                    [{ range: model.getFullModelRange(), text: pendingInitialCode.current }],
                    () => null
                  )
                }
                dispatch({ type: 'SET_CODE', payload: pendingInitialCode.current })
                pendingInitialCode.current = null
              }
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              // Plain notepad feel — no AI/intellisense noise
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              parameterHints: { enabled: false },
              wordBasedSuggestions: 'off',
              snippetSuggestions: 'none',
              inlineSuggest: { enabled: false },
              suggest: { enabled: false },
              hover: { enabled: false },
              codeLens: false,
              lightbulb: { enabled: 'off' },
              renderLineHighlight: 'none',
              occurrencesHighlight: 'off',
              selectionHighlight: false,
              matchBrackets: 'never',
              folding: false,
              glyphMargin: false,
              lineDecorationsWidth: 0,
            }}
          />

          {/* Placeholder — visible only while the editor is empty */}
          {state.code === '' && (
            <div
              className="absolute top-0 left-0 pointer-events-none select-none"
              style={{
                top: '6px',
                left: '10px',
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: '14px',
                lineHeight: '21px',
                color: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)',
                whiteSpace: 'pre',
              }}
            >
              {PLACEHOLDER}
            </div>
          )}
        </div>

        <IconRail
          language={state.language}
          code={state.code}
        />
      </div>

      {/* Status strip */}
      <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-3 text-xs text-zinc-500 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        <span>{state.connected ? 'Connected' : 'Connecting…'}</span>
      </div>
    </div>
  )
}
