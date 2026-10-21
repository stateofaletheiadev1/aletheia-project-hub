'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';

/**
 * Proposed national map of the Sovereign Covenant State of Aletheia.
 *
 * Geometry is generated from a pointy-top hexagonal grid in plan units
 * from Covenant Square (0, 0), at 10 SVG units per plan unit. One plan unit
 * is KM_PER_UNIT km, which makes the land 6,500 km², the planned national
 * territory; the km grid and scale bar use that measure. The
 * landmass is the set of grid cells inside a few overlapping lobes; each
 * cell belongs to the state whose sector contains it. Coastline and state
 * boundaries are the cell edges where the land or the state changes, which
 * gives the hexagonal outline of the national plan.
 */

export type RegionId = 'antioch' | 'barbara' | 'augustine' | 'benedict' | 'brendan';
type StateId = Exclude<RegionId, 'antioch'>;

const KM = 10;
/** Kilometres per plan unit: the 290 land cells and three islets (1,823 square units) measure 6,500 km². */
const KM_PER_UNIT = 1.888;
/** Plan units spanned by `km` kilometres. */
const units = (km: number) => km / KM_PER_UNIT;
/** Grid cell size (centre to vertex), plan units. */
const CELL = 1.55;
/** Federal District hexagon radius (centre to vertex), plan units. */
const FD_RADIUS = 7.5;
/** The Covenant Ring inside the Federal District, plan units. */
const RING_RADIUS = 3.6;

/** fill: resting; active: hovered or focused; muted: while another region is highlighted (opaque, so nothing beneath shows through). */
export const REGION_COLORS: Record<RegionId, { fill: string; active: string; muted: string; ink: string }> = {
  antioch: { fill: '#EAD7AE', active: '#E2C88E', muted: '#F1E7D2', ink: '#701824' },
  barbara: { fill: '#D9E2EF', active: '#C3D2E8', muted: '#E6EBF2', ink: '#15294A' },
  augustine: { fill: '#D7E7DA', active: '#BFDCC5', muted: '#E5EEE7', ink: '#1F5B3A' },
  benedict: { fill: '#EDE7C6', active: '#E3DAA6', muted: '#F2EFDC', ink: '#6B5A12' },
  brendan: { fill: '#F0D9DE', active: '#E7C1CA', muted: '#F4E7EA', ink: '#701824' },
};

const SEA = '#C9D9E3';
const SHELF_OUTER = '#D7E3EA';
const SHELF_INNER = '#E3ECF1';
const COAST = '#15294A';

/** Land lobes in plan units: centre and radii. A cell is land when its centre lies in any lobe. */
const LOBES = [
  { x: 0, y: 0, rx: 14, ry: 14 },
  { x: -2, y: -12, rx: 15, ry: 9.5 }, // St. Barbara, north
  { x: 20, y: -6, rx: 12.5, ry: 6.5 }, // St. Brendan, north-east arm
  { x: 17, y: 8, rx: 8.5, ry: 9 }, // St. Brendan, east
  { x: 3, y: 15, rx: 17, ry: 8.5 }, // Benedict, south
  { x: -18, y: 3, rx: 10.5, ry: 9 }, // Augustine, west
];

/** State sectors by bearing from Covenant Square (degrees, 0 = east, 90 = south). */
function stateAt(x: number, y: number): StateId {
  const a = (Math.atan2(y, x) * 180) / Math.PI;
  if (a >= -35 && a < 40) return 'brendan';
  if (a >= 40 && a < 135) return 'benedict';
  if (a >= -158 && a < -35) return 'barbara';
  return 'augustine';
}

const round = (n: number) => Math.round(n * 100) / 100;

function hexPoints(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
  });
}

const toPath = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x},${y}`).join('L')}Z`;

interface Cell { x: number; y: number; state: StateId }

