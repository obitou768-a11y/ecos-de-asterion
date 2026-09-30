import { AREAS, ATTRIBUTE_LABELS, GEAR_SLOTS, ITEMS, type AttributeName, type GameSession, type ItemCategory, type ItemStats, type Rarity } from './systems';
import { deriveStats, inventoryWeight, xpToNextLevel } from './systems';

const rarityLabels: Record<Rarity, string> = { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário' };
const categoryLabels: Record<ItemCategory, string> = { weapon: 'Armas', armor: 'Armaduras', helm: 'Elmos', gloves: 'Luvas', boots: 'Botas', shield: 'Escudos', ring: 'Anéis', amulet: 'Amuletos', potion: 'Poções', food: 'Comidas', material: 'Materiais', quest: 'Missão', relic: 'Relíquias' };
const attributes: AttributeName[] = ['strength', 'dexterity', 'intelligence', 'vitality', 'resistance', 'luck'];
const statLabels: Record<keyof ItemStats, string> = { attack: 'Ataque', defense: 'Defesa', health: 'Vida', mana: 'Mana', stamina: 'Vigor', crit: 'Crítico', magicAttack: 'Ataque mágico', magicDefense: 'Defesa mágica', speed: 'Movimento', resistance: 'Resistência' };

function statLines(stats: ItemStats | undefined): string {
  if (!stats) return '<span class="empty-stats">Sem bônus de atributo</span>';
  return Object.entries(stats).filter(([, value]) => value).map(([key, value]) => `<span class="stat-line">+${value}${key === 'crit' ? '%' : ''} ${statLabels[key as keyof ItemStats]}</span>`).join('');
}

function itemCard(session: GameSession, itemId: string, quantity: number, index: number): string {
  const item = ITEMS[itemId];
  if (!item) return '';
  const currentlyEquipped = Object.values(session.equipment).includes(itemId);
  const currentId = item.slot ? session.equipment[item.slot] : null;
  const current = currentId ? ITEMS[currentId] : null;
  const comparisonStats = [...new Set([...Object.keys(current?.stats ?? {}), ...Object.keys(item.stats ?? {})])] as Array<keyof ItemStats>;
  const comparison = current && item.slot ? `<div class="item-compare"><b>ATUAL · ${current.name}</b><b>NOVO · ${item.name}</b>${comparisonStats.map((stat) => {
    const before = current.stats?.[stat] ?? 0;
    const after = item.stats?.[stat] ?? 0;
    const change = after - before;
    const format = (value: number): string => `${value}${stat === 'crit' ? '%' : ''}`;
    return `<span class="comparison-row"><i>${statLabels[stat]}</i><b>${format(before)} → ${format(after)}</b><em class="${change >= 0 ? 'positive' : 'negative'}">${change > 0 ? '+' : ''}${format(change)}</em></span>`;
  }).join('')}</div>` : '';
  const actions = item.slot
    ? `<button data-action="equip" data-item="${itemId}">${currentlyEquipped ? 'Equipado' : 'Equipar'}</button><button data-action="drop" data-item="${itemId}">Largar</button>`
    : item.heal || item.restoreMana
      ? `<button data-action="use" data-item="${itemId}">Usar</button><button data-action="drop" data-item="${itemId}">Largar</button>`
      : `<button data-action="drop" data-item="${itemId}" ${item.category === 'quest' ? 'disabled' : ''}>${item.category === 'quest' ? 'Missão' : 'Largar'}</button>`;
  return `<article class="item-card rarity-${item.rarity}" data-item-index="${index}" data-name="${item.name}" data-rarity="${item.rarity}" data-category="${item.category}" tabindex="0" title="${item.name} · ${rarityLabels[item.rarity]} · ${item.description}">
    <div class="item-icon">${item.icon}<span class="item-quantity">×${quantity}</span></div>
    <div class="item-info"><div class="item-title">${item.name}</div><div class="item-meta">${rarityLabels[item.rarity]} · ${categoryLabels[item.category]} · ${item.weight} kg</div><div class="item-description">${item.description}</div><div class="item-stats">${statLines(item.stats)}</div>${item.effect ? `<div class="item-effect">${item.effect}</div>` : ''}${comparison}<div class="item-actions">${actions}</div></div>
  </article>`;
}

function renderInventory(session: GameSession): string {
  const entries = [...session.inventory].sort((a, b) => ITEMS[a.itemId].name.localeCompare(ITEMS[b.itemId].name));
  const cards = entries.map((entry, index) => itemCard(session, entry.itemId, entry.quantity, index)).join('');
  const slots = GEAR_SLOTS.map(({ id, label }) => {
    const item = session.equipment[id];
    const definition = item ? ITEMS[item] : null;
    return `<button class="gear-slot ${definition ? `rarity-${definition.rarity}` : ''}" data-action="unequip" data-slot="${id}" ${definition ? '' : 'disabled'}><span>${definition?.icon ?? '··'}</span><b>${label}</b><small>${definition?.name ?? 'Vazio'}</small></button>`;
  }).join('');
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  return `<div class="inventory-layout"><section class="inventory-left"><div class="panel-section-title">EQUIPAMENTO <span>${GEAR_SLOTS.length} SLOTS</span></div><div class="gear-grid">${slots}</div><div class="carry-meter"><span>Capacidade</span><b>${inventoryWeight(session).toFixed(1)} / ${24 + session.attributes.strength * 2} kg</b></div></section><section class="inventory-right"><div class="panel-section-title">MOCHILA <span>${count} ITENS · ${session.gold} OURO</span><button class="sort-button" data-action="sort" data-order="rarity">Organizar A-Z</button></div><div class="inventory-filters"><button class="filter-chip active" data-filter="all">Tudo</button>${Object.entries(categoryLabels).map(([key, label]) => `<button class="filter-chip" data-filter="${key}">${label}</button>`).join('')}</div><div class="inventory-grid" id="inventory-grid">${cards || '<p class="empty-inventory">A mochila está vazia.</p>'}</div><div class="save-slots">${[1,2,3].map((slot) => `<div class="save-slot"><span>ESPAÇO ${slot}</span><button data-action="save" data-slot="${slot}">Salvar</button><button data-action="load" data-slot="${slot}">Carregar</button><button data-action="delete-save" data-slot="${slot}" aria-label="Apagar espaço ${slot}">×</button></div>`).join('')}</div></section></div>`;
}

function renderAttributes(session: GameSession): string {
  const stats = deriveStats(session);
  const progression = xpToNextLevel(session.level);
  const xpPercent = Math.max(0, Math.min(100, session.xp / progression * 100));
  const rows = attributes.map((attribute) => `<div class="attribute-row"><div><strong>${ATTRIBUTE_LABELS[attribute]}</strong><span>Valor base</span></div><b>${session.attributes[attribute]}</b><button data-action="attribute" data-attribute="${attribute}" ${session.attributePoints < 1 ? 'disabled' : ''} aria-label="Aumentar ${ATTRIBUTE_LABELS[attribute]}">+</button></div>`).join('');
  const derived = [['Vida', `${Math.ceil(session.health)} / ${stats.maxHealth}`], ['Mana', `${Math.ceil(session.mana)} / ${stats.maxMana}`], ['Vigor', `${Math.ceil(session.stamina)} / ${stats.maxStamina}`], ['Ataque', stats.attack.toFixed(1)], ['Defesa física', stats.defense.toFixed(1)], ['Ataque mágico', stats.magicAttack.toFixed(1)], ['Defesa mágica', stats.magicDefense.toFixed(1)], ['Chance crítica', `${stats.critChance.toFixed(1)}%`], ['Dano crítico', `${stats.critDamage.toFixed(0)}%`], ['Intervalo de ataque', `${stats.attackCooldown} ms`], ['Velocidade', `${stats.moveSpeed.toFixed(0)}`], ['Carga máxima', `${stats.carryCapacity} kg`]];
  return `<div class="character-overview"><div class="character-level"><span>KAEL · NÍVEL ${session.level}</span><b>${session.xp} / ${progression} XP</b><div class="xp-track"><i style="width:${xpPercent}%"></i></div><small>${session.attributePoints} pontos de atributo · ${session.skillPoints} pontos de habilidade</small></div><div class="attribute-columns"><section><div class="panel-section-title">ATRIBUTOS <span>+3 POR NÍVEL</span></div>${rows}</section><section><div class="panel-section-title">ESTATÍSTICAS DERIVADAS</div><div class="derived-grid">${derived.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div></section></div><div class="progression-note">FORÇA amplia golpes e carga · DESTREZA acelera ataques e críticos · INTELIGÊNCIA fortalece magia · VITALIDADE aumenta vida · RESISTÊNCIA reduz dano · SORTE favorece críticos e raridade do saque.</div></div>`;
}

function renderEquipment(session: GameSession): string {
  const slots = GEAR_SLOTS.map(({ id, label }) => {
    const itemId = session.equipment[id];
    const item = itemId ? ITEMS[itemId] : null;
    return `<div class="equipment-row"><span>${label}</span><b>${item ? `${item.icon} ${item.name}` : 'Vazio'}</b>${item ? `<button data-action="unequip" data-slot="${id}">Desequipar</button>` : ''}</div>`;
  }).join('');
  return `<div class="equipment-sheet"><div class="panel-section-title">EQUIPAMENTO ATUAL <span>BÔNUS APLICADOS EM TEMPO REAL</span></div>${slots}<p>Os bônus de ataque, defesa, vida, mana, vigor, crítico e velocidade são recalculados ao equipar ou remover itens.</p></div>`;
}

export function renderCharacterMenu(session: GameSession, tab: string): string {
  if (tab === 'attributes') return renderAttributes(session);
  if (tab === 'equipment') return renderEquipment(session);
  if (tab === 'skills') return `<div class="skills-panel"><span class="skills-mark">${session.skillPoints}</span><div><h3>Talentos de Kael</h3><p>O primeiro ponto de habilidade chega no nível 5. Os caminhos Combatente, Arcanista e Sobrevivente serão expandidos nesta etapa de progressão.</p></div><div class="skill-paths"><div>COMBATENTE <b>Bloqueio firme · Nível 5</b></div><div>ARCANISTA <b>Eco potente · Nível 10</b></div><div>SOBREVIVENTE <b>Fôlego longo · Nível 15</b></div></div></div>`;
  return renderInventory(session);
}

export function renderAreaBanner(areaId: string, difficultyTier = 0): string {
  const area = AREAS[areaId as keyof typeof AREAS];
  return `<span>${area.name}</span><b>${area.recommended} · AMEAÇA ${difficultyTier}/${25}</b><small>${area.subtitle}</small>`;
}
