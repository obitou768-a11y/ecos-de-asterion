import { type AreaId, type PortalDirection } from './systems';

export const MAP_TILE_SIZE = 64;
export const MAP_COLUMNS = 30;
export const MAP_ROWS = 20;

export type FeatureKind = 'tree' | 'rock' | 'wall' | 'house' | 'ruins' | 'cave' | 'lake' | 'bridge' | 'clearing' | 'secret' | 'camp' | 'tower' | 'crypt' | 'chest';

export interface MapCell { col: number; row: number }
export interface MapFeature extends MapCell {
  id: string;
  kind: FeatureKind;
  width: number;
  height: number;
  blocksMovement: boolean;
  variant: number;
}
export interface AreaLayout {
  areaId: AreaId;
  seed: number;
  roads: boolean[][];
  blocked: boolean[][];
  features: MapFeature[];
  entry: MapCell;
  exits: Record<PortalDirection, MapCell>;
  objective: MapCell;
  npc: MapCell;
  boss: MapCell;
  enemySpawns: MapCell[];
  chests: MapFeature[];
  secrets: MapFeature[];
}

export const PORTAL_SPAWN_CELLS: Record<PortalDirection, MapCell> = {
  north: { col: 15, row: 2 }, south: { col: 15, row: MAP_ROWS - 3 },
  west: { col: 2, row: 10 }, east: { col: MAP_COLUMNS - 3, row: 10 },
};

export function respawnCell(direction: PortalDirection | null, layout: AreaLayout): MapCell {
  return direction ? PORTAL_SPAWN_CELLS[direction] : layout.entry;
}

const ENTRY_CELL: MapCell = { col: 15, row: 10 };
const EXIT_CELLS: Record<PortalDirection, MapCell> = {
  north: { col: 15, row: 0 },
  south: { col: 15, row: MAP_ROWS - 1 },
  west: { col: 0, row: 10 },
  east: { col: MAP_COLUMNS - 1, row: 10 },
};
const FEATURE_POOLS: Record<AreaId, FeatureKind[]> = {
  valdora: ['house', 'house', 'ruins', 'wall', 'tower', 'camp', 'crypt', 'rock'],
  nareth: ['tree', 'tree', 'tree', 'rock', 'lake', 'ruins', 'camp', 'cave'],
  valen: ['wall', 'ruins', 'ruins', 'tower', 'crypt', 'cave', 'rock', 'lake'],
  mire: ['tree', 'rock', 'lake', 'lake', 'ruins', 'bridge', 'camp', 'cave'],
  khar: ['rock', 'rock', 'cave', 'cave', 'ruins', 'bridge', 'tower', 'crypt'],
};
const REQUIRED_FEATURES: Record<AreaId, FeatureKind[]> = {
  valdora: ['house', 'ruins', 'wall'],
  nareth: ['tree', 'lake', 'cave', 'ruins'],
  valen: ['ruins', 'wall', 'tower', 'crypt'],
  mire: ['tree', 'lake', 'bridge', 'cave'],
  khar: ['rock', 'cave', 'bridge', 'ruins'],
};
const BLOCKING_KINDS = new Set<FeatureKind>(['tree', 'rock', 'wall', 'house', 'ruins', 'lake', 'tower', 'crypt']);

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function dimensions(kind: FeatureKind, random: () => number): { width: number; height: number } {
  if (kind === 'tree' || kind === 'rock' || kind === 'chest') return { width: 1, height: 1 };
  if (kind === 'wall' || kind === 'bridge') return random() < 0.5 ? { width: 3, height: 1 } : { width: 1, height: 3 };
  if (kind === 'house' || kind === 'cave' || kind === 'tower') return random() < 0.35 ? { width: 4, height: 3 } : { width: 3, height: 2 };
  if (kind === 'lake') return { width: 2 + Math.floor(random() * 3), height: 2 + Math.floor(random() * 2) };
  if (kind === 'clearing' || kind === 'secret') return { width: 2 + Math.floor(random() * 2), height: 2 + Math.floor(random() * 2) };
  return { width: 2 + Math.floor(random() * 2), height: 2 + Math.floor(random() * 2) };
}

