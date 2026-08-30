export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function truncate(input: string, max: number): string {
  const text = collapseWhitespace(input);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function wordCount(input: string): number {
  const text = collapseWhitespace(input);
  return text ? text.split(' ').length : 0;
}

/** Very small stopword list; enough to keep topic extraction from returning "the". */
const STOPWORDS = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your'.split(
    ' ',
  ),
);

export function keywords(input: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const raw of collapseWhitespace(input.toLowerCase()).split(/[^a-z0-9'-]+/)) {
    const word = raw.replace(/^['-]+|['-]+$/g, '');
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase());
}
