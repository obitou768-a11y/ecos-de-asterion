export type AttributeName = 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'resistance' | 'luck';
export type GearSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'ring1' | 'ring2' | 'amulet';
export type ItemCategory = 'weapon' | 'armor' | 'helm' | 'gloves' | 'boots' | 'shield' | 'ring' | 'amulet' | 'potion' | 'food' | 'material' | 'quest' | 'relic';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AreaId = 'valdora' | 'nareth' | 'valen' | 'mire' | 'khar';
export type PortalDirection = 'north' | 'south' | 'east' | 'west';

export interface ItemStats {
  attack?: number;
  defense?: number;
  health?: number;
  mana?: number;
  stamina?: number;
  crit?: number;
  magicAttack?: number;
  magicDefense?: number;
  speed?: number;
  resistance?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  icon: string;
  category: ItemCategory;
  rarity: Rarity;
  description: string;
  weight: number;
  stats?: ItemStats;
  slot?: GearSlot;
  effect?: string;
  heal?: number;
  restoreMana?: number;
}

export interface InventoryEntry { itemId: string; quantity: number }
export interface Attributes { strength: number; dexterity: number; intelligence: number; vitality: number; resistance: number; luck: number }
export type Equipment = Record<GearSlot, string | null>;
export interface DerivedStats extends ItemStats {
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  attack: number;
  defense: number;
  magicAttack: number;
  magicDefense: number;
  critChance: number;
  critDamage: number;
  attackCooldown: number;
  moveSpeed: number;
  carryCapacity: number;
}

export interface GameSession {
  version: 1;
  worldSeed: number;
  areaSeeds: Partial<Record<AreaId, number>>;
  collectedChests: Partial<Record<AreaId, string[]>>;
  discoveredSecrets: Partial<Record<AreaId, string[]>>;
  area: AreaId;
  returnArea: AreaId | null;
  returnDirection: PortalDirection | null;
  x: number;
  y: number;
  health: number;
  mana: number;
  stamina: number;
  level: number;
  xp: number;
  attributePoints: number;
  skillPoints: number;
  attributes: Attributes;
  inventory: InventoryEntry[];
  equipment: Equipment;
  gold: number;
  difficultyTier: number;
  cacheCollected: boolean;
  discovered: AreaId[];
  defeated: Partial<Record<AreaId, string[]>>;
}

export interface AreaDefinition {
  id: AreaId;
  name: string;
  subtitle: string;
  recommended: string;
  ground: number;
  path: number;
  trim: number;
  enemyLevel: number;
  exits: Record<PortalDirection, AreaId>;
}

export const ATTRIBUTE_LABELS: Record<AttributeName, string> = {
  strength: 'Força', dexterity: 'Destreza', intelligence: 'Inteligência',
  vitality: 'Vitalidade', resistance: 'Resistência', luck: 'Sorte',
};

export const GEAR_SLOTS: Array<{ id: GearSlot; label: string }> = [
  { id: 'weapon', label: 'Arma principal' }, { id: 'offhand', label: 'Arma secundária' },
  { id: 'head', label: 'Cabeça' }, { id: 'chest', label: 'Peitoral' },
  { id: 'hands', label: 'Luvas' }, { id: 'legs', label: 'Pernas' },
  { id: 'feet', label: 'Botas' }, { id: 'ring1', label: 'Anel I' },
  { id: 'ring2', label: 'Anel II' }, { id: 'amulet', label: 'Amuleto' },
];

