'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';

type OpportunityTodo = {
  id: string;
  product: string;
  health_system: HealthSystem;
  contacts: Array<Contact & {
    last_contact_date: string | null;
    days_since_contact: number | null;
  }>;
  has_email_this_week: boolean;
};

export default function TodoPage() {
  const [opportunities, setOpportunities] = useState<OpportunityTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});

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

    // Build contact last outreach map
    const lastOutreach: Record<string, { date: string; method: string }> = {};
    (logsData || []).forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    // Check which opportunities have email this week
    const contactToOpp: Record<string, string> = {};
    (contactsData || []).forEach((c: Contact) => {
      if (c.opportunity_id) {
        contactToOpp[c.id] = c.opportunity_id;
      }
    });

    const oppsWithEmailThisWeek = new Set<string>();
    (logsData || [])
      .filter((log: OutreachLog) =>
        log.contact_method === 'email' &&
        new Date(log.contact_date) >= startOfWeek
      )
      .forEach((log: OutreachLog) => {
        const oppId = contactToOpp[log.contact_id];
        if (oppId) {
          oppsWithEmailThisWeek.add(oppId);
        }
      });

    // Build opportunity todos
    const todos: OpportunityTodo[] = (oppsData || []).map((opp: Opportunity & { health_systems: HealthSystem }) => {
      const oppContacts = (contactsData || [])
        .filter((c: Contact) => c.opportunity_id === opp.id)
        .map((contact: Contact) => {
          const last = lastOutreach[contact.id];
          const daysSince = last
            ? Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return {
            ...contact,
            last_contact_date: last?.date || null,
            days_since_contact: daysSince,
          };
        })
        // Sort by days since contact (never contacted first, then oldest)
        .sort((a, b) => {
          if (a.days_since_contact === null && b.days_since_contact === null) return 0;
          if (a.days_since_contact === null) return -1;
          if (b.days_since_contact === null) return 1;
          return b.days_since_contact - a.days_since_contact;
        });

      return {
        id: opp.id,
        product: opp.product,
        health_system: opp.health_systems,
        contacts: oppContacts,
        has_email_this_week: oppsWithEmailThisWeek.has(opp.id),
      };
    });

    // Filter to only show opportunities needing email and sort by account name
    const needingEmail = todos
      .filter((t) => !t.has_email_this_week)
      .sort((a, b) => a.health_system.name.localeCompare(b.health_system.name));

    setOpportunities(needingEmail);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const logEmail = async (contactId: string) => {
    setLoggingId(contactId);
    const notes = logNotes[contactId] || null;

    const { error } = await supabase.from('outreach_logs').insert({
      contact_id: contactId,
      contact_method: 'email',
      notes,
    });

    if (error) {
      console.error('Error logging email:', error);
      alert('Failed to log email');
    } else {
      setLogNotes((prev) => ({ ...prev, [contactId]: '' }));
      await fetchData();
    }
    setLoggingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Weekly To-Do</h1>
        <p className="text-gray-500 text-sm">Opportunities that need an email this week</p>
      </div>

      {opportunities.length === 0 ? (
        <div className="text-center py-16 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-xl text-green-700 dark:text-green-300 font-medium">All caught up!</p>
          <p className="text-gray-500 mt-1">Every opportunity has been emailed this week.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block text-sm">
            View Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-lg text-red-600">{opportunities.length}</span>
              {' '}opportunit{opportunities.length !== 1 ? 'ies' : 'y'} still need{opportunities.length === 1 ? 's' : ''} an email
            </p>
          </div>

          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{opp.health_system.name}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      {opp.product}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {opp.contacts.length} contact{opp.contacts.length !== 1 ? 's' : ''} available
                  </p>
                </div>
                <Link
                  href={`/opportunities/${opp.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Manage contacts
                </Link>
              </div>

              {opp.contacts.length === 0 ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
                  <p className="text-yellow-700 dark:text-yellow-300">
                    No contacts assigned to this opportunity.{' '}
                    <Link href={`/opportunities/${opp.id}`} className="underline">
                      Add contacts
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {opp.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{contact.name}</span>
                          {contact.role && (
                            <span className="text-gray-500 text-sm"> - {contact.role}</span>
                          )}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            contact.days_since_contact === null
                              ? 'bg-yellow-100 text-yellow-700'
                              : contact.days_since_contact >= 14
                              ? 'bg-green-100 text-green-700'
                              : contact.days_since_contact >= 7
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {contact.days_since_contact === null
                              ? 'Never contacted'
                              : `${contact.days_since_contact}d ago`}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => logEmail(contact.id)}
                          disabled={loggingId === contact.id}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>✉️</span> Log Email
                        </button>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={logNotes[contact.id] || ''}
                          onChange={(e) =>
                            setLogNotes((prev) => ({ ...prev, [contact.id]: e.target.value }))
                          }
                          className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
