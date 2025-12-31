'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, HealthSystemWithLastContact } from '@/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [healthSystems, setHealthSystems] = useState<HealthSystemWithLastContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  const fetchHealthSystems = async () => {
    const { data: systems, error } = await supabase
      .from('health_systems')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching health systems:', error);
      return;
    }

    // Get last contact for each system
    const systemsWithContact = await Promise.all(
      (systems || []).map(async (system) => {
        const { data: logs } = await supabase
          .from('outreach_logs')
          .select('contact_date, contact_method')
          .eq('health_system_id', system.id)
          .order('contact_date', { ascending: false })
          .limit(1);

        const lastLog = logs?.[0];
        const lastContactDate = lastLog?.contact_date || null;
        const daysSince = lastContactDate
          ? Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          ...system,
          last_contact_date: lastContactDate,
          last_contact_method: lastLog?.contact_method || null,
          days_since_contact: daysSince,
        };
      })
    );

    setHealthSystems(systemsWithContact);
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthSystems();
  }, []);

  const logContact = async (healthSystemId: string, method: 'call' | 'email' | 'meeting') => {
    setLoggingId(healthSystemId);
    const notes = logNotes[healthSystemId] || null;

    const { error } = await supabase.from('outreach_logs').insert({
      health_system_id: healthSystemId,
      contact_method: method,
      notes: notes,
    });

    if (error) {
      console.error('Error logging contact:', error);
      alert('Failed to log contact');
    } else {
      setLogNotes((prev) => ({ ...prev, [healthSystemId]: '' }));
      await fetchHealthSystems();
    }
    setLoggingId(null);
  };

  // Filter to show systems due for contact (14+ days or never contacted)
  const dueSystems = healthSystems.filter(
    (s) => s.days_since_contact === null || s.days_since_contact >= 14
  );

  // Sort by most overdue first
  const sortedDueSystems = dueSystems.sort((a, b) => {
    if (a.days_since_contact === null && b.days_since_contact === null) return 0;
    if (a.days_since_contact === null) return -1;
    if (b.days_since_contact === null) return 1;
    return b.days_since_contact - a.days_since_contact;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Today&apos;s Outreach</h1>
        <div className="flex gap-2">
          <Link
            href="/accounts"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Manage Accounts
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {sortedDueSystems.length === 0 ? (
        <div className="text-center py-12 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-xl text-green-700 dark:text-green-300">All caught up! No outreach due today.</p>
          <Link href="/accounts" className="text-blue-600 hover:underline mt-2 inline-block">
            Add health systems to track
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {sortedDueSystems.length} account{sortedDueSystems.length !== 1 ? 's' : ''} due for outreach
          </p>

          {sortedDueSystems.map((system) => (
            <div
              key={system.id}
              className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-semibold">{system.name}</h2>
                  {system.contact_name && (
                    <p className="text-gray-600 dark:text-gray-400">
                      {system.contact_name}
                      {system.contact_role && ` - ${system.contact_role}`}
                    </p>
                  )}
                  {system.contact_email && (
                    <p className="text-sm text-gray-500">{system.contact_email}</p>
                  )}
                  {system.contact_phone && (
                    <p className="text-sm text-gray-500">{system.contact_phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm ${
                      system.days_since_contact === null
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : system.days_since_contact >= 21
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    }`}
                  >
                    {system.days_since_contact === null
                      ? 'Never contacted'
                      : `${system.days_since_contact} days ago`}
                  </span>
                  {system.deal_stage && (
                    <p className="text-sm text-gray-500 mt-1 capitalize">{system.deal_stage}</p>
                  )}
                </div>
              </div>

              {system.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
                  Notes: {system.notes}
                </p>
              )}

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => logContact(system.id, 'call')}
                  disabled={loggingId === system.id}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>📞</span> Call
                </button>
                <button
                  onClick={() => logContact(system.id, 'email')}
                  disabled={loggingId === system.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>✉️</span> Email
                </button>
                <button
                  onClick={() => logContact(system.id, 'meeting')}
                  disabled={loggingId === system.id}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>🤝</span> Meeting
                </button>
              </div>

              <input
                type="text"
                placeholder="Add notes (optional) - e.g., 'left voicemail'"
                value={logNotes[system.id] || ''}
                onChange={(e) =>
                  setLogNotes((prev) => ({ ...prev, [system.id]: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
