import type { BrandBrain } from '@morrowlane/shared';
import { truncate } from '@morrowlane/shared';

/**
 * The Brand Brain rendered the way the reference does: a node graph on a dotted
 * canvas. Everything drawn is real data from the brain — products and audience feed
 * in from the left, voice from above, rules from below, and the connected channels
 * fan out to the right, because that is the actual direction knowledge flows.
 */

interface Node {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  side: 'left' | 'right' | 'top' | 'bottom';
  accent?: boolean;
}

const W = 1040;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const HUB_W = 190;
const HUB_H = 74;

export function BrandGraph({ brain, channels }: { brain: BrandBrain; channels: string[] }) {
  const nodes: Node[] = [];

  const products = brain.products.slice(0, 3);
  const leftCount = products.length + 1;
  products.forEach((product, index) => {
    nodes.push({
      x: 42,
      y: yFor(index, leftCount),
      w: 232,
      h: 62,
      title: product.name,
      lines: [product.priceHint ?? truncate(product.description, 34)],
      side: 'left',
    });
  });
  nodes.push({
    x: 42,
    y: yFor(products.length, leftCount),
    w: 232,
    h: 62,
    title: 'Audience',
    lines: [truncate(brain.identity.audience.join(', ') || 'Not identified yet', 36)],
    side: 'left',
  });

  nodes.push({
    x: CX - 116,
    y: 26,
    w: 232,
    h: 56,
    title: 'Voice',
    lines: [truncate(brain.voice.traits.join(' · ') || 'unset', 40)],
    side: 'top',
  });

  nodes.push({
    x: CX - 246,
    y: H - 84,
    w: 232,
    h: 56,
    title: 'Brand rules',
    lines: [
      `${brain.rules.prohibitedClaims.length + brain.rules.prohibitedTerminology.length} guardrails · ${brain.rules.preferredCtas.length} CTAs`,
    ],
    side: 'bottom',
  });
  nodes.push({
    x: CX + 14,
    y: H - 84,
    w: 232,
    h: 56,
    title: 'Knowledge',
    lines: [`${brain.sourcePageCount} pages · ${brain.faqs.length} FAQs · ${brain.testimonials.length} quotes`],
    side: 'bottom',
  });

  const rightItems =
    channels.length > 0
      ? channels.slice(0, 4).map((channel) => ({ title: channelLabel(channel), line: 'publishing' }))
      : [{ title: 'No channels yet', line: 'connect accounts to publish' }];
  rightItems.forEach((item, index) => {
    nodes.push({
      x: W - 274,
      y: yFor(index, rightItems.length),
      w: 232,
      h: 62,
      title: item.title,
      lines: [item.line],
      side: 'right',
      accent: true,
    });
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface bg-dotgrid shadow-card [background-size:18px_18px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[760px]" role="img" aria-label="Brand Brain graph">
        {nodes.map((node, index) => (
          <path key={`edge-${index}`} d={edgePath(node)} fill="none" stroke="#c3cfc9" strokeWidth="1.3" className="anim-edge" />
        ))}

        {nodes.map((node, index) => (
          <g key={`node-${index}`}>
            <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="10" fill="#ffffff" stroke="#e2e8e5" />
            <rect x={node.x} y={node.y} width="3.5" height={node.h} rx="1.75" fill={node.accent ? '#0d9488' : '#d5ded9'} />
            <text x={node.x + 14} y={node.y + 24} fontSize="12.5" fontWeight="600" fill="#101815">
              {truncate(node.title, 28)}
            </text>
            {node.lines.map((line, lineIndex) => (
              <text key={lineIndex} x={node.x + 14} y={node.y + 42 + lineIndex * 14} fontSize="11" fill="#6b7a74">
                {line}
              </text>
            ))}
          </g>
        ))}

        <g>
          <rect
            x={CX - HUB_W / 2}
            y={CY - HUB_H / 2}
            width={HUB_W}
            height={HUB_H}
            rx="14"
            fill="#0c1512"
            stroke="#0d9488"
            strokeWidth="1.5"
          />
          <text x={CX} y={CY - 6} fontSize="14" fontWeight="600" fill="#e8f1ed" textAnchor="middle">
            {truncate(brain.identity.companyName, 22)}
          </text>
          <text x={CX} y={CY + 14} fontSize="11" fill="#0d9488" textAnchor="middle">
            Brand Brain · v{brain.version}
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Vertical slot for the nth of n side nodes, spread around the hub. */
function yFor(index: number, count: number): number {
  const usable = H - 160;
  const step = count > 1 ? usable / (count - 1) : 0;
  return count > 1 ? 60 + index * step : CY - 31;
}

/** A gentle bezier from a node's inner edge to the hub. */
function edgePath(node: Node): string {
  let fromX: number;
  let fromY: number;
  let toX: number;
  let toY: number;

  if (node.side === 'left' || node.side === 'right') {
    fromX = node.side === 'left' ? node.x + node.w : node.x;
    fromY = node.y + node.h / 2;
    toX = node.side === 'left' ? CX - HUB_W / 2 : CX + HUB_W / 2;
    toY = CY;
    const midX = (fromX + toX) / 2;
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  }

  fromX = node.x + node.w / 2;
  fromY = node.side === 'top' ? node.y + node.h : node.y;
  toX = CX;
  toY = node.side === 'top' ? CY - HUB_H / 2 : CY + HUB_H / 2;
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

function channelLabel(channel: string): string {
  return channel
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}
