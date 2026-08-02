import { useState, useRef, useEffect } from 'react'
import { Download, Palette } from 'lucide-react'
import { useTheme, THEMES } from '../contexts/ThemeContext'

const EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', java: 'java',
  go: 'go', rust: 'rs', cpp: 'cpp', csharp: 'cs',
  html: 'html', css: 'css', sql: 'sql', plaintext: 'txt',
}

export default function IconRail({ language, code }) {
  const { theme, setTheme } = useTheme()
  const [themeOpen, setThemeOpen] = useState(false)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!themeOpen) return
    function onDown(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setThemeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [themeOpen])

  function handleDownload() {
    const ext = EXT[language] ?? 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `code.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="w-11 flex flex-col items-center border-l border-zinc-800 bg-zinc-900 shrink-0 pt-2 gap-1">

      {/* Theme picker */}
      <div className="relative" ref={popoverRef}>
        <RailBtn
          title="Theme"
          active={themeOpen}
          onClick={() => setThemeOpen(o => !o)}
        >
          <Palette size={17} />
        </RailBtn>

        {themeOpen && (
          <div className="absolute right-12 top-0 z-50 w-36 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-1 overflow-hidden">
            <p className="text-xs text-zinc-500 px-3 pt-2 pb-1 font-medium">Theme</p>
            {THEMES.map(t => (
              <button
                key={t.value}
                onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors
                  ${theme === t.value ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Download */}
      <RailBtn title="Download" onClick={handleDownload}>
        <Download size={17} />
      </RailBtn>
    </div>
  )
}

function RailBtn({ children, title, active, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
        ${active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
    >
      {children}
    </button>
  )
}
