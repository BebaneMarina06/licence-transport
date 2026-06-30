import { Link, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, LogOut } from 'lucide-react'
import { clearAuth, getStoredUser } from '../lib/auth'

export function AdminLayout() {
  const navigate = useNavigate()
  const user = getStoredUser()

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <p className="font-bold text-lg">Backoffice DGTT</p>
          <p className="text-xs text-slate-400 mt-1">Licences de transport</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" icon={LayoutDashboard} label="Tableau de bord" />
          <NavLink to="/dossiers" icon={FileText} label="Dossiers" />
        </nav>
        <div className="p-4 border-t border-slate-700">
          <p className="text-sm truncate">{user?.full_name}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          <button
            onClick={() => {
              clearAuth()
              navigate('/connexion')
            }}
            className="mt-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
    >
      <Icon size={18} />
      {label}
    </Link>
  )
}
