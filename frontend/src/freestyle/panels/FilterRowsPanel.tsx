import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Filter, CopyMinus } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

const OPERATORS = [
  { value: '>',           label: '>',           numeric: true  },
  { value: '>=',          label: '≥',           numeric: true  },
  { value: '<',           label: '<',           numeric: true  },
  { value: '<=',          label: '≤',           numeric: true  },
  { value: '==',          label: '=',           numeric: false },
  { value: '!=',          label: '≠',           numeric: false },
  { value: 'contains',    label: 'contains',    numeric: false },
  { value: 'not_contains',label: '¬ contains',  numeric: false },
]

type Mode = 'filter' | 'duplicates'

export default function FilterRowsPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [mode, setMode]       = useState<Mode>('filter')
  const [column, setColumn]   = useState('')
  const [operator, setOperator] = useState('==')
  const [value, setValue]     = useState('')

  const { data: analyzeData } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const columns = analyzeData?.dataset_info.columns ?? []
  const shape   = analyzeData?.dataset_info.shape

  const isNumericCol = column
    ? !(analyzeData?.dataset_info.categorical_columns ?? []).includes(column)
    : false

  const availableOps = isNumericCol ? OPERATORS : OPERATORS.filter(o => !o.numeric || o.value === '==' || o.value === '!=')

  const filterMutation = useMutation({
    mutationFn: () =>
      mode === 'duplicates'
        ? preprocessingApi.dropDuplicates(projectId)
        : preprocessingApi.filterRows(projectId, column, operator, value),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      const newRows = (res as { shape?: [number, number] }).shape?.[0]
      const msg = mode === 'duplicates'
        ? `Duplicates removed${newRows != null ? ` - ${newRows} rows remain` : ''}`
        : `Filter applied${newRows != null ? ` - ${newRows} rows remain` : ''}`
      toast.success(msg)
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const canApply = mode === 'duplicates' || (column && operator && value !== '')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {shape && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
            <span className="text-[11px] text-[#64748b]">Rows:</span>
            <span className="text-[11px] font-mono text-[#e2e8f0]">{shape[0].toLocaleString()}</span>
            <span className="mx-1 text-[#1e2a3a]">·</span>
            <span className="text-[11px] text-[#64748b]">Cols:</span>
            <span className="text-[11px] font-mono text-[#e2e8f0]">{shape[1]}</span>
          </div>
        )}

        <Section label="Operation">
          <OptionCard
            selected={mode === 'filter'}
            label="Row Filter"
            desc="Keep rows matching a condition."
            onClick={() => setMode('filter')}
          />
          <OptionCard
            selected={mode === 'duplicates'}
            label="Drop Duplicates"
            desc="Remove exact duplicate rows."
            onClick={() => setMode('duplicates')}
          />
        </Section>

        {mode === 'filter' && (
          <>
            {/* Column */}
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Column</p>
              <select
                value={column}
                onChange={e => { setColumn(e.target.value); setOperator('==') }}
                className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white outline-none focus:border-[#f97316] appearance-none"
              >
                <option value="">Select column…</option>
                {columns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Operator */}
            {column && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Condition</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableOps.map(op => (
                    <button
                      key={op.value}
                      onClick={() => setOperator(op.value)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                        operator === op.value
                          ? 'bg-[#f9731620] border-[#f97316] text-[#f97316]'
                          : 'bg-[#111827] border-[#1e2a3a] text-[#64748b] hover:border-[#2d3748] hover:text-[#94a3b8]'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Value */}
            {column && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Value</p>
                <input
                  type={isNumericCol && !['contains', 'not_contains'].includes(operator) ? 'number' : 'text'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={isNumericCol ? '0' : 'value…'}
                  className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono placeholder-[#374151] outline-none focus:border-[#f97316]"
                />
              </div>
            )}

            {column && operator && value !== '' && (
              <div className="px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Keep rows where{' '}
                  <span className="text-[#f97316]">{column}</span>
                  {' '}<span className="text-[#e2e8f0]">{OPERATORS.find(o => o.value === operator)?.label}</span>{' '}
                  <span className="text-[#22c55e]">"{value}"</span>
                </p>
              </div>
            )}
          </>
        )}

        {mode === 'duplicates' && (
          <div className="flex items-start gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
            <CopyMinus size={14} className="text-[#64748b] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Removes rows where all column values are identical to another row. The first occurrence is kept.
            </p>
          </div>
        )}

        <button
          onClick={() => filterMutation.mutate()}
          disabled={filterMutation.isPending || !canApply}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {filterMutation.isPending
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Applying…</>
            : mode === 'duplicates'
            ? <><CopyMinus size={13} /> Drop Duplicates</>
            : <><Filter size={13} /> Apply Filter</>
          }
        </button>
      </div>
    </div>
  )
}
