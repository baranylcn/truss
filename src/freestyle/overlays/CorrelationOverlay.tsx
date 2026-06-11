interface Props {
  matrix: Record<string, Record<string, number>>
  columns: string[]
}

function corrToColor(v: number): string {
  // -1 → red, 0 → dark neutral, +1 → teal-green
  const abs = Math.abs(v)
  if (v > 0) {
    const r = Math.round(13  + (34 - 13)  * (1 - abs))
    const g = Math.round(17  + (211 - 17) * abs)
    const b = Math.round(23  + (153 - 23) * abs)
    return `rgb(${r},${g},${b})`
  } else {
    const r = Math.round(13  + (239 - 13) * abs)
    const g = Math.round(17  + (68  - 17) * (1 - abs))
    const b = Math.round(23  + (68  - 23) * (1 - abs))
    return `rgb(${r},${g},${b})`
  }
}

function textColor(v: number): string {
  return Math.abs(v) > 0.5 ? '#fff' : '#64748b'
}

export default function CorrelationOverlay({ matrix, columns }: Props) {
  const highPairs: { a: string; b: string; v: number }[] = []
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const v = matrix[columns[i]]?.[columns[j]] ?? 0
      if (Math.abs(v) >= 0.7) highPairs.push({ a: columns[i], b: columns[j], v })
    }
  }
  highPairs.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))

  const cellSize = columns.length > 10 ? 36 : columns.length > 6 ? 48 : 60

  return (
    <div className="p-5 flex flex-col gap-5">
      {highPairs.length > 0 && (
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#1e2a3a]">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">High Correlation Pairs (|r| ≥ 0.7)</p>
          </div>
          <div className="divide-y divide-[#1e2a3a]">
            {highPairs.slice(0, 10).map(({ a, b, v }) => (
              <div key={`${a}-${b}`} className="flex items-center gap-4 px-4 py-2.5">
                <span className="text-[11px] font-mono text-[#94a3b8] truncate max-w-[120px]">{a}</span>
                <span className="text-[10px] text-[#374151]">↔</span>
                <span className="text-[11px] font-mono text-[#94a3b8] truncate max-w-[120px]">{b}</span>
                <span
                  className="ml-auto text-xs font-bold font-mono px-2 py-0.5 rounded"
                  style={{ color: textColor(v), backgroundColor: corrToColor(v) }}
                >
                  {v.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-auto">
        <div className="px-4 py-2.5 border-b border-[#1e2a3a] flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Correlation Matrix</p>
          <div className="flex items-center gap-1.5">
            <div className="flex h-2 rounded overflow-hidden" style={{ width: '80px' }}>
              {[-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1].map(v => (
                <div key={v} className="flex-1 h-full" style={{ backgroundColor: corrToColor(v) }} />
              ))}
            </div>
            <span className="text-[9px] text-[#374151]">-1 → +1</span>
          </div>
        </div>

        <div className="p-3 overflow-auto">
          <table className="border-separate" style={{ borderSpacing: '2px' }}>
            <thead>
              <tr>
                <th style={{ width: `${cellSize + 8}px` }} />
                {columns.map(col => (
                  <th
                    key={col}
                    className="text-[9px] font-mono text-[#4a5568] pb-1"
                    style={{ width: `${cellSize}px`, maxWidth: `${cellSize}px` }}
                  >
                    <div
                      className="truncate"
                      style={{ width: `${cellSize}px`, transform: columns.length > 8 ? 'rotate(-45deg)' : undefined, transformOrigin: 'bottom left' }}
                      title={col}
                    >
                      {col.length > 6 && columns.length > 8 ? col.slice(0, 5) + '…' : col}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map(rowCol => (
                <tr key={rowCol}>
                  <td
                    className="text-[9px] font-mono text-[#4a5568] pr-1 text-right"
                    style={{ maxWidth: `${cellSize + 8}px` }}
                    title={rowCol}
                  >
                    <div className="truncate" style={{ maxWidth: `${cellSize + 4}px` }}>
                      {rowCol.length > 8 ? rowCol.slice(0, 7) + '…' : rowCol}
                    </div>
                  </td>
                  {columns.map(colCol => {
                    const v = matrix[rowCol]?.[colCol] ?? 0
                    const isDiag = rowCol === colCol
                    return (
                      <td
                        key={colCol}
                        className="rounded text-center"
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          backgroundColor: corrToColor(v),
                          opacity: isDiag ? 0.4 : 1,
                        }}
                        title={`${rowCol} ↔ ${colCol}: ${v.toFixed(3)}`}
                      >
                        {cellSize >= 48 && (
                          <span className="text-[9px] font-mono" style={{ color: textColor(v) }}>
                            {v.toFixed(2)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
