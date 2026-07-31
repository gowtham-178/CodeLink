import { useTheme } from '../contexts/ThemeContext'

const EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', java: 'java',
  go: 'go', rust: 'rs', cpp: 'cpp', csharp: 'cs',
  html: 'html', css: 'css', sql: 'sql', plaintext: 'txt',
}

// Rail now only has the Download button.
export default function IconRail({ language, code }) {
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
      <button
        title="Download"
        onClick={handleDownload}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-base text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        ⬇️
      </button>
    </div>
  )
}
