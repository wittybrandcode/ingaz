import type { ReactNode } from 'react'

interface KanbanColumnProps {
  header: ReactNode
  children: ReactNode
  bg: string
}

export default function KanbanColumn({ header, children, bg }: KanbanColumnProps) {
  return (
    <div className="rounded-xl flex flex-col overflow-hidden" style={{ background: bg }}>
      <div className="flex items-center justify-between px-4 py-2.5">
        {header}
      </div>
      <div className="col-body">
        {children}
      </div>
    </div>
  )
}
