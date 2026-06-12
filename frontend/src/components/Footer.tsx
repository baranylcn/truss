export default function Footer() {
  return (
    <footer className="border-t border-[#1e2a3a] bg-[#0d1117] px-6 py-3 flex items-center justify-between flex-shrink-0">
      <span className="text-[11px] text-[#4a5568] uppercase tracking-wide font-semibold">Truss</span>
      <div className="flex items-center gap-5">
        <a href="#" className="text-[11px] text-[#4a5568] hover:text-[#94a3b8] transition-colors duration-150">GitHub</a>
        <a href="#" className="text-[11px] text-[#4a5568] hover:text-[#94a3b8] transition-colors duration-150">Docs</a>
        <a href="#" className="text-[11px] text-[#4a5568] hover:text-[#94a3b8] transition-colors duration-150">Contact</a>
        <span className="text-[11px] text-[#4a5568]">© 2025 Truss</span>
      </div>
    </footer>
  );
}
