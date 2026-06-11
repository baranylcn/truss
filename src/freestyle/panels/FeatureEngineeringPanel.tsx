import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type Operation = 'arithmetic' | 'transform' | 'binning' | 'cast' | 'replace'

const TRANSFORMS = [
  { value: 'log',       label: 'log(x+1)',   desc: 'Log transform. Good for skewed distributions.' },
  { value: 'sqrt',      label: '√x',         desc: 'Square root. Stabilizes variance.' },
  { value: 'square',    label: 'x²',         desc: 'Square. Captures non-linear relationships.' },
  { value: 'abs',       label: '|x|',        desc: 'Absolute value.' },
  { value: 'normalize', label: '[0,1]',       desc: 'Min-max normalize to 0–1 range.' },
]

const ARITH_OPS = ['+', '-', '*', '/']

export default function FeatureEngineeringPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [operation, setOperation] = useState<Operation>('arithmetic')
  const [colA, setColA]       = useState('')
  const [colB, setColB]       = useState('')
  const [arithOp, setArithOp] = useState('+')
  const [singleCol, setSingleCol] = useState('')
  const [transform, setTransform] = useState('log')
  const [nBins, setNBins]     = useState(5)
  const [newCol, setNewCol]   = useState('')
  const [castDtype, setCastDtype] = useState('numeric')
  const [replaceOld, setReplaceOld] = useState('')
  const [replaceNew, setReplaceNew] = useState('')

  const { data: analyzeData } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const allCols     = analyzeData?.dataset_info.columns ?? []
  const numericCols = allCols.filter(c => !(analyzeData?.dataset_info.categorical_columns ?? []).includes(c))

  const mutation = useMutation({
    mutationFn: () => {
      if (operation === 'cast') {
        return preprocessingApi.castColumn(projectId, singleCol, castDtype)
      }
      if (operation === 'replace') {
        const nv = replaceNew === '' ? null : replaceNew
        return preprocessingApi.replaceValues(projectId, singleCol, replaceOld, nv)
      }
      const base = { operation, new_col: newCol }
      if (operation === 'arithmetic') {
        return preprocessingApi.featureEngineering(projectId, { ...base, col_a: colA, col_b: colB, operator: arithOp })
      } else if (operation === 'transform') {
        return preprocessingApi.featureEngineering(projectId, { ...base, col: singleCol, func: transform })
      } else {
        return preprocessingApi.featureEngineering(projectId, { ...base, col: singleCol, n_bins: nBins })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      if (operation === 'cast') toast.success(`Column "${singleCol}" cast to ${castDtype}`)
      else if (operation === 'replace') toast.success('Values replaced')
      else { toast.success(`Column "${newCol}" created`); setNewCol('') }
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const canApply =
    operation === 'cast'     ? !!singleCol :
    operation === 'replace'  ? (!!singleCol && replaceOld !== '') :
    newCol.trim().length > 0 && (
      operation === 'arithmetic' ? (!!colA && !!colB) :
      !!singleCol
    )

  const ColSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div>
      <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white outline-none focus:border-[#f97316] appearance-none"
      >
        <option value="">Select column…</option>
        {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        <Section label="Operation">
          <OptionCard selected={operation === 'arithmetic'} label="Arithmetic"  desc="Combine two columns (A + B, A / B, …)." onClick={() => setOperation('arithmetic')} />
          <OptionCard selected={operation === 'transform'}  label="Transform"   desc="Apply a math function to one column."   onClick={() => setOperation('transform')} />
          <OptionCard selected={operation === 'binning'}    label="Binning"     desc="Discretize numeric column into bins."   onClick={() => setOperation('binning')} />
          <OptionCard selected={operation === 'cast'}       label="Type Cast"   desc="Change column dtype (numeric, string, datetime)." onClick={() => setOperation('cast')} />
          <OptionCard selected={operation === 'replace'}    label="Replace"     desc="Replace a specific value in a column (use empty for NaN)." onClick={() => setOperation('replace')} />
        </Section>

        {operation === 'arithmetic' && (
          <>
            <ColSelect value={colA} onChange={setColA} label="Column A" />
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Operator</p>
              <div className="flex gap-1.5">
                {ARITH_OPS.map(op => (
                  <button
                    key={op}
                    onClick={() => setArithOp(op)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition-colors ${
                      arithOp === op
                        ? 'border-[#f97316] bg-[#f9731620] text-[#f97316]'
                        : 'border-[#1e2a3a] text-[#64748b] hover:border-[#2d3748] hover:text-[#94a3b8]'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
            <ColSelect value={colB} onChange={setColB} label="Column B" />
            {colA && colB && (
              <div className="px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  <span className="text-[#f97316]">{newCol || 'new_col'}</span>
                  {' = '}
                  <span className="text-[#38bdf8]">{colA}</span>
                  {' '}<span className="text-[#e2e8f0]">{arithOp}</span>{' '}
                  <span className="text-[#38bdf8]">{colB}</span>
                </p>
              </div>
            )}
          </>
        )}

        {operation === 'transform' && (
          <>
            <ColSelect value={singleCol} onChange={setSingleCol} label="Column" />
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Function</p>
              <div className="flex flex-col gap-1.5">
                {TRANSFORMS.map(t => (
                  <OptionCard key={t.value} selected={transform === t.value} label={t.label} desc={t.desc} onClick={() => setTransform(t.value)} />
                ))}
              </div>
            </div>
            {singleCol && (
              <div className="px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  <span className="text-[#f97316]">{newCol || 'new_col'}</span>
                  {' = '}
                  <span className="text-[#e2e8f0]">{TRANSFORMS.find(t => t.value === transform)?.label}</span>
                  {'('}
                  <span className="text-[#38bdf8]">{singleCol}</span>
                  {')'}
                </p>
              </div>
            )}
          </>
        )}

        {operation === 'binning' && (
          <>
            <ColSelect value={singleCol} onChange={setSingleCol} label="Column" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Bins</p>
                <span className="text-xs font-mono text-[#f97316]">{nBins}</span>
              </div>
              <input
                type="range" min={2} max={20} value={nBins}
                onChange={e => setNBins(Number(e.target.value))}
                className="w-full accent-[#f97316]"
              />
              <div className="flex justify-between text-[9px] text-[#374151] mt-0.5">
                <span>2</span><span>20</span>
              </div>
            </div>
          </>
        )}

        {/* Cast options */}
        {operation === 'cast' && (
          <>
            <ColSelect value={singleCol} onChange={setSingleCol} label="Column" />
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Target Type</p>
              <div className="grid grid-cols-2 gap-1.5">
                {['numeric', 'string', 'datetime', 'category'].map(dt => (
                  <button
                    key={dt}
                    onClick={() => setCastDtype(dt)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      castDtype === dt
                        ? 'border-[#f97316] bg-[#f9731620] text-[#f97316]'
                        : 'border-[#1e2a3a] text-[#64748b] hover:border-[#2d3748] hover:text-[#94a3b8]'
                    }`}
                  >
                    {dt}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Replace options */}
        {operation === 'replace' && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Column</p>
              <select
                value={singleCol}
                onChange={e => setSingleCol(e.target.value)}
                className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white outline-none focus:border-[#f97316] appearance-none"
              >
                <option value="">Select column…</option>
                {allCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Replace This Value</p>
              <input type="text" value={replaceOld} onChange={e => setReplaceOld(e.target.value)} placeholder='e.g. "?" or 0'
                className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono placeholder-[#374151] outline-none focus:border-[#f97316]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">With This Value <span className="normal-case font-normal text-[#374151]">(leave empty for NaN)</span></p>
              <input type="text" value={replaceNew} onChange={e => setReplaceNew(e.target.value)} placeholder="e.g. 0 or Unknown"
                className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono placeholder-[#374151] outline-none focus:border-[#f97316]" />
            </div>
          </>
        )}

        {/* New column name (only for create operations) */}
        {(operation === 'arithmetic' || operation === 'transform' || operation === 'binning') && (
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">New Column Name</p>
          <input
            type="text"
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
            placeholder="e.g. price_per_sqft"
            className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono placeholder-[#374151] outline-none focus:border-[#f97316]"
          />
        </div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !canApply}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />{operation === 'cast' ? 'Casting…' : operation === 'replace' ? 'Replacing…' : 'Creating…'}</>
            : <><Wand2 size={13} />{operation === 'cast' ? 'Cast Column' : operation === 'replace' ? 'Replace Values' : 'Create Column'}</>
          }
        </button>
      </div>
    </div>
  )
}
