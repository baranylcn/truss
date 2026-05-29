import {
  Upload,
  Sparkles,
  Rocket,
  Check,
  Lock,
  Github,
  FileText,
  Mail,
  Shield,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { motion, useScroll, useSpring, useInView } from 'framer-motion';
import { useRef } from 'react';

interface LandingPageProps {
  onNavigate: (page: 'login' | 'register') => void;
}

function FadeIn({
  children,
  delay = 0,
  x = 0,
  y = 0,
  scale = 1,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  x?: number;
  y?: number;
  scale?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x, y, scale }}
      animate={inView ? { opacity: 1, x: 0, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const workflowRef = useRef(null);
  const workflowInView = useInView(workflowRef, { once: true, margin: '-80px' });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[#0a0f1e] text-white">
      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX, transformOrigin: '0%' }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#f97316] z-50"
      />

      {/* Navbar */}
      <nav className="border-b border-white/[0.06] fixed top-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/truss_logo.png" alt="Truss" className="h-7 w-auto object-contain" />
          </div>

          <div className="hidden md:flex items-center gap-7">
            <button onClick={() => scrollTo('section-workflow')} className="text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              Dashboard
            </button>
            <button onClick={() => scrollTo('section-modes')} className="text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              Documentation
            </button>
            <button onClick={() => scrollTo('section-pricing')} className="text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              Pricing
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('login')} className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 cursor-pointer">
              Login
            </button>
            <button onClick={() => onNavigate('register')} className="text-sm font-semibold text-white bg-[#f97316] hover:bg-[#ea6c0a] transition-colors px-4 py-1.5 rounded cursor-pointer">
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1 — Hero ── */}
      <section id="hero" className="min-h-screen flex flex-col justify-center pt-14" style={{ background: '#0a0f1e' }}>
        <div className="max-w-7xl mx-auto px-6 w-full py-16">
          <div className="grid grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div>
              <FadeIn y={40} delay={0.05}>
                <h1 className="font-black leading-[1.1] tracking-tight text-white mb-5" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
                  Build ML models without writing a{' '}
                  <span className="text-white">single line of code</span>
                </h1>
              </FadeIn>
              <FadeIn y={24} delay={0.18}>
                <p className="text-white/50 leading-relaxed mb-8 max-w-md" style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.125rem)' }}>
                  Orchestrate high-performance pipelines, clean datasets, and deploy neural networks through a professional, tool-first visual interface.
                </p>
              </FadeIn>
              <FadeIn y={20} delay={0.28}>
                <div className="flex items-center gap-4">
                  <button onClick={() => onNavigate('register')} className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded transition-colors cursor-pointer">
                    Start Free
                    <ChevronRight size={15} />
                  </button>
                  <button className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2.5 cursor-pointer">
                    Watch Demo
                  </button>
                </div>
              </FadeIn>
            </div>

            {/* Mockup — slides from right */}
            <FadeIn x={60} delay={0.12}>
              <div className="relative">
                <div
                  className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#111827] shadow-2xl flex flex-col"
                  style={{ height: 'clamp(300px, 45vh, 580px)' }}
                >
                  <div className="bg-[#0d1117] px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06] flex-shrink-0">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#f87171]/60" />
                      <div className="w-3 h-3 rounded-full bg-[#fbbf24]/60" />
                      <div className="w-3 h-3 rounded-full bg-[#22c55e]/60" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-[#1c2333] rounded px-3 py-1 text-[10px] text-white/30 font-mono text-center">
                        truss.io/projects/proj-001/training
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-3 flex-1 flex flex-col">
                    <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                      {[
                        { label: 'ACCURACY', val: '94.2%', color: '#22c55e' },
                        { label: 'F1 SCORE', val: '93.0%', color: '#f97316' },
                        { label: 'AUC-ROC', val: '0.961', color: '#06b6d4' },
                      ].map((s) => (
                        <div key={s.label} className="bg-[#0d1117] rounded-lg p-3 border border-white/[0.05]">
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
                          <p className="text-base font-bold" style={{ color: s.color }}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0d1117] rounded-lg border border-white/[0.05] p-4 flex-1 flex items-end gap-1.5 min-h-0">
                      {[40, 55, 48, 70, 62, 80, 75, 90, 85, 95, 88, 96].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: i === 11 ? '#f97316' : `rgba(249,115,22,${0.15 + i * 0.05})` }} />
                      ))}
                    </div>
                    <div className="bg-[#0d1117] rounded-lg border border-white/[0.05] overflow-hidden flex-shrink-0">
                      {['XGBoost', 'Random Forest', 'Logistic Regression'].map((m, i) => (
                        <div key={m} className={`flex items-center justify-between px-3 py-2 ${i < 2 ? 'border-b border-white/[0.04]' : ''}`}>
                          <span className="text-[10px] text-white/50 font-mono">{m}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-white/[0.06] rounded-full h-1">
                              <div className="h-1 rounded-full bg-[#f97316]" style={{ width: `${[96, 82, 71][i]}%` }} />
                            </div>
                            <span className="text-[10px] font-mono" style={{ color: i === 0 ? '#f97316' : '#ffffff50' }}>
                              {['94.2%', '89.1%', '81.3%'][i]}
                            </span>
                            {i === 0 && <span className="text-[8px] px-1 py-0.5 bg-[#f97316] text-white rounded uppercase font-semibold">Best</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="absolute -inset-4 bg-[#f97316]/5 rounded-2xl blur-2xl -z-10" />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Workflow ── */}
      <section id="section-workflow" className="min-h-screen flex flex-col justify-center items-center border-t border-white/[0.06]" style={{ background: '#0d1117' }}>
        <div className="max-w-7xl mx-auto px-6 w-full py-16">
          <FadeIn y={20} delay={0}>
            <p className="text-[10px] font-semibold text-[#f97316] uppercase tracking-[0.25em] text-center mb-4">
              Workflow
            </p>
            <h2 className="font-bold text-white text-center mb-16" style={{ fontSize: 'clamp(1.75rem, 3vw, 3rem)' }}>
              Zero Code. Pure Logic.
            </h2>
          </FadeIn>

          {/* Icons row with inline connecting lines */}
          <div ref={workflowRef} className="max-w-3xl mx-auto w-full">
            <div className="flex items-center mb-0">
              {[
                { num: '01.', label: 'Upload', icon: <Upload size={22} />, desc: 'Ingest CSV, JSON, or SQL streams directly into our secure data lake.', delay: 0.35 },
                { num: '02.', label: 'Clean', icon: <Sparkles size={22} />, desc: 'Automated outlier detection and normalization with one click.', delay: 0.5 },
                { num: '03.', label: 'Train & Export', icon: <Rocket size={22} />, desc: 'Hyperparameter tuning and deployment as a REST API or ONNX file.', delay: 0.65 },
              ].map((step, i) => (
                <>
                  <motion.div
                    key={step.label}
                    className="flex flex-col items-center text-center"
                    initial={{ opacity: 0, y: 24 }}
                    animate={workflowInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: step.delay, ease: [0.22, 0.61, 0.36, 1] }}
                  >
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center border text-white"
                      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
                    >
                      {step.icon}
                    </div>
                    <p className="text-[10px] text-white/30 font-mono mt-5 mb-1">{step.num}</p>
                    <p className="text-lg font-semibold text-white mb-2">{step.label}</p>
                    <p className="text-sm text-white/40 leading-relaxed w-[160px]">{step.desc}</p>
                  </motion.div>
                  {i < 2 && (
                    <motion.div
                      className="flex-1 h-[1px] origin-left"
                      style={{ background: 'rgba(255,255,255,0.20)' }}
                      initial={{ scaleX: 0 }}
                      animate={workflowInView ? { scaleX: 1 } : {}}
                      transition={{ duration: 0.5, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
                    />
                  )}
                </>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Mode Comparison ── */}
      <section id="section-modes" className="min-h-screen flex flex-col justify-center" style={{ background: '#0a0f1e' }}>
        <div className="max-w-7xl mx-auto px-6 w-full py-16">
          <FadeIn y={20} delay={0}>
            <p className="text-[10px] font-semibold text-[#f97316] uppercase tracking-[0.25em] text-center mb-4">
              Modes
            </p>
            <h2 className="font-bold text-white text-center mb-12" style={{ fontSize: 'clamp(1.75rem, 3vw, 3rem)' }}>
              Choose your workflow
            </h2>
          </FadeIn>

          <div className="h-1.5 bg-gradient-to-r from-[#f97316] to-[#f97316]/20 rounded-t-lg" />
          <div className="grid grid-cols-2 gap-0 border border-white/[0.08] rounded-b-lg rounded-tr-lg overflow-hidden">
            {/* Manual Mode — slides from left */}
            <FadeIn x={-40} delay={0.1} className="contents">
              <div className="p-8 bg-[#111827] border-r border-white/[0.06]">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-1 h-4 bg-[#f97316] rounded-full" />
                      ))}
                    </div>
                    <span className="text-base font-semibold text-white">Manual Mode</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 border border-white/[0.1] px-2 py-0.5 rounded">
                    v2.4 Live
                  </span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">
                  Granular control over every layer. Drag-and-drop nodes to define custom neural architectures and loss functions. Ideal for specialized research tasks.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Node-based visual graph', 'Custom activation functions', 'Real-time epoch visualization'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center flex-shrink-0">
                        <Check size={9} className="text-[#f97316]" />
                      </div>
                      <span className="text-sm text-white/60">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => onNavigate('login')} className="w-full py-2.5 border border-white/[0.12] text-sm text-white/70 hover:text-white hover:border-white/25 rounded transition-colors cursor-pointer">
                  Configure Now
                </button>
              </div>
            </FadeIn>

            {/* AI Mode — slides from right */}
            <FadeIn x={40} delay={0.1} className="contents">
              <div className="p-8 bg-[#0d1117] opacity-70 relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <Zap size={18} className="text-[#06b6d4]" />
                    <span className="text-base font-semibold text-white">AI Mode</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#06b6d4] border border-[#06b6d4]/30 bg-[#06b6d4]/10 px-2 py-0.5 rounded uppercase tracking-wide">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed mb-6">
                  Describe your problem in natural language. Our internal LLM agent builds, tests, and optimizes the entire pipeline for you autonomously.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Prompt-to-Model synthesis', 'Auto-scaling inference', 'Predictive cost analysis'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-white/[0.04] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                        <Lock size={8} className="text-white/30" />
                      </div>
                      <span className="text-sm text-white/30">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-2.5 border border-white/[0.08] text-sm text-white/30 rounded cursor-not-allowed">
                  Join Waitlist
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — Pricing ── */}
      <section id="section-pricing" className="min-h-screen flex flex-col justify-center border-t border-white/[0.06]" style={{ background: '#0d1117' }}>
        <div className="max-w-7xl mx-auto px-6 w-full py-16">
          <FadeIn y={20} delay={0}>
            <h2 className="font-bold text-white text-center mb-2" style={{ fontSize: 'clamp(1.75rem, 3vw, 3rem)' }}>
              Enterprise-grade pricing
            </h2>
            <p className="text-sm text-white/40 text-center mb-12">Scale from hobbyist to full-scale enterprise infra.</p>
          </FadeIn>

          <div className="grid grid-cols-3 gap-4 lg:gap-8 max-w-4xl mx-auto">
            {/* Community */}
            <FadeIn y={24} delay={0.1}>
              <div className="bg-[#111827] border border-white/[0.08] rounded-lg p-6 flex flex-col h-full">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Community</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$0</span>
                  <span className="text-sm text-white/40">/mo</span>
                </div>
                <div className="h-px bg-white/[0.06] my-5" />
                <ul className="space-y-3 flex-1 mb-6">
                  {['5 Active Pipelines', '1GB Dataset Storage', 'Basic UI Access'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={13} className="text-[#22c55e] flex-shrink-0" />
                      <span className="text-sm text-white/60">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => onNavigate('register')} className="w-full py-2.5 border border-white/[0.12] text-sm text-white/60 hover:text-white hover:border-white/25 rounded transition-colors cursor-pointer">
                  Get Started
                </button>
              </div>
            </FadeIn>

            {/* Professional — scale entrance */}
            <motion.div
              ref={useRef(null)}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="bg-[#111827] border-2 border-[#f97316] rounded-lg p-6 flex flex-col relative h-full">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#f97316] text-white text-[10px] font-bold uppercase rounded tracking-wide">
                  Popular
                </div>
                <p className="text-[10px] font-semibold text-[#f97316] uppercase tracking-widest mb-3">Professional</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$49</span>
                  <span className="text-sm text-white/40">/mo</span>
                </div>
                <div className="h-px bg-white/[0.06] my-5" />
                <ul className="space-y-3 flex-1 mb-6">
                  {['Unlimited Pipelines', '50GB Dataset Storage', 'GPU Accelerated Training', 'Priority Support'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={13} className="text-[#22c55e] flex-shrink-0" />
                      <span className="text-sm text-white/70">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => onNavigate('register')} className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded transition-colors cursor-pointer">
                  Start Pro Trial
                </button>
              </div>
            </motion.div>

            {/* Enterprise */}
            <FadeIn y={24} delay={0.3}>
              <div className="bg-[#111827] border border-white/[0.08] rounded-lg p-6 flex flex-col h-full">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Enterprise</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">Custom</span>
                </div>
                <div className="h-px bg-white/[0.06] my-5" />
                <ul className="space-y-3 flex-1 mb-6">
                  {['Bring Your Own Key', 'On-prem Deployment', 'Custom API Rate Limits', 'SLA Guarantees'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={13} className="text-[#22c55e] flex-shrink-0" />
                      <span className="text-sm text-white/60">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-2.5 border border-white/[0.12] text-sm text-white/60 hover:text-white hover:border-white/25 rounded transition-colors cursor-pointer">
                  Contact Sales
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-[#0a0f1e] py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/truss_logo.png" alt="Truss" className="h-5 w-auto object-contain opacity-40" />
            <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Truss</span>
            <span className="text-white/20 text-xs ml-2">© 2025. Build with precision.</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: 'GitHub', icon: <Github size={13} /> },
              { label: 'Docs', icon: <FileText size={13} /> },
              { label: 'Contact', icon: <Mail size={13} /> },
              { label: 'Privacy', icon: <Shield size={13} /> },
            ].map((l) => (
              <a key={l.label} href="#" className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                {l.icon}
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
