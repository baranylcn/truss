import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { GitMerge } from 'lucide-react'
import toast from 'react-hot-toast'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard } from './MissingValuesPanel'

type CorrMethod = 'pearson' | 'spearman' | 'kendall'

interface Props {
  projectId: string
  onComputed: (matrix: Record<string, Record<string, number>>, columns: string[]) => void
}

const METHODS: { value: CorrMethod; label: string; desc: string }[] = [
  { value: 'pearson',  label: 'Pearson',  desc: 'Linear correlation. Best for normally distributed numeric data.' },
  { value: 'spearman', label: 'Spearman', desc: 'Rank-based. Robust to outliers and non-linear relations.' },
  { value: 'kendall',  label: 'Kendall',  desc: 'Concordance-based. Good for small samples.' },
]

export default function CorrelationPanel({ projectId, onComputed }: Props) {
  const [method, setMethod] = useState<CorrMethod>('pearson')
  const [threshold, setThreshold] = useState('')

  const computeMutation = useMutation({
    mutationFn: () => preprocessingApi.correlation(projectId, method),
    onSuccess: (res) => {
      onComputed(res.correlation_matrix, res.columns)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <Section label="Method">
          {METHODS.map(o => (
            <OptionCard
              key={o.value}
              selected={method === o.value}
              label={o.label}
              desc={o.desc}
              onClick={() => setMethod(o.value)}
            />
          ))}
        </Section>

        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">
            Highlight Threshold <span className="normal-case text-[#374151]">(optional)</span>
          </p>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            placeholder="0.7"
            className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white placeholder-[#374151] outline-none focus:border-[#f97316]"
          />
          <p className="text-[10px] text-[#374151] mt-1">Pairs above this value are highlighted in the results.</p>
        </div>

        <button
          onClick={() => computeMutation.mutate()}
          disabled={computeMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111827] hover:bg-[#1a2235] border border-[#1e2a3a] hover:border-[#2d3748] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {computeMutation.isPending
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Computing…</>
            : <><GitMerge size={13} /> Compute Correlation</>
          }
        </button>

        {computeMutation.isSuccess && (
          <p className="text-xs text-[#22c55e] text-center py-1">
            Matrix computed - see overlay for results.
          </p>
        )}
      </div>
    </div>
  )
}
