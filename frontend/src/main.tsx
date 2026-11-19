import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './app/App'
import { AppProvider } from './app/store'
import { Boot } from './app/Boot'
import { ToastProvider } from './design'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Boot>
        {(data) => (
          <AppProvider data={data}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AppProvider>
        )}
      </Boot>
    </BrowserRouter>
  </StrictMode>,
)
