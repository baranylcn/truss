import { useState, useRef, useEffect } from 'react'
import { Menu, ChevronDown, Download, Settings, CheckCircle2, Circle, BarChart2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { datasetApi } from '../services/api/dataset'
import type { AppPage, PipelineStep } from '../types'

interface FreestyleTopBarProps {
  projectId: string
  currentStep: PipelineStep
  completedSteps: Set<PipelineStep>
  onStepSelect: (step: PipelineStep) => void
  onPageChange: (page: AppPage) => void
  onNewProject: () => void
  onAnalyze: () => void
}

const PIPELINE_DROPDOWN_STEPS: { id: PipelineStep; label: string }[] = [
  { id: 'missing-values', label: 'Missing Values' },
  { id: 'outliers',       label: 'Outliers' },
  { id: 'encoding',       label: 'Encoding' },
  { id: 'correlation',    label: 'Correlation' },
  { id: 'scaling',        label: 'Scaling' },
  { id: 'training',       label: 'Training' },
  { id: 'evaluation',     label: 'Evaluation' },
  { id: 'optimization',   label: 'Optimization' },
]

const STEP_LABELS: Partial<Record<PipelineStep, string>> = {
  'missing-values': 'Missing Values',
  'outliers':       'Outliers',
  'encoding':       'Encoding',
  'correlation':    'Correlation',
  'scaling':        'Scaling',
  'training':       'Training',
  'evaluation':     'Evaluation',
  'optimization':   'Optimization',
  'upload':         'Upload',
  'analyze':        'Analyze',
  'export':         'Export',
}

type OpenMenu = 'hamburger' | 'steps' | null

export default function FreestyleTopBar({
  projectId,
  currentStep,
  completedSteps,
  onStepSelect,
  onPageChange,
  onNewProject,
  onAnalyze,
}: FreestyleTopBarProps) {
  const { signOut } = useAuth()
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)

  const { data: analyzeData } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const shape = analyzeData?.dataset_info.shape
  const shapeText = shape ? `${shape[0].toLocaleString()} rows × ${shape[1]} cols` : ''

  const toggle = (menu: OpenMenu) => setOpenMenu(prev => prev === menu ? null : menu)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !hamburgerRef.current?.contains(e.target as Node) &&
        !stepsRef.current?.contains(e.target as Node)
      ) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div
      className="flex items-center justify-between px-4 border-b border-[#1e2a3a] bg-[#0d1117] relative"
      style={{ height: '48px' }}
    >
      {/* Left: logo + hamburger + filename */}
      <div className="flex items-center gap-3">
        <img src="/truss_logo.png" alt="Truss" className="h-7 w-auto object-contain" />

        <div className="relative" ref={hamburgerRef}>
          <button
            onClick={() => toggle('hamburger')}
            className={`p-1.5 rounded transition-colors ${openMenu === 'hamburger' ? 'bg-white/[0.08] text-white' : 'text-[#64748b] hover:text-white hover:bg-white/[0.04]'}`}
          >
            <Menu size={15} />
          </button>

          {openMenu === 'hamburger' && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-[#111827] border border-[#1e2a3a] rounded-lg shadow-xl z-[200] py-1">
              {[
                { label: 'Dashboard', page: 'dashboard' as AppPage },
                { label: 'Projects',  page: 'projects'  as AppPage },
                { label: 'Settings',  page: 'settings'  as AppPage },
              ].map(item => (
                <button
                  key={item.page}
                  onClick={() => { setOpenMenu(null); onPageChange(item.page) }}
                  className="w-full text-left px-3 py-2 text-xs text-[#94a3b8] hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="border-t border-[#1e2a3a] my-1" />
              <button
                onClick={() => { setOpenMenu(null); onNewProject() }}
                className="w-full text-left px-3 py-2 text-xs text-[#94a3b8] hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                New Project
              </button>
              <div className="border-t border-[#1e2a3a] my-1" />
              <button
                onClick={() => { setOpenMenu(null); signOut() }}
                className="w-full text-left px-3 py-2 text-xs text-[#f87171] hover:bg-white/[0.04] transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {shapeText && (
          <span className="text-xs text-[#4a5568] font-mono">{shapeText}</span>
        )}
      </div>

      {/* Middle: step dropdown + actions */}
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <div className="relative" ref={stepsRef}>
          <button
            onClick={() => toggle('steps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              openMenu === 'steps'
                ? 'bg-[#1e2a3a] border-[#2d3748] text-white'
                : 'bg-[#111827] border-[#1e2a3a] text-[#e2e8f0] hover:border-[#2d3748]'
            }`}
          >
            {STEP_LABELS[currentStep] ?? currentStep}
            <ChevronDown size={11} className={`text-[#64748b] transition-transform ${openMenu === 'steps' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'steps' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-52 bg-[#111827] border border-[#1e2a3a] rounded-lg shadow-xl z-[200] py-1">
              <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-[#4a5568] uppercase tracking-widest">Pipeline Steps</p>
              {PIPELINE_DROPDOWN_STEPS.map(s => {
                const isActive = currentStep === s.id
                const isDone = completedSteps.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => { setOpenMenu(null); onStepSelect(s.id) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      isActive ? 'text-[#f97316] bg-[#f9731608]' : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {isDone
                      ? <CheckCircle2 size={12} className="text-[#22c55e] flex-shrink-0" />
                      : isActive
                        ? <div className="w-2 h-2 rounded-full bg-[#f97316] flex-shrink-0" />
                        : <Circle size={12} className="text-[#374151] flex-shrink-0" />
                    }
                    {s.label}
                    {isActive && <span className="ml-auto text-[9px] font-bold text-[#f97316] bg-[#f9731618] px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </button>
                )
              })}
              <div className="border-t border-[#1e2a3a] mt-1 pt-1">
                <button
                  onClick={() => { setOpenMenu(null); onStepSelect('export') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#94a3b8] hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <Download size={12} className="flex-shrink-0" />
                  Export Results
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onAnalyze}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] text-xs text-[#94a3b8] hover:text-white rounded-lg transition-all"
        >
          <BarChart2 size={12} />
          Analyze
        </button>

        <button
          onClick={() => onStepSelect('export')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] text-xs text-[#94a3b8] hover:text-white rounded-lg transition-all"
        >
          <Download size={12} />
          Export
        </button>
      </div>

      {/* Right: settings + avatar */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange('settings')}
          className="p-1.5 text-[#4a5568] hover:text-white hover:bg-white/[0.04] rounded transition-colors"
        >
          <Settings size={15} />
        </button>
        <button
          onClick={() => onPageChange('settings')}
          className="w-7 h-7 rounded-full bg-[#1e2a3a] border border-[#2d3748] flex items-center justify-center"
        >
          <span className="text-[10px] font-bold text-[#f97316]">A</span>
        </button>
      </div>
    </div>
  )
}
