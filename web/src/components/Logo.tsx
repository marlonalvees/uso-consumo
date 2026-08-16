import logoNm from '../assets/logos/logo-nm.jpeg'

export default function Logo({ className = 'h-9' }: { className?: string }) {
  return <img src={logoNm} alt="Logo Novamix" className={`w-auto rounded-md bg-white ${className}`} />
}
