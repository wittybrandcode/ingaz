import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
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

function badgeOffset(bSize: number): { top?: string; right?: string; bottom?: string; left?: string } {
  const off = `${-Math.round(bSize * 0.55)}px`
  return { top: off, right: off }
}

export default function ProfileAvatar({ name, avatar, size = 'md', badges = [], className = '' }: ProfileAvatarProps) {
  const avatarSize = avatarPixels[size] || 32
  const defaultBadgeSize = Math.max(14, Math.round(avatarSize * 0.35))

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <Avatar name={name} avatar={avatar} size={size} />
      {badges.map(b => {
        const bSize = b.size ?? defaultBadgeSize
        const pos = b.position
        let offset: { top?: string; right?: string; bottom?: string; left?: string }
        if (pos === 'top-right') offset = { top: badgeOffset(bSize).top, right: badgeOffset(bSize).right }
        else if (pos === 'bottom-right') offset = { bottom: badgeOffset(bSize).top, right: badgeOffset(bSize).right }
        else if (pos === 'bottom-left') offset = { bottom: badgeOffset(bSize).top, left: badgeOffset(bSize).right }
        else offset = { top: badgeOffset(bSize).top, left: badgeOffset(bSize).right }
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
              ...offset,
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

export function assignBadge(permissions: string[] = []): AvatarBadge | null {
  if (permissions.length === 0) return null
  const ok = ASSIGN_REQUIRED_PERMS.every(p => permissions.includes(p))
  if (!ok) return null
  return {
    key: 'assign-qualified',
    content: <Check className="w-full h-full p-0.5" />,
    position: 'bottom-left',
    bgColor: '#d5e8d4',
    textColor: '#16a34a',
    tooltip: 'مؤهل للتكليف',
  }
}

export function canAssignBadge(canAssign: boolean): AvatarBadge | null {
  if (!canAssign) return null
  return assignBadge(ASSIGN_REQUIRED_PERMS)
}

export function warningsBadge(count: number | undefined): AvatarBadge | null {
  if (!count || count <= 0) return null
  const color = count <= 2 ? '#eab308' : '#ef4444'
  return {
    key: 'warnings',
    content: <span>{count}</span>,
    position: 'top-left',
    size: 20,
    bgColor: color,
    textColor: '#fff',
    tooltip: `الإنذارات: ${count}`,
  }
}

export function notificationBadge(count: number | undefined): AvatarBadge | null {
  if (Number(count) <= 0) return null
  return {
    key: 'notifications',
    content: <span>{count}</span>,
    position: 'top-right',
    size: 20,
    bgColor: '#6366f1',
    textColor: '#fff',
    tooltip: `الإشعارات: ${count}`,
  }
}

export function onlineBadge(online: boolean | undefined): AvatarBadge {
  return {
    key: 'online',
    content: <div className={`w-full h-full rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />,
    position: 'bottom-right',
    size: 12,
    tooltip: online ? 'متصل' : 'غير متصل',
  }
}

export type { AvatarBadge, BadgePosition, ProfileAvatarProps }
