/** Minimal robots.txt parser: the directives that matter for a polite crawler. */
export interface RobotsRules {
  sitemaps: string[];
  disallow: string[];
  allow: string[];
  crawlDelaySeconds: number | null;
}

export function parseRobots(body: string, userAgent = 'morrowlanebot'): RobotsRules {
  const rules: RobotsRules = { sitemaps: [], disallow: [], allow: [], crawlDelaySeconds: null };
  // Groups are keyed by user-agent; we merge the wildcard group with ours.
  let applies = false;
  let sawAnyGroup = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]!.trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;

    if (field === 'sitemap') {
      rules.sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      applies = agent === '*' || agent === userAgent.toLowerCase();
      sawAnyGroup = true;
      continue;
    }
    if (!sawAnyGroup || !applies) continue;

    if (field === 'disallow') rules.disallow.push(value);
    else if (field === 'allow') rules.allow.push(value);
    else if (field === 'crawl-delay') {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds)) rules.crawlDelaySeconds = seconds;
    }
  }
  return rules;
}

function matches(pattern: string, path: string): boolean {
  if (pattern === '') return false;
  // robots.txt wildcards: * matches any run, $ anchors the end.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}${anchored ? '$' : ''}`);
  return regex.test(path);
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  // Longest matching rule wins; Allow beats Disallow at equal length.
  let bestDisallow = -1;
  let bestAllow = -1;
  for (const pattern of rules.disallow) {
    if (matches(pattern, path)) bestDisallow = Math.max(bestDisallow, pattern.length);
  }
  for (const pattern of rules.allow) {
    if (matches(pattern, path)) bestAllow = Math.max(bestAllow, pattern.length);
  }
  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}