function createRoads(random: () => number): boolean[][] {
  const roads = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLUMNS).fill(false));
  let horizontalCenter = ENTRY_CELL.row;
  for (let col = 0; col < MAP_COLUMNS; col++) {
    if (col > 1 && col < MAP_COLUMNS - 2 && random() < 0.26) horizontalCenter = Math.max(8, Math.min(11, horizontalCenter + (random() < 0.5 ? -1 : 1)));
    if (col === 0 || col === MAP_COLUMNS - 1) horizontalCenter = ENTRY_CELL.row;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      const row = horizontalCenter + rowOffset;
      if (row >= 0 && row < MAP_ROWS) roads[row][col] = true;
    }
  }
  let verticalCenter = ENTRY_CELL.col;
  for (let row = 0; row < MAP_ROWS; row++) {
    if (row > 1 && row < MAP_ROWS - 2 && random() < 0.24) verticalCenter = Math.max(13, Math.min(16, verticalCenter + (random() < 0.5 ? -1 : 1)));
    if (row === 0 || row === MAP_ROWS - 1) verticalCenter = ENTRY_CELL.col;
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      const col = verticalCenter + colOffset;
      if (col >= 0 && col < MAP_COLUMNS) roads[row][col] = true;
    }
  }
  for (const exit of Object.values(EXIT_CELLS)) roads[exit.row][exit.col] = true;
  roads[ENTRY_CELL.row][ENTRY_CELL.col] = true;
  return roads;
}

function insideFeature(feature: MapFeature, col: number, row: number): boolean {
  return col >= feature.col && col < feature.col + feature.width && row >= feature.row && row < feature.row + feature.height;
}

function overlapsFeature(features: MapFeature[], feature: MapFeature): boolean {
  return features.some((placed) => feature.col < placed.col + placed.width && feature.col + feature.width > placed.col
    && feature.row < placed.row + placed.height && feature.row + feature.height > placed.row);
}

function makeFeature(areaId: AreaId, kind: FeatureKind, dimensionsValue: { width: number; height: number }, col: number, row: number, ordinal: number, random: () => number): MapFeature {
  return {
    id: `${areaId}-${kind}-${ordinal}`,
    kind,
    col,
    row,
    width: dimensionsValue.width,
    height: dimensionsValue.height,
    blocksMovement: BLOCKING_KINDS.has(kind),
    variant: Math.floor(random() * 6),
  };
}

function placeFeature(kind: FeatureKind, areaId: AreaId, features: MapFeature[], roads: boolean[][], random: () => number, ordinal: number): MapFeature | null {
  const size = dimensions(kind, random);
  for (let attempt = 0; attempt < 90; attempt++) {
    const col = 1 + Math.floor(random() * (MAP_COLUMNS - size.width - 2));
    const row = 1 + Math.floor(random() * (MAP_ROWS - size.height - 2));
    const feature = makeFeature(areaId, kind, size, col, row, ordinal, random);
    if (overlapsFeature(features, feature)) continue;
    if (kind === 'bridge') {
      if (!roads[row][col]) continue;
      const protectedCells = [ENTRY_CELL, ...Object.values(EXIT_CELLS)];
      if (protectedCells.some((cell) => Math.abs(cell.col - col) + Math.abs(cell.row - row) < 2)) continue;
    } else {
      let touchesRoad = false;
      for (let featureRow = row; featureRow < row + size.height; featureRow++) {
        for (let featureCol = col; featureCol < col + size.width; featureCol++) {
          if (roads[featureRow][featureCol]) touchesRoad = true;
        }
      }
      if (touchesRoad) continue;
    }
    features.push(feature);
    return feature;
  }
  return null;
}

