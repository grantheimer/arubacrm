'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

function getSecurityLevel(length: number): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (length === 0) return { level: 0, label: '', color: '' };
  if (length <= 2) return { level: 1, label: 'Insufficient', color: 'red' };
  if (length <= 4) return { level: 2, label: 'Moderate', color: 'amber' };
  return { level: 3, label: 'Secure', color: 'green' };
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const security = getSecurityLevel(password.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo className="h-10 w-auto" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 transition-all duration-300 ${
                security.level === 0
                  ? 'border-gray-300 dark:border-gray-600'
                  : security.level === 1
                  ? 'border-red-400 ring-1 ring-red-400/30'
                  : security.level === 2
                  ? 'border-amber-400 ring-1 ring-amber-400/30'
                  : 'border-green-500 ring-2 ring-green-500/30'
              }`}
              placeholder="Enter password"
              autoFocus
            />

            {/* Security strength indicator */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 h-1.5">
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      security.level >= 1 ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      security.level >= 2 ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      security.level >= 3 ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span
                    className={`text-xs font-medium transition-colors duration-300 ${
                      security.level === 1
                        ? 'text-red-600 dark:text-red-400'
                        : security.level === 2
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {security.label}
                  </span>
                  {security.level === 3 && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Ready
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 text-white rounded-lg transition-all duration-300 disabled:opacity-50 ${
              security.level === 3
                ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
