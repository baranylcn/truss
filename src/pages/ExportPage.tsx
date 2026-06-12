import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Download, FileJson, Table2, Package, LayoutDashboard } from 'lucide-react'
import toast from 'react-hot-toast'
import { modelApi } from '../services/api/model'

interface ExportPageProps {
  projectId: string
  onDashboard: () => void
}

const fmt = (v: number) => `${(v * 100).toFixed(2)}%`

export default function ExportPage({ projectId, onDashboard }: ExportPageProps) {
  const [loadingPred, setLoadingPred] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)

  const { data: evalData, isLoading } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
  })

  const handleDownloadPredictions = async () => {
    setLoadingPred(true)
    try {
      await modelApi.exportPredictions(projectId)
      toast.success('Predictions downloaded')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingPred(false)
    }
  }

  const handleDownloadModel = async () => {
    setLoadingModel(true)
    try {
      await modelApi.exportModel(projectId, evalData?.best_model ?? 'model')
      toast.success('Model downloaded')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingModel(false)
    }
  }

  const handleDownloadReport = () => {
    if (!evalData) return
    const report = {
      exported_at: new Date().toISOString(),
      project_id: projectId,
      model: {
        type: evalData.best_model,
        task: evalData.problem_type,
        target_column: evalData.target_column,
        accuracy: evalData.accuracy,
        ...(evalData.problem_type !== 'regression' ? {
          f1_score: evalData.f1_score,
          precision: evalData.precision,
          recall: evalData.recall,
        } : {}),
        feature_importance: evalData.feature_importance,
      },
      all_models: evalData.results.map(r => ({
        model: r.model,
        metrics: r.metrics,
      })),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pipeline_report_${projectId.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  return (
    <div className="animate-fade-in p-6" style={{ paddingBottom: '80px' }}>

      {/* Pipeline Complete Banner */}
      <div className="bg-gradient-to-r from-[#22c55e10] to-[#f9731610] border border-[#22c55e30] rounded-xl p-6 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#22c55e18] border border-[#22c55e40] flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={24} className="text-[#22c55e]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white mb-0.5">Pipeline Complete</h2>
          <p className="text-sm text-[#64748b]">Your model has been trained and evaluated. Download your results below.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* Left: Model Summary */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
          <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Best Model Summary</p>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-[#1e2a3a] rounded animate-pulse" />)}
            </div>
          ) : evalData ? (
            <div className="space-y-0">
              {[
                { label: 'Model',     value: evalData.best_model ?? '-' },
                { label: 'Task',      value: evalData.problem_type ?? '-' },
                { label: 'Target',    value: evalData.target_column ?? '-' },
                { label: 'Accuracy',  value: fmt(evalData.accuracy), accent: '#22c55e' },
                ...(evalData.problem_type !== 'regression' ? [
                  { label: 'F1-Score',  value: evalData.f1_score  != null ? fmt(evalData.f1_score)  : '-', accent: '#38bdf8' },
                  { label: 'Precision', value: evalData.precision != null ? fmt(evalData.precision) : '-' },
                  { label: 'Recall',    value: evalData.recall    != null ? fmt(evalData.recall)    : '-' },
                ] : []),
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#1e2a3a] last:border-0">
                  <span className="text-xs text-[#64748b]">{label}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: accent ?? '#e2e8f0' }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#64748b]">No model data found.</p>
          )}

          {/* Feature importance mini-list */}
          {evalData?.feature_importance && Object.keys(evalData.feature_importance).length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-3">Top Features</p>
              <div className="space-y-2">
                {Object.entries(evalData.feature_importance).slice(0, 5).map(([feat, imp]) => (
                  <div key={feat} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#94a3b8] font-mono w-28 truncate flex-shrink-0">{feat}</span>
                    <div className="flex-1 bg-[#1c2333] rounded-full h-1.5">
                      <div
                        className="bg-[#f97316] h-1.5 rounded-full"
                        style={{ width: `${Math.round((imp as number) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#4a5568] w-8 text-right">{((imp as number) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Export Options */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-1">Download Options</p>

          {/* Predictions CSV */}
          <div className="bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] rounded-lg p-4 flex items-start gap-4 transition-colors">
            <div className="w-9 h-9 rounded bg-[#38bdf818] border border-[#38bdf830] flex items-center justify-center flex-shrink-0">
              <Table2 size={16} className="text-[#38bdf8]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-0.5">Predictions CSV</p>
              <p className="text-[11px] text-[#64748b] mb-3">Test set rows with actual and predicted values side by side.</p>
              <button
                onClick={handleDownloadPredictions}
                disabled={loadingPred || !evalData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf818] border border-[#38bdf840] hover:bg-[#38bdf828] text-[#38bdf8] text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPred
                  ? <><div className="w-3 h-3 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />Generating…</>
                  : <><Download size={12} />Download .csv</>}
              </button>
            </div>
          </div>

          {/* Model .pkl */}
          <div className="bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] rounded-lg p-4 flex items-start gap-4 transition-colors">
            <div className="w-9 h-9 rounded bg-[#818cf818] border border-[#818cf830] flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-[#818cf8]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-0.5">Trained Model</p>
              <p className="text-[11px] text-[#64748b] mb-3">Sklearn pipeline serialized with joblib — ready for deployment.</p>
              <button
                onClick={handleDownloadModel}
                disabled={loadingModel || !evalData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#818cf818] border border-[#818cf840] hover:bg-[#818cf828] text-[#818cf8] text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loadingModel
                  ? <><div className="w-3 h-3 border-2 border-[#818cf8] border-t-transparent rounded-full animate-spin" />Generating…</>
                  : <><Download size={12} />Download .pkl</>}
              </button>
            </div>
          </div>

          {/* Pipeline Report JSON */}
          <div className="bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] rounded-lg p-4 flex items-start gap-4 transition-colors">
            <div className="w-9 h-9 rounded bg-[#f9731818] border border-[#f9731830] flex items-center justify-center flex-shrink-0">
              <FileJson size={16} className="text-[#f97316]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-0.5">Pipeline Report</p>
              <p className="text-[11px] text-[#64748b] mb-3">JSON summary of model metrics, feature importance, and all results.</p>
              <button
                onClick={handleDownloadReport}
                disabled={!evalData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f9731818] border border-[#f9731840] hover:bg-[#f9731828] text-[#f97316] text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={12} />Download .json
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {evalData ? `${evalData.best_model} · ${fmt(evalData.accuracy)} accuracy` : ''}
        </span>
        <button
          onClick={onDashboard}
          className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded"
        >
          <LayoutDashboard size={15} />
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