export const ITEMS: Record<string, ItemDefinition> = {
  rusted_sword: { id: 'rusted_sword', name: 'Lâmina Enferrujada', icon: 'AR', category: 'weapon', rarity: 'common', description: 'Uma espada simples que sobreviveu à Ruptura.', weight: 3, slot: 'weapon', stats: { attack: 8 } },
  iron_sword: { id: 'iron_sword', name: 'Espada de Ferro', icon: 'ES', category: 'weapon', rarity: 'uncommon', description: 'Uma espada confiável, forjada para soldados de fronteira.', weight: 3, slot: 'weapon', stats: { attack: 12 } },
  leather_armor: { id: 'leather_armor', name: 'Gibão de Patrulha', icon: 'PE', category: 'armor', rarity: 'common', description: 'Couro reforçado contra garras e estilhaços.', weight: 5, slot: 'chest', stats: { defense: 5, health: 14 } },
  iron_helm: { id: 'iron_helm', name: 'Elmo do Vigia', icon: 'EL', category: 'helm', rarity: 'uncommon', description: 'O brasão foi raspado, mas o aço ainda protege.', weight: 3, slot: 'head', stats: { defense: 4, resistance: 2 } },
  leather_gloves: { id: 'leather_gloves', name: 'Luvas de Couro', icon: 'LU', category: 'gloves', rarity: 'common', description: 'Aderência firme para empunhar a lâmina.', weight: 1, slot: 'hands', stats: { attack: 2, stamina: 5 } },
  leather_boots: { id: 'leather_boots', name: 'Botas de Trilha', icon: 'BO', category: 'boots', rarity: 'common', description: 'Solas leves para caminhos em ruínas.', weight: 2, slot: 'feet', stats: { speed: 8, stamina: 5 } },
  oak_shield: { id: 'oak_shield', name: 'Escudo de Freixo', icon: 'ES', category: 'shield', rarity: 'uncommon', description: 'Madeira antiga, coberta por uma lâmina de ferro.', weight: 4, slot: 'offhand', stats: { defense: 8, resistance: 2 } },
  copper_ring: { id: 'copper_ring', name: 'Anel de Cobre', icon: 'AN', category: 'ring', rarity: 'common', description: 'Um aro simples gravado com marcas de proteção.', weight: 0.2, slot: 'ring1', stats: { crit: 2, health: 5 } },
  ash_charm: { id: 'ash_charm', name: 'Amuleto de Cinzas', icon: 'AM', category: 'amulet', rarity: 'rare', description: 'Uma brasa fria pulsa sob o vidro escuro.', weight: 0.4, slot: 'amulet', stats: { magicAttack: 8, mana: 18 } },
  health_potion: { id: 'health_potion', name: 'Poção de Sangue', icon: 'PV', category: 'potion', rarity: 'common', description: 'Recupera 45 pontos de vida.', weight: 0.5, heal: 45 },
  ether_potion: { id: 'ether_potion', name: 'Tônico de Éter', icon: 'ET', category: 'potion', rarity: 'uncommon', description: 'Recupera 30 pontos de mana.', weight: 0.5, restoreMana: 30 },
  moonroot: { id: 'moonroot', name: 'Raiz-lua', icon: 'RL', category: 'food', rarity: 'common', description: 'Uma raiz amarga que recupera 12 pontos de vida.', weight: 0.2, heal: 12 },
  ember_ore: { id: 'ember_ore', name: 'Minério de Brasa', icon: 'MB', category: 'material', rarity: 'uncommon', description: 'Metal poroso que ainda guarda calor.', weight: 1.5 },
  broken_seal: { id: 'broken_seal', name: 'Selo Partido', icon: 'SP', category: 'quest', rarity: 'rare', description: 'Um fragmento marcado com o símbolo da família real.', weight: 0, effect: 'Item de missão: não pode ser descartado.' },
  sunken_circlet: { id: 'sunken_circlet', name: 'Diadema Afogado', icon: 'DA', category: 'helm', rarity: 'epic', description: 'A prata escurecida ainda ressoa com os salões submersos.', weight: 2, slot: 'head', stats: { defense: 9, mana: 16, magicDefense: 6 }, effect: 'Aumenta a resistência contra ataques mágicos.' },
  twilight_blade: { id: 'twilight_blade', name: 'Lâmina do Crepúsculo', icon: 'LC', category: 'relic', rarity: 'legendary', description: 'Aço ancestral que desperta diante de um inimigo enfraquecido.', weight: 3, slot: 'weapon', stats: { attack: 35, crit: 10 }, effect: 'Golpes causam 25% de dano adicional contra inimigos abaixo de 30% de vida.' },
};

