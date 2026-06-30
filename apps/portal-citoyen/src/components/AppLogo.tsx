const LOGO_SRC = '/logo-gabon.png'

type AppLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizes = {
  sm: { img: 'h-9 w-9', label: 'text-sm' },
  md: { img: 'h-11 w-11', label: 'text-lg' },
  lg: { img: 'h-20 w-20', label: 'text-xl' },
}

export function AppLogo({ size = 'md', showLabel = false, className = '' }: AppLogoProps) {
  const s = sizes[size]

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={LOGO_SRC}
        alt="Armoiries de la République Gabonaise"
        className={`${s.img} object-contain bg-white rounded-full p-0.5 shrink-0`}
      />
      {showLabel && (
        <div>
          <p className={`font-semibold leading-tight ${s.label}`}>Licences de Transport</p>
          <p className="text-xs opacity-80">République Gabonaise — DGTT</p>
        </div>
      )}
    </div>
  )
}
