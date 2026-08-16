import logoNm from '../assets/logos/logo-nm.jpeg'

type LogoProps = {
  compact?: boolean
}

export default function Logo({ compact = false }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'py-4' : 'px-6 py-6'}`}>
      <img
        src={logoNm}
        alt="Logo Novamix"
        className={`rounded-lg bg-white ${compact ? 'w-[55%] max-w-32' : 'w-[70%] max-w-48'}`}
      />
    </div>
  )
}
