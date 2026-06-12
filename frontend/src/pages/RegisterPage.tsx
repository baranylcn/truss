import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (page: 'landing' | 'login' | 'register' | 'reset') => void;
}

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center py-8 px-4 animate-fade-in">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account created!</h1>
          <p className="text-sm text-[#64748b] mb-6">
            Welcome to Truss. You can now sign in with your credentials.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full py-3 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-8 px-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Back buttons */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <ChevronLeft size={14} />
            Back to sign in
          </button>
          <button
            onClick={() => onNavigate('landing')}
            className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            Back to home
          </button>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create account</h1>
          <p className="text-sm text-[#64748b]">Join Truss and start building ML pipelines today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full px-3 py-2.5 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

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
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#4a5568] mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign in link */}
        <p className="text-center text-sm text-[#64748b]">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="text-[#f97316] hover:underline font-medium"
          >
            Sign in
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
