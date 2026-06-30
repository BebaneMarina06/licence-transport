import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { AdminLoginPage } from './pages/AdminLogin'
import { RegisterPage } from './pages/Register'
import { DashboardPage } from './pages/Dashboard'
import { NewApplicationPage } from './pages/NewApplication'
import { ApplicationDetailPage } from './pages/ApplicationDetail'
import { AdminDashboardPage } from './pages/admin/AdminDashboard'
import { AdminApplicationsListPage } from './pages/admin/AdminApplicationsList'
import { AdminApplicationReviewPage } from './pages/admin/AdminApplicationReview'
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminLicenseTypesPage } from './pages/admin/AdminLicenseTypesPage'
import { AdminLabelsPage } from './pages/admin/AdminLabelsPage'
import { AdminOcrSettingsPage } from './pages/admin/AdminOcrSettingsPage'
import { AdminCitizensPage } from './pages/admin/AdminCitizensPage'
import { AdminRevenuePage } from './pages/admin/AdminRevenuePage'
import { getStoredUser, isAdmin, isLoggedIn, isStaff, canManageLicenseTypes, staffProfileComplete } from './lib/auth'
import { AdminCompleteProfilePage, AdminProfilePage } from './pages/admin/AdminProfilePage'
import { useLicenseTypesSync } from './hooks/useLicenseTypesSync'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
    },
  },
})

function LicenseTypesSync() {
  useLicenseTypesSync()
  return null
}

function ProtectedRoute() {
  const location = useLocation()
  if (!isLoggedIn('citizen')) return <Navigate to="/connexion" state={{ from: location }} replace />
  return <Outlet />
}

function StaffRoute() {
  const user = getStoredUser('admin')
  const location = useLocation()
  if (!isLoggedIn('admin')) return <Navigate to="/admin/connexion" state={{ from: location }} replace />
  if (!isStaff(user)) return <Navigate to="/espace" replace />
  return <Outlet />
}

function StaffProfileGuard() {
  const user = getStoredUser('admin')
  const location = useLocation()
  if (!staffProfileComplete(user) && location.pathname !== '/admin/completer-profil') {
    return <Navigate to="/admin/completer-profil" replace />
  }
  if (staffProfileComplete(user) && location.pathname === '/admin/completer-profil') {
    return <Navigate to="/admin" replace />
  }
  return <Outlet />
}

function AdminOnlyRoute() {
  const user = getStoredUser('admin')
  if (!isAdmin(user)) return <Navigate to="/admin" replace />
  return <Outlet />
}

function LicenseTypesRoute() {
  const user = getStoredUser('admin')
  if (!canManageLicenseTypes(user)) return <Navigate to="/admin" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LicenseTypesSync />
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/admin/connexion" element={<AdminLoginPage />} />
          <Route path="/inscription" element={<RegisterPage />} />

          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/espace" element={<DashboardPage />} />
              <Route path="/nouvelle-demande" element={<NewApplicationPage />} />
              <Route path="/dossier/:id" element={<ApplicationDetailPage />} />
            </Route>
          </Route>

          <Route element={<StaffRoute />}>
            <Route path="/admin/completer-profil" element={<AdminCompleteProfilePage />} />
            <Route element={<StaffProfileGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/profil" element={<AdminProfilePage />} />
              <Route path="/admin/dossiers" element={<AdminApplicationsListPage />} />
              <Route path="/admin/citoyens" element={<AdminCitizensPage />} />
              <Route path="/admin/recettes" element={<AdminRevenuePage />} />
              <Route path="/admin/dossiers/:id" element={<AdminApplicationReviewPage />} />
              <Route path="/admin/paiements" element={<AdminPaymentsPage />} />
              <Route path="/admin/rapports" element={<AdminReportsPage />} />
              <Route element={<LicenseTypesRoute />}>
                <Route path="/admin/types-licences" element={<AdminLicenseTypesPage />} />
              </Route>
              <Route element={<AdminOnlyRoute />}>
                <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
                <Route path="/admin/libelles" element={<AdminLabelsPage />} />
                <Route path="/admin/ocr" element={<AdminOcrSettingsPage />} />
              </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
