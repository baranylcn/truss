import { useState } from 'react';
import { Check } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'plan'>('profile');
  const [name, setName] = useState('Alex ML');
  const [saved, setSaved] = useState(false);
  const [apiKey] = useState('sk-truss-xxxxxxxxxxxxxxxxxxxxxx');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <div className="flex-1 p-6 overflow-y-auto max-w-3xl">
        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-[#1e2a3a] mb-8">
          {(['profile', 'plan'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#f97316] text-white'
                  : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              {tab === 'plan' ? 'Plan & API' : 'Profile'}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Identity</p>
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#1e2a3a] border border-[#2d3748] flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-[#f97316]">A</span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">Alex ML</p>
                    <p className="text-sm text-[#64748b]">Machine Learning Architect</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-[#94a3b8] block mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#94a3b8] block mb-2">Email Address (Read-only)</label>
                <input
                  type="email"
                  value="alex@truss.run"
                  readOnly
                  className="w-full px-4 py-3 bg-[#111827] border border-[#1e2a3a] rounded-lg text-sm text-[#4a5568] cursor-not-allowed"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saved ? (
                <>
                  <Check size={14} />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div>
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Current Plan</p>
              <div className="bg-[#111827] border border-[#f97316] rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-lg font-bold text-white">Pro Plan</p>
                      <span className="px-2 py-0.5 text-[10px] font-semibold text-[#f97316] bg-[#f9731620] rounded uppercase">Active</span>
                    </div>
                    <p className="text-sm text-[#64748b]">$49/month · Renews Dec 1, 2026</p>
                  </div>
                  <button className="px-4 py-2 border border-[#2d3748] text-sm text-[#94a3b8] rounded hover:border-[#374151] hover:text-white transition-colors">
                    Manage
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#1e2a3a]">
                  {[
                    { label: 'Projects', value: '∞ Unlimited' },
                    { label: 'Datasets', value: 'Up to 10 GB' },
                    { label: 'AI Suggestions', value: 'Enabled' },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] text-[#4a5568] uppercase tracking-widest">{f.label}</p>
                      <p className="text-sm text-[#94a3b8] mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* API Key */}
            <div>
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">API Access</p>
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <label className="text-xs font-medium text-[#94a3b8] block mb-2">API Key</label>
                <div className="flex gap-3">
                  <input
                    type="password"
                    value={apiKey}
                    readOnly
                    className="flex-1 px-4 py-3 bg-[#0d1117] border border-[#1e2a3a] rounded font-mono text-sm text-[#64748b]"
                  />
                  <button className="px-4 py-2.5 bg-[#1c2333] border border-[#2d3748] text-sm text-[#94a3b8] rounded hover:border-[#374151] hover:text-white transition-colors">
                    Reveal
                  </button>
                  <button className="px-4 py-2.5 bg-[#1c2333] border border-[#2d3748] text-sm text-[#94a3b8] rounded hover:border-[#374151] hover:text-white transition-colors">
                    Regenerate
                  </button>
                </div>
                <p className="text-[11px] text-[#374151] mt-2">Keep your API key secret. It grants full access to your account.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