export const AREAS: Record<AreaId, AreaDefinition> = {
  valdora: { id: 'valdora', name: 'Cinzas de Valdora', subtitle: 'A aldeia ainda arde sob a Ruptura.', recommended: 'Nível 1–3', ground: 0x303b2e, path: 0x514638, trim: 0x78604b, enemyLevel: 1, exits: { north: 'nareth', east: 'valen', south: 'mire', west: 'khar' } },
  nareth: { id: 'nareth', name: 'Floresta de Nareth', subtitle: 'Raízes antigas cercam as trilhas corrompidas.', recommended: 'Nível 3–7', ground: 0x26382d, path: 0x46533a, trim: 0x8d704a, enemyLevel: 3, exits: { north: 'valen', east: 'mire', south: 'valdora', west: 'khar' } },
  valen: { id: 'valen', name: 'Ruínas de Valen', subtitle: 'A pedra élfica recorda o primeiro fragmento.', recommended: 'Nível 7–12', ground: 0x333638, path: 0x5a5547, trim: 0x87908b, enemyLevel: 7, exits: { north: 'mire', east: 'khar', south: 'nareth', west: 'valdora' } },
  mire: { id: 'mire', name: 'Pântano Sombrio', subtitle: 'Luzes falsas dançam sobre águas profundas.', recommended: 'Nível 12–18', ground: 0x293731, path: 0x4b4c3c, trim: 0x8d8b55, enemyLevel: 12, exits: { north: 'valdora', east: 'khar', south: 'valen', west: 'nareth' } },
  khar: { id: 'khar', name: 'Montanhas de Khar', subtitle: 'O vento carrega o eco de um reino perdido.', recommended: 'Nível 18–25', ground: 0x3c4140, path: 0x65625a, trim: 0xb69b72, enemyLevel: 18, exits: { north: 'mire', east: 'valdora', south: 'nareth', west: 'valen' } },
};

export const MAX_LEVEL = 50;
export const MAX_DIFFICULTY_TIER = 25;
export const OPPOSITE_PORTAL: Record<PortalDirection, PortalDirection> = { north: 'south', south: 'north', east: 'west', west: 'east' };
export const xpToNextLevel = (level: number): number => Math.floor(70 + 35 * level + 8 * Math.pow(level, 1.55));

export function createWorldSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

function seedFromSerializedSave(serializedSave: string): number {
  let seed = 0x811c9dc5;
  for (let index = 0; index < serializedSave.length; index++) {
    seed ^= serializedSave.charCodeAt(index);
    seed = Math.imul(seed, 0x01000193) >>> 0;
  }
  return seed || 1;
}

export function ensureAreaSeed(session: GameSession, areaId: AreaId): number {
  const existing = session.areaSeeds[areaId];
  if (existing !== undefined) return existing;
  let hash = (session.worldSeed ^ 0x811c9dc5) >>> 0;
  const input = `${session.worldSeed}:${areaId}`;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  session.areaSeeds[areaId] = hash || 1;
  return session.areaSeeds[areaId]!;
}

export function exitsFor(session: GameSession): Record<PortalDirection, AreaId> {
  const exits = { ...AREAS[session.area].exits };
  if (session.returnArea && session.returnDirection) exits[session.returnDirection] = session.returnArea;
  return exits;
}

export function crossPortal(session: GameSession, areaId: AreaId, exitDirection: PortalDirection): number {
  session.returnArea = session.area;
  session.returnDirection = OPPOSITE_PORTAL[exitDirection];
  session.difficultyTier = Math.min(MAX_DIFFICULTY_TIER, session.difficultyTier + 1);
  session.area = areaId;
  session.defeated[areaId] = [];
  return session.difficultyTier;
}

export function enemyLevelFor(session: GameSession, areaId: AreaId, index: number): number {
  return Math.min(MAX_LEVEL, AREAS[areaId].enemyLevel + session.difficultyTier + index % 3);
}

export function createDefaultSession(): GameSession {
  return {
    version: 1, worldSeed: createWorldSeed(), areaSeeds: {}, collectedChests: {}, discoveredSecrets: {}, area: 'valdora', returnArea: null, returnDirection: null, x: 340, y: 650, health: 100, mana: 50, stamina: 100,
    level: 1, xp: 0, attributePoints: 0, skillPoints: 0,
    attributes: { strength: 4, dexterity: 4, intelligence: 4, vitality: 4, resistance: 4, luck: 4 },
    inventory: [{ itemId: 'rusted_sword', quantity: 1 }, { itemId: 'health_potion', quantity: 2 }],
    equipment: { weapon: 'rusted_sword', offhand: null, head: null, chest: null, hands: null, legs: null, feet: null, ring1: null, ring2: null, amulet: null },
    gold: 12, difficultyTier: 0, cacheCollected: false, discovered: ['valdora'], defeated: {},
  };
}