function buildGeometry() {
  const cells: Cell[] = [];
  const w = Math.sqrt(3) * CELL;
  for (let r = -20; r <= 20; r++) {
    for (let q = -30; q <= 30; q++) {
      const x = w * (q + r / 2);
      const y = 1.5 * CELL * r;
      const land = LOBES.some((l) => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 <= 1);
      if (land) cells.push({ x, y, state: stateAt(x, y) });
    }
  }

  // Index every cell edge by its (rounded) endpoints to find coast and borders.
  const edges = new Map<string, { a: [number, number]; b: [number, number]; states: StateId[] }>();
  const cellPaths: Record<StateId, string[]> = { barbara: [], augustine: [], benedict: [], brendan: [] };
  for (const c of cells) {
    const pts = hexPoints(c.x * KM, c.y * KM, CELL * KM);
    cellPaths[c.state].push(toPath(pts));
    for (let i = 0; i < 6; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 6];
      const key = [a, b].map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).sort().join('|');
      const e = edges.get(key);
      if (e) e.states.push(c.state);
      else edges.set(key, { a, b, states: [c.state] });
    }
  }

  let coast = '';
  let borders = '';
  for (const { a, b, states } of edges.values()) {
    const seg = `M${a[0]},${a[1]}L${b[0]},${b[1]}`;
    if (states.length === 1) coast += seg;
    else if (states[0] !== states[1]) borders += seg;
  }

  return {
    cells: Object.fromEntries(Object.entries(cellPaths).map(([k, v]) => [k, v.join('')])) as Record<StateId, string>,
    land: Object.values(cellPaths).flat().join(''),
    coast,
    borders,
  };
}

const GEO = buildGeometry();

const FD_HEX = hexPoints(0, 0, FD_RADIUS * KM);
const RING_HEX = hexPoints(0, 0, RING_RADIUS * KM);

/** Positions in plan units from Covenant Square (x east, y south). */
const CAPITALS: { name: string; x: number; y: number; dx: number; dy: number; position: 'start' | 'end' | 'middle' }[] = [
  { name: 'Port Michael', x: -3, y: -19.6, dx: 1.2, dy: -0.9, position: 'start' },
  { name: 'Port Nicholas', x: 30.4, y: -6.6, dx: -0.6, dy: -1.7, position: 'end' },
  { name: 'San José', x: 0.4, y: 20.6, dx: 1.3, dy: 0.45, position: 'start' },
  { name: 'Port Luke', x: -26.2, y: 2.4, dx: 0, dy: 2.9, position: 'middle' },
];

const TOWNS: { name: string; x: number; y: number; position: 'start' | 'end' }[] = [
  { name: 'Arda Field', x: -11, y: -13, position: 'start' },
  { name: 'Hermon Station', x: 4, y: -14.5, position: 'start' },
  { name: 'Nazareth Heights', x: -13, y: -4.3, position: 'end' },
  { name: 'Galilee', x: -13.6, y: 7, position: 'start' },
  { name: 'Ardfert', x: 12, y: -0.4, position: 'start' },
  { name: 'Clonfert', x: 17, y: 9.5, position: 'start' },
  { name: 'Nursia', x: -10, y: 15, position: 'start' },
  { name: 'Monte Cassino', x: 11, y: 16.5, position: 'start' },
];

const STATE_LABELS: { id: StateId; name: string; code: string; x: number; y: number }[] = [
  { id: 'barbara', name: 'St. Barbara State', code: '20000', x: 5.4, y: -9.6 },
  { id: 'augustine', name: 'Augustine State', code: '30000', x: -17.5, y: -1.9 },
  { id: 'benedict', name: 'Benedict State', code: '40000', x: 6.6, y: 12.6 },
  { id: 'brendan', name: 'St. Brendan State', code: '50000', x: 17.2, y: 3.6 },
];

const WATERS: { name: string; x: number; y: number }[] = [
  { name: 'Covenant Sea', x: -25, y: -21.5 },
  { name: 'St. Brendan Sound', x: 26, y: -18 },
  { name: 'Western Approaches', x: -30.5, y: -8.5 },
  { name: 'Benedict Deep', x: 25, y: 21.2 },
];

const ISLANDS: { name: string; x: number; y: number; r: number; dx: number; dy: number; position: 'start' | 'end' | 'middle' }[] = [
  { name: 'Barbara Key', x: 6, y: -25.6, r: 1.25, dx: 0, dy: 2.8, position: 'middle' },
  { name: 'Covenant Reef', x: 33.2, y: 4, r: 0.75, dx: 0, dy: 2.3, position: 'middle' },
  { name: 'Columba Isle', x: -30.4, y: 11.6, r: 1.45, dx: 0, dy: 3.1, position: 'middle' },
];

const RESERVOIR = { x: -20.5, y: 6.4, r: 1.6 };

// Map frame, plan units.
const VIEW = { x: -36, y: -29, w: 74, h: 55 };

