import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Table } from 'lucide-react'
import { datasetApi } from '../services/api/dataset'

interface DataPreviewProps {
  projectId: string
}

const PREVIEW_ROWS = 10

export default function DataPreview({ projectId }: DataPreviewProps) {
  const [open, setOpen] = useState(false)

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const columns = analyzeData?.dataset_info.columns ?? []
  const allRows = analyzeData?.dataset_info.data ?? []
  const rows = allRows.slice(0, PREVIEW_ROWS)
  const totalRows = analyzeData?.dataset_info.shape[0] ?? 0

  return (
    <div className="mb-5 bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Table size={13} className="text-[#4a5568] flex-shrink-0" />
        <span className="text-xs font-semibold text-[#94a3b8]">Data Preview</span>
        {!isLoading && (
          <span className="text-[10px] text-[#4a5568] ml-1">
            {totalRows.toLocaleString()} rows × {columns.length} cols
          </span>
        )}
        <ChevronDown
          size={13}
          className={`ml-auto text-[#4a5568] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-[#1e2a3a] overflow-x-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-[#64748b] text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#64748b] text-center">No data available.</p>
          ) : (
            <>
              <table className="text-xs w-max min-w-full">
                <thead>
                  <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                    <th className="px-3 py-2 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest text-right w-10 sticky left-0 bg-[#0d1117]">#</th>
                    {columns.map(col => (
                      <th key={col} className="px-3 py-2 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest text-left whitespace-nowrap max-w-[140px] truncate">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-[#1e2a3a] hover:bg-[#0d1117]">
                      <td className="px-3 py-1.5 text-[#374151] text-right font-mono sticky left-0 bg-[#111827]">{i + 1}</td>
                      {(row as unknown[]).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 font-mono text-[#94a3b8] whitespace-nowrap max-w-[140px] truncate">
                          {val === null || val === undefined ? (
                            <span className="text-[#f97316] italic">null</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalRows > PREVIEW_ROWS && (
                <p className="px-4 py-2 text-[10px] text-[#4a5568] border-t border-[#1e2a3a]">
                  Showing first {PREVIEW_ROWS} of {totalRows.toLocaleString()} rows
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