function reachableCells(blocked: boolean[][], start: MapCell): MapCell[] {
  const reachable: MapCell[] = [];
  const visited = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLUMNS).fill(false));
  const pending: MapCell[] = [start];
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  visited[start.row][start.col] = true;
  for (let index = 0; index < pending.length; index++) {
    const cell = pending[index];
    reachable.push(cell);
    offsets.forEach(([colOffset, rowOffset]) => {
      const col = cell.col + colOffset;
      const row = cell.row + rowOffset;
      if (col < 0 || col >= MAP_COLUMNS || row < 0 || row >= MAP_ROWS || visited[row][col] || blocked[row][col]) return;
      visited[row][col] = true;
      pending.push({ col, row });
    });
  }
  return reachable;
}

function choosePoint(candidates: MapCell[], used: MapCell[], random: () => number, minDistance: number): MapCell | null {
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.find((candidate) => used.every((point) => Math.abs(point.col - candidate.col) + Math.abs(point.row - candidate.row) >= minDistance)) ?? null;
}

function buildLayout(areaId: AreaId, seed: number): AreaLayout {
  const random = seededRandom(seed);
  const roads = createRoads(random);
  const features: MapFeature[] = [];
  const pool = FEATURE_POOLS[areaId];
  const structureRequests = Array.from({ length: 26 }, () => pool[Math.floor(random() * pool.length)]);
  structureRequests.push(...REQUIRED_FEATURES[areaId], 'clearing', 'clearing', 'clearing', 'secret', 'chest', 'chest', 'chest');
  for (let index = structureRequests.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [structureRequests[index], structureRequests[swapIndex]] = [structureRequests[swapIndex], structureRequests[index]];
  }
  const ordinals = new Map<FeatureKind, number>();
  structureRequests.forEach((kind) => {
    const ordinal = ordinals.get(kind) ?? 0;
    ordinals.set(kind, ordinal + 1);
    placeFeature(kind, areaId, features, roads, random, ordinal);
  });
  for (let index = 0; index < 3; index++) placeFeature('bridge', areaId, features, roads, random, index);

  const blocked = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLUMNS).fill(false));
  features.filter((feature) => feature.blocksMovement).forEach((feature) => {
    for (let row = feature.row; row < feature.row + feature.height; row++) {
      for (let col = feature.col; col < feature.col + feature.width; col++) blocked[row][col] = true;
    }
  });
  const reachable = reachableCells(blocked, ENTRY_CELL);
  const openReachable = reachable.filter((cell) => !features.some((feature) => insideFeature(feature, cell.col, cell.row)));
  const usedPoints: MapCell[] = [ENTRY_CELL, ...Object.values(EXIT_CELLS)];
  const objective = ENTRY_CELL;
  const npc = choosePoint(openReachable.filter((cell) => !roads[cell.row][cell.col]), usedPoints, random, 3) ?? ENTRY_CELL;
  usedPoints.push(npc);
  const boss = [...openReachable].sort((first, second) => {
    const firstDistance = Math.abs(first.col - ENTRY_CELL.col) + Math.abs(first.row - ENTRY_CELL.row);
    const secondDistance = Math.abs(second.col - ENTRY_CELL.col) + Math.abs(second.row - ENTRY_CELL.row);
    return secondDistance - firstDistance;
  }).find((cell) => usedPoints.every((point) => Math.abs(point.col - cell.col) + Math.abs(point.row - cell.row) >= 4)) ?? ENTRY_CELL;
  usedPoints.push(boss);

  const chestFeatures = features.filter((feature) => feature.kind === 'chest');
  const chests = chestFeatures.filter((feature) => reachable.some((cell) => insideFeature(feature, cell.col, cell.row)));
  const secrets = features.filter((feature) => feature.kind === 'secret' && reachable.some((cell) => insideFeature(feature, cell.col, cell.row)));
  chests.forEach((chest) => usedPoints.push({ col: chest.col, row: chest.row }));
  secrets.forEach((secret) => usedPoints.push({ col: secret.col, row: secret.row }));

  const spawnCandidates = openReachable.filter((cell) => !roads[cell.row][cell.col] && !usedPoints.some((point) => point.col === cell.col && point.row === cell.row));
  const enemySpawns: MapCell[] = [];
  for (let index = 0; index < 8; index++) {
    const spawn = choosePoint(spawnCandidates, [...usedPoints, ...enemySpawns], random, 3)
      ?? choosePoint(reachable, [...usedPoints, ...enemySpawns], random, 2);
    if (!spawn) break;
    enemySpawns.push(spawn);
  }

  return {
    areaId,
    seed,
    roads,
    blocked,
    features,
    entry: ENTRY_CELL,
    exits: EXIT_CELLS,
    objective,
    npc,
    boss,
    enemySpawns,
    chests,
    secrets,
  };
}