const k = (n: number) => round(n * KM);

/** Long water names go on two lines, breaking before the last word ("St. Brendan / Sound"). */
function waterLines(name: string): string[] {
  const i = name.lastIndexOf(' ');
  return name.length > 14 && i > 0 ? [name.slice(0, i), name.slice(i + 1)] : [name];
}

function Star({ x, y, size = 1.15, className }: { x: number; y: number; size?: number; className?: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = (i % 2 ? size * 0.42 : size) * KM;
    const a = ((i * 36 - 90) * Math.PI) / 180;
    return `${round(k(x) + r * Math.cos(a))},${round(k(y) + r * Math.sin(a))}`;
  });
  return <polygon points={pts.join(' ')} className={className} />;
}

interface NationalMapProps {
  active: RegionId | null;
  onActiveChange: (id: RegionId | null) => void;
}

export function NationalMap({ active, onActiveChange }: NationalMapProps) {
  const { t } = useI18n();
  const dim = (id: RegionId) => active !== null && active !== id;
  const fillOf = (id: RegionId) => (active === id ? REGION_COLORS[id].active : dim(id) ? REGION_COLORS[id].muted : REGION_COLORS[id].fill);

  // A line every 10 km east and south of Covenant Square, both ways.
  const gridLines: React.ReactNode[] = [];
  for (let km = -60; km <= 60; km += 10) {
    const u = units(km);
    if (u >= VIEW.x && u <= VIEW.x + VIEW.w) {
      gridLines.push(<line key={`gx${km}`} x1={k(u)} y1={k(VIEW.y)} x2={k(u)} y2={k(VIEW.y + VIEW.h)} />);
    }
    if (u >= VIEW.y && u <= VIEW.y + VIEW.h) {
      gridLines.push(<line key={`gy${km}`} x1={k(VIEW.x)} y1={k(u)} x2={k(VIEW.x + VIEW.w)} y2={k(u)} />);
    }
  }

  const regionProps = (id: RegionId) => ({
    href: `#${id}`,
    onMouseEnter: () => onActiveChange(id),
    onMouseLeave: () => onActiveChange(null),
    onFocus: () => onActiveChange(id),
    onBlur: () => onActiveChange(null),
    className: 'cursor-pointer focus:outline-none',
  });

  return (
    <svg
      viewBox={`${k(VIEW.x)} ${k(VIEW.y)} ${k(VIEW.w)} ${k(VIEW.h)}`}
      className="w-full h-auto block select-none"
      role="group"
      aria-labelledby="national-map-title"
      style={{ fontFamily: 'inherit' }}
    >
      <title id="national-map-title">{t("The Sovereign Covenant State of Aletheia")}</title>
      <desc>{t("Proposed national map: the Antioch Federal District at the centre, St. Barbara State to the north, St. Brendan State to the east, Benedict State to the south and Augustine State to the west.")}</desc>

      {/* Sea, km grid and continental shelf */}
      <rect x={k(VIEW.x)} y={k(VIEW.y)} width={k(VIEW.w)} height={k(VIEW.h)} fill={SEA} />
      <g stroke={COAST} strokeOpacity="0.07" strokeWidth="1">{gridLines}</g>
      <g fill={SHELF_OUTER} stroke={SHELF_OUTER} strokeWidth={CELL * KM * 4.2} strokeLinejoin="round">
        <path d={GEO.land} />
        {ISLANDS.map((i) => <circle key={i.name} cx={k(i.x)} cy={k(i.y)} r={k(i.r)} />)}
      </g>
      <g fill={SHELF_INNER} stroke={SHELF_INNER} strokeWidth={CELL * KM * 2} strokeLinejoin="round">
        <path d={GEO.land} />
        {ISLANDS.map((i) => <circle key={i.name} cx={k(i.x)} cy={k(i.y)} r={k(i.r)} />)}
      </g>

      {WATERS.map((w) => (
        <text key={w.name} x={k(w.x)} y={k(w.y)} textAnchor="middle" fill={COAST} fillOpacity="0.45" fontSize="10" fontWeight="600" letterSpacing="2">
          {waterLines(t(w.name).toUpperCase()).map((line, i, lines) => (
            <tspan key={i} x={k(w.x)} dy={i ? 13 : -6.5 * (lines.length - 1)}>{line}</tspan>
          ))}
        </text>
      ))}

      {/* States: hexagonal cells, then dashed state boundaries and the coastline */}
      {(Object.keys(GEO.cells) as StateId[]).map((id) => (
        <a key={id} {...regionProps(id)} aria-label={t(STATE_LABELS.find((s) => s.id === id)!.name)}>
          <path
            d={GEO.cells[id]}
            fill={fillOf(id)}
            stroke={fillOf(id)}
            strokeWidth="0.8"
            className="transition-[fill,stroke] duration-300"
          />
        </a>
      ))}
      <path d={GEO.borders} fill="none" stroke={COAST} strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 3" pointerEvents="none" />
      <path d={GEO.coast} fill="none" stroke={COAST} strokeWidth="1.7" strokeLinecap="round" pointerEvents="none" />

      {/* Islands and Tiberias Reservoir */}
      {ISLANDS.map((i) => (
        <g key={i.name} pointerEvents="none">
          <circle cx={k(i.x)} cy={k(i.y)} r={k(i.r)} fill="#F2EEE3" stroke={COAST} strokeWidth="1.3" />
          <text x={k(i.x + i.dx)} y={k(i.y + i.dy)} textAnchor={i.position} fill={COAST} fontSize="9.5" fontWeight="600">{t(i.name)}</text>
        </g>
      ))}
      <g pointerEvents="none">
        <path d={toPath(hexPoints(k(RESERVOIR.x), k(RESERVOIR.y), k(RESERVOIR.r)))} fill="#B9D0DE" stroke={COAST} strokeOpacity="0.6" strokeWidth="1" />
        <text x={k(RESERVOIR.x)} y={k(RESERVOIR.y + RESERVOIR.r + 1.5)} textAnchor="middle" fill={COAST} fillOpacity="0.7" fontSize="8.5">{t("Tiberias Reservoir")}</text>
      </g>

      {/* Antioch Federal District with the Covenant Ring and the six radial avenues */}
      <a {...regionProps('antioch')} aria-label={t("Antioch Federal District")}>
        <path
          d={toPath(FD_HEX)}
          fill={fillOf('antioch')}
          stroke={COAST}
          strokeWidth="1.2"
          strokeDasharray="5 3"
          className="transition-[fill] duration-300"
        />
      </a>
      <g pointerEvents="none" stroke={COAST}>
        {FD_HEX.map(([x, y], i) => <line key={i} x1="0" y1="0" x2={x} y2={y} strokeOpacity="0.18" strokeWidth="0.8" />)}
        <path d={toPath(RING_HEX)} fill="none" strokeWidth="1.6" strokeOpacity="0.75" />
      </g>

      {/* Arterial roads from Covenant Square to the four state capitals */}
      <g pointerEvents="none" stroke={COAST} strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round">
        {CAPITALS.map((c) => <line key={c.name} x1="0" y1="0" x2={k(c.x)} y2={k(c.y)} />)}
      </g>

      {/* Towns */}
      {TOWNS.map((tw) => (
        <g key={tw.name} pointerEvents="none">
          <circle cx={k(tw.x)} cy={k(tw.y)} r="2.1" fill={COAST} fillOpacity="0.75" />
          <text x={k(tw.x) + (tw.position === 'start' ? 5 : -5)} y={k(tw.y) + 3.2} textAnchor={tw.position} fill={COAST} fillOpacity="0.8" fontSize="9">{t(tw.name)}</text>
        </g>
      ))}

      {/* State names and postal codes */}
      {STATE_LABELS.map((s) => (
        <g key={s.id} pointerEvents="none" opacity={dim(s.id) ? 0.55 : 1} className="transition-opacity duration-300">
          <text x={k(s.x)} y={k(s.y)} textAnchor="middle" fill={REGION_COLORS[s.id].ink} fontSize="11" fontWeight="700" letterSpacing="1.2" paintOrder="stroke" stroke={fillOf(s.id)} strokeWidth="3" strokeLinejoin="round">
            {t(s.name).toUpperCase()}
          </text>
          <text x={k(s.x)} y={k(s.y) + 13} textAnchor="middle" fill={COAST} fillOpacity="0.65" fontSize="9" paintOrder="stroke" stroke={fillOf(s.id)} strokeWidth="3" strokeLinejoin="round">
            {t("Postal {code}", { code: s.code })}
          </text>
        </g>
      ))}

      {/* State capitals */}
      {CAPITALS.map((c) => (
        <g key={c.name} pointerEvents="none">
          <Star x={c.x} y={c.y} className="fill-[#15294A]" />
          <text x={k(c.x + c.dx)} y={k(c.y + c.dy)} textAnchor={c.position} fill={COAST} fontSize="11" fontWeight="700" paintOrder="stroke" stroke="#F4F1E8" strokeWidth="3" strokeLinejoin="round">{t(c.name)}</text>
        </g>
      ))}

      {/* Antioch, the national capital at Covenant Square */}
      <g pointerEvents="none">
        <text x="0" y={k(-5.25)} textAnchor="middle" fill={REGION_COLORS.antioch.ink} fontSize="8.5" fontWeight="700" letterSpacing="0.4" paintOrder="stroke" stroke={fillOf('antioch')} strokeWidth="3">{t("Federal District")}</text>
        <text x="0" y={k(-4.15)} textAnchor="middle" fill={COAST} fillOpacity="0.65" fontSize="8" paintOrder="stroke" stroke={fillOf('antioch')} strokeWidth="3">{t("Postal {code}", { code: '10000' })}</text>
        <circle cx="0" cy="0" r={k(1.75)} fill="#F4F1E8" stroke={COAST} strokeWidth="1.2" />
        <Star x={0} y={0} size={1.3} className="fill-[#701824]" />
        <text x={k(2.1)} y={k(2.3)} fill={COAST} fontSize="12.5" fontWeight="800" paintOrder="stroke" stroke={fillOf('antioch')} strokeWidth="3.5" strokeLinejoin="round">{t("Antioch")}</text>
      </g>

      {/* North arrow and scale bar */}
      <g transform={`translate(${k(31.5)} ${k(14.5)})`} pointerEvents="none">
        <circle r="26" fill="#F4F1E8" fillOpacity="0.9" stroke={COAST} strokeOpacity="0.4" />
        <polygon points="0,-20 6,4 0,-1 -6,4" fill={COAST} />
        <polygon points="0,20 6,4 0,-1 -6,4" fill={COAST} fillOpacity="0.25" />
        <text y="-29" textAnchor="middle" fill={COAST} fontSize="11" fontWeight="700">{t("N")}</text>
      </g>
      <g transform={`translate(${k(20)} ${k(24.2)})`} pointerEvents="none" fill={COAST}>
        <rect x="0" y="0" width={k(units(10))} height="4" />
        <rect x={k(units(10))} y="0" width={k(units(10))} height="4" fill="#F4F1E8" stroke={COAST} strokeWidth="0.8" />
        <rect x="0" y="0" width={k(units(20))} height="4" fill="none" stroke={COAST} strokeWidth="0.8" />
        <text x="0" y="-4" textAnchor="middle" fontSize="8.5">0</text>
        <text x={k(units(10))} y="-4" textAnchor="middle" fontSize="8.5">10</text>
        <text x={k(units(20))} y="-4" textAnchor="middle" fontSize="8.5">{t("20 km")}</text>
      </g>
    </svg>
  );
}

