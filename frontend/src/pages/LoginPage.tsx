import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onNavigate: (page: 'landing' | 'register' | 'reset') => void;
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-8 px-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Back to landing */}
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#94a3b8] mb-6 transition-colors"
        >
          <ChevronLeft size={14} />
          Back to home
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
          <img src="/truss_logo.png" alt="Truss" className="h-10 w-auto object-contain" />
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-sm text-[#64748b]">Sign in to your Truss account to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#94a3b8]">Password</label>
              <button
                type="button"
                onClick={() => onNavigate('reset')}
                className="text-xs text-[#f97316] hover:underline"
              >
                Forgot?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 bg-[#f87171]/10 border border-[#f87171]/20 rounded text-xs text-[#f87171]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#1e2a3a]" />
          <span className="text-xs text-[#4a5568]">OR</span>
          <div className="flex-1 h-px bg-[#1e2a3a]" />
        </div>

        {/* Sign up link */}
        <p className="text-center text-sm text-[#64748b]">
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="text-[#f97316] hover:underline font-medium"
          >
            Sign up
          </button>
        </p>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#1e2a3a] text-center text-[10px] text-[#4a5568] uppercase tracking-widest">
          © 2026 Truss
        </div>
      </div>
    </div>
  );
}
