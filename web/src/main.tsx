import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/push'

// app instalável (tela inicial do celular) e notificações push
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
