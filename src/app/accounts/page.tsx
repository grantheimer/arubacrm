'use client';

import { useEffect, useState } from 'react';
import { supabase, HealthSystem } from '@/lib/supabase';
import Link from 'next/link';

type FormData = {
  name: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  deal_stage: string;
  revenue_potential: string;
  notes: string;
};

const emptyForm: FormData = {
  name: '',
  contact_name: '',
  contact_role: '',
  contact_email: '',
  contact_phone: '',
  deal_stage: 'prospecting',
  revenue_potential: '',
  notes: '',
};

const dealStages = [
  'prospecting',
  'qualified',
  'proposal',
  'negotiation',
  'closed-won',
  'closed-lost',
  'nurturing',
];

export default function AccountsPage() {
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchHealthSystems = async () => {
    const { data, error } = await supabase
      .from('health_systems')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching health systems:', error);
    } else {
      setHealthSystems(data || []);
    }
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
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Error updating:', error);
        alert('Failed to update');
      }
    } else {
      const { error } = await supabase.from('health_systems').insert(formData);

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
      contact_name: system.contact_name || '',
      contact_role: system.contact_role || '',
      contact_email: system.contact_email || '',
      contact_phone: system.contact_phone || '',
      deal_stage: system.deal_stage || 'prospecting',
      revenue_potential: system.revenue_potential || '',
      notes: system.notes || '',
    });
    setEditingId(system.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all outreach history.`)) {
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
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Accounts</h1>
        <div className="flex gap-2">
          <Link
            href="/"
            className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Back to Dashboard
          </Link>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              + Add Account
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Account' : 'Add New Account'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Health System Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., Mayo Clinic"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contact Name</label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contact Role</label>
              <input
                type="text"
                value={formData.contact_role}
                onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., VP of Operations"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., john@mayoclinic.org"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contact Phone</label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Deal Stage</label>
              <select
                value={formData.deal_stage}
                onChange={(e) => setFormData({ ...formData, deal_stage: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              >
                {dealStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Revenue Potential</label>
              <input
                type="text"
                value={formData.revenue_potential}
                onChange={(e) => setFormData({ ...formData, revenue_potential: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., $500K - $1M"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                rows={3}
                placeholder="Any relevant notes about this account..."
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Account' : 'Add Account'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {healthSystems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xl text-gray-600 dark:text-gray-400">No accounts yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:underline mt-2"
          >
            Add your first health system
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-gray-600 dark:text-gray-400">
            {healthSystems.length} account{healthSystems.length !== 1 ? 's' : ''}
          </p>

          {healthSystems.map((system) => (
            <div
              key={system.id}
              className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-start"
            >
              <div>
                <h3 className="text-lg font-semibold">{system.name}</h3>
                {system.contact_name && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {system.contact_name}
                    {system.contact_role && ` - ${system.contact_role}`}
                  </p>
                )}
                <p className="text-sm text-gray-500 capitalize">{system.deal_stage}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(system)}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(system.id, system.name)}
                  className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
