import Phaser from 'phaser';
import './style.css';
import './game/character-menu.css';
import './game/title-screen.css';
import { GameScene } from './game/GameScene';
import { TitleScene } from './game/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#202a22',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  render: { antialias: true, pixelArt: false },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [TitleScene, GameScene],
});

document.querySelector<HTMLButtonElement>('#start-game')!.addEventListener('click', () => {
  game.events.emit('start-game');
});

const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
soundToggle.addEventListener('click', () => {
  game.events.emit('toggle-sound');
  soundToggle.classList.toggle('muted');
});

document.querySelector<HTMLButtonElement>('#restart')!.addEventListener('click', () => {
  game.events.emit('return-checkpoint');
});

const menu = document.querySelector<HTMLElement>('#game-menu')!;
menu.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tab], [data-action], [data-filter], #menu-close');
  if (!target) return;
  if (target.id === 'menu-close') {
    game.events.emit('game-menu-close');
    return;
  }
  if (target.dataset.tab) {
    game.events.emit('game-menu-tab', target.dataset.tab);
    return;
  }
  if (target.dataset.filter) {
    menu.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('active', chip === target));
    menu.querySelectorAll<HTMLElement>('.item-card').forEach((card) => {
      card.hidden = target.dataset.filter !== 'all' && card.dataset.category !== target.dataset.filter;
    });
    return;
  }
  if (target.dataset.action) {
    if (target.dataset.action === 'sort') {
      const grid = menu.querySelector<HTMLElement>('#inventory-grid');
      if (!grid) return;
      const order = grid.dataset.sortMode === 'rarity' ? 'name' : 'rarity';
      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.item-card'));
      cards.sort((a, b) => order === 'name'
        ? (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '')
        : rarityOrder.indexOf(a.dataset.rarity ?? '') - rarityOrder.indexOf(b.dataset.rarity ?? '') || (a.dataset.name ?? '').localeCompare(b.dataset.name ?? ''));
      cards.forEach((card) => grid.append(card));
      grid.dataset.sortMode = order;
      target.textContent = order === 'rarity' ? 'Organizar por raridade' : 'Organizar A-Z';
      return;
    }
    if (target.dataset.action === 'delete-save' && !window.confirm(`Apagar o espaço ${target.dataset.slot}?`)) return;
    game.events.emit('game-menu-action', {
      action: target.dataset.action,
      itemId: target.dataset.item,
      slot: target.dataset.slot,
      attribute: target.dataset.attribute,
    });
  }
});

document.querySelector<HTMLButtonElement>('#quick-potion')!.addEventListener('click', () => {
  game.events.emit('game-menu-action', { action: 'quick-potion', itemId: 'health_potion' });
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !menu.hidden) game.events.emit('game-menu-close');
});
