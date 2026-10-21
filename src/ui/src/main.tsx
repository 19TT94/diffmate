import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Contexts
import { SettingsProvider } from './contexts/SettingsContext'

// Components
import App from './App.tsx'

// Styles
import { GlobalStyle } from './styles/GlobalStyle'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <GlobalStyle />
      <App />
    </SettingsProvider>
  </StrictMode>,
)
