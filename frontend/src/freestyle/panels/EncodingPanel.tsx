import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard, StatCard, PanelFooter, ModeToggle, ColMethodRow } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type Method = 'label' | 'onehot' | 'ordinal'
type PanelMode = 'global' | 'per_column'

const METHODS: { value: Method; label: string; desc: string }[] = [
  { value: 'label',   label: 'Label',   desc: 'Integer labels. Good for tree-based models.' },
  { value: 'onehot',  label: 'One-Hot', desc: 'Binary columns per category. Increases width.' },
  { value: 'ordinal', label: 'Ordinal', desc: 'Preserves order between categories.' },
]
const METHOD_OPTS = METHODS.map(m => ({ value: m.value, label: m.label }))

export default function EncodingPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [panelMode, setPanelMode] = useState<PanelMode>('global')
  const [method, setMethod] = useState<Method | null>(null)
  const [colMethods, setColMethods] = useState<Record<string, Method>>({})

  const { data } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const catCols = data?.dataset_info.categorical_columns ?? []

  const canApply = catCols.length > 0 && method !== null

  const hasOneHot = panelMode === 'global'
    ? method === 'onehot'
    : Object.values(colMethods).some(m => m === 'onehot') || (method === 'onehot' && catCols.some(c => !colMethods[c]))

  const applyMutation = useMutation({
    mutationFn: () => {
      if (panelMode === 'per_column') {
        return preprocessingApi.encoding(projectId, {
          method: method ?? 'label',
          column_methods: Object.keys(colMethods).length > 0 ? colMethods : null,
        })
      }
      return preprocessingApi.encoding(projectId, { method: method! })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      toast.success('Encoding applied')
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="CAT COLS"  value={String(catCols.length)} />
          <StatCard label="OVERRIDES" value={panelMode === 'per_column' ? String(Object.keys(colMethods).length) : '-'} />
        </div>

        <ModeToggle mode={panelMode} onChange={m => { setPanelMode(m); setColMethods({}) }} />

        {/* Method selector — shown in both modes as the "default" */}
        <Section label={panelMode === 'per_column' ? 'Default Method' : 'Encoding Method'}>
          {METHODS.map(o => (
            <OptionCard key={o.value} selected={method === o.value} label={o.label} desc={o.desc} onClick={() => setMethod(o.value)} />
          ))}
        </Section>

        {panelMode === 'per_column' && catCols.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Per Column Override</p>
              {Object.keys(colMethods).length > 0 && (
                <button onClick={() => setColMethods({})} className="text-[10px] text-[#f97316] hover:underline">Reset all</button>
              )}
            </div>
            {catCols.map(col => (
              <ColMethodRow
                key={col}
                col={col}
                value={colMethods[col] ?? (method ?? 'label')}
                options={METHOD_OPTS}
                overridden={colMethods[col] !== undefined}
                onChange={v => setColMethods(p => ({ ...p, [col]: v as Method }))}
                onReset={() => setColMethods(p => { const n = { ...p }; delete n[col]; return n })}
              />
            ))}
          </div>
        )}

        {panelMode === 'global' && catCols.length > 0 && method !== null && (
          <div>
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Columns to Encode</p>
            <div className="flex flex-wrap gap-1.5">
              {catCols.map(col => (
                <span key={col} className="px-2 py-0.5 bg-[#111827] border border-[#1e2a3a] rounded text-[10px] font-mono text-[#94a3b8]">{col}</span>
              ))}
            </div>
          </div>
        )}

        {hasOneHot && catCols.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-[#111827] border border-[#1e2a3a] rounded-lg">
            <Info size={12} className="text-[#64748b] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              One-Hot creates binary columns per category. Original columns are dropped.
            </p>
          </div>
        )}
      </div>

      <PanelFooter
        onApply={() => applyMutation.mutate()}
        pending={applyMutation.isPending}
        disabled={!canApply}
        disabledHint={catCols.length === 0 ? 'No categorical columns found.' : method === null ? 'Select a default method above.' : undefined}
      />
    </div>
  )
}
