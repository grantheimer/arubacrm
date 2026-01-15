'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, HealthSystem, Opportunity, Contact, ContactOpportunity, PRODUCTS } from '@/lib/supabase';
import Link from 'next/link';

type OpportunityWithContacts = Opportunity & {
  contacts: Contact[];
};

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<HealthSystem | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityWithContacts[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProduct, setAddingProduct] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: accountData, error: accountError } = await supabase
      .from('health_systems')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      setLoading(false);
      return;
    }

    setAccount(accountData);

    const { data: oppsData } = await supabase
      .from('opportunities')
      .select('*')
      .eq('health_system_id', accountId)
      .order('product');

    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .eq('health_system_id', accountId);

    // Get contact-opportunity assignments
    const { data: assignmentsData } = await supabase
      .from('contact_opportunities')
      .select('*');

    // Build contact lookup map
    const contactMap: Record<string, Contact> = {};
    (contactsData || []).forEach((contact: Contact) => {
      contactMap[contact.id] = contact;
    });

    // Build contacts by opportunity using junction table
    const contactsByOpp: Record<string, Contact[]> = {};
    (assignmentsData || []).forEach((assignment: ContactOpportunity) => {
      const contact = contactMap[assignment.contact_id];
      if (contact) {
        if (!contactsByOpp[assignment.opportunity_id]) {
          contactsByOpp[assignment.opportunity_id] = [];
        }
        contactsByOpp[assignment.opportunity_id].push(contact);
      }
    });

    const oppsWithContacts = (oppsData || []).map((opp: Opportunity) => ({
      ...opp,
      contacts: contactsByOpp[opp.id] || [],
    }));

    setOpportunities(oppsWithContacts);
    setLoading(false);
  };

  useEffect(() => {
    if (accountId) {
      fetchData();
    }
  }, [accountId]);

  const handleAddOpportunity = async (product: string) => {
    setAddingProduct(product);

    const { error } = await supabase.from('opportunities').insert({
      health_system_id: accountId,
      product,
    });

    if (error) {
      console.error('Error adding opportunity:', error);
      alert('Failed to add opportunity');
    } else {
      await fetchData();
    }

    setAddingProduct(null);
  };

  const handleRemoveOpportunity = async (oppId: string, product: string, contactCount: number) => {
    if (contactCount > 0) {
      if (!confirm(`Remove "${product}"? This will also remove ${contactCount} contact${contactCount !== 1 ? 's' : ''} assigned to it.`)) {
        return;
      }
    }

    const { error } = await supabase.from('opportunities').delete().eq('id', oppId);

    if (error) {
      console.error('Error removing opportunity:', error);
      alert('Failed to remove opportunity');
    } else {
      await fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Account not found</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  const existingProducts = new Set(opportunities.map((o) => o.product));
  const availableProducts = PRODUCTS.filter((p) => !existingProducts.has(p));

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Accounts
        </Link>
        <h1 className="text-2xl font-bold mt-1">{account.name}</h1>
        <p className="text-gray-500 text-sm">
          {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* Add Opportunities */}
      <div className="mb-6 p-5 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Solutions You Can Sell</h2>
        <p className="text-sm text-gray-500 mb-4">Click to add a solution as an opportunity for this account</p>

        <div className="flex flex-wrap gap-2">
          {PRODUCTS.map((product) => {
            const isAdded = existingProducts.has(product);
            const isLoading = addingProduct === product;

            return (
              <button
                key={product}
                onClick={() => !isAdded && handleAddOpportunity(product)}
                disabled={isAdded || isLoading}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  isAdded
                    ? 'bg-blue-600 text-white border-blue-600 cursor-default'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                } ${isLoading ? 'opacity-50' : ''}`}
              >
                {isAdded ? '✓ ' : '+ '}{product}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No opportunities yet</p>
          <p className="text-sm text-gray-400">Add solutions above to create opportunities</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Opportunities</h2>

          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      {opp.product}
                    </span>
                    <span className="text-sm text-gray-500">
                      {opp.contacts.length} contact{opp.contacts.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {opp.contacts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {opp.contacts.map((contact) => (
                        <p key={contact.id} className="text-sm text-gray-600 dark:text-gray-400">
                          {contact.name}
                          {contact.role && <span className="text-gray-400"> - {contact.role}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  <Link
                    href={`/opportunities/${opp.id}`}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {opp.contacts.length === 0 ? 'Add Contacts' : 'Manage'}
                  </Link>
                  <button
                    onClick={() => handleRemoveOpportunity(opp.id, opp.product, opp.contacts.length)}
                    className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
