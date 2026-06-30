import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User, Shield, Menu, X } from 'lucide-react'
import { clearAuth, getStoredUser, isStaff } from '../lib/auth'
import { getLanguage, setLanguage } from '../lib/i18n'
import type { AppLanguage } from '../types'
import { NotificationBell } from './NotificationBell'
import { AppLogo } from './AppLogo'
import { useEffect, useState } from 'react'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const citizen = getStoredUser('citizen')
  const admin = getStoredUser('admin')
  const [lang, setLang] = useState<AppLanguage>(getLanguage())
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const switchLang = (next: AppLanguage) => {
    setLanguage(next)
    setLang(next)
    window.location.reload()
  }

  const handleLogout = () => {
    clearAuth('citizen')
    navigate('/')
  }

  const langSwitch = (
    <div className="flex items-center gap-1 text-xs border border-white/30 rounded overflow-hidden">
      <button
        onClick={() => switchLang('fr')}
        className={`px-2 py-1 ${lang === 'fr' ? 'bg-white text-[#0055a4]' : 'hover:bg-white/10'}`}
      >
        FR
      </button>
      <button
        onClick={() => switchLang('en')}
        className={`px-2 py-1 ${lang === 'en' ? 'bg-white text-[#0055a4]' : 'hover:bg-white/10'}`}
      >
        EN
      </button>
    </div>
  )

  return (
    <>
      <header className="bg-[#0055a4] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <AppLogo size="md" showLabel className="text-white" />
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm">
            {langSwitch}
            <Link to="/" className="hover:text-blue-200 transition-colors">
              Accueil
            </Link>
            {citizen || admin ? (
              <>
                {citizen && (
                  <Link to="/espace" className="hover:text-blue-200 transition-colors">
                    Mon espace
                  </Link>
                )}
                {admin && isStaff(admin) && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Shield size={14} />
                    Backoffice DGTT
                  </Link>
                )}
                <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                  {citizen && <NotificationBell />}
                  <User size={16} />
                  <span className="max-w-[10rem] truncate">{citizen?.full_name ?? admin?.full_name}</span>
                  <button
                    onClick={handleLogout}
                    className="ml-2 p-1.5 rounded hover:bg-white/10"
                    title="Déconnexion citoyen"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/connexion" className="hover:text-blue-200 transition-colors">
                  Connexion
                </Link>
                <Link
                  to="/inscription"
                  className="bg-white text-[#0055a4] px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  S'inscrire
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            {citizen && <NotificationBell />}
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="p-2 rounded-lg hover:bg-white/10"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/15 bg-[#004b91]">
            <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-1 text-sm">
              {(citizen || admin) && (
                <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/15">
                  <User size={16} />
                  <span className="font-medium truncate">
                    {citizen?.full_name ?? admin?.full_name}
                  </span>
                </div>
              )}
              <Link to="/" className="py-2.5 px-2 rounded-lg hover:bg-white/10 transition-colors">
                Accueil
              </Link>
              {citizen || admin ? (
                <>
                  {citizen && (
                    <Link
                      to="/espace"
                      className="py-2.5 px-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      Mon espace
                    </Link>
                  )}
                  {admin && isStaff(admin) && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-1.5 py-2.5 px-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Shield size={14} />
                      Backoffice DGTT
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 py-2.5 px-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                  >
                    <LogOut size={16} />
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/connexion"
                    className="py-2.5 px-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link
                    to="/inscription"
                    className="mt-1 bg-white text-[#0055a4] px-4 py-2.5 rounded-lg font-medium text-center hover:bg-blue-50 transition-colors"
                  >
                    S'inscrire
                  </Link>
                </>
              )}
              <div className="pt-3 mt-2 border-t border-white/15">{langSwitch}</div>
            </nav>
          </div>
        )}
      </header>
      <Outlet />
      <footer className="bg-slate-800 text-slate-300 text-sm py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>Ministère des Transports — Direction Générale des Transports Terrestres</p>
          <p className="mt-1 text-slate-400">© {new Date().getFullYear()} République Gabonaise</p>
        </div>
      </footer>
    </>
  )
}
