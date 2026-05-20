interface StatsPillProps {
  icon: React.ComponentType<{ className?: string }>
  count: number
  label?: string
  color?: string
}

const palettes: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'text-gray-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-500' },
}

export default function StatsPill({ icon: Icon, count, label, color = 'blue' }: StatsPillProps) {
  const p = palettes[color] || palettes.blue
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-bold ${p.bg} ${p.text}`}>
      <Icon className={`w-3 h-3 ${p.icon}`} />
      {count}
      {label && <span className="opacity-70">{label}</span>}
    </span>
  )
}
