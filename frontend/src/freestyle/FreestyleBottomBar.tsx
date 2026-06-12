import { Info } from 'lucide-react'

interface FreestyleBottomBarProps {
  statusText: string
  onSwitchToGuided: () => void
}

export default function FreestyleBottomBar({ statusText, onSwitchToGuided }: FreestyleBottomBarProps) {
  return (
    <div
      className="flex items-center justify-between px-4 border-t border-[#1e2a3a] bg-[#0d1117] flex-shrink-0"
      style={{ height: '36px' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Info size={11} className="text-[#4a5568] flex-shrink-0" />
        <span className="text-[11px] text-[#4a5568] truncate">{statusText}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <button
          onClick={onSwitchToGuided}
          className="text-[11px] text-[#64748b] hover:text-white border border-[#1e2a3a] hover:border-[#2d3748] px-2.5 py-1 rounded transition-colors"
        >
          Guided Mode
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span className="text-[11px] text-[#4a5568]">Kernel: Ready</span>
        </div>
      </div>
    </div>
  )
}
