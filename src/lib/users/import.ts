import Papa from 'papaparse';

/**
 * Parse a pasted or uploaded roster into rows the create-import endpoint
 * accepts: `{ name?, email }`.
 *
 * Same contract as `parseProjectImport` and `parseAttendeeCsv`: `errors`
 * block the import, `notes` are recoverable and imported anyway, and
 * `counts` say exactly what happened before anything is written.
 *
 * The server derives a name for any row that arrives without one and flags
 * that row — the name computed here (`deriveName`) is a PREVIEW ONLY. It is
 * never sent as a flag; the server's own derivation is what gets stored.
 * Likewise, this file cannot know which addresses already have accounts —
 * that split only exists after the import runs — so it is never guessed at
 * here.
 */

const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const KNOWN_COLUMNS = ['name', 'email'];

export type ImportRow = { name: string; email: string };

export type ImportCounts = {
  total: number;
  derived: number;
  duplicates: number;
  invalid: number;
};

export type ImportUserResult = {
  rows: ImportRow[];
  errors: string[];
  notes: string[];
  counts: ImportCounts;
  /**
   * Emails whose name was derived rather than read from the file — for the
   * preview to mark a row "derived" only. The server does its own derivation
   * (`deriveNameFromEmail`) and decides `nameWasDerived` itself; this list is
   * never sent to the API.
   */
  derivedEmails: string[];
};

/** "grace@x.io" -> "Grace". Preview-only — see the module note above. */
export function deriveName(email: string): string {
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[._+-]/).filter(Boolean)[0] ?? local;
  return first ? first[0].toUpperCase() + first.slice(1) : local;
}

function parseRecords(
  text: string,
  filename: string,
): { records: Record<string, unknown>[]; errors: string[]; notes: string[] } {
  const errors: string[] = [];
  const notes: string[] = [];
  const isJson = filename.toLowerCase().endsWith('.json') || text.trim().startsWith('[');

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      errors.push(`That is not valid JSON — ${(error as Error).message}`);
      return { records: [], errors, notes };
    }
    if (!Array.isArray(parsed)) {
      errors.push('The JSON file must be an array of rows.');
      return { records: [], errors, notes };
    }
    const records = parsed.filter(
      (row): row is Record<string, unknown> => !!row && typeof row === 'object',
    );
    return { records, errors, notes };
  }

  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return { records: parsed.data, errors, notes };
}

export function parseUserImport(text: string, filename: string): ImportUserResult {
  const empty = { total: 0, derived: 0, duplicates: 0, invalid: 0 };
  const { records, errors, notes } = parseRecords(text, filename);
  if (errors.length) return { rows: [], errors, notes, counts: empty, derivedEmails: [] };

  if (!records.length) {
    return {
      rows: [],
      errors: ['The file has no rows.'],
      notes,
      counts: empty,
      derivedEmails: [],
    };
  }

  const columns = Array.from(new Set(records.flatMap((row) => Object.keys(row))));
  const hasEmailColumn = columns.some((key) => key.toLowerCase() === 'email');
  if (!hasEmailColumn) {
    return {
      rows: [],
      errors: ['No "email" column was found.'],
      notes,
      counts: empty,
      derivedEmails: [],
    };
  }

  const strayColumns = columns.filter((key) => !KNOWN_COLUMNS.includes(key.toLowerCase()));
  if (strayColumns.length) {
    notes.push(`Ignored column(s) not used by the import: ${strayColumns.join(', ')}.`);
  }

  const rows: ImportRow[] = [];
  const derivedEmails: string[] = [];
  const seen = new Set<string>();
  let derived = 0;
  let duplicates = 0;
  let invalid = 0;

  records.forEach((raw, index) => {
    const rowNumber = index + 1;
    const emailKey = Object.keys(raw).find((key) => key.toLowerCase() === 'email');
    const nameKey = Object.keys(raw).find((key) => key.toLowerCase() === 'name');
    const rawEmail = emailKey ? raw[emailKey] : undefined;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const rawName = nameKey ? raw[nameKey] : undefined;
    const name = typeof rawName === 'string' ? rawName.trim() : '';

    if (!email) {
      // A row with neither a name nor an email is just a blank line.
      if (name) notes.push(`Row ${rowNumber}: "${name}" has no email — skipped.`);
      return;
    }
    if (!EMAIL.test(email)) {
      invalid += 1;
      notes.push(`Row ${rowNumber}: "${rawEmail}" is not a valid email — skipped.`);
      return;
    }
    if (seen.has(email)) {
      duplicates += 1;
      notes.push(`Row ${rowNumber}: "${email}" is a duplicate in this file — skipped.`);
      return;
    }
    seen.add(email);

    let resolvedName = name;
    if (!resolvedName) {
      resolvedName = deriveName(email);
      derived += 1;
      derivedEmails.push(email);
      notes.push(`Row ${rowNumber}: no name given for "${email}" — using "${resolvedName}".`);
    }

    rows.push({ name: resolvedName, email });
  });

  return {
    rows,
    errors,
    notes,
    counts: { total: rows.length, derived, duplicates, invalid },
    derivedEmails,
  };
}
