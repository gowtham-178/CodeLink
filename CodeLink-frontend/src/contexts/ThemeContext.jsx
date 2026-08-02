import { createContext, useContext, useEffect, useState } from 'react'

// Available Monaco themes — add more here later (e.g. 'hc-black', 'hc-light')
export const THEMES = [
  { value: 'vs-dark', label: 'Dark' },
  { value: 'light',   label: 'Light' },
]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('theme') ?? 'vs-dark'
  )

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme !== 'light')
  }, [theme])

  function setTheme(value) {
    if (THEMES.some(t => t.value === value)) setThemeState(value)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
