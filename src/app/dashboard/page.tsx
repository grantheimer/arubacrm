'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, OutreachLog } from '@/lib/supabase';

type Stats = {
  totalOpportunities: number;
  totalAccounts: number;
  totalContacts: number;
  opportunitiesCoveredThisWeek: number;
  opportunitiesNeedingEmail: number;
  weeklyCompletionRate: number;
  totalEmailsThisWeek: number;
  callsThisWeek: number;
  emailsThisWeek: number;
  meetingsThisWeek: number;
  currentStreak: number;
  recentActivity: Array<{
    contactName: string;
    accountName: string;
    product: string;
    method: string;
    date: string;
    notes: string | null;
  }>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Get all opportunities with health systems
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*, health_systems(*)');

    // Get all health systems
    const { data: accounts } = await supabase
      .from('health_systems')
      .select('*');

    // Get all contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*');

    // Get all outreach logs
    const { data: logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Calculate dates
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const oppsData = opportunities || [];
    const accountsData = accounts || [];
    const contactsData = contacts || [];
    const logsData = logs || [];

    // Build maps
    const contactToOpp: Record<string, string> = {};
    const contactToAccount: Record<string, string> = {};
    const contactMap: Record<string, { name: string; accountName: string; product: string }> = {};

    contactsData.forEach((c: Contact) => {
      if (c.opportunity_id) {
        contactToOpp[c.id] = c.opportunity_id;
      }
      contactToAccount[c.id] = c.health_system_id;
    });

    oppsData.forEach((o: Opportunity & { health_systems: HealthSystem }) => {
      const oppContacts = contactsData.filter((c: Contact) => c.opportunity_id === o.id);
      oppContacts.forEach((c: Contact) => {
        contactMap[c.id] = {
          name: c.name,
          accountName: o.health_systems?.name || 'Unknown',
          product: o.product,
        };
      });
    });

    // This week's logs
    const thisWeekLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= startOfWeek
    );

    // Emails this week by opportunity
    const emailsByOpp = new Set<string>();
    thisWeekLogs
      .filter((log: OutreachLog) => log.contact_method === 'email')
      .forEach((log: OutreachLog) => {
        const oppId = contactToOpp[log.contact_id];
        if (oppId) {
          emailsByOpp.add(oppId);
        }
      });

    const opportunitiesCoveredThisWeek = emailsByOpp.size;
    const opportunitiesNeedingEmail = oppsData.length - opportunitiesCoveredThisWeek;
    const weeklyCompletionRate = oppsData.length > 0
      ? Math.round((opportunitiesCoveredThisWeek / oppsData.length) * 100)
      : 100;

    // Activity breakdown this week
    const callsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'call').length;
    const emailsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'email').length;
    const meetingsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'meeting').length;

    // Calculate streak (consecutive days with email activity)
    let streak = 0;
    const checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasEmail = logsData.some(
        (l: OutreachLog) => l.contact_date === dateStr && l.contact_method === 'email'
      );
      if (hasEmail) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Recent activity (last 5)
    const recentActivity = logsData.slice(0, 5).map((log: OutreachLog) => ({
      contactName: contactMap[log.contact_id]?.name || 'Unknown',
      accountName: contactMap[log.contact_id]?.accountName || 'Unknown',
      product: contactMap[log.contact_id]?.product || '',
      method: log.contact_method,
      date: log.contact_date,
      notes: log.notes,
    }));

    setStats({
      totalOpportunities: oppsData.length,
      totalAccounts: accountsData.length,
      totalContacts: contactsData.length,
      opportunitiesCoveredThisWeek,
      opportunitiesNeedingEmail,
      weeklyCompletionRate,
      totalEmailsThisWeek: emailsThisWeek,
      callsThisWeek,
      emailsThisWeek,
      meetingsThisWeek,
      currentStreak: streak,
      recentActivity,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!stats) return null;

  const methodIcons: Record<string, string> = {
    call: '📞',
    email: '✉️',
    meeting: '🤝',
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm">Weekly opportunity coverage at a glance</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Need Email</p>
          <p className={`text-3xl font-bold mt-1 ${
            stats.opportunitiesNeedingEmail === 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stats.opportunitiesNeedingEmail}
          </p>
          <p className="text-xs text-gray-400">opportunities this week</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Weekly Coverage</p>
          <p className={`text-3xl font-bold mt-1 ${
            stats.weeklyCompletionRate >= 100 ? 'text-green-600' :
            stats.weeklyCompletionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {stats.weeklyCompletionRate}%
          </p>
          <p className="text-xs text-gray-400">{stats.opportunitiesCoveredThisWeek}/{stats.totalOpportunities} covered</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Email Streak</p>
          <p className="text-3xl font-bold mt-1">{stats.currentStreak}</p>
          <p className="text-xs text-gray-400">{stats.currentStreak === 1 ? 'day' : 'days'} in a row</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Emails Sent</p>
          <p className="text-3xl font-bold mt-1">{stats.emailsThisWeek}</p>
          <p className="text-xs text-gray-400">this week</p>
        </div>
      </div>

      {/* Activity Breakdown & Summary */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Activity Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">This Week&apos;s Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✉️</span>
                <span className="text-gray-600 dark:text-gray-300">Emails</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.emailsThisWeek / Math.max(stats.emailsThisWeek + stats.callsThisWeek + stats.meetingsThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.emailsThisWeek}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <span className="text-gray-600 dark:text-gray-300">Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.callsThisWeek / Math.max(stats.emailsThisWeek + stats.callsThisWeek + stats.meetingsThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.callsThisWeek}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤝</span>
                <span className="text-gray-600 dark:text-gray-300">Meetings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.meetingsThisWeek / Math.max(stats.emailsThisWeek + stats.callsThisWeek + stats.meetingsThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.meetingsThisWeek}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">Coverage Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Total Opportunities</span>
              <span className="font-medium">{stats.totalOpportunities}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Accounts</span>
              <span className="font-medium">{stats.totalAccounts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Contacts</span>
              <span className="font-medium">{stats.totalContacts}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Covered This Week</span>
                <span className="font-medium text-green-600">{stats.opportunitiesCoveredThisWeek}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600 dark:text-gray-300">Still Need Email</span>
                <span className={`font-medium ${stats.opportunitiesNeedingEmail > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.opportunitiesNeedingEmail}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity. Start reaching out!</p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <span className="text-xl">{methodIcons[activity.method]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.contactName}</span>
                    <span className="text-gray-500"> at {activity.accountName}</span>
                    {activity.product && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {activity.product}
                      </span>
                    )}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-gray-400 truncate">{activity.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
