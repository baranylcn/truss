import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'

interface Props { projectId: string; onApplied: () => void }

type NumMethod = 'mean' | 'median' | 'mode' | 'drop' | 'none'
type CatMethod = 'mode' | 'drop' | 'none'
type ColMethod = 'mean' | 'median' | 'mode' | 'drop' | 'none'
type PanelMode = 'global' | 'per_column'

const NUM_OPTS: { value: NumMethod; label: string }[] = [
  { value: 'none',   label: 'Skip' },
  { value: 'mean',   label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'mode',   label: 'Mode' },
  { value: 'drop',   label: 'Drop Rows' },
]
const CAT_OPTS: { value: CatMethod; label: string }[] = [
  { value: 'none', label: 'Skip' },
  { value: 'mode', label: 'Mode' },
  { value: 'drop', label: 'Drop Rows' },
]
const COL_METHOD_OPTS: { value: ColMethod; label: string }[] = [
  { value: 'mean',   label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'mode',   label: 'Mode' },
  { value: 'drop',   label: 'Drop Rows' },
  { value: 'none',   label: 'Skip' },
]

export default function MissingValuesPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [panelMode, setPanelMode] = useState<PanelMode>('global')
  const [numMethod, setNumMethod] = useState<NumMethod>('none')
  const [catMethod, setCatMethod] = useState<CatMethod>('none')
  const [colMethods, setColMethods] = useState<Record<string, ColMethod>>({})

  const { data } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const missing = data?.dataset_info.missing_values ?? {}
  const allCols = data?.dataset_info.columns ?? []
  const catCols = new Set(data?.dataset_info.categorical_columns ?? [])
  const missingCols = allCols.filter(c => (missing[c] ?? 0) > 0)
  const totalMissing = Object.values(missing).reduce((a, b) => a + b, 0)
  const colsAffected = missingCols.length
  const totalCells = (data?.dataset_info.shape[0] ?? 0) * (allCols.length || 1)
  const rate = totalCells > 0 ? ((totalMissing / totalCells) * 100).toFixed(1) : '0.0'

  const applyMutation = useMutation({
    mutationFn: () => {
      if (panelMode === 'per_column') {
        return preprocessingApi.missingValues(projectId, {
          numerical_method: numMethod,
          categorical_method: catMethod,
          column_methods: Object.keys(colMethods).length > 0 ? colMethods : null,
        })
      }
      return preprocessingApi.missingValues(projectId, {
        numerical_method: numMethod,
        categorical_method: catMethod,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Missing values handled')
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="MISSING"  value={String(totalMissing)} />
          <StatCard label="COLS"     value={String(colsAffected)} />
          <StatCard label="RATE"     value={`${rate}%`} />
        </div>

        <ModeToggle mode={panelMode} onChange={m => { setPanelMode(m); setColMethods({}) }} />

        {panelMode === 'global' && (
          <>
            <Section label="Numeric Columns">
              {NUM_OPTS.map(o => (
                <OptionCard key={o.value} selected={numMethod === o.value} label={o.label} desc='' onClick={() => setNumMethod(o.value)} />
              ))}
            </Section>
            <Section label="Categorical Columns">
              {CAT_OPTS.map(o => (
                <OptionCard key={o.value} selected={catMethod === o.value} label={o.label} desc='' onClick={() => setCatMethod(o.value)} />
              ))}
            </Section>
          </>
        )}

        {panelMode === 'per_column' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Column Overrides</p>
              {Object.keys(colMethods).length > 0 && (
                <button onClick={() => setColMethods({})} className="text-[10px] text-[#f97316] hover:underline">Reset all</button>
              )}
            </div>
            {missingCols.length === 0
              ? <p className="text-xs text-[#4a5568] text-center py-4">No columns with missing values.</p>
              : missingCols.map(col => {
                  return (
                    <ColMethodRow
                      key={col}
                      col={col}
                      count={missing[col]}
                      value={colMethods[col] ?? 'none'}
                      options={COL_METHOD_OPTS}
                      overridden={colMethods[col] !== undefined}
                      onChange={v => setColMethods(p => ({ ...p, [col]: v as ColMethod }))}
                      onReset={() => setColMethods(p => { const n = { ...p }; delete n[col]; return n })}
                    />
                  )
                })
            }
            <p className="text-[10px] text-[#374151] mt-2">
              Default: numeric → {numMethod}, categorical → {catMethod}. Override per column above.
            </p>
          </div>
        )}
      </div>

      <PanelFooter
        onApply={() => applyMutation.mutate()}
        pending={applyMutation.isPending}
        disabled={totalMissing === 0}
        disabledHint={totalMissing === 0 ? 'No missing values found.' : (numMethod === 'none' && catMethod === 'none' && panelMode === 'global') ? 'Both methods set to Skip — no changes will be made.' : undefined}
      />
    </div>
  )
}

// ── shared helpers (exported for other panels) ─────────────────────────────

export function ModeToggle({ mode, onChange }: { mode: 'global' | 'per_column'; onChange: (m: 'global' | 'per_column') => void }) {
  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1e2a3a] rounded-lg p-1">
      {(['global', 'per_column'] as const).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex-1 py-1.5 rounded text-[11px] font-semibold transition-all ${mode === m ? 'bg-[#f97316] text-white' : 'text-[#64748b] hover:text-white'}`}
        >
          {m === 'global' ? 'Global' : 'Per Column'}
        </button>
      ))}
    </div>
  )
}

export function ColMethodRow({
  col, count, value, options, overridden, onChange, onReset,
}: {
  col: string
  count?: number
  value: string
  options: { value: string; label: string }[]
  overridden: boolean
  onChange: (v: string) => void
  onReset: () => void
}) {
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1 ${overridden ? 'bg-[#f9731606] border border-[#f9731630]' : 'border border-transparent'}`}>
      <span className="text-[11px] font-mono text-[#94a3b8] truncate flex-1 min-w-0" title={col}>{col}</span>
      {count !== undefined && (
        <span className="text-[10px] text-[#4a5568] font-mono flex-shrink-0">{count}</span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[#111827] border border-[#1e2a3a] rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-[#f97316] flex-shrink-0 cursor-pointer"
        style={{ minWidth: '82px' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {overridden && (
        <button onClick={onReset} className="text-[9px] text-[#4a5568] hover:text-[#94a3b8] flex-shrink-0" title="Reset">✕</button>
      )}
    </div>
  )
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">{label}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

export function OptionCard({ selected, label, desc, onClick }: { selected: boolean; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-left p-3 rounded-lg border transition-all duration-150 ${selected ? 'border-[#f97316] bg-[#f9731608]' : 'border-[#1e2a3a] hover:border-[#2d3748]'}`}>
      <p className={`text-xs font-semibold ${desc ? 'mb-0.5' : ''} ${selected ? 'text-white' : 'text-[#94a3b8]'}`}>{label}</p>
      {desc && <p className="text-[11px] text-[#4a5568] leading-relaxed">{desc}</p>}
    </button>
  )
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-2.5 text-center">
      <p className="text-[9px] text-[#4a5568] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  )
}

export function PanelFooter({
  onApply, pending, disabled, disabledHint,
}: {
  onApply: () => void; pending: boolean; disabled?: boolean; disabledHint?: string
}) {
  return (
    <div className="p-4 border-t border-[#1e2a3a] flex flex-col gap-2 flex-shrink-0">
      {disabledHint && <p className="text-[11px] text-[#4a5568] text-center">{disabledHint}</p>}
      <button
        onClick={onApply}
        disabled={pending || disabled}
        className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
      >
        {pending ? 'Applying…' : 'Apply & Update Preview'}
      </button>
    </div>
  )
}
