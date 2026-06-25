import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UpdatePasswordPageProps {
  onDone: () => void;
}

export default function UpdatePasswordPage({ onDone }: UpdatePasswordPageProps) {
  const { updatePassword, signOut, exitRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      exitRecovery();
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-md px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Set a new password</h1>
          <p className="text-sm text-[#64748b]">
            Choose a new password for your account. You'll be asked to sign in with it afterwards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 bg-[#111827] border border-[#2d3748] rounded-lg text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#94a3b8] block mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Re-enter your new password"
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
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#1e2a3a] text-center text-[10px] text-[#4a5568] uppercase tracking-widest">
          © 2026 Truss
        </div>
      </div>
    </div>
  );
}
