import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import type { DatasetInfo } from '../types'

interface FreestyleUploadModalProps {
  projectId: string
  onDone: () => void
  onCancel: () => void
}

export default function FreestyleUploadModal({ projectId, onDone, onCancel }: FreestyleUploadModalProps) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [uploadedInfo, setUploadedInfo] = useState<DatasetInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => datasetApi.upload(projectId, file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      setUploadedInfo(data)
      toast.success('File uploaded successfully')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported')
      return
    }
    uploadMutation.mutate(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const previewRows = uploadedInfo?.data.slice(0, 7) ?? []
  const previewCols = uploadedInfo?.columns ?? []

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}>
      <div
        className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl flex flex-col shadow-2xl"
        style={{ width: '640px', maxHeight: '82vh' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a3a] flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">Upload Dataset</p>
            <p className="text-[11px] text-[#4a5568] mt-0.5">Supported format: <span className="text-[#f97316]">.csv</span> · Max 100 MB</p>
          </div>
          <button onClick={onCancel} className="text-[#4a5568] hover:text-white transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer mb-5 ${
              dragging
                ? 'border-[#f97316] bg-[#f9731610]'
                : uploadMutation.isPending
                ? 'border-[#2d3748] bg-[#111827] opacity-60 cursor-wait'
                : uploadedInfo
                ? 'border-[#22c55e40] bg-[#22c55e08] cursor-default'
                : 'border-[#2d3748] bg-[#111827] hover:border-[#374151] hover:bg-[#1a2235]'
            }`}
            style={{ height: '160px' }}
          >
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <div className="w-12 h-12 rounded-xl bg-[#1c2333] flex items-center justify-center mb-3">
              {uploadMutation.isPending
                ? <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
                : uploadedInfo
                ? <CheckCircle size={22} className="text-[#22c55e]" />
                : <Upload size={22} className="text-[#f97316]" />
              }
            </div>
            {uploadMutation.isPending ? (
              <p className="text-sm text-[#64748b]">Uploading…</p>
            ) : uploadedInfo ? (
              <>
                <p className="text-sm font-semibold text-white mb-1">File uploaded</p>
                <p className="text-xs text-[#22c55e]">
                  {uploadedInfo.shape[0].toLocaleString()} rows × {uploadedInfo.shape[1]} columns
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white mb-1">Drop your CSV file here</p>
                <p className="text-xs text-[#4a5568]">or <span className="text-[#f97316]">browse files</span></p>
              </>
            )}
          </div>

          {/* Preview table */}
          {uploadedInfo && previewCols.length > 0 && (
            <div className="animate-fade-in">
              <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-widest mb-2">
                Preview — first 7 rows
              </p>
              <div className="rounded-lg border border-[#1e2a3a] overflow-x-auto">
                <table className="text-xs w-max min-w-full">
                  <thead>
                    <tr className="bg-[#111827] border-b border-[#1e2a3a]">
                      {previewCols.map(col => (
                        <th key={col} className="px-3 py-2 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest text-left whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-[#1e2a3a] last:border-0">
                        {(row as unknown[]).map((cell, j) => (
                          <td key={j} className="px-3 py-2 font-mono text-[#94a3b8] whitespace-nowrap">
                            {cell === null || cell === undefined || cell === ''
                              ? <span className="text-[#f97316] italic opacity-70">null</span>
                              : String(cell)
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2a3a] flex-shrink-0">
          <span className="text-xs text-[#4a5568]">
            {uploadedInfo
              ? `${uploadedInfo.shape[0].toLocaleString()} rows · ${uploadedInfo.shape[1]} columns`
              : 'No file selected'
            }
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-xs text-[#64748b] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDone}
              disabled={!uploadedInfo}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Open in Freestyle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