export function equippedBonuses(session: GameSession): ItemStats {
  const total: ItemStats = {};
  (Object.values(session.equipment) as Array<string | null>).forEach((id) => {
    const stats = id ? ITEMS[id]?.stats : undefined;
    if (!stats) return;
    Object.entries(stats).forEach(([key, value]) => {
      const stat = key as keyof ItemStats;
      total[stat] = (total[stat] ?? 0) + (value ?? 0);
    });
  });
  return total;
}

export function deriveStats(session: GameSession): DerivedStats {
  const a = session.attributes;
  const gear = equippedBonuses(session);
  return {
    maxHealth: Math.max(1, 100 + (a.vitality - 4) * 12 + (session.level - 1) * 8 + (gear.health ?? 0)),
    maxMana: Math.max(1, 50 + (a.intelligence - 4) * 8 + (session.level - 1) * 5 + (gear.mana ?? 0)),
    maxStamina: Math.max(1, 100 + (a.dexterity - 4) * 5 + (session.level - 1) * 4 + (gear.stamina ?? 0)),
    attack: Math.max(1, 16 + a.strength * 2.3 + (gear.attack ?? 0)),
    defense: Math.max(0, a.resistance * 0.8 + (gear.resistance ?? 0) + (gear.defense ?? 0)),
    magicAttack: Math.max(1, 14 + a.intelligence * 2.5 + (gear.magicAttack ?? 0)),
    magicDefense: Math.max(0, a.resistance * 1.2 + (gear.magicDefense ?? 0)),
    critChance: Math.min(60, 5 + a.dexterity * 0.65 + a.luck * 0.85 + (gear.crit ?? 0)),
    critDamage: 150 + Math.min(50, a.strength * 0.5),
    attackCooldown: Math.max(270, 450 - a.dexterity * 5),
    moveSpeed: Math.min(230, 165 + a.dexterity * 0.7 + (gear.speed ?? 0)),
    carryCapacity: 24 + a.strength * 2,
  };
}

export function addExperience(session: GameSession, amount: number): number {
  if (amount <= 0 || session.level >= MAX_LEVEL) return 0;
  session.xp += amount;
  let gained = 0;
  while (session.level < MAX_LEVEL && session.xp >= xpToNextLevel(session.level)) {
    session.xp -= xpToNextLevel(session.level);
    session.level += 1;
    session.attributePoints += 3;
    if (session.level % 5 === 0) session.skillPoints += 1;
    gained += 1;
  }
  if (session.level >= MAX_LEVEL) session.xp = Math.min(session.xp, xpToNextLevel(MAX_LEVEL));
  return gained;
}

