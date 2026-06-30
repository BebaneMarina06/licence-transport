import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173'

export default function App() {
  useEffect(() => {
    window.location.replace(`${PORTAL_URL}/connexion`)
  }, [])

  return <Navigate to="/connexion" replace />
}
