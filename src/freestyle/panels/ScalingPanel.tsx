import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard, StatCard, PanelFooter, ModeToggle, ColMethodRow } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type Scaler = 'standard' | 'minmax' | 'robust'
type PanelMode = 'global' | 'per_column'

const SCALERS: { value: Scaler; label: string; desc: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'Zero mean, unit variance. Best for linear models.' },
  { value: 'minmax',   label: 'Min-Max',  desc: 'Scales to [0, 1] range.' },
  { value: 'robust',   label: 'Robust',   desc: 'Uses median & IQR. Resistant to outliers.' },
]
const SCALER_OPTS = SCALERS.map(s => ({ value: s.value, label: s.label }))

export default function ScalingPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [panelMode, setPanelMode] = useState<PanelMode>('global')
  const [scaler, setScaler] = useState<Scaler | null>(null)
  const [selectedCols, setSelectedCols] = useState<Set<string> | null>(null) // null = all
  const [colScalers, setColScalers] = useState<Record<string, Scaler>>({})

  const { data } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const catSet = new Set(data?.dataset_info.categorical_columns ?? [])
  const numericCols = (data?.dataset_info.columns ?? []).filter(c => !catSet.has(c))

  const handleModeChange = (m: PanelMode) => {
    setPanelMode(m)
    setColScalers({})
    setSelectedCols(null)
  }

  const activeCols: Set<string> = selectedCols ?? new Set(numericCols)
  const allSelected = selectedCols === null || selectedCols.size === numericCols.length

  const toggleCol = (col: string) => {
    const next = new Set(activeCols)
    if (next.has(col)) { next.delete(col) } else { next.add(col) }
    setSelectedCols(next)
  }

  const columnsParam = allSelected ? undefined : Array.from(activeCols)

  const canApply = numericCols.length > 0 && activeCols.size > 0 && scaler !== null

  const applyMutation = useMutation({
    mutationFn: () => {
      if (panelMode === 'per_column') {
        return preprocessingApi.scaling(projectId, {
          method: scaler ?? 'standard',
          columns: allSelected ? undefined : Array.from(activeCols),
          column_methods: Object.keys(colScalers).length > 0 ? colScalers : null,
        })
      }
      return preprocessingApi.scaling(projectId, {
        method: scaler!,
        columns: columnsParam,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Scaling applied')
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="NUMERIC"  value={String(numericCols.length)} />
          <StatCard label="SELECTED" value={String(activeCols.size)} />
        </div>

        <ModeToggle mode={panelMode} onChange={handleModeChange} />

        <div className="flex items-start gap-2 p-2.5 bg-[#f9731608] border border-[#f9731630] rounded-lg">
          <span className="text-[#f97316] text-xs mt-0.5 flex-shrink-0">⚠</span>
          <p className="text-[11px] text-[#f97316] leading-relaxed">
            Deselect your target column below before applying.
          </p>
        </div>

        {/* Scaler selector — shown in both modes as the "default" */}
        <Section label={panelMode === 'per_column' ? 'Default Scaler' : 'Scaler'}>
          {SCALERS.map(o => (
            <OptionCard key={o.value} selected={scaler === o.value} label={o.label} desc={o.desc} onClick={() => setScaler(o.value)} />
          ))}
        </Section>

        {panelMode === 'global' && numericCols.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Columns</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#4a5568]">{activeCols.size}/{numericCols.length}</span>
                {!allSelected && (
                  <button onClick={() => setSelectedCols(null)} className="text-[10px] text-[#f97316] hover:underline">All</button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
              {numericCols.map(col => (
                <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeCols.has(col)}
                    onChange={() => toggleCol(col)}
                    className="accent-[#f97316] w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-[11px] font-mono text-[#94a3b8] truncate" title={col}>{col}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {panelMode === 'per_column' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Per Column</p>
              {Object.keys(colScalers).length > 0 && (
                <button onClick={() => setColScalers({})} className="text-[10px] text-[#f97316] hover:underline">Reset all</button>
              )}
            </div>
            {numericCols.length === 0
              ? <p className="text-xs text-[#4a5568] text-center py-4">No numeric columns found.</p>
              : numericCols.map(col => (
                  <div key={col} className="flex items-center gap-1.5 mb-1">
                    <input
                      type="checkbox"
                      checked={activeCols.has(col)}
                      onChange={() => toggleCol(col)}
                      className="accent-[#f97316] w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <ColMethodRow
                        col={col}
                        value={colScalers[col] ?? (scaler ?? 'standard')}
                        options={SCALER_OPTS}
                        overridden={colScalers[col] !== undefined}
                        onChange={v => setColScalers(p => ({ ...p, [col]: v as Scaler }))}
                        onReset={() => setColScalers(p => { const n = { ...p }; delete n[col]; return n })}
                      />
                    </div>
                  </div>
                ))
            }
          </div>
        )}
      </div>

      <PanelFooter
        onApply={() => applyMutation.mutate()}
        pending={applyMutation.isPending}
        disabled={!canApply}
        disabledHint={
          numericCols.length === 0 ? 'No numeric columns found.' :
          scaler === null ? 'Select a default scaler above.' :
          activeCols.size === 0 ? 'Select at least one column.' : undefined
        }
      />
    </div>
  )
}