export function addItem(session: GameSession, itemId: string, quantity = 1): boolean {
  if (!ITEMS[itemId] || quantity < 1) return false;
  const item = ITEMS[itemId];
  const weight = session.inventory.reduce((sum, entry) => sum + (ITEMS[entry.itemId]?.weight ?? 0) * entry.quantity, 0);
  const capacity = deriveStats(session).carryCapacity;
  if (weight + item.weight * quantity > capacity) return false;
  const existing = session.inventory.find((entry) => entry.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else session.inventory.push({ itemId, quantity });
  return true;
}

export function removeItem(session: GameSession, itemId: string, quantity = 1): boolean {
  const entry = session.inventory.find((item) => item.itemId === itemId);
  if (!entry || quantity < 1 || entry.quantity < quantity) return false;
  entry.quantity -= quantity;
  if (entry.quantity === 0) session.inventory = session.inventory.filter((item) => item.itemId !== itemId);
  return true;
}

export function equipItem(session: GameSession, itemId: string, preferredRing?: 'ring1' | 'ring2'): string | null {
  const item = ITEMS[itemId];
  if (!item?.slot || !session.inventory.some((entry) => entry.itemId === itemId)) return null;
  const slot: GearSlot = item.slot === 'ring1' ? preferredRing ?? (session.equipment.ring1 ? 'ring2' : 'ring1') : item.slot;
  const previous = session.equipment[slot];
  if (previous === itemId) return null;
  if (!removeItem(session, itemId)) return null;
  if (previous) addItem(session, previous);
  session.equipment[slot] = itemId;
  return slot;
}

export function unequipItem(session: GameSession, slot: GearSlot): boolean {
  const itemId = session.equipment[slot];
  if (!itemId || !addItem(session, itemId)) return false;
  session.equipment[slot] = null;
  return true;
}

export function useItem(session: GameSession, itemId: string): boolean {
  const item = ITEMS[itemId];
  if (!item || !session.inventory.some((entry) => entry.itemId === itemId)) return false;
  if (item.heal) {
    const maxHealth = deriveStats(session).maxHealth;
    if (session.health >= maxHealth) return false;
    session.health = Math.min(maxHealth, session.health + item.heal);
  } else if (item.restoreMana) {
    const maxMana = deriveStats(session).maxMana;
    if (session.mana >= maxMana) return false;
    session.mana = Math.min(maxMana, session.mana + item.restoreMana);
  }
  else return false;
  return removeItem(session, itemId);
}

export function dropItem(session: GameSession, itemId: string): boolean {
  if (ITEMS[itemId]?.category === 'quest') return false;
  return removeItem(session, itemId);
}

export function inventoryWeight(session: GameSession): number {
  return session.inventory.reduce((sum, entry) => sum + (ITEMS[entry.itemId]?.weight ?? 0) * entry.quantity, 0);
}

const SAVE_PREFIX = 'asterion-save-v1-';
const AUTO_KEY = `${SAVE_PREFIX}auto`;
const SLOT_KEY = (slot: number): string => `${SAVE_PREFIX}slot-${slot}`;

export function saveSession(session: GameSession, slot: number | 'auto' = 'auto'): boolean {
  try {
    if (typeof slot === 'number' && ![1, 2, 3].includes(slot)) return false;
    const key = slot === 'auto' ? AUTO_KEY : SLOT_KEY(slot);
    localStorage.setItem(key, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function loadSession(slot: number | 'auto' = 'auto'): GameSession | null {
  try {
    if (typeof slot === 'number' && ![1, 2, 3].includes(slot)) return null;
    const raw = localStorage.getItem(slot === 'auto' ? AUTO_KEY : SLOT_KEY(slot));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isValidSession(data)) return null;
    const clean = createDefaultSession();
    Object.assign(clean, data);
    clean.attributes = { ...createDefaultSession().attributes, ...data.attributes };
    clean.inventory = data.inventory.filter((entry) => ITEMS[entry.itemId] && Number.isInteger(entry.quantity) && entry.quantity > 0);
    clean.equipment = { ...clean.equipment, ...data.equipment };
    clean.worldSeed = Number.isInteger(data.worldSeed) && data.worldSeed >= 0 && data.worldSeed <= 0xffffffff ? data.worldSeed : seedFromSerializedSave(raw);
    clean.areaSeeds = data.areaSeeds && typeof data.areaSeeds === 'object' ? Object.fromEntries(Object.entries(data.areaSeeds).filter(([area, seed]) => area in AREAS && Number.isInteger(seed) && seed! >= 0 && seed! <= 0xffffffff)) as Partial<Record<AreaId, number>> : {};
    clean.collectedChests = data.collectedChests && typeof data.collectedChests === 'object' ? Object.fromEntries(Object.entries(data.collectedChests).filter(([area, ids]) => area in AREAS && Array.isArray(ids) && ids.every((id) => typeof id === 'string'))) as Partial<Record<AreaId, string[]>> : {};
    clean.discoveredSecrets = data.discoveredSecrets && typeof data.discoveredSecrets === 'object' ? Object.fromEntries(Object.entries(data.discoveredSecrets).filter(([area, ids]) => area in AREAS && Array.isArray(ids) && ids.every((id) => typeof id === 'string'))) as Partial<Record<AreaId, string[]>> : {};
    if (data.cacheCollected && !clean.collectedChests.valdora?.includes('valdora-chest-0')) {
      clean.collectedChests.valdora = [...(clean.collectedChests.valdora ?? []), 'valdora-chest-0'];
    }
    clean.difficultyTier = Number.isInteger(data.difficultyTier) ? Math.max(0, Math.min(MAX_DIFFICULTY_TIER, data.difficultyTier)) : 0;
    clean.returnArea = data.returnArea && data.returnArea in AREAS ? data.returnArea : null;
    clean.returnDirection = data.returnDirection && ['north', 'south', 'east', 'west'].includes(data.returnDirection) ? data.returnDirection : null;
    clean.discovered = Array.isArray(data.discovered) ? data.discovered.filter((area): area is AreaId => area in AREAS) : [clean.area];
    return clean;
  } catch {
    return null;
  }
}

export function deleteSave(slot: number): void {
  try { localStorage.removeItem(SLOT_KEY(slot)); } catch { /* Storage can be disabled by the browser. */ }
}

export function isValidSession(value: unknown): value is GameSession {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<GameSession>;
  if (data.version !== 1 || !data.area || !(data.area in AREAS) || !Number.isInteger(data.level) || data.level! < 1 || data.level! > MAX_LEVEL
    || !Number.isFinite(data.xp) || data.xp! < 0 || !Number.isFinite(data.x) || !Number.isFinite(data.y)
    || !Number.isFinite(data.health) || data.health! < 0 || !Number.isFinite(data.mana) || data.mana! < 0
    || !Number.isFinite(data.stamina) || data.stamina! < 0 || !Number.isInteger(data.gold) || data.gold! < 0
    || !Number.isInteger(data.attributePoints) || data.attributePoints! < 0 || !Number.isInteger(data.skillPoints) || data.skillPoints! < 0
    || (data.difficultyTier !== undefined && (!Number.isInteger(data.difficultyTier) || data.difficultyTier < 0 || data.difficultyTier > MAX_DIFFICULTY_TIER))
    || (data.returnArea !== undefined && data.returnArea !== null && !(data.returnArea in AREAS))
    || (data.returnDirection !== undefined && data.returnDirection !== null && !['north', 'south', 'east', 'west'].includes(data.returnDirection))
    || (data.worldSeed !== undefined && (!Number.isInteger(data.worldSeed) || data.worldSeed < 0 || data.worldSeed > 0xffffffff))
    || !data.attributes || !data.inventory || !Array.isArray(data.inventory) || !data.equipment) return false;
  const attributeValues = Object.values(data.attributes);
  if (attributeValues.length !== 6 || attributeValues.some((value) => !Number.isInteger(value) || value < 0 || value > 99)) return false;
  if (data.inventory.some((entry) => !entry || !ITEMS[entry.itemId] || !Number.isInteger(entry.quantity) || entry.quantity < 1)) return false;
  if (!Object.entries(data.equipment).every(([slot, itemId]) => {
    const knownSlot = GEAR_SLOTS.some((gear) => gear.id === slot);
    const item = typeof itemId === 'string' ? ITEMS[itemId] : null;
    return knownSlot && (itemId === null || !!item && (item.slot === slot || (slot === 'ring2' && item.slot === 'ring1')));
  })) return false;
  if (data.discovered && (!Array.isArray(data.discovered) || data.discovered.some((area) => typeof area !== 'string' || !(area in AREAS)))) return false;
  if (data.areaSeeds && (typeof data.areaSeeds !== 'object' || Object.entries(data.areaSeeds).some(([area, seed]) => !(area in AREAS) || !Number.isInteger(seed) || seed! < 0 || seed! > 0xffffffff))) return false;
  if (data.collectedChests && (typeof data.collectedChests !== 'object' || Object.entries(data.collectedChests).some(([area, ids]) => !(area in AREAS) || !Array.isArray(ids) || ids.some((id) => typeof id !== 'string')))) return false;
  if (data.discoveredSecrets && (typeof data.discoveredSecrets !== 'object' || Object.entries(data.discoveredSecrets).some(([area, ids]) => !(area in AREAS) || !Array.isArray(ids) || ids.some((id) => typeof id !== 'string')))) return false;
  return !data.defeated || typeof data.defeated === 'object' && !Array.isArray(data.defeated)
    && Object.values(data.defeated).every((list) => Array.isArray(list) && list.every((id) => typeof id === 'string'));
}
