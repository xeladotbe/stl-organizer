export type ComboOption =
  { type: 'existing'; id: number; name: string } | { type: 'create'; name: string };

/**
 * Builds the dropdown options for a typeahead combobox: existing suggestions matching `query`
 * (substring, case-insensitive; all of them if `query` is blank), plus a trailing "create new"
 * option whenever the typed text doesn't exactly match an existing one - so typing an unknown
 * name always offers to create it, without a separate "new" step.
 */
export function buildComboOptions(
  suggestions: { id: number; name: string }[],
  query: string
): ComboOption[] {
  const trimmed = query.trim();
  const filtered = trimmed
    ? suggestions.filter((s) => s.name.toLowerCase().includes(trimmed.toLowerCase()))
    : suggestions;

  const options: ComboOption[] = filtered.map((s) => ({
    type: 'existing',
    id: s.id,
    name: s.name
  }));

  const hasExactMatch = filtered.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (trimmed && !hasExactMatch) options.push({ type: 'create', name: trimmed });

  return options;
}
