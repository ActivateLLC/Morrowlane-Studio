import type { ImageRenderRequest } from './brief.js';
import type { ImageRenderer, RenderedImage } from './renderer.js';

/**
 * The zero-config renderer: composes a branded typographic card as SVG. Not a
 * diffusion model — a designed layout in the brand's own colour, so quote graphics,
 * educational cards and carousel slides are genuinely usable with no API key, and
 * tests can assert on exact output. Configure HF_TOKEN (or ComfyUI) for photographic
 * creative.
 */
export function createSvgRenderer(): ImageRenderer {
  return {
    name: 'svg',
    available: true,
    async render(request) {
      return composeSvgCard(request);
    },
  };
}

export function composeSvgCard(request: ImageRenderRequest): RenderedImage {
  const { width, height } = request;
  const brand = request.brandColor ?? '#0d9488';
  const ink = '#0c1512';
  const paper = '#f5f7f6';

  // A typographic card sets the slide's actual words. The prompt (visual direction)
  // is for diffusion renderers, not for typesetting.
  const headline = request.heading ?? request.message.split(/(?<=[.!?])\s+/)[0] ?? '';
  const support = request.heading
    ? request.message
    : request.message.slice(headline.length).trim();

  const margin = Math.round(width * 0.09);
  const headSize = Math.round(width / 12);
  const supportSize = Math.round(width / 26);
  const headLines = wrapText(cleanText(headline ?? ''), Math.floor((width - margin * 2) / (headSize * 0.52)), 5);
  const supportLines = wrapText(cleanText(support), Math.floor((width - margin * 2) / (supportSize * 0.52)), 3);

  const headStartY = Math.round(height * 0.34);
  const lineHeight = Math.round(headSize * 1.18);
  const supportStartY = headStartY + headLines.length * lineHeight + Math.round(supportSize * 1.6);

  const slideBadge =
    request.slideIndex !== null
      ? `<g>
          <circle cx="${width - margin}" cy="${margin}" r="${Math.round(width * 0.035)}" fill="${brand}"/>
          <text x="${width - margin}" y="${margin + Math.round(width * 0.013)}" font-size="${Math.round(width * 0.035)}"
                font-weight="700" fill="#ffffff" text-anchor="middle" font-family="${FONT}">${request.slideIndex + 1}</text>
        </g>`
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${paper}"/>
  <rect width="${width}" height="${Math.round(height * 0.012)}" fill="${brand}"/>
  <g opacity="0.5">${dotGrid(width, height, margin)}</g>
  <rect x="${margin}" y="${headStartY - lineHeight}" width="${Math.round(width * 0.09)}" height="${Math.round(height * 0.008)}" fill="${brand}"/>
  ${headLines
    .map(
      (line, index) =>
        `<text x="${margin}" y="${headStartY + index * lineHeight}" font-size="${headSize}" font-weight="700"
           fill="${ink}" font-family="${FONT}" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n  ')}
  ${supportLines
    .map(
      (line, index) =>
        `<text x="${margin}" y="${supportStartY + index * Math.round(supportSize * 1.5)}" font-size="${supportSize}"
           fill="#3d4a45" font-family="${FONT}">${line}</text>`,
    )
    .join('\n  ')}
  <g>
    <rect x="${margin}" y="${height - margin - Math.round(width * 0.055)}" width="${Math.round(width * 0.055)}"
          height="${Math.round(width * 0.055)}" rx="${Math.round(width * 0.014)}" fill="${brand}"/>
    <text x="${margin + Math.round(width * 0.0275)}" y="${height - margin - Math.round(width * 0.0165)}"
          font-size="${Math.round(width * 0.034)}" font-weight="800" fill="#ffffff" text-anchor="middle"
          font-family="${FONT}">M</text>
  </g>
  ${slideBadge}
</svg>`;

  return {
    bytes: new TextEncoder().encode(svg),
    contentType: 'image/svg+xml',
    width,
    height,
  };
}

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function cleanText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
}

/** Greedy word wrap onto at most maxLines, ellipsising the last line if needed. */
function wrapText(text: string, charsPerLine: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]!.slice(0, Math.max(1, charsPerLine - 1)).trimEnd()}…`;
  }
  return lines;
}

function dotGrid(width: number, height: number, margin: number): string {
  const step = Math.round(width / 18);
  const dots: string[] = [];
  for (let x = margin; x < width - margin; x += step) {
    dots.push(`<circle cx="${x}" cy="${height - Math.round(margin / 2)}" r="1.5" fill="#c3cfc9"/>`);
  }
  return dots.join('');
}
