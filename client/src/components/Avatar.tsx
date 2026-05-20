interface AvatarProps {
  name: string
  avatar?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'w-5 h-5 text-[7px]',
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-lg',
}

export default function Avatar({ name, avatar, size = 'md', className = '' }: AvatarProps) {
  if (avatar) {
    return (
      <img src={`/uploads/${avatar}`} alt={name}
        className={`${sizes[size]} rounded-full object-cover shrink-0 ${className}`} />
    )
  }

  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-purple-100 text-purple-700',
  ]
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length

  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0 ${colors[colorIndex]} ${className}`}>
      {name.charAt(0)}
    </div>
  )
}

export function AvatarWithName({ name, avatar, size = 'md', showName = true }: AvatarProps & { showName?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} avatar={avatar} size={size} />
      {showName && <span className="text-sm text-gray-700 truncate">{name}</span>}
    </div>
  )
}
