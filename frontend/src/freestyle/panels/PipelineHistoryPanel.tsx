import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { preprocessingApi } from '../../services/api/preprocessing'

interface Props { projectId: string; onApplied: () => void }

const STEP_LABELS: Record<string, string> = {
  missing_values:    'Missing Values',
  outliers:          'Outliers',
  encoding:          'Encoding',
  scaling:           'Scaling',
  drop_columns:      'Drop Columns',
  rename_column:     'Rename Column',
  feature_engineering: 'Feature Engineering',
  filter_rows:       'Filter Rows',
  cast_column:       'Type Cast',
  replace_values:    'Replace Values',
}

function configSummary(stepName: string, config: Record<string, unknown> | null): string {
  if (!config) return ''
  if (stepName === 'drop_columns') return `Dropped: ${(config.dropped_columns as string[])?.join(', ') ?? ''}`
  if (stepName === 'rename_column') return `${config.old_name} → ${config.new_name}`
  if (stepName === 'missing_values') return `num: ${config.numerical_method}, cat: ${config.categorical_method}`
  if (stepName === 'cast_column') return `${config.column} → ${config.dtype}`
  if (stepName === 'replace_values') return `${config.column}: "${config.old_value}" → "${config.new_value}"`
  if (stepName === 'filter_rows') return config.operation === 'drop_duplicates' ? 'Drop duplicates' : `${config.column} ${config.operator} ${config.value}`
  if (stepName === 'feature_engineering') return `${config.operation}: ${config.new_col}`
  return ''
}

export default function PipelineHistoryPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-history', projectId],
    queryFn: () => preprocessingApi.pipelineHistory(projectId),
    enabled: !!projectId,
  })

  const restoreMutation = useMutation({
    mutationFn: (stateId: string) => preprocessingApi.restoreSnapshot(projectId, stateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Dataset restored to selected checkpoint')
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const history = data?.history ?? []

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-[#111827] border border-[#1e2a3a] rounded-lg animate-pulse" />
          ))
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Clock size={24} className="text-[#374151]" />
            <p className="text-xs text-[#64748b]">No pipeline steps recorded yet.</p>
            <p className="text-[11px] text-[#374151]">Apply preprocessing steps and they'll appear here.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-[#374151] mb-1">Click Restore to roll back the dataset to any checkpoint.</p>
            {history.map((entry, idx) => {
              const label = STEP_LABELS[entry.step_name] ?? entry.step_name
              const summary = configSummary(entry.step_name, entry.config)
              const ts = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const isLatest = idx === 0
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${isLatest ? 'border-[#22c55e30] bg-[#22c55e08]' : 'border-[#1e2a3a] bg-[#111827]'}`}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#e2e8f0]">{label}</span>
                      {isLatest && <span className="text-[8px] px-1 py-0.5 bg-[#22c55e] text-white rounded">LATEST</span>}
                    </div>
                    {summary && <span className="text-[10px] font-mono text-[#4a5568] truncate mt-0.5">{summary}</span>}
                    <span className="text-[9px] text-[#374151] mt-0.5">{ts}</span>
                  </div>
                  {!isLatest && (
                    <button
                      onClick={() => restoreMutation.mutate(entry.id)}
                      disabled={restoreMutation.isPending}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 bg-[#0d1117] border border-[#2d3748] hover:border-[#f97316] text-[#64748b] hover:text-[#f97316] text-[10px] font-semibold rounded transition-colors disabled:opacity-40"
                      title="Restore dataset to this checkpoint"
                    >
                      <RotateCcw size={10} />
                      Restore
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
