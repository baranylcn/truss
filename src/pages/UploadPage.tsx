import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, ChevronRight, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import type { PipelineStep, DatasetInfo } from '../types'

interface UploadPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

export default function UploadPage({ projectId, onNext }: UploadPageProps) {
  const [dragging, setDragging] = useState(false)
  const [uploadedInfo, setUploadedInfo] = useState<DatasetInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => datasetApi.upload(projectId, file),
    onSuccess: (data) => {
      setUploadedInfo(data)
      toast.success('File uploaded successfully')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleFile = (file: File) => {
    if (!projectId) {
      toast.error('Please create a project first from the Dashboard')
      return
    }
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const previewRows = uploadedInfo?.data.slice(0, 7) ?? []
  const previewCols = uploadedInfo?.columns ?? []

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-[#64748b]">
            Initialize your pipeline by providing source data. Supported format:{' '}
            <span className="text-[#f97316]">.csv</span>
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-16 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer mb-8 ${
            dragging
              ? 'border-[#f97316] bg-[#f9731610]'
              : uploadMutation.isPending
              ? 'border-[#2d3748] bg-[#0d1117] opacity-60 cursor-wait'
              : 'border-[#2d3748] bg-[#0d1117] hover:border-[#374151] hover:bg-[#111827]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="w-16 h-16 rounded-xl bg-[#1c2333] flex items-center justify-center mb-4">
            {uploadMutation.isPending ? (
              <div className="w-7 h-7 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
            ) : uploadedInfo ? (
              <CheckCircle size={28} className="text-[#22c55e]" />
            ) : (
              <Upload size={28} className="text-[#f97316]" />
            )}
          </div>
          {uploadMutation.isPending ? (
            <p className="text-[#64748b] text-sm">Uploading…</p>
          ) : uploadedInfo ? (
            <>
              <p className="text-white font-medium text-base mb-1">File uploaded</p>
              <p className="text-sm text-[#22c55e]">
                {uploadedInfo.shape[0].toLocaleString()} rows × {uploadedInfo.shape[1]} columns
              </p>
            </>
          ) : (
            <>
              <p className="text-white font-medium text-base mb-1">Drop your CSV file here</p>
              <p className="text-sm text-[#64748b]">
                or <span className="text-[#f97316]">browse files</span>
              </p>
              <p className="text-xs text-[#374151] mt-2 uppercase tracking-widest font-mono">Max 100MB</p>
            </>
          )}
        </div>

        {/* Preview Table */}
        {uploadedInfo && previewCols.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-[#64748b] uppercase tracking-widest">
                Preview - first 7 rows
              </p>
            </div>
            <div className="rounded-lg border border-[#1e2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a3a] bg-[#111827]">
                    {previewCols.map((col) => (
                      <th key={col} className="text-left px-4 py-3 text-[10px] font-semibold text-[#64748b] uppercase tracking-widest whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-[#1e2a3a] hover:bg-[#111827] ${i % 2 === 0 ? 'bg-[#0d1117]' : 'bg-[#0a0f18]'}`}
                    >
                      {(row as unknown[]).map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-xs text-[#94a3b8] font-mono whitespace-nowrap">
                          {String(cell ?? '')}
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

      {/* Footer Actions */}
      <div
        className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}
      >
        <span className="text-sm text-white/40">
          {uploadedInfo
            ? `${uploadedInfo.shape[0].toLocaleString()} rows · ${uploadedInfo.shape[1]} columns`
            : 'No file selected'}
        </span>
        <div className="flex gap-3">
          <button className="px-4 py-1.5 text-sm text-[#94a3b8] hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onNext('analyze')}
            disabled={!uploadedInfo}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
          >
            Save &amp; Continue
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
