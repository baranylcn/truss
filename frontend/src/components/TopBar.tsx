import { Plus } from 'lucide-react';

interface TopBarProps {
  title: string;
  badge?: string;
  onNewProject: () => void;
}

export default function TopBar({ title, badge, onNewProject }: TopBarProps) {
  return (
    <header className="h-14 border-b border-[#1e2a3a] bg-[#0d1117] flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-mono text-[#94a3b8] bg-[#1e2a3a] border border-[#2d3748] rounded">
            {badge}
          </span>
        )}
      </div>
      <button
        onClick={onNewProject}
        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea6c0a] transition-colors duration-150 px-4 py-1.5 rounded cursor-pointer"
      >
        <Plus size={13} />
        NEW PROJECT
      </button>
    </header>
  );
}
