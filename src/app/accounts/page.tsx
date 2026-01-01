'use client';

import { useEffect, useState } from 'react';
import { supabase, HealthSystem, Opportunity } from '@/lib/supabase';
import Link from 'next/link';

type HealthSystemWithCounts = HealthSystem & {
  opportunity_count: number;
  contact_count: number;
  opportunities: Opportunity[];
};

type FormData = {
  name: string;
  notes: string;
};

const emptyForm: FormData = {
  name: '',
  notes: '',
};

export default function AccountsPage() {
  const [healthSystems, setHealthSystems] = useState<HealthSystemWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchHealthSystems = async () => {
    const { data: systems, error } = await supabase
      .from('health_systems')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching health systems:', error);
      setLoading(false);
      return;
    }

    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('health_system_id');

    const oppsBySystem: Record<string, Opportunity[]> = {};
    const contactCounts: Record<string, number> = {};

    (opportunities || []).forEach((opp: Opportunity) => {
      if (!oppsBySystem[opp.health_system_id]) {
        oppsBySystem[opp.health_system_id] = [];
      }
      oppsBySystem[opp.health_system_id].push(opp);
    });

    (contacts || []).forEach((c: { health_system_id: string }) => {
      contactCounts[c.health_system_id] = (contactCounts[c.health_system_id] || 0) + 1;
    });

    const systemsWithCounts = (systems || []).map((system) => ({
      ...system,
      opportunities: oppsBySystem[system.id] || [],
      opportunity_count: (oppsBySystem[system.id] || []).length,
      contact_count: contactCounts[system.id] || 0,
    }));

    setHealthSystems(systemsWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthSystems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('health_systems')
        .update({
          name: formData.name,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Error updating:', error);
        alert('Failed to update');
      }
    } else {
      const { error } = await supabase.from('health_systems').insert({
        name: formData.name,
        notes: formData.notes || null,
      });

      if (error) {
        console.error('Error creating:', error);
        alert('Failed to create');
      }
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    await fetchHealthSystems();
  };

  const handleEdit = (system: HealthSystem) => {
    setFormData({
      name: system.name,
      notes: system.notes || '',
    });
    setEditingId(system.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This removes all opportunities, contacts, and outreach history.`)) {
      return;
    }

    const { error } = await supabase.from('health_systems').delete().eq('id', id);

    if (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    } else {
      await fetchHealthSystems();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-gray-500 text-sm">{healthSystems.length} health system{healthSystems.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            + Add Account
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 p-5 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Account' : 'New Account'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Health System Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., Mayo Clinic"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={2}
                  placeholder="Any notes about this account..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Account'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {healthSystems.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No accounts yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:underline text-sm"
          >
            Add your first health system
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {healthSystems.map((system) => (
            <div
              key={system.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{system.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {system.opportunity_count} opportunit{system.opportunity_count !== 1 ? 'ies' : 'y'}
                    {' · '}
                    {system.contact_count} contact{system.contact_count !== 1 ? 's' : ''}
                  </p>
                  {system.opportunities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {system.opportunities.map((opp) => (
                        <span
                          key={opp.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {opp.product}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 sm:gap-1">
                  <Link
                    href={`/accounts/${system.id}`}
                    className="flex-1 sm:flex-none text-center px-3 py-2 sm:py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
                  >
                    Manage
                  </Link>
                  <button
                    onClick={() => handleEdit(system)}
                    className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(system.id, system.name)}
                    className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition"
                  >
                    Delete
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
