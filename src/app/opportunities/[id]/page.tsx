'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, HealthSystem, Opportunity, Contact, OutreachLog, ContactOpportunity, OPPORTUNITY_STATUSES, OpportunityStatus } from '@/lib/supabase';
import Link from 'next/link';
import ContactHistoryModal from '@/components/ContactHistoryModal';

type ContactFormData = {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  cadence_days: number;
};

const emptyContactForm: ContactFormData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
  cadence_days: 10,
};

type ContactWithOutreach = Contact & {
  assignment_id: string; // contact_opportunities.id
  cadence_days: number; // from junction table
  last_contact_date: string | null;
  last_contact_method: string | null;
  days_since_contact: number | null;
};

type OutreachSelection = {
  emailed: boolean;
  called: boolean;
  notes: string;
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [account, setAccount] = useState<HealthSystem | null>(null);
  const [contacts, setContacts] = useState<ContactWithOutreach[]>([]);
  const [unassignedContacts, setUnassignedContacts] = useState<Contact[]>([]); // Account contacts not on this opportunity
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyContactForm);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Selection state for outreach logging
  const [selections, setSelections] = useState<Record<string, OutreachSelection>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // History modal state
  const [historyContactId, setHistoryContactId] = useState<string | null>(null);
  const [historyContactName, setHistoryContactName] = useState<string>('');

  const fetchData = async () => {
    const { data: oppData, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (oppError) {
      console.error('Error fetching opportunity:', oppError);
      setLoading(false);
      return;
    }

    setOpportunity(oppData);

    const { data: accountData } = await supabase
      .from('health_systems')
      .select('*')
      .eq('id', oppData.health_system_id)
      .single();

    setAccount(accountData);

    // Get contact assignments for this opportunity via junction table
    const { data: assignmentsData } = await supabase
      .from('contact_opportunities')
      .select('*, contacts(*)')
      .eq('opportunity_id', opportunityId);

    // Get outreach logs for this opportunity
    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('contact_date', { ascending: false });

    // Find last outreach for each contact on this opportunity
    const lastOutreach: Record<string, { date: string; method: string }> = {};
    (logsData || []).forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    // Build enriched contacts from assignments
    const enrichedContacts: ContactWithOutreach[] = (assignmentsData || [])
      .filter((a: ContactOpportunity & { contacts: Contact }) => a.contacts)
      .map((assignment: ContactOpportunity & { contacts: Contact }) => {
        const contact = assignment.contacts;
        const last = lastOutreach[contact.id];
        const daysSince = last
          ? Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          ...contact,
          assignment_id: assignment.id,
          cadence_days: assignment.cadence_days,
          last_contact_date: last?.date || null,
          last_contact_method: last?.method || null,
          days_since_contact: daysSince,
        };
      })
      .sort((a: ContactWithOutreach, b: ContactWithOutreach) => a.name.localeCompare(b.name));

    setContacts(enrichedContacts);

    // Get all contacts for this account to find unassigned ones
    const { data: allAccountContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('health_system_id', oppData.health_system_id)
      .order('name');

    // Filter to contacts not assigned to this opportunity
    const assignedContactIds = new Set(enrichedContacts.map((c: ContactWithOutreach) => c.id));
    const unassigned = (allAccountContacts || []).filter(
      (c: Contact) => !assignedContactIds.has(c.id)
    );
    setUnassignedContacts(unassigned);

    setLoading(false);
  };

  useEffect(() => {
    if (opportunityId) {
      fetchData();
    }
  }, [opportunityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      // Editing existing contact - update contact details and junction cadence separately
      const contact = contacts.find(c => c.id === editingId);

      // Update contact basic info
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          name: formData.name,
          role: formData.role || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (contactError) {
        console.error('Error updating contact:', contactError);
        alert('Failed to update contact: ' + contactError.message);
      }

      // Update cadence in junction table
      if (contact?.assignment_id) {
        const { error: cadenceError } = await supabase
          .from('contact_opportunities')
          .update({ cadence_days: formData.cadence_days })
          .eq('id', contact.assignment_id);

        if (cadenceError) {
          console.error('Error updating cadence:', cadenceError);
        }
      }
    } else {
      // Creating new contact - insert contact, then create junction row
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          name: formData.name,
          role: formData.role || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          health_system_id: opportunity?.health_system_id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating contact:', insertError);
        alert('Failed to create contact: ' + insertError.message);
      } else if (newContact) {
        // Create assignment in junction table
        const { error: assignError } = await supabase
          .from('contact_opportunities')
          .insert({
            contact_id: newContact.id,
            opportunity_id: opportunityId,
            cadence_days: formData.cadence_days,
          });

        if (assignError) {
          console.error('Error assigning contact:', assignError);
          alert('Contact created but failed to assign to opportunity');
        }
      }
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyContactForm);
    await fetchData();
  };

  const handleEdit = (contact: ContactWithOutreach) => {
    setFormData({
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      cadence_days: contact.cadence_days,
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  // Remove contact from this opportunity (keeps contact at account level)
  const handleRemoveFromOpportunity = async (contact: ContactWithOutreach) => {
    if (!confirm(`Remove "${contact.name}" from this opportunity? The contact will remain at the account level.`)) {
      return;
    }

    const { error } = await supabase
      .from('contact_opportunities')
      .delete()
      .eq('id', contact.assignment_id);

    if (error) {
      console.error('Error removing contact from opportunity:', error);
      alert('Failed to remove contact');
    } else {
      await fetchData();
    }
  };

  // Permanently delete contact (and all their assignments/history)
  const handleDeleteContact = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This removes them from ALL opportunities and deletes their outreach history.`)) {
      return;
    }

    const { error } = await supabase.from('contacts').delete().eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    } else {
      await fetchData();
    }
  };

  // Assign an existing account contact to this opportunity
  const handleAssignContact = async (contactId: string, cadenceDays: number = 10) => {
    const { error } = await supabase
      .from('contact_opportunities')
      .insert({
        contact_id: contactId,
        opportunity_id: opportunityId,
        cadence_days: cadenceDays,
      });

    if (error) {
      console.error('Error assigning contact:', error);
      alert('Failed to assign contact to opportunity');
    } else {
      setShowAssignPicker(false);
      await fetchData();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyContactForm);
  };

  const handleStatusChange = async (newStatus: OpportunityStatus) => {
    if (!opportunity) return;
    setUpdatingStatus(true);

    const { error } = await supabase
      .from('opportunities')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunity.id);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } else {
      setOpportunity({ ...opportunity, status: newStatus });
    }
    setUpdatingStatus(false);
  };

  // Outreach logging functions - use assignment_id as key
  const toggleSelection = (assignmentId: string, field: 'emailed' | 'called') => {
    setSelections(prev => ({
      ...prev,
      [assignmentId]: {
        emailed: prev[assignmentId]?.emailed || false,
        called: prev[assignmentId]?.called || false,
        notes: prev[assignmentId]?.notes || '',
        [field]: !prev[assignmentId]?.[field],
      },
    }));
  };

  const updateNotes = (assignmentId: string, notes: string) => {
    setSelections(prev => ({
      ...prev,
      [assignmentId]: {
        emailed: prev[assignmentId]?.emailed || false,
        called: prev[assignmentId]?.called || false,
        notes,
      },
    }));
  };

  const handleLogSubmit = async (contact: ContactWithOutreach) => {
    const key = contact.assignment_id;
    const selection = selections[key];
    if (!selection?.emailed && !selection?.called) {
      alert('Please select at least one action (Emailed or Called)');
      return;
    }

    setSubmittingId(key);

    const logs: { contact_id: string; opportunity_id: string; contact_method: string; notes: string | null }[] = [];

    if (selection.emailed) {
      logs.push({
        contact_id: contact.id,
        opportunity_id: opportunityId,
        contact_method: 'email',
        notes: selection.notes || null,
      });
    }

    if (selection.called) {
      logs.push({
        contact_id: contact.id,
        opportunity_id: opportunityId,
        contact_method: 'call',
        notes: selection.notes || null,
      });
    }

    const { error } = await supabase.from('outreach_logs').insert(logs);

    if (error) {
      console.error('Error logging outreach:', error);
      alert('Failed to log outreach');
    } else {
      setSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[key];
        return newSelections;
      });
      await fetchData();
    }

    setSubmittingId(null);
  };

  const openHistory = (contactId: string, contactName: string) => {
    setHistoryContactId(contactId);
    setHistoryContactName(contactName);
  };

  const closeHistory = () => {
    setHistoryContactId(null);
    setHistoryContactName('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!opportunity || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Opportunity not found</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to {account.name}
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
            {opportunity.product}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-2">
          <p className="text-gray-500 text-sm">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} for this opportunity
          </p>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={opportunity.status || 'prospect'}
              onChange={(e) => handleStatusChange(e.target.value as OpportunityStatus)}
              disabled={updatingStatus}
              className={`text-sm px-3 py-2 sm:px-2 sm:py-1 rounded-lg border transition ${
                opportunity.status === 'prospect'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300'
                  : opportunity.status === 'active'
                  ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
              } ${updatingStatus ? 'opacity-50' : ''}`}
            >
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {opportunity.status !== 'prospect' && (
          <p className="text-xs text-gray-400 mt-2">
            ℹ️ This opportunity is marked as &quot;{opportunity.status}&quot; and won&apos;t appear in the daily to-do list.
          </p>
        )}
      </div>

      {/* Add/Assign Contact Buttons */}
      {!showForm && !showAssignPicker && (
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            + New Contact
          </button>
          {unassignedContacts.length > 0 && (
            <button
              onClick={() => setShowAssignPicker(true)}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition"
            >
              Assign Existing ({unassignedContacts.length})
            </button>
          )}
        </div>
      )}

      {/* Assign Existing Contact Picker */}
      {showAssignPicker && (
        <div className="mb-6 p-5 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Assign Existing Contact</h2>
          <p className="text-sm text-gray-500 mb-4">
            Select a contact from this account to assign to this opportunity.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unassignedContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
              >
                <div>
                  <p className="font-medium">{contact.name}</p>
                  {contact.role && <p className="text-sm text-gray-500">{contact.role}</p>}
                </div>
                <button
                  onClick={() => handleAssignContact(contact.id)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAssignPicker(false)}
            className="mt-4 px-4 py-2 border text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Contact Form */}
      {showForm && (
        <div className="mb-6 p-5 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Contact' : 'New Contact'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role / Title</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., VP of Operations"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., john@hospital.org"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cadence (days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.cadence_days}
                  onChange={(e) => setFormData({ ...formData, cadence_days: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">Days between outreach touches</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Any notes about this contact..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Contact'}
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

      {/* Contacts List */}
      {contacts.length === 0 && !showForm && !showAssignPicker ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No contacts for this opportunity yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:underline text-sm"
          >
            Add your first contact
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => {
            const assignmentId = contact.assignment_id;
            const selection = selections[assignmentId] || { emailed: false, called: false, notes: '' };
            const hasSelection = selection.emailed || selection.called;

            return (
              <div
                key={assignmentId}
                className="border border-gray-700 rounded-xl p-4 sm:p-3 bg-gray-800 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <button
                      onClick={() => openHistory(contact.id, contact.name)}
                      className="font-semibold text-base sm:text-lg text-white hover:underline text-left inline-flex items-center gap-1.5"
                    >
                      {contact.name}
                      <span className="text-gray-400 text-sm">↗</span>
                    </button>
                    {contact.role && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{contact.role}</p>
                    )}
                    {(contact.email || contact.phone) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {contact.email}{contact.email && contact.phone && ' · '}{contact.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        contact.days_since_contact === null
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : contact.days_since_contact >= contact.cadence_days
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : contact.days_since_contact >= contact.cadence_days * 0.7
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}
                    >
                      {contact.days_since_contact === null
                        ? 'Never contacted'
                        : contact.days_since_contact === 0
                        ? 'Today'
                        : `${contact.days_since_contact}d ago`}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{contact.cadence_days}d cadence</p>
                  </div>
                </div>

                {/* Toggle Buttons */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => toggleSelection(assignmentId, 'emailed')}
                    className={`flex-1 sm:flex-none min-w-[100px] px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                      selection.emailed
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {selection.emailed && <span>✓</span>} Emailed
                  </button>
                  <button
                    onClick={() => toggleSelection(assignmentId, 'called')}
                    className={`flex-1 sm:flex-none min-w-[100px] px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                      selection.called
                        ? 'bg-green-600 text-white'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {selection.called && <span>✓</span>} Called
                  </button>
                  <div className="hidden sm:block flex-1" />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemoveFromOpportunity(contact)}
                      className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 active:bg-orange-100 transition"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id, contact.name)}
                      className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={selection.notes}
                  onChange={(e) => updateNotes(assignmentId, e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 mb-3"
                />

                {/* Submit Button */}
                <button
                  onClick={() => handleLogSubmit(contact)}
                  disabled={submittingId === assignmentId || !hasSelection}
                  className={`w-full py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                    hasSelection
                      ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {submittingId === assignmentId ? (
                    'Saving...'
                  ) : (
                    <>
                      <span>✓</span> Log Outreach
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* History Modal */}
      {historyContactId && (
        <ContactHistoryModal
          contactId={historyContactId}
          contactName={historyContactName}
          opportunityId={opportunityId}
          onClose={closeHistory}
          onDelete={fetchData}
        />
      )}
    </div>
  );
}