function openFallback(areaId: AreaId, seed: number): AreaLayout {
  const roads = createRoads(seededRandom(seed));
  const blocked = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLUMNS).fill(false));
  const openCells = Array.from({ length: MAP_ROWS }, (_, row) => Array.from({ length: MAP_COLUMNS }, (_, col) => ({ col, row }))).flat();
  const random = seededRandom(seed ^ 0xa5a5a5a5);
  const fallbackFeatures: MapFeature[] = [
    { id: `${areaId}-chest-0`, kind: 'chest' as const, col: 12, row: 8, width: 1, height: 1, blocksMovement: false, variant: 0 },
    { id: `${areaId}-chest-1`, kind: 'chest' as const, col: 18, row: 12, width: 1, height: 1, blocksMovement: false, variant: 1 },
    { id: `${areaId}-secret-0`, kind: 'secret' as const, col: 20, row: 8, width: 2, height: 2, blocksMovement: false, variant: 0 },
  ];
  REQUIRED_FEATURES[areaId].forEach((kind, index) => {
    const candidates = openCells.filter((cell) => !roads[cell.row][cell.col] && !fallbackFeatures.some((feature) => insideFeature(feature, cell.col, cell.row)));
    if (!candidates.length) return;
    const cell = candidates[Math.floor(random() * candidates.length)];
    fallbackFeatures.push({ id: `${areaId}-${kind}-fallback-${index}`, kind, col: cell.col, row: cell.row, width: 1, height: 1, blocksMovement: false, variant: Math.floor(random() * 6) });
  });
  for (let index = 0; index < 24; index++) {
    const candidates = openCells.filter((cell) => !roads[cell.row][cell.col] && !fallbackFeatures.some((feature) => insideFeature(feature, cell.col, cell.row)));
    if (!candidates.length) break;
    const cell = candidates[Math.floor(random() * candidates.length)];
    fallbackFeatures.push({ id: `${areaId}-fallback-${index}`, kind: index % 3 === 0 ? 'tree' : 'rock', col: cell.col, row: cell.row, width: 1, height: 1, blocksMovement: false, variant: Math.floor(random() * 6) });
  }
  const safeCells = openCells.filter((cell) => !fallbackFeatures.some((feature) => insideFeature(feature, cell.col, cell.row)));
  const npc = choosePoint(safeCells.filter((cell) => !roads[cell.row][cell.col]), [ENTRY_CELL, ...Object.values(EXIT_CELLS)], random, 3) ?? ENTRY_CELL;
  const boss = [...safeCells].sort((first, second) => {
    const firstDistance = Math.abs(first.col - ENTRY_CELL.col) + Math.abs(first.row - ENTRY_CELL.row);
    const secondDistance = Math.abs(second.col - ENTRY_CELL.col) + Math.abs(second.row - ENTRY_CELL.row);
    return secondDistance - firstDistance;
  })[0] ?? ENTRY_CELL;
  const enemySpawns: MapCell[] = [];
  for (let index = 0; index < 8; index++) {
    const spawn = choosePoint(safeCells.filter((cell) => !roads[cell.row][cell.col]), [ENTRY_CELL, npc, boss, ...Object.values(EXIT_CELLS), ...enemySpawns], random, 2);
    if (spawn) enemySpawns.push(spawn);
  }
  const chests = fallbackFeatures.filter((feature) => feature.kind === 'chest');
  const secrets = fallbackFeatures.filter((feature) => feature.kind === 'secret');
  return { areaId, seed, roads, blocked, features: fallbackFeatures, entry: ENTRY_CELL, exits: EXIT_CELLS, objective: ENTRY_CELL, npc, boss, enemySpawns, chests, secrets };
}

