import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import { preprocessingApi } from '../services/api/preprocessing'
import type { PipelineStep } from '../types'

interface FreestyleDataTableProps {
  projectId: string
  activeStep: PipelineStep | null
  onUploadRequest?: () => void
}

const STEP_AFFECTED_COLS: Partial<Record<PipelineStep, (info: { missing_values: Record<string, number>; categorical_columns: string[] | null }) => string[]>> = {
  'missing-values': (info) => Object.keys(info.missing_values).filter(c => info.missing_values[c] > 0),
  'encoding': (info) => info.categorical_columns ?? [],
}

export default function FreestyleDataTable({ projectId, activeStep, onUploadRequest }: FreestyleDataTableProps) {
  const qc = useQueryClient()
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const [confirmCol, setConfirmCol] = useState<string | null>(null)
  const [renamingCol, setRenamingCol] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const dropMutation = useMutation({
    mutationFn: (col: string) => preprocessingApi.dropColumns(projectId, [col]),
    onSuccess: (_, col) => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      toast.success(`"${col}" dropped`)
      setConfirmCol(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setConfirmCol(null)
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      preprocessingApi.renameColumn(projectId, oldName, newName),
    onSuccess: (_, { oldName, newName }) => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      toast.success(`"${oldName}" → "${newName}"`)
      setRenamingCol(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => {
    if (renamingCol) renameInputRef.current?.focus()
  }, [renamingCol])

  const startRename = (col: string) => {
    setRenamingCol(col)
    setRenameValue(col)
    setHoveredCol(null)
    setConfirmCol(null)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === renamingCol) {
      setRenamingCol(null)
      return
    }
    renameMutation.mutate({ oldName: renamingCol!, newName: trimmed })
  }

  const columns = analyzeData?.dataset_info.columns ?? []
  const rows = analyzeData?.dataset_info.data ?? []

  const highlightedCols = new Set<string>(
    activeStep && analyzeData
      ? (STEP_AFFECTED_COLS[activeStep]?.(analyzeData.dataset_info) ?? [])
      : []
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#64748b]">
        Loading dataset…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-[#64748b]">
        <p>No data available.</p>
        {onUploadRequest && (
          <button
            onClick={onUploadRequest}
            className="px-4 py-2 bg-[#111827] border border-[#1e2a3a] hover:border-[#f97316] text-[#f97316] text-xs font-semibold rounded-lg transition-colors"
          >
            Upload Dataset
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="text-xs w-max min-w-full">
        <thead className="sticky top-0 z-[5]">
          <tr className="bg-[#0d1117] border-b border-[#1e2a3a]">
            <th className="px-3 py-2 text-[10px] font-semibold text-[#374151] uppercase tracking-widest text-right w-10 sticky left-0 bg-[#0d1117]">#</th>
            {columns.map(col => {
              const isHovered = hoveredCol === col
              const isConfirm = confirmCol === col
              const isRenaming = renamingCol === col
              const isHighlighted = highlightedCols.has(col)
              const isDropping = dropMutation.isPending && dropMutation.variables === col

              return (
                <th
                  key={col}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-left whitespace-nowrap relative"
                  style={{
                    color: isConfirm ? '#ef4444' : isHighlighted ? '#f97316' : isHovered ? '#e2e8f0' : '#4a5568',
                    backgroundColor: isConfirm
                      ? 'rgba(239,68,68,0.08)'
                      : isRenaming
                      ? 'rgba(99,102,241,0.08)'
                      : isHighlighted
                      ? 'rgba(249,115,22,0.06)'
                      : '#0d1117',
                  }}
                  onMouseEnter={() => { if (!confirmCol && !renamingCol) setHoveredCol(col) }}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div className="flex items-center gap-1.5">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingCol(null)
                        }}
                        onBlur={commitRename}
                        disabled={renameMutation.isPending}
                        className="bg-transparent border-b border-[#6366f1] outline-none text-[#e2e8f0] text-[10px] font-mono w-28 min-w-0"
                      />
                    ) : (
                      <span onDoubleClick={() => startRename(col)} title="Double-click to rename">{col}</span>
                    )}

                    {isConfirm ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => dropMutation.mutate(col)}
                          disabled={isDropping}
                          className="px-1.5 py-0.5 bg-[#ef4444] hover:bg-[#dc2626] text-white text-[9px] font-bold rounded transition-colors disabled:opacity-50"
                        >
                          {isDropping ? '…' : 'Drop'}
                        </button>
                        <button
                          onClick={() => { setConfirmCol(null); setHoveredCol(null) }}
                          className="px-1.5 py-0.5 text-[#4a5568] hover:text-white text-[9px] font-bold rounded transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isHovered && !isRenaming ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startRename(col)}
                          className="text-[#6366f1] hover:text-[#818cf8] opacity-80 hover:opacity-100 transition-all flex-shrink-0"
                          title={`Rename "${col}"`}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => { setConfirmCol(col); setHoveredCol(null) }}
                          className="text-[#ef4444] hover:text-[#dc2626] opacity-80 hover:opacity-100 transition-all flex-shrink-0"
                          title={`Drop column "${col}"`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1e2a3a] hover:bg-white/[0.02]">
              <td className="px-3 py-1.5 text-[#2d3748] text-right font-mono sticky left-0 bg-[#0d1117]">{i + 1}</td>
              {(row as unknown[]).map((val, j) => {
                const col = columns[j]
                const isHighlighted = highlightedCols.has(col)
                const isConfirm = confirmCol === col
                const isNull = val === null || val === undefined || val === ''
                return (
                  <td
                    key={j}
                    className="px-3 py-1.5 font-mono whitespace-nowrap max-w-[160px] truncate"
                    style={{
                      backgroundColor: isConfirm
                        ? 'rgba(239,68,68,0.04)'
                        : isHighlighted
                        ? 'rgba(249,115,22,0.04)'
                        : undefined,
                    }}
                  >
                    {isNull ? (
                      <span className="text-[#f97316] italic opacity-70">null</span>
                    ) : (
                      <span className={isConfirm ? 'text-[#64748b]' : 'text-[#94a3b8]'}>{String(val)}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
