import { useState, useEffect, useRef } from 'react'
import { Bell, Trash2, Palette } from 'lucide-react'

interface NotifBarProps {
  notif: string
  onClose: () => void
  index: number
  colorTheme: string
  setColorTheme: (theme: string) => void
}

const themeOptions = [
  { key: 'default', colors: ['#D5D8DC', '#DFE2E6', '#EAECEF', '#F4F5F7'] },
  { key: 'slate',   colors: ['#CBD5E1', '#94A3B8', '#64748B', '#475569'] },
  { key: 'emerald', colors: ['#A7F3D0', '#6EE7B7', '#34D399', '#10B981'] },
  { key: 'rose',    colors: ['#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E'] },
  { key: 'amber',   colors: ['#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B'] },
  { key: 'indigo',  colors: ['#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1'] },
]

const notifColors = ['#4A90D9', '#E5A700', '#4CAF50', '#EF4444']

export default function NotifBar({ notif, onClose, index, colorTheme, setColorTheme }: NotifBarProps) {
  const [bellHover, setBellHover] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paletteOpen) return
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [paletteOpen])

  if (!notif) return null

  return (
    <div className="flex items-center justify-between mx-2.5 mb-2 px-3.5 py-0 rounded-lg anim-fade shrink-0" style={{ background: 'rgba(255,255,255,0.04)', height: '36px' }}>
      <button
        onClick={onClose}
        onMouseEnter={() => setBellHover(true)}
        onMouseLeave={() => setBellHover(false)}
        className="w-7 h-7 rounded-full border-none flex items-center justify-center cursor-pointer transition-all shrink-0"
        style={{ background: bellHover ? '#EF4444' : '#fff' }}
      >
        {bellHover ? <Trash2 className="w-3.5 h-3.5 text-white" /> : <Bell className="w-3.5 h-3.5" style={{ color: '#333' }} />}
      </button>
      <div className="flex-1 px-4 text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span className="w-2 h-2 rounded-full inline-block ml-1.5" style={{ background: notifColors[index % notifColors.length] }} />
        {notif}
      </div>
      <div className="relative flex items-center">
        <button onClick={() => setPaletteOpen(!paletteOpen)}
          className="w-6 h-6 rounded-md border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
          <Palette className="w-3 h-3" />
        </button>
        {paletteOpen && (
          <div ref={paletteRef}
            className="absolute bottom-full left-0 mb-1.5 p-2 rounded-xl shadow-xl anim-fade flex gap-1.5 z-50"
            style={{ background: 'rgba(30,30,50,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {themeOptions.map(t => (
              <button key={t.key} onClick={() => { setColorTheme(t.key); setPaletteOpen(false) }}
                className="w-7 h-7 rounded-lg border-2 cursor-pointer transition-all hover:scale-110 p-0.5 flex items-center justify-center overflow-hidden"
                style={{ borderColor: colorTheme === t.key ? '#fff' : 'transparent', background: t.colors[0] }}>
                <div className="flex gap-px">
                  {t.colors.map((c, i) => <div key={i} className="w-1.5 h-4 rounded-sm" style={{ background: c }} />)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
