import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function AuthLayout({
  children,
  backTo = '/',
  backLabel = "Retour à l'accueil",
}: {
  children: React.ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="min-h-screen bg-[#f4f8fc] flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#0055a4]/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#0055a4]/8 blur-3xl" />
      </div>

      <header className="relative z-10 px-6 py-5">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#0055a4] transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-12">
        {children}
      </main>

      <footer className="relative z-10 text-center text-xs text-slate-400 pb-6">
        Direction Générale des Transports Terrestres — République Gabonaise
      </footer>
    </div>
  )
}
