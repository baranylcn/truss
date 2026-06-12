import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (page: 'landing' | 'login' | 'register' | 'reset') => void;
}

export default function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex-1 flex items-center justify-center animate-fade-in">
        <div className="w-full max-w-md px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#38bdf8]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-sm text-[#64748b] mb-2">
            We sent a password reset link to <span className="font-medium text-[#94a3b8]">{email}</span>
          </p>
          <p className="text-xs text-[#4a5568] mb-6">
            Click the link in the email to reset your password. If you don't see it, check your spam folder.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full py-3 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-md px-6">
        {/* Back button */}
        <button
          onClick={() => onNavigate('login')}
          className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#94a3b8] mb-6 transition-colors"
        >
          <ChevronLeft size={14} />
          Back to sign in
        </button>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
          <p className="text-sm text-[#64748b]">
            Enter the email address associated with your account and we'll send you instructions to reset your password.
          </p>
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
              className="w-full px-4 py-3 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
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
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {/* Sign in link */}
        <p className="text-center text-sm text-[#64748b]">
          Remember your password?{' '}
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
