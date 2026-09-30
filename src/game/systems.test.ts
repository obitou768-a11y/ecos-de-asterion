import { beforeEach, describe, expect, it } from 'vitest';
import { addExperience, addItem, AREAS, createDefaultSession, crossPortal, deriveStats, dropItem, enemyLevelFor, ensureAreaSeed, equipItem, exitsFor, isValidSession, loadSession, MAX_DIFFICULTY_TIER, removeItem, saveSession, useItem, xpToNextLevel, type PortalDirection } from './systems';
import { generateAreaLayout, mapFingerprint, respawnCell, validateAreaLayout } from './world-generation';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

describe('sistemas de progressão', () => {
  beforeEach(() => storage.clear());

  it('aumenta o custo de XP, concede três pontos e respeita o nível 50', () => {
    const session = createDefaultSession();
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1));
    expect(addExperience(session, xpToNextLevel(1))).toBe(1);
    expect(session.level).toBe(2);
    expect(session.attributePoints).toBe(3);
    session.level = 50;
    expect(addExperience(session, 999999)).toBe(0);
  });

  it('recalcula ataque ao equipar e impede remover item já equipado da mochila', () => {
    const session = createDefaultSession();
    const before = deriveStats(session).attack;
    expect(addItem(session, 'iron_sword')).toBe(true);
    expect(equipItem(session, 'iron_sword')).toBe('weapon');
    expect(deriveStats(session).attack).toBeGreaterThan(before);
    expect(session.equipment.weapon).toBe('iron_sword');
    expect(removeItem(session, 'iron_sword')).toBe(false);
  });

  it('usa consumível e restaura o estado ao carregar um espaço salvo', () => {
    const session = createDefaultSession();
    session.health = 30;
    expect(useItem(session, 'health_potion')).toBe(true);
    expect(session.health).toBe(75);
    expect(saveSession(session, 1)).toBe(true);
    expect(loadSession(1)?.health).toBe(75);
    expect(loadSession(1)?.area).toBe('valdora');
  });

  it('cada atributo melhora uma estatística derivada correspondente', () => {
    const session = createDefaultSession();
    const before = deriveStats(session);
    session.attributes.strength += 1;
    session.attributes.dexterity += 1;
    session.attributes.intelligence += 1;
    session.attributes.vitality += 1;
    session.attributes.resistance += 1;
    session.attributes.luck += 1;
    const after = deriveStats(session);
    expect(after.attack).toBeGreaterThan(before.attack);
    expect(after.attackCooldown).toBeLessThan(before.attackCooldown);
    expect(after.maxMana).toBeGreaterThan(before.maxMana);
    expect(after.maxHealth).toBeGreaterThan(before.maxHealth);
    expect(after.defense).toBeGreaterThan(before.defense);
    expect(after.critChance).toBeGreaterThan(before.critChance);
  });

  it('recusa consumível sem efeito, item de missão descartado e save corrompido', () => {
    const session = createDefaultSession();
    expect(useItem(session, 'health_potion')).toBe(false);
    expect(session.inventory.find((entry) => entry.itemId === 'health_potion')?.quantity).toBe(2);
    expect(addItem(session, 'broken_seal')).toBe(true);
    expect(dropItem(session, 'broken_seal')).toBe(false);
    storage.set('asterion-save-v1-slot-2', '{inválido');
    expect(loadSession(2)).toBeNull();
    expect(isValidSession({ ...session, version: 99 })).toBe(false);
  });

  it('permite dois anéis e valida os três espaços de salvamento', () => {
    const session = createDefaultSession();
    expect(addItem(session, 'copper_ring', 2)).toBe(true);
    expect(equipItem(session, 'copper_ring')).toBe('ring1');
    expect(equipItem(session, 'copper_ring')).toBe('ring2');
    expect(session.equipment.ring1).toBe('copper_ring');
    expect(session.equipment.ring2).toBe('copper_ring');
    expect(saveSession(session, 0)).toBe(false);
    expect(saveSession(session, 3)).toBe(true);
    expect(loadSession(3)?.equipment.ring2).toBe('copper_ring');
  });

  it('cada região tem quatro saídas cardeais distintas', () => {
    const directions: PortalDirection[] = ['north', 'south', 'east', 'west'];
    Object.values(AREAS).forEach((area) => {
      expect(Object.keys(area.exits).sort()).toEqual([...directions].sort());
      expect(new Set(Object.values(area.exits)).size).toBe(4);
      expect(Object.values(area.exits)).not.toContain(area.id);
    });
  });

  it('cada travessia aumenta a pressão e reentrada respawna somente a região de destino', () => {
    const session = createDefaultSession();
    session.defeated.valdora = ['valdora-0'];
    expect(crossPortal(session, 'nareth', 'north')).toBe(1);
    expect(session.returnArea).toBe('valdora');
    expect(session.returnDirection).toBe('south');
    expect(exitsFor(session).south).toBe('valdora');
    expect(session.defeated.valdora).toEqual(['valdora-0']);
    session.defeated.nareth = ['nareth-0'];
    expect(crossPortal(session, 'valdora', 'south')).toBe(2);
    expect(session.defeated.valdora).toEqual([]);
    expect(session.defeated.nareth).toEqual(['nareth-0']);
    expect(enemyLevelFor(session, 'valdora', 0)).toBeGreaterThan(AREAS.valdora.enemyLevel);
    for (let crossing = 2; crossing < MAX_DIFFICULTY_TIER + 3; crossing++) crossPortal(session, 'nareth', 'north');
    expect(session.difficultyTier).toBe(MAX_DIFFICULTY_TIER);
    expect(enemyLevelFor(session, 'khar', 2)).toBeLessThanOrEqual(50);
  });

  it('mantém seeds por mundo/região e salva baús coletados', () => {
    const session = createDefaultSession();
    session.worldSeed = 424242;
    const narethSeed = ensureAreaSeed(session, 'nareth');
    expect(ensureAreaSeed(session, 'nareth')).toBe(narethSeed);
    expect(ensureAreaSeed(session, 'valen')).not.toBe(narethSeed);
    session.collectedChests.nareth = ['nareth-chest-0'];
    expect(saveSession(session, 2)).toBe(true);
    const loaded = loadSession(2);
    expect(loaded?.worldSeed).toBe(424242);
    expect(loaded?.areaSeeds.nareth).toBe(narethSeed);
    expect(loaded?.collectedChests.nareth).toEqual(['nareth-chest-0']);
  });

  it('migra saves antigos para uma seed estável e conserva o baú legado aberto', () => {
    const legacy = JSON.parse(JSON.stringify({ ...createDefaultSession(), worldSeed: undefined, areaSeeds: undefined, collectedChests: undefined, cacheCollected: true })) as Record<string, unknown>;
    storage.set('asterion-save-v1-auto', JSON.stringify(legacy));
    const firstLoad = loadSession();
    const secondLoad = loadSession();
    expect(firstLoad?.worldSeed).toBeGreaterThan(0);
    expect(secondLoad?.worldSeed).toBe(firstLoad?.worldSeed);
    expect(secondLoad?.collectedChests.valdora).toContain('valdora-chest-0');
  });

  it('reconstrói mapas idênticos pela mesma seed e valida layouts diferentes em várias regiões', () => {
    const requiredByArea: Record<keyof typeof AREAS, string[]> = {
      valdora: ['house', 'ruins', 'wall'], nareth: ['tree', 'lake', 'cave', 'ruins'],
      valen: ['ruins', 'wall', 'tower', 'crypt'], mire: ['tree', 'lake', 'bridge', 'cave'],
      khar: ['rock', 'cave', 'bridge', 'ruins'],
    };
    (Object.keys(AREAS) as Array<keyof typeof AREAS>).forEach((areaId) => {
      const fingerprints = new Set<string>();
      for (let index = 0; index < 8; index++) {
        const seed = (index + 1) * 0x10203;
        const layout = generateAreaLayout(areaId, seed);
        expect(validateAreaLayout(layout)).toBe(true);
        expect(layout.enemySpawns).toHaveLength(8);
        expect(layout.chests.length).toBeGreaterThanOrEqual(2);
        expect(layout.secrets.length).toBeGreaterThanOrEqual(1);
        expect(respawnCell(null, layout)).toEqual(layout.entry);
        (['north', 'south', 'east', 'west'] as PortalDirection[]).forEach((direction) => {
          const spawn = respawnCell(direction, layout);
          expect(layout.roads[spawn.row][spawn.col]).toBe(true);
          expect(layout.blocked[spawn.row][spawn.col]).toBe(false);
          expect(layout.features.some((feature) => spawn.col >= feature.col && spawn.col < feature.col + feature.width && spawn.row >= feature.row && spawn.row < feature.row + feature.height)).toBe(false);
        });
        requiredByArea[areaId].forEach((kind) => expect(layout.features.some((feature) => feature.kind === kind)).toBe(true));
        expect(mapFingerprint(generateAreaLayout(areaId, seed))).toBe(mapFingerprint(layout));
        fingerprints.add(mapFingerprint(layout));
      }
      expect(fingerprints.size).toBeGreaterThan(1);
    });
  });
});
