import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Package, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { modelApi } from '../../services/api/model'

interface Props { projectId: string; onApplied: () => void }

export default function ExportPanel({ projectId }: Props) {
  const [csvLoading, setCsvLoading]    = useState(false)
  const [pklLoading, setPklLoading]    = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [csvError, setCsvError]        = useState<string | null>(null)
  const [pklError, setPklError]        = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: evalData } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
  })

  const hasModel = !!evalData?.best_model

  const handleCSV = async () => {
    setCsvError(null)
    setCsvLoading(true)
    try {
      await modelApi.exportPredictions(projectId)
    } catch {
      setCsvError('Export failed. Make sure the model is trained.')
    } finally {
      setCsvLoading(false)
    }
  }

  const handlePKL = async () => {
    setPklError(null)
    setPklLoading(true)
    try {
      await modelApi.exportModel(projectId, evalData?.best_model ?? 'model')
    } catch {
      setPklError('Export failed. Make sure the model is trained.')
    } finally {
      setPklLoading(false)
    }
  }

  const handleBatchPredict = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBatchLoading(true)
    try {
      await modelApi.batchPredict(projectId, file)
      toast.success('Batch predictions downloaded')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Batch predict failed')
    } finally {
      setBatchLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!hasModel ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-xs text-[#64748b]">No trained model found.</p>
            <p className="text-[11px] text-[#374151]">Complete the Training step first.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
              <span className="text-[11px] text-[#64748b]">Best model:</span>
              <span className="text-[11px] font-mono text-[#f97316] truncate">{evalData.best_model}</span>
            </div>

            {/* Predictions CSV */}
            <div className="flex flex-col gap-2 p-3 bg-[#111827] border border-[#1e2a3a] rounded-lg">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#22c55e] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#e2e8f0]">Predictions CSV</p>
                  <p className="text-[10px] text-[#4a5568]">Test split with actual vs predicted values</p>
                </div>
              </div>
              {csvError && <p className="text-[10px] text-[#ef4444]">{csvError}</p>}
              <button
                onClick={handleCSV}
                disabled={csvLoading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#0d1117] border border-[#1e2a3a] hover:border-[#22c55e] text-[#22c55e] text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {csvLoading
                  ? <><div className="w-3 h-3 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" /> Exporting…</>
                  : <><Download size={12} /> Download CSV</>
                }
              </button>
            </div>

            {/* Model PKL */}
            <div className="flex flex-col gap-2 p-3 bg-[#111827] border border-[#1e2a3a] rounded-lg">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-[#f97316] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#e2e8f0]">Model File (.pkl)</p>
                  <p className="text-[10px] text-[#4a5568]">Serialized sklearn pipeline for inference</p>
                </div>
              </div>
              {pklError && <p className="text-[10px] text-[#ef4444]">{pklError}</p>}
              <button
                onClick={handlePKL}
                disabled={pklLoading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#0d1117] border border-[#1e2a3a] hover:border-[#f97316] text-[#f97316] text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pklLoading
                  ? <><div className="w-3 h-3 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" /> Exporting…</>
                  : <><Download size={12} /> Download PKL</>
                }
              </button>
            </div>
            {/* Batch Prediction */}
            <div className="flex flex-col gap-2 p-3 bg-[#111827] border border-[#1e2a3a] rounded-lg">
              <div className="flex items-center gap-2">
                <Upload size={14} className="text-[#38bdf8] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#e2e8f0]">Batch Prediction</p>
                  <p className="text-[10px] text-[#4a5568]">Upload a CSV and get predictions appended</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleBatchPredict}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={batchLoading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#0d1117] border border-[#1e2a3a] hover:border-[#38bdf8] text-[#38bdf8] text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {batchLoading
                  ? <><div className="w-3 h-3 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" /> Predicting…</>
                  : <><Upload size={12} /> Upload CSV for Predictions</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
