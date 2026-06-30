import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Home,
  ExternalLink,
  CreditCard,
  BarChart3,
  Wallet,
  Users,
  BookOpen,
  Languages,
  Settings,
  ScanText,
  Menu,
  X,
} from 'lucide-react'
import { clearAuth, getStoredUser, isAdmin, canMutateApplications, canManageLicenseTypes } from '../lib/auth'
import { AppLogo } from './AppLogo'
import { NotificationBell } from './NotificationBell'

const ADMIN_TABS = [
  { to: '/admin/utilisateurs', icon: Users, label: 'Agents & rôles' },
  { to: '/admin/libelles', icon: Languages, label: 'Libellés FR / EN' },
  { to: '/admin/ocr', icon: ScanText, label: 'OCR documents' },
] as const

function isAdminSection(pathname: string) {
  return ADMIN_TABS.some((tab) => pathname.startsWith(tab.to))
}

function getPageMeta(pathname: string): { title: string; subtitle: string } {
  if (/^\/admin\/dossiers\/\d+$/.test(pathname)) {
    return { title: 'Examen de dossier', subtitle: 'Consultation, instruction et délivrance' }
  }
  if (pathname.startsWith('/admin/dossiers')) {
    return { title: 'Dossiers', subtitle: "File d'instruction filtrable" }
  }
  if (pathname.startsWith('/admin/citoyens')) {
    return { title: 'Citoyens inscrits', subtitle: 'Comptes usagers du portail citoyen' }
  }
  if (pathname.startsWith('/admin/paiements')) {
    return { title: 'Paiements', subtitle: 'Vérification et validation des règlements' }
  }
  if (pathname.startsWith('/admin/recettes')) {
    return { title: 'Gestion des recettes', subtitle: 'Suivi financier et journal des encaissements' }
  }
  if (pathname.startsWith('/admin/rapports')) {
    return { title: 'Reporting', subtitle: 'Exports statistiques et dossiers' }
  }
  if (pathname.startsWith('/admin/types-licences')) {
    return { title: 'Types de licences', subtitle: 'Catalogue, tarifs, validité et pièces requises' }
  }
  if (pathname.startsWith('/admin/utilisateurs')) {
    return { title: 'Administration', subtitle: 'Utilisateurs, rôles et habilitations' }
  }
  if (pathname.startsWith('/admin/libelles')) {
    return { title: 'Administration', subtitle: 'Gestion des textes FR / EN' }
  }
  if (pathname.startsWith('/admin/ocr')) {
    return { title: 'Administration', subtitle: 'Lecture automatique des pièces justificatives' }
  }
  if (pathname.startsWith('/admin/profil')) {
    return { title: 'Mon profil', subtitle: 'E-mail et téléphone pour les alertes' }
  }
  return { title: 'Tableau de bord', subtitle: 'Pilotage et indicateurs en temps réel' }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getStoredUser('admin')
  const { title, subtitle } = getPageMeta(location.pathname)
  const showMutateNav = canMutateApplications(user)
  const showAdminNav = isAdmin(user)
  const showLicenseTypesNav = canManageLicenseTypes(user)
  const inAdminSection = isAdminSection(location.pathname)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    clearAuth('admin')
    navigate('/admin/connexion')
  }

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col bg-white border-r border-slate-100 shadow-[2px_0_16px_rgba(0,85,164,0.04)] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-2">
          <div>
            <AppLogo size="sm" />
            <p className="font-bold text-lg mt-4 tracking-tight text-slate-900">Backoffice DGTT</p>
            <p className="text-xs text-slate-500 mt-1">Licences de transport</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarLink to="/admin" end icon={LayoutDashboard} label="Tableau de bord" />
          <SidebarLink to="/admin/dossiers" icon={FileText} label="Dossiers" />
          <SidebarLink to="/admin/citoyens" icon={Users} label="Citoyens" />
          {showMutateNav && (
            <SidebarLink to="/admin/paiements" icon={CreditCard} label="Paiements" />
          )}
          <SidebarLink to="/admin/recettes" icon={Wallet} label="Recettes" />
          <SidebarLink to="/admin/rapports" icon={BarChart3} label="Reporting" />
          {showLicenseTypesNav && (
            <SidebarLink to="/admin/types-licences" icon={BookOpen} label="Types de licences" />
          )}
          {showAdminNav && (
            <SidebarLink
              to="/admin/utilisateurs"
              icon={Settings}
              label="Administration"
              isActiveOverride={inAdminSection}
            />
          )}
          <div className="pt-3 mt-3 border-t border-slate-100">
            <SidebarLink to="/" icon={Home} label="Portail citoyen" external />
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-[0_1px_12px_rgba(0,85,164,0.06)]">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
                aria-label="Ouvrir le menu"
              >
                <Menu size={22} />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0055a4] mb-1">
                  Backoffice DGTT
                </p>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                  {title}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <Link
                to="/"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#0055a4] transition-colors"
              >
                <ExternalLink size={14} />
                Portail citoyen
              </Link>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                <NotificationBell realm="admin" defaultLink="/admin/dossiers" variant="light" />
                <button
                  type="button"
                  onClick={() => navigate('/admin/profil')}
                  className="hidden sm:flex items-center gap-3 hover:opacity-90 transition-opacity text-left"
                  title="Mon profil"
                >
                  <div className="w-9 h-9 rounded-full bg-[#0055a4] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user?.full_name ? getInitials(user.full_name) : '?'}
                  </div>
                  <div className="hidden md:block min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Déconnexion"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>

          {inAdminSection && showAdminNav && (
            <div className="px-4 sm:px-6 lg:px-8 bg-slate-50/80 border-t border-slate-100">
              <nav className="flex gap-1 overflow-x-auto" aria-label="Onglets administration">
                {ADMIN_TABS.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        isActive
                          ? 'border-[#0055a4] text-[#0055a4] bg-white'
                          : 'border-transparent text-slate-500 hover:text-[#0055a4] hover:bg-white/60'
                      }`
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-slate-50/40">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  end,
  external,
  isActiveOverride,
}: {
  to: string
  icon: typeof LayoutDashboard
  label: string
  end?: boolean
  external?: boolean
  isActiveOverride?: boolean
}) {
  const baseClass =
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200'

  if (external) {
    return (
      <Link
        to={to}
        className={`${baseClass} text-slate-600 hover:bg-slate-50 hover:text-[#0055a4]`}
      >
        <Icon size={18} className="shrink-0 text-slate-400" />
        {label}
      </Link>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const active = isActiveOverride ?? isActive
        return `${baseClass} ${
          active
            ? 'bg-blue-50 text-[#0055a4] font-semibold ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-50 hover:text-[#0055a4]'
        }`
      }}
    >
      {({ isActive }) => {
        const active = isActiveOverride ?? isActive
        return (
          <>
            <Icon
              size={18}
              className={`shrink-0 ${active ? 'text-[#0055a4]' : 'text-slate-400'}`}
            />
            {label}
          </>
        )
      }}
    </NavLink>
  )
}