export function generateAreaLayout(areaId: AreaId, seed: number): AreaLayout {
  for (let attempt = 0; attempt < 12; attempt++) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const layout = buildLayout(areaId, attemptSeed);
    if (validateAreaLayout(layout)) return layout;
  }
  const fallback = openFallback(areaId, seed >>> 0);
  if (!validateAreaLayout(fallback)) throw new Error(`Não foi possível criar um mapa acessível para ${areaId}.`);
  return fallback;
}

export function validateAreaLayout(layout: AreaLayout): boolean {
  if (layout.roads.length !== MAP_ROWS || layout.blocked.length !== MAP_ROWS) return false;
  if (layout.roads.some((row) => row.length !== MAP_COLUMNS) || layout.blocked.some((row) => row.length !== MAP_COLUMNS)) return false;
  if (layout.features.length < 20 || layout.enemySpawns.length !== 8 || layout.chests.length < 2 || layout.secrets.length < 1) return false;
  if (REQUIRED_FEATURES[layout.areaId].some((kind) => !layout.features.some((feature) => feature.kind === kind))) return false;
  if (layout.features.some((feature) => feature.col < 0 || feature.row < 0 || feature.col + feature.width > MAP_COLUMNS || feature.row + feature.height > MAP_ROWS)) return false;
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLUMNS; col++) {
      if (layout.roads[row][col] && layout.blocked[row][col]) return false;
    }
  }
  const protectedCells = [layout.entry, ...Object.values(layout.exits), ...Object.values(PORTAL_SPAWN_CELLS)];
  if (protectedCells.some((cell) => layout.blocked[cell.row][cell.col] || !layout.roads[cell.row][cell.col])) return false;
  const requiredClearCells = [...protectedCells, layout.npc, layout.boss, ...layout.enemySpawns];
  if (requiredClearCells.some((cell) => layout.features.some((feature) => insideFeature(feature, cell.col, cell.row)))) return false;
  const reachable = reachableCells(layout.blocked, layout.entry);
  const keySet = new Set(reachable.map((cell) => `${cell.col}:${cell.row}`));
  const allRequiredCells: MapCell[] = [...Object.values(layout.exits), layout.objective, layout.npc, layout.boss, ...layout.enemySpawns];
  [...layout.chests, ...layout.secrets].forEach((feature) => {
    for (let rowOffset = 0; rowOffset < feature.height; rowOffset++) {
      for (let colOffset = 0; colOffset < feature.width; colOffset++) {
        allRequiredCells.push({ col: feature.col + colOffset, row: feature.row + rowOffset });
      }
    }
  });
  return allRequiredCells.every((cell) => cell.col >= 0 && cell.col < MAP_COLUMNS && cell.row >= 0 && cell.row < MAP_ROWS
    && !layout.blocked[cell.row][cell.col] && keySet.has(`${cell.col}:${cell.row}`));
}

export function mapFingerprint(layout: AreaLayout): string {
  const roadSignature = layout.roads.map((row) => row.map((road) => road ? '1' : '0').join('')).join('/');
  const featureSignature = layout.features.map((feature) => `${feature.kind}:${feature.col},${feature.row},${feature.width},${feature.height}:${feature.variant}`).join('|');
  return `${roadSignature}#${featureSignature}`;
}

export function worldPosition(cell: MapCell): { x: number; y: number } {
  return { x: cell.col * MAP_TILE_SIZE + MAP_TILE_SIZE / 2, y: cell.row * MAP_TILE_SIZE + MAP_TILE_SIZE / 2 };
}
