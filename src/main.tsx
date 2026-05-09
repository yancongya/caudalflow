import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Clear stale localStorage on every startup so LangGraph thread state never
// diverges from what CopilotKit expects (avoids "Message not found" errors).
localStorage.clear();

createRoot(document.getElementById('root')!).render(
  <App />
)
