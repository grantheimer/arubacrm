'use client';

import { useEffect, useState } from 'react';
import { supabase, Opportunity, HealthSystem, Contact, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';

type OpportunityWithDetails = Opportunity & {
  health_system: HealthSystem;
  contact_count: number;
  has_email_this_week: boolean;
  last_email_date: string | null;
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // Get opportunities with health systems
    const { data: oppsData } = await supabase
      .from('opportunities')
      .select('*, health_systems(*)');

    // Get contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*');

    // Get outreach logs
    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Calculate start of week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Build contact to opportunity map
    const contactToOpp: Record<string, string> = {};
    const contactCountByOpp: Record<string, number> = {};

    (contactsData || []).forEach((c: Contact) => {
      if (c.opportunity_id) {
        contactToOpp[c.id] = c.opportunity_id;
        contactCountByOpp[c.opportunity_id] = (contactCountByOpp[c.opportunity_id] || 0) + 1;
      }
    });

    // Find opportunities with email this week and last email date
    const oppsWithEmailThisWeek = new Set<string>();
    const lastEmailByOpp: Record<string, string> = {};

    (logsData || []).forEach((log: OutreachLog) => {
      if (log.contact_method === 'email') {
        const oppId = contactToOpp[log.contact_id];
        if (oppId) {
          // Check if this week
          if (new Date(log.contact_date) >= startOfWeek) {
            oppsWithEmailThisWeek.add(oppId);
          }
          // Track last email date
          if (!lastEmailByOpp[oppId]) {
            lastEmailByOpp[oppId] = log.contact_date;
          }
        }
      }
    });

    // Build enriched opportunities
    const enrichedOpps: OpportunityWithDetails[] = (oppsData || []).map(
      (opp: Opportunity & { health_systems: HealthSystem }) => ({
        ...opp,
        health_system: opp.health_systems,
        contact_count: contactCountByOpp[opp.id] || 0,
        has_email_this_week: oppsWithEmailThisWeek.has(opp.id),
        last_email_date: lastEmailByOpp[opp.id] || null,
      })
    );

    // Sort by account name, then product
    enrichedOpps.sort((a, b) => {
      const accountCompare = a.health_system.name.localeCompare(b.health_system.name);
      if (accountCompare !== 0) return accountCompare;
      return a.product.localeCompare(b.product);
    });

    setOpportunities(enrichedOpps);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // Group by account
  const oppsByAccount: Record<string, OpportunityWithDetails[]> = {};
  opportunities.forEach((opp) => {
    const accountId = opp.health_system_id;
    if (!oppsByAccount[accountId]) {
      oppsByAccount[accountId] = [];
    }
    oppsByAccount[accountId].push(opp);
  });

  const accountIds = Object.keys(oppsByAccount).sort((a, b) => {
    const nameA = oppsByAccount[a][0]?.health_system?.name || '';
    const nameB = oppsByAccount[b][0]?.health_system?.name || '';
    return nameA.localeCompare(nameB);
  });

  const coveredThisWeek = opportunities.filter((o) => o.has_email_this_week).length;
  const needingEmail = opportunities.length - coveredThisWeek;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-gray-500 text-sm">
            {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} across {accountIds.length} account{accountIds.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${needingEmail === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {needingEmail}
          </p>
          <p className="text-xs text-gray-500">need email this week</p>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No opportunities yet</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
            Go to Accounts to add solutions
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {accountIds.map((accountId) => {
            const accountOpps = oppsByAccount[accountId];
            const accountName = accountOpps[0]?.health_system?.name || 'Unknown';
            const accountCovered = accountOpps.filter((o) => o.has_email_this_week).length;

            return (
              <div key={accountId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">{accountName}</h2>
                    <span className="text-sm text-gray-500">
                      ({accountOpps.length} opportunit{accountOpps.length !== 1 ? 'ies' : 'y'})
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${
                    accountCovered === accountOpps.length ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {accountCovered}/{accountOpps.length} covered
                  </span>
                </div>

                <div className="space-y-2">
                  {accountOpps.map((opp) => (
                    <div
                      key={opp.id}
                      className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${
                            opp.has_email_this_week ? 'bg-green-500' : 'bg-red-400'
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                                {opp.product}
                              </span>
                              <span className="text-sm text-gray-500">
                                {opp.contact_count} contact{opp.contact_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {opp.last_email_date && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Last email: {new Date(opp.last_email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          {opp.contact_count === 0 ? 'Add Contacts' : 'Manage'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
