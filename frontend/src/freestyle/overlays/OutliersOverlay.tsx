interface OutlierResult {
  count: number
  values: number[]
  method: string
}

interface Props {
  results: Record<string, OutlierResult>
  totalRows: number
}

export default function OutliersOverlay({ results, totalRows }: Props) {
  const affected = Object.entries(results).filter(([, v]) => v.count > 0)
  const totalOutliers = affected.reduce((s, [, v]) => s + v.count, 0)
  const maxCount = Math.max(...affected.map(([, v]) => v.count), 1)

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Outliers', value: String(totalOutliers) },
          { label: 'Cols Affected',  value: String(affected.length) },
          { label: 'Row Impact',     value: `${((totalOutliers / totalRows) * 100).toFixed(1)}%` },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#4a5568] uppercase tracking-widest font-semibold mb-1.5">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {affected.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#22c55e12] border border-[#22c55e30] rounded-lg">
          <span className="text-[#22c55e] text-xs">✓</span>
          <span className="text-xs text-[#22c55e]">No outliers detected in the selected columns.</span>
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#1e2a3a]">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Per Column Results</p>
          </div>
          <div className="divide-y divide-[#1e2a3a]">
            {affected.map(([col, v]) => {
              const pct = (v.count / totalRows) * 100
              const barWidth = (v.count / maxCount) * 100
              const barColor = pct > 10 ? '#ef4444' : pct > 5 ? '#f97316' : '#f59e0b'

              return (
                <div key={col} className="px-4 py-3 flex items-center gap-4">
                  <span className="text-xs font-mono text-[#e2e8f0] w-36 flex-shrink-0 truncate" title={col}>{col}</span>

                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                    </div>
                    <span className="text-[11px] font-mono text-[#94a3b8] w-8 text-right">{v.count}</span>
                    <span className="text-[11px] font-mono w-12 text-right" style={{ color: barColor }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>

                  {v.values.length > 0 && (
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {v.values.slice(0, 5).map((val, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#0d1117] border border-[#2d3748] rounded text-[10px] font-mono text-[#64748b]">
                          {val.toFixed(2)}
                        </span>
                      ))}
                      {v.values.length > 5 && (
                        <span className="text-[10px] text-[#374151]">+{v.values.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#374151]">
        Method: {affected[0]?.[1]?.method?.toUpperCase() ?? 'IQR'}. Close this overlay to select an action and apply.
      </p>
    </div>
  )
}
