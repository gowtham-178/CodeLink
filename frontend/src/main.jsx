import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { RoomProvider } from './contexts/RoomContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <RoomProvider>
          <App />
        </RoomProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
