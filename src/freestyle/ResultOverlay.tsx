import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ResultOverlayProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function ResultOverlay({ title, onClose, children }: ResultOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50 }}
    >
      <div
        className="flex flex-col mx-4 my-4 rounded-xl border border-[#1e2a3a] overflow-hidden"
        style={{ flex: 1, backgroundColor: '#0d1117', minHeight: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2a3a] flex-shrink-0">
          <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">{title}</span>
          <button
            onClick={onClose}
            className="text-[#4a5568] hover:text-white transition-colors p-0.5"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
