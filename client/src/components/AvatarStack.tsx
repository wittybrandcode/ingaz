import Avatar from './Avatar'

interface AvatarUser {
  name: string
  avatar?: string | null
}

interface AvatarStackProps {
  users: AvatarUser[]
  max?: number
  size?: 'sm' | 'xs'
}

const sizeMap = { sm: 'w-6 h-6 text-[9px]', xs: 'w-5 h-5 text-[7px]' }

export default function AvatarStack({ users, max = 4, size = 'xs' }: AvatarStackProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className="flex items-center" style={{ direction: 'ltr' }}>
      {visible.map((u, i) => (
        <div key={i} className="-ml-1 first:ml-0 border-2 border-white rounded-full">
          <Avatar name={u.name} avatar={u.avatar} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div className={`-ml-1 border-2 border-white rounded-full ${sizeMap[size]} flex items-center justify-center bg-gray-100 text-gray-500 font-bold shrink-0`}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
