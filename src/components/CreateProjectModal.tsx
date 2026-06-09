import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '../services/api/projects'

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: (projectId: string) => void
}

export default function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const qc = useQueryClient()
  const [projectName, setProjectName] = useState('')

  const createMutation = useMutation({
    mutationFn: (name: string) => projectsApi.create({ name }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      onCreated(project.id)
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
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white">New Project</p>
          <button onClick={onClose} className="text-[#64748b] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          type="text"
          placeholder="Project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] outline-none focus:border-[#f97316] mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#64748b] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="px-4 py-1.5 bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
