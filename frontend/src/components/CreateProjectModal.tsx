import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Sparkles, Table2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '../services/api/projects'
import type { ViewMode } from '../types'

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: (projectId: string, mode: ViewMode) => void
}

export default function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const qc = useQueryClient()
  const [projectName, setProjectName] = useState('')
  const [mode, setMode] = useState<ViewMode>('guided')

  const createMutation = useMutation({
    mutationFn: (name: string) => projectsApi.create({ name }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      onCreated(project.id, mode)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleCreate = () => {
    const name = projectName.trim() || `Project ${new Date().toLocaleDateString()}`
    createMutation.mutate(name)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-white">New Project</p>
          <button onClick={onClose} className="text-[#64748b] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <label className="block text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">
          Project name
        </label>
        <input
          autoFocus
          type="text"
          placeholder="e.g. customer_churn_v2"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] outline-none focus:border-[#f97316] mb-5"
        />

        <label className="block text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2.5">
          Mode Selection
        </label>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <ModeCard
            selected={mode === 'guided'}
            onClick={() => setMode('guided')}
            icon={<Sparkles size={18} className="text-[#f97316]" />}
            title="Guided Mode"
            description="Step-by-step pipeline creation with smart defaults."
          />
          <ModeCard
            selected={mode === 'freestyle'}
            onClick={() => setMode('freestyle')}
            icon={<Table2 size={18} className="text-[#94a3b8]" />}
            title="Freestyle Mode"
            description="Direct dataset manipulation and flexible tool selection."
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#64748b] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Project →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModeCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border transition-all duration-150 relative ${
        selected
          ? 'border-[#f97316] bg-[#f9731608]'
          : 'border-[#1e2a3a] bg-[#0d1117] hover:border-[#2d3748]'
      }`}
    >
      <div className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{ borderColor: selected ? '#f97316' : '#374151' }}>
        {selected && <div className="w-2 h-2 rounded-full bg-[#f97316]" />}
      </div>
      <div className="mb-2.5">{icon}</div>
      <p className="text-xs font-semibold text-white mb-1">{title}</p>
      <p className="text-[11px] text-[#64748b] leading-relaxed">{description}</p>
    </button>
  )
}
