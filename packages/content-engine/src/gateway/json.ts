/**
 * Models wrap JSON in prose and fences more often than they should. This recovers
 * the object without a second round-trip.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1];
  if (fenced) {
    const parsed = tryParse(fenced.trim());
    if (parsed !== undefined) return parsed;
  }

  // Fall back to the first balanced object or array in the response.
  for (const opener of ['{', '['] as const) {
    const start = trimmed.indexOf(opener);
    if (start === -1) continue;
    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i += 1) {
      const char = trimmed[i]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') inString = !inString;
      if (inString) continue;
      if (char === opener) depth += 1;
      else if (char === closer) {
        depth -= 1;
        if (depth === 0) {
          const parsed = tryParse(trimmed.slice(start, i + 1));
          if (parsed !== undefined) return parsed;
          break;
        }
      }
    }
  }

  throw new Error('The model response did not contain parseable JSON.');
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
