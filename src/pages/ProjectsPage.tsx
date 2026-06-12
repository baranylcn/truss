import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, Trash2, ArrowRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '../services/api/projects'
import type { PipelineStep, Project, ViewMode } from '../types'

interface ProjectsPageProps {
  onOpenProject: (id: string, step: PipelineStep, mode: ViewMode) => void
}

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  active:    { dot: '#f97316', text: '#f97316', bg: '#f9731618', label: 'Active' },
  completed: { dot: '#22c55e', text: '#22c55e', bg: '#22c55e18', label: 'Completed' },
  failed:    { dot: '#ef4444', text: '#ef4444', bg: '#ef444418', label: 'Failed' },
}

const STEP_LABELS: Record<string, string> = {
  upload: 'Upload',
  analyze: 'Analysis',
  'missing-values': 'Missing Values',
  outliers: 'Outliers',
  encoding: 'Encoding',
  correlation: 'Correlation',
  scaling: 'Scaling',
  training: 'Training',
  evaluation: 'Evaluation',
  optimization: 'Optimization',
  export: 'Export',
  'filter-rows': 'Filter Rows',
  'feature-engineering': 'Feature Eng.',
  'feature-selection': 'Feature Sel.',
  'cross-validate': 'Cross Validation',
  'pipeline-history': 'History',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ProjectsPage({ onOpenProject }: ProjectsPageProps) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setConfirmDelete(null)
      toast.success('Project deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.filename ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-[#64748b]">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded-lg text-sm text-white placeholder-[#4a5568] outline-none focus:border-[#f97316] w-52"
          />
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm font-semibold text-white mb-2">Delete project?</p>
            <p className="text-xs text-[#64748b] mb-6">This will permanently delete the project and all its pipeline data.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-1.5 text-xs text-[#64748b] hover:text-white">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="px-4 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e2a3a] grid grid-cols-12 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">
          <span className="col-span-4">Project</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Current Step</span>
          <span className="col-span-2">Dataset</span>
          <span className="col-span-1">Created</span>
          <span className="col-span-1" />
        </div>

        {isLoading && (
          <div className="px-5 py-10 text-center text-sm text-[#64748b]">Loading…</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-[#64748b]">{search ? 'No projects match your search.' : 'No projects yet.'}</p>
          </div>
        )}

        <div className="divide-y divide-[#1e2a3a]">
          {filtered.map((project: Project) => {
            const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.active
            const stepLabel = STEP_LABELS[project.current_step] ?? project.current_step
            return (
              <div key={project.id} className="grid grid-cols-12 items-center px-5 py-4 hover:bg-white/[0.02] transition-colors">
                {/* Name */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#1c2333] border border-[#2d3748] flex items-center justify-center flex-shrink-0">
                    <Activity size={14} className="text-[#f97316]" />
                  </div>
                  <p className="text-sm font-medium text-white truncate">{project.name}</p>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase"
                    style={{ color: style.text, backgroundColor: style.bg }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                    {style.label}
                  </div>
                </div>

                {/* Current step */}
                <div className="col-span-2">
                  <span className="text-xs text-[#64748b]">{stepLabel}</span>
                </div>

                {/* Dataset */}
                <div className="col-span-2 min-w-0">
                  <p className="text-xs font-mono text-[#4a5568] truncate">
                    {project.filename ?? '-'}
                  </p>
                  {project.shape && (
                    <p className="text-[10px] text-[#374151]">{project.shape[0].toLocaleString()} × {project.shape[1]}</p>
                  )}
                </div>

                {/* Created */}
                <div className="col-span-1">
                  <span className="text-[11px] text-[#374151]">{timeAgo(project.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmDelete(project.id)}
                    className="p-1.5 text-[#374151] hover:text-[#ef4444] transition-colors rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => onOpenProject(project.id, project.current_step ?? 'upload', project.view_mode ?? 'guided')}
                    className="p-1.5 text-[#374151] hover:text-[#f97316] transition-colors rounded"
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
