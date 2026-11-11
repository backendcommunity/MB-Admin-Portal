'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchTeam, fetchTeams, type TeamSummary } from '@/lib/api/teams';

/** Radix Select cannot hold "" as an item value. */
const NONE = '__none__';

type Props = {
  id?: string;
  /** The cohort's linked team id, or "" for none. */
  value: string;
  onChange: (teamId: string) => void;
};

/**
 * Picks the team a cohort's paid buyers join (academy `Cohort.teamId`).
 *
 * Loads lazily — on opening the list, on a search, or to label an already
 * linked team — so the form makes no request just by rendering. Archived
 * teams never appear: the admin list excludes them by default, and the API
 * refuses linking one.
 */
export function ProgrammeTeamPicker({ id, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  // Names fetched for linked teams that are not in the current results.
  const [fetchedNames, setFetchedNames] = useState<Record<string, string>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const knownName = teams.find((t) => t.id === value)?.name;
  const selectedName = value ? (knownName ?? fetchedNames[value] ?? '') : '';

  // Label the linked team even when it is not in the current results.
  useEffect(() => {
    if (!value || knownName || fetchedNames[value]) return;
    let cancelled = false;
    fetchTeam(value)
      .then((team) => {
        if (!cancelled) setFetchedNames((m) => ({ ...m, [value]: team.name }));
      })
      .catch(() => {
        if (!cancelled) setFetchedNames((m) => ({ ...m, [value]: 'Linked team (not found)' }));
      });
    return () => {
      cancelled = true;
    };
  }, [value, knownName, fetchedNames]);

  const load = async (q: string) => {
    setLoading(true);
    try {
      const page = await fetchTeams({ q, limit: 20 });
      setTeams(page.teams);
      setLoaded(true);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (next: string) => {
    setQuery(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(next.trim()), 300);
  };

  const showSelectedSeparately = Boolean(value) && !teams.some((t) => t.id === value);

  return (
    <div className="space-y-2">
      <Input
        aria-label="Search teams"
        placeholder="Search teams by name or owner…"
        value={query}
        onChange={(event) => onSearch(event.target.value)}
      />
      <Select
        value={value || NONE}
        onValueChange={(next) => onChange(next === NONE ? '' : next)}
        onOpenChange={(open) => {
          if (open && !loaded && !loading) load(query.trim());
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="No team">
            {value ? selectedName || 'Loading…' : 'No team'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No team</SelectItem>
          {showSelectedSeparately ? (
            <SelectItem value={value}>{selectedName || value}</SelectItem>
          ) : null}
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
              {team.comped ? ' · comped' : ''}
              {team.owner?.email ? ` · ${team.owner.email}` : ''}
            </SelectItem>
          ))}
          {loading ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading teams…</div>
          ) : null}
          {loaded && !loading && teams.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No teams match.</div>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
