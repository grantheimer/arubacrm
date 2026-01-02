import { describe, it, expect } from 'vitest';
import { PRODUCTS } from '../src/lib/supabase';
import { buildLlmPromptForContact, PRODUCT_EMAIL_CONTEXT, type EmailPromptContact } from '../src/lib/emailPrompt';

function makeContact(overrides: Partial<EmailPromptContact> = {}): EmailPromptContact {
  return {
    name: 'Dr. Ada Lovelace',
    role: 'CMIO',
    notes: 'High-priority cardiology service line leader with strong interest in data quality.',
    health_system: { name: 'Aruba Health System' },
    opportunity: { product: 'Core' },
    ...overrides,
  };
}

describe('buildLlmPromptForContact', () => {
  it('generates a well-formatted prompt with all key contact details', () => {
    const contact = makeContact();

    const prompt = buildLlmPromptForContact(contact);

    // Basic structure markers
    expect(prompt.startsWith('You are an expert B2B sales email writer.')).toBe(true);
    expect(prompt).toContain('Generate a concise, friendly, relatively formal outreach email.');

    // Contact details
    expect(prompt).toContain(`The email is to ${contact.name}, ${contact.role} at ${contact.health_system.name}.`);
    expect(prompt).toContain(`I want to introduce them for the first time to our ${contact.opportunity.product} solution.`);

    // Product context and internal notes
    const productKey = contact.opportunity.product as (typeof PRODUCTS)[number];
    expect(prompt).toContain(PRODUCT_EMAIL_CONTEXT[productKey]);
    expect(prompt).toContain(contact.notes!);

    // Formatting footer
    expect(prompt).toContain('First, generate a concise, professional subject line.');
    expect(prompt).toContain('Then generate the email body.');
    expect(prompt.trim().endsWith('<email body here>')).toBe(true);
    expect(prompt).toMatch(/Subject: <subject line>/);
  });

  it('handles missing or empty role and notes gracefully', () => {
    const contactNoRole: EmailPromptContact = makeContact({ role: null });
    const promptNoRole = buildLlmPromptForContact(contactNoRole);

    // No dangling comma when role is null
    expect(promptNoRole).toContain(`The email is to ${contactNoRole.name} at ${contactNoRole.health_system.name}.`);
    expect(promptNoRole).not.toContain(',  at');

    const contactEmptyRole: EmailPromptContact = makeContact({ role: '' });
    const promptEmptyRole = buildLlmPromptForContact(contactEmptyRole);
    expect(promptEmptyRole).toContain(`The email is to ${contactEmptyRole.name} at ${contactEmptyRole.health_system.name}.`);

    const contactNoNotes: EmailPromptContact = makeContact({ notes: null });
    const promptNoNotes = buildLlmPromptForContact(contactNoNotes);
    expect(promptNoNotes).toContain('No additional internal notes.');

    const contactWhitespaceNotes: EmailPromptContact = makeContact({ notes: '   \n  ' });
    const promptWhitespaceNotes = buildLlmPromptForContact(contactWhitespaceNotes);
    expect(promptWhitespaceNotes).toContain('No additional internal notes.');
  });

  it('incorporates PRODUCT_EMAIL_CONTEXT for each Product type', () => {
    for (const product of PRODUCTS) {
      const contact = makeContact({ opportunity: { product } });
      const prompt = buildLlmPromptForContact(contact);

      expect(prompt).toContain(PRODUCT_EMAIL_CONTEXT[product]);
      expect(prompt).toContain(`Here is detailed product and positioning information for ${product}.`);
    }
  });

  it('truncates internalNotes to 500 characters', () => {
    const longNotes = 'X'.repeat(600);
    const contact = makeContact({ notes: longNotes });

    const prompt = buildLlmPromptForContact(contact);

    const expected = longNotes.slice(0, 500);
    const notExpected = longNotes.slice(500);

    expect(prompt).toContain(expected);
    expect(prompt).not.toContain(notExpected);
  });
});

describe('PRODUCT_EMAIL_CONTEXT', () => {
  it('has entries for all defined Product types', () => {
    for (const product of PRODUCTS) {
      const entry = PRODUCT_EMAIL_CONTEXT[product];
      expect(entry).toBeDefined();
      expect(typeof entry).toBe('string');
      expect(entry.trim().length).toBeGreaterThan(0);
    }
  });
});
