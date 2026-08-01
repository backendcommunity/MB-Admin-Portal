import Papa from 'papaparse';

export type Attendee = { name: string; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAttendeeCsv(text: string): { rows: Attendee[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = [];
  const headers = parsed.meta.fields?.map((f) => f.toLowerCase()) ?? [];
  if (!headers.includes('name') || !headers.includes('email')) {
    errors.push('CSV must have "name" and "email" columns.');
    return { rows: [], errors };
  }

  const rows: Attendee[] = [];
  parsed.data.forEach((raw, i) => {
    const name = (raw.name ?? '').trim();
    const email = (raw.email ?? '').trim().toLowerCase();
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push(`Row ${i + 1}: invalid email "${raw.email}"`);
      return;
    }
    rows.push({ name, email });
  });

  return { rows, errors };
}
