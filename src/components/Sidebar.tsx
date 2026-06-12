import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Upload,
  BarChart2,
  AlertTriangle,
  Code2,
  GitMerge,
  Maximize2,
  Cpu,
  Activity,
  Zap,
  Download,
  CheckCircle2,
  Circle,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PipelineStep, AppPage, StepStatus, ViewMode } from '../types';

interface SidebarProps {
  currentPage: AppPage;
  currentStep: PipelineStep;
  onPageChange: (page: AppPage) => void;
  onStepChange: (step: PipelineStep) => void;
  onBackToDashboard: () => void;
  viewMode?: ViewMode;
  onSwitchToFreestyle?: () => void;
}

const PIPELINE_STEPS: { id: PipelineStep; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Upload', icon: <Upload size={14} /> },
  { id: 'analyze', label: 'Analyze', icon: <BarChart2 size={14} /> },
  { id: 'missing-values', label: 'Missing Values', icon: <AlertTriangle size={14} /> },
  { id: 'outliers', label: 'Outliers', icon: <Maximize2 size={14} /> },
  { id: 'encoding', label: 'Encoding', icon: <Code2 size={14} /> },
  { id: 'correlation', label: 'Correlation', icon: <GitMerge size={14} /> },
  { id: 'scaling', label: 'Scaling', icon: <Maximize2 size={14} /> },
  { id: 'training', label: 'Training', icon: <Cpu size={14} /> },
  { id: 'evaluation', label: 'Evaluation', icon: <Activity size={14} /> },
  { id: 'optimization', label: 'Optimization', icon: <Zap size={14} /> },
  { id: 'export', label: 'Export', icon: <Download size={14} /> },
];

const STEP_ORDER: PipelineStep[] = [
  'upload', 'analyze', 'missing-values', 'outliers', 'encoding',
  'correlation', 'scaling', 'training', 'evaluation', 'optimization', 'export',
];

function getStepStatus(stepId: PipelineStep, currentStep: PipelineStep): StepStatus {
  const stepIdx = STEP_ORDER.indexOf(stepId);
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 size={14} className="text-[#22c55e] flex-shrink-0" />;
  }
  return <Circle size={14} className="text-[#475569] flex-shrink-0" />;
}

export default function Sidebar({ currentPage, currentStep, onPageChange, onStepChange, onBackToDashboard, onSwitchToFreestyle }: SidebarProps) {
  const { signOut } = useAuth();
  const isInProject = currentPage === 'pipeline';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <aside className="bg-[#0d1117] border-r border-[#1e2a3a]" style={{ width: '220px', flexShrink: 0, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#1e2a3a]">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <img src="/truss_logo.png" alt="Truss" className="h-12 w-auto object-contain" />
        </button>
      </div>

      {/* App-level nav */}
      {!isInProject && (
        <nav className="px-3 pt-4 pb-2 flex-shrink-0">
          <NavItem
            icon={<LayoutDashboard size={15} />}
            label="Dashboard"
            active={currentPage === 'dashboard'}
            onClick={() => onPageChange('dashboard')}
          />
          <NavItem
            icon={<FolderOpen size={15} />}
            label="Projects"
            active={currentPage === 'projects'}
            onClick={() => onPageChange('projects')}
          />
          <NavItem
            icon={<Settings size={15} />}
            label="Settings"
            active={currentPage === 'settings'}
            onClick={() => onPageChange('settings')}
          />
        </nav>
      )}

      {/* Project-level nav */}
      {isInProject && (
        <nav className="px-3 pt-3 pb-2 flex-1 overflow-y-auto flex flex-col">
          {/* Back link */}
          <button
            onClick={onBackToDashboard}
            className="w-full flex items-center gap-2 py-1.5 pl-2 mb-3 text-xs text-[#64748b] hover:text-white transition-colors duration-150 cursor-pointer"
          >
            <ChevronLeft size={13} className="flex-shrink-0" />
            Back to Dashboard
          </button>

          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2 px-1">Pipeline Steps</p>

          {PIPELINE_STEPS.map((step) => {
            const status = getStepStatus(step.id, currentStep);
            const isActive = currentStep === step.id;
            const textColor = isActive
              ? 'text-white'
              : status === 'completed'
              ? 'text-white/60'
              : 'text-white/35';

            return (
              <button
                key={step.id}
                onClick={() => onStepChange(step.id)}
                className={`w-full flex items-center gap-2 py-1.5 rounded-r text-sm mb-0.5 transition-all duration-150 ease-in-out text-left cursor-pointer ${
                  isActive
                    ? 'border-l-[3px] border-orange-500 bg-orange-500/[0.08] pl-[5px]'
                    : `pl-2 hover:bg-white/[0.04] border-l-[3px] border-transparent`
                } ${textColor}`}
              >
                {isActive ? (
                  <span className="flex-shrink-0 w-3.5">{step.icon}</span>
                ) : (
                  <StepIcon status={status} />
                )}
                <span className="text-xs">{step.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Freestyle mode toggle — only in project context */}
      {isInProject && onSwitchToFreestyle && (
        <div className="px-3 pb-3 flex-shrink-0">
          <button
            onClick={onSwitchToFreestyle}
            className="w-full flex items-center gap-2 py-1.5 pl-2 text-xs text-[#4a5568] hover:text-[#94a3b8] border border-[#1e2a3a] hover:border-[#2d3748] rounded transition-all duration-150"
          >
            <span className="text-[10px] font-mono">⚡</span>
            Freestyle Mode
          </button>
        </div>
      )}

      {/* Spacer when in app context */}
      {!isInProject && <div className="flex-1" />}

      {/* User */}
      <div className="flex-shrink-0 border-t border-[#1e2a3a] px-3 py-3">
        <button
          onClick={() => onPageChange('settings')}
          className="w-full flex items-center gap-2 hover:bg-white/[0.04] rounded px-2 py-1.5 transition-colors duration-150 ease-in-out cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#1e2a3a] border border-[#2d3748] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[#f97316]">A</span>
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-medium text-[#e2e8f0] truncate">Alex ML</p>
            <p className="text-[10px] text-[#f97316]">Pro Plan</p>
          </div>
        </button>
        <div className="flex items-center justify-between mt-1 px-2">
          <span className="text-[10px] text-[#4a5568]">v1.0.0</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange('settings')}
              className="text-[#4a5568] hover:text-[#94a3b8] transition-colors duration-150 p-1 cursor-pointer"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={handleSignOut}
              className="text-[#4a5568] hover:text-[#f87171] transition-colors duration-150 p-1 cursor-pointer"
              title="Sign out"
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 py-1.5 rounded-r text-sm mb-0.5 transition-all duration-150 ease-in-out text-left cursor-pointer ${
        active
          ? 'border-l-[3px] border-orange-500 bg-orange-500/[0.08] pl-[5px] text-white font-medium'
          : 'border-l-[3px] border-transparent pl-2 text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <span className={active ? 'text-[#f97316]' : 'text-[#4a5568]'}>
        {icon}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  );
}
