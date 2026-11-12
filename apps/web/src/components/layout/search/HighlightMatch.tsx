import { normalizeSearchText } from '../../../lib/search';

export interface HighlightMatchProps {
  text: string;
  query: string;
}

export function HighlightMatch({ text, query }: HighlightMatchProps) {
  const needle = normalizeSearchText(query);
  if (!needle) return <>{text}</>;
  const positions: Array<{ start: number; end: number }> = [];
  let normalized = '';
  let offset = 0;
  for (const character of text) {
    const start = offset;
    offset += character.length;
    const normalizedCharacter = normalizeSearchText(character);
    normalized += normalizedCharacter;
    for (let index = 0; index < normalizedCharacter.length; index++)
      positions.push({ start, end: offset });
  }
  const found = normalized.indexOf(needle);
  if (found < 0 || !positions[found] || !positions[found + needle.length - 1])
    return <>{text}</>;
  const start = positions[found].start;
  const end = positions[found + needle.length - 1].end;
  return (
    <>
      {text.slice(0, start)}
      <strong className="font-bold text-ink">{text.slice(start, end)}</strong>
      {text.slice(end)}
    </>
  );
}
