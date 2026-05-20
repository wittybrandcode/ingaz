import { useState, createContext, useContext, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

interface ToastItem {
  id: number; message: string; type: 'success' | 'error' | 'warning'
}

interface ToastCtx {
  toast: (message: string, type?: ToastItem['type']) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(Ctx)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = nextId++
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 4000)
  }, [])

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id))

  const icons = { success: <CheckCircle2 className="w-5 h-5 text-green-500" />, error: <XCircle className="w-5 h-5 text-red-500" />, warning: <AlertTriangle className="w-5 h-5 text-amber-500" /> }
  const colors = { success: 'border-green-200 bg-green-50', error: 'border-red-200 bg-red-50', warning: 'border-amber-200 bg-amber-50' }

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2">
        {items.map(i => (
          <div key={i.id} role="alert" className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-slide-up ${colors[i.type]}`}>
            {icons[i.type]}
            <span className="text-gray-800">{i.message}</span>
            <button onClick={() => remove(i.id)} className="p-0.5 hover:bg-black/5 rounded-full mr-2"><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
