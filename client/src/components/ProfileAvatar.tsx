import type { ReactNode } from 'react'
import { Check, X, Bell } from 'lucide-react'
import Avatar from './Avatar'
import { ASSIGN_REQUIRED_PERMS } from '../constants'

type BadgePosition = 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'

interface AvatarBadge {
  key: string
  content: ReactNode
  position: BadgePosition
  size?: number
  bgColor?: string
  textColor?: string
  tooltip?: string
}

interface ProfileAvatarProps {
  name: string
  avatar?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  badges?: AvatarBadge[]
  className?: string
}

const avatarPixels: Record<string, number> = {
  xs: 20, sm: 24, md: 32, lg: 40, xl: 56,
}

const positionStyles: Record<BadgePosition, { top?: string; right?: string; bottom?: string; left?: string }> = {
  'top-right': { top: '-4px', right: '-4px' },
  'bottom-right': { bottom: '-4px', right: '-4px' },
  'bottom-left': { bottom: '-4px', left: '-4px' },
  'top-left': { top: '-4px', left: '-4px' },
}

export default function ProfileAvatar({ name, avatar, size = 'md', badges = [], className = '' }: ProfileAvatarProps) {
  const avatarSize = avatarPixels[size] || 32
  const defaultBadgeSize = Math.max(14, Math.round(avatarSize * 0.4))

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} style={{ width: avatarSize, height: avatarSize }}>
      <Avatar name={name} avatar={avatar} size={size} />
      {badges.map(b => {
        const bSize = b.size ?? defaultBadgeSize
        return (
          <div
            key={b.key}
            title={b.tooltip}
            style={{
              position: 'absolute',
              width: bSize,
              height: bSize,
              fontSize: Math.max(8, Math.round(bSize * 0.45)),
              backgroundColor: b.bgColor || '#e1d5e7',
              color: b.textColor || '#7c3aed',
              ...positionStyles[b.position],
            }}
            className="rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm"
          >
            {b.content}
          </div>
        )
      })}
    </div>
  )
}

export function assignBadge(permissions: string[] = []): AvatarBadge {
  const ok = ASSIGN_REQUIRED_PERMS.every(p => permissions.includes(p))
  return {
    key: 'assign-qualified',
    content: ok ? <Check className="w-full h-full p-0.5" /> : <X className="w-full h-full p-0.5" />,
    position: 'bottom-left',
    bgColor: ok ? '#d5e8d4' : '#f3f4f6',
    textColor: ok ? '#16a34a' : '#9ca3af',
    tooltip: ok ? 'مؤهل للتكليف' : 'غير مؤهل للتكليف',
  }
}

export function warningsBadge(count: number): AvatarBadge | null {
  if (count === 0) return null
  const color = count <= 2 ? '#eab308' : '#ef4444'
  return {
    key: 'warnings',
    content: <span>{count}</span>,
    position: 'top-left',
    size: 20,
    bgColor: color,
    textColor: '#fff',
    tooltip: `التنبيهات: ${count}`,
  }
}

export function notificationBadge(count: number): AvatarBadge | null {
  if (count === 0) return null
  return {
    key: 'notifications',
    content: <Bell className="w-full h-full p-0.5" />,
    position: 'top-right',
    size: 20,
    bgColor: '#6366f1',
    textColor: '#fff',
    tooltip: `الإشعارات: ${count}`,
  }
}

export function onlineBadge(online: boolean): AvatarBadge {
  return {
    key: 'online',
    content: <div className={`w-full h-full rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />,
    position: 'bottom-right',
    size: 12,
    tooltip: online ? 'متصل' : 'غير متصل',
  }
}

export type { AvatarBadge, BadgePosition, ProfileAvatarProps }
