'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, Opportunity } from '@/lib/supabase';

type OpportunityWithCadence = Opportunity & { cadence_days: number; assignment_id: string };

type ContactEditModalProps = {
  contact: Contact & { opportunities: OpportunityWithCadence[] };
  onClose: () => void;
  onSave: () => void;
};

type FormData = {
  name: string;
  role: string;
  email: string;
  notes: string;
  cadences: Record<string, number>; // assignment_id -> cadence_days
};

export default function ContactEditModal({
  contact,
  onClose,
  onSave,
}: ContactEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(() => {
    const cadences: Record<string, number> = {};
    contact.opportunities.forEach((opp) => {
      cadences[opp.assignment_id] = opp.cadence_days;
    });
    return {
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      notes: contact.notes || '',
      cadences,
    };
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Update contact basic info
    const { error: contactError } = await supabase
      .from('contacts')
      .update({
        name: formData.name,
        role: formData.role || null,
        email: formData.email || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    if (contactError) {
      console.error('Error updating contact:', contactError);
      alert('Failed to update contact');
      setSaving(false);
      return;
    }

    // Update cadences for each opportunity assignment
    for (const opp of contact.opportunities) {
      const newCadence = formData.cadences[opp.assignment_id];
      if (newCadence !== opp.cadence_days) {
        const { error: cadenceError } = await supabase
          .from('contact_opportunities')
          .update({ cadence_days: newCadence })
          .eq('id', opp.assignment_id);

        if (cadenceError) {
          console.error('Error updating cadence:', cadenceError);
        }
      }
    }

    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Edit Contact</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <span className="text-xl text-gray-400">×</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g., CFO, Director of HIM"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="email@example.com"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                rows={3}
                placeholder="Internal notes about this contact..."
              />
            </div>

            {/* Cadence per Opportunity */}
            {contact.opportunities.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Outreach Cadence (days between contact)
                </label>
                <div className="space-y-2">
                  {contact.opportunities.map((opp) => (
                    <div
                      key={opp.assignment_id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <span className="text-sm">{opp.product}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={formData.cadences[opp.assignment_id]}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cadences: {
                                ...formData.cadences,
                                [opp.assignment_id]: parseInt(e.target.value) || 10,
                              },
                            })
                          }
                          className="w-16 px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-center"
                        />
                        <span className="text-sm text-gray-500">days</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with buttons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