/** Map legend, rendered as HTML beside the map so it stays legible on small screens. */
export function NationalMapLegend() {
  const { t } = useI18n();
  const items: { key: string; label: string; swatch: React.ReactNode }[] = [
    { key: 'capital', label: 'State capital', swatch: <svg viewBox="-12 -12 24 24" className="w-4 h-4"><Star x={0} y={0} className="fill-[#15294A]" /></svg> },
    { key: 'town', label: 'Town', swatch: <span className="block w-1.5 h-1.5 rounded-full bg-navy/75 mx-auto" /> },
    { key: 'road', label: 'Arterial road', swatch: <span className="block w-5 h-[2px] bg-navy/80" /> },
    { key: 'ring', label: 'Covenant Ring (hexagonal)', swatch: <svg viewBox="-12 -12 24 24" className="w-4 h-4"><path d={toPath(hexPoints(0, 0, 10))} fill="none" stroke={COAST} strokeWidth="2" /></svg> },
    { key: 'border', label: 'State boundary', swatch: <span className="block w-5 border-t-[1.5px] border-dashed border-navy/50" /> },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-navy/75">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-2">
          <span className="w-5 flex items-center justify-center shrink-0">{i.swatch}</span>
          {t(i.label)}
        </li>
      ))}
    </ul>
  );
}
