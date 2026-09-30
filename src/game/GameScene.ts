import Phaser from 'phaser';
import { renderAreaBanner, renderCharacterMenu } from './character-menu';
import { addExperience, addItem, AREAS, createDefaultSession, crossPortal, deleteSave, deriveStats, dropItem, enemyLevelFor, equipItem, exitsFor, inventoryWeight, ITEMS, loadSession, MAX_LEVEL, OPPOSITE_PORTAL, saveSession, type AreaId, type AttributeName, type GameSession, type GearSlot, type ItemDefinition, type PortalDirection, type Rarity, unequipItem, useItem, xpToNextLevel } from './systems';
import { ensureAreaSeed } from './systems';
import { generateAreaLayout, MAP_COLUMNS, MAP_ROWS, MAP_TILE_SIZE, respawnCell, worldPosition, type AreaLayout, type MapFeature } from './world-generation';

type Enemy = Phaser.Physics.Arcade.Sprite & {
  id: string;
  hp: number;
  maxHp: number;
  speed: number;
  level: number;
  attackAt: number;
  hurtAt: number;
  kind: 'hollow' | 'stalker' | 'wisp';
};

type LootDrop = { x: number; y: number; itemId: string | null; amount: number; view: Phaser.GameObjects.Container };
type MenuAction = { action: string; itemId?: string; slot?: string; attribute?: string };

const WORLD = { width: MAP_COLUMNS * MAP_TILE_SIZE, height: MAP_ROWS * MAP_TILE_SIZE };
const COLORS = { ground: 0x303b2e, path: 0x514638, wall: 0x62604e, player: 0xd8c8a5 };
const PORTAL_POSITIONS: Record<PortalDirection, { x: number; y: number }> = {
  north: { x: 992, y: 32 }, south: { x: 992, y: 1248 }, west: { x: 32, y: 672 }, east: { x: 1888, y: 672 },
};
const PORTAL_SPAWNS: Record<PortalDirection, { x: number; y: number }> = {
  north: { x: 992, y: 160 }, south: { x: 992, y: 1120 }, west: { x: 160, y: 672 }, east: { x: 1760, y: 672 },
};
const PORTAL_LABELS: Record<PortalDirection, string> = { north: 'NORTE', south: 'SUL', east: 'LESTE', west: 'OESTE' };

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private session: GameSession = loadSession() ?? createDefaultSession();
  private areaId: AreaId = this.session.area;
  private layout!: AreaLayout;
  private arrival: PortalDirection | 'saved' = 'saved';
  private nearbyPortal: { direction: PortalDirection; target: AreaId } | null = null;
  private menuOpen = false;
  private transitioning = false;
  private menuTab = 'inventory';
  private drops: LootDrop[] = [];
  private chestSprites = new Map<string, Phaser.GameObjects.Container>();
  private lastSaveAt = 0;
  private invulnerableUntil = 0;
  private dodgeUntil = 0;
  private attackUntil = 0;
  private attackReadyAt = 0;
  private specialReadyAt = 0;
  private facing = new Phaser.Math.Vector2(1, 0);
  private soundOn = false;
  private audio?: AudioContext;
  private minimap!: HTMLCanvasElement;
  private toastTimer?: Phaser.Time.TimerEvent;
  private timeLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  private get health(): number { return this.session.health; }
  private set health(value: number) { this.session.health = value; }
  private get mana(): number { return this.session.mana; }
  private set mana(value: number) { this.session.mana = value; }
  private get stamina(): number { return this.session.stamina; }
  private set stamina(value: number) { this.session.stamina = value; }
  private get xp(): number { return this.session.xp; }
  private set xp(value: number) { this.session.xp = value; }
  private get level(): number { return this.session.level; }

  init(data?: { area?: AreaId; entry?: PortalDirection | 'saved' }): void {
    this.areaId = data?.area ?? this.session.area;
    this.session.area = this.areaId;
    this.arrival = data?.entry ?? 'saved';
  }

  preload(): void {
    this.load.svg('kael-idle', '/assets/kael-idle.svg', { width: 128, height: 128 });
    this.load.svg('kael-run', '/assets/kael-run.svg', { width: 128, height: 128 });
    this.load.svg('kael-attack', '/assets/kael-attack.svg', { width: 128, height: 128 });
  }

  create(): void {
    this.areaId = this.session.area;
    document.querySelector('#start-screen')?.setAttribute('hidden', '');
    document.querySelector('.hud')?.removeAttribute('hidden');
    document.querySelector('#game-footer')?.removeAttribute('hidden');
    document.querySelector('.chapter')?.removeAttribute('hidden');
    document.querySelector('#sound-toggle')?.removeAttribute('hidden');
    const firstGeneration = this.session.areaSeeds[this.areaId] === undefined;
    const seed = ensureAreaSeed(this.session, this.areaId);
    this.layout = generateAreaLayout(this.areaId, seed);
    this.session.areaSeeds[this.areaId] = this.layout.seed;
    if (firstGeneration && this.arrival === 'saved') {
      const start = worldPosition(this.layout.entry);
      this.session.x = start.x;
      this.session.y = start.y;
    }
    if (this.health <= 0) {
      const stats = deriveStats(this.session);
      this.health = stats.maxHealth;
      this.mana = stats.maxMana;
      this.stamina = stats.maxStamina;
      const spawn = worldPosition(respawnCell(this.session.returnDirection, this.layout));
      this.session.x = spawn.x;
      this.session.y = spawn.y;
      saveSession(this.session);
      this.showToast('Kael retornou ao portal anterior com vida restaurada.');
    }
    this.invulnerableUntil = this.time.now + 1800;
    this.menuOpen = false;
    this.transitioning = false;
    this.drops = [];
    this.chestSprites.clear();
    this.nearbyPortal = null;
    document.querySelector('#game-menu')?.setAttribute('hidden', '');
    this.drawWorld();
    this.createTextures();
    this.obstacles = this.physics.add.staticGroup();
    this.addObstacles();
    const spawn = this.arrival === 'saved' ? { x: this.session.x, y: this.session.y } : PORTAL_SPAWNS[this.arrival];
    this.player = this.physics.add.sprite(spawn.x, spawn.y, this.playerTexture('idle'));
    this.player.setScale(this.player.texture.key === 'kael-fallback' ? 1 : 0.62);
    this.player.setDepth(5).setCollideWorldBounds(true).setDrag(900, 900).setMaxVelocity(250);
    this.player.setCircle(this.player.texture.key === 'kael-fallback' ? 10 : 19, this.player.texture.key === 'kael-fallback' ? 6 : 45, this.player.texture.key === 'kael-fallback' ? 12 : 46);
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.spawnEnemies();
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.player, this.enemies, (_player, enemy) => this.touchDamage(enemy as Enemy));
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height).startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(Math.min(1.15, Math.max(0.8, this.scale.width / 1000)));
    this.cameras.main.setBackgroundColor('#252f26');
    this.cameras.main.fadeIn(400, 10, 14, 11);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,J,K,F,E,TAB,C,Q') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on('keydown-J', () => this.attack());
    this.input.keyboard!.on('keydown-K', () => this.castPulse());
    this.input.keyboard!.on('keydown-SPACE', () => this.dodge());
    this.input.keyboard!.on('keydown-F', () => this.interact());
    this.input.keyboard!.on('keydown-E', () => this.usePortal());
    this.input.keyboard!.on('keydown-TAB', (event: KeyboardEvent) => { event.preventDefault(); this.menuOpen ? this.closeMenu() : this.openMenu('inventory'); });
    this.input.keyboard!.on('keydown-C', () => this.openMenu('attributes'));
    this.input.keyboard!.on('keydown-Q', () => this.useConsumable('health_potion'));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.castPulse();
      else if (pointer.leftButtonDown()) this.attack();
    });
    this.input.mouse?.disableContextMenu();
    this.events.on('toggle-sound', this.toggleSound, this);
    this.game.events.off('game-menu-action', this.handleMenuAction, this);
    this.game.events.off('game-menu-tab', this.handleMenuTab, this);
    this.game.events.off('game-menu-close', this.closeMenu, this);
    this.game.events.on('game-menu-action', this.handleMenuAction, this);
    this.game.events.on('game-menu-tab', this.handleMenuTab, this);
    this.game.events.on('game-menu-close', this.closeMenu, this);
    this.game.events.off('return-checkpoint', this.returnCheckpoint, this);
    this.game.events.on('return-checkpoint', this.returnCheckpoint, this);
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(Math.min(1.15, Math.max(0.8, size.width / 1000)));
    });
    this.minimap = document.querySelector<HTMLCanvasElement>('#minimap')!;
    this.timeLabel = this.add.text(0, 0, '04:17', { fontFamily: 'DM Mono', fontSize: '11px', color: '#d4cdb6' }).setScrollFactor(0).setDepth(20);
    if (this.arrival !== 'saved') this.showRegionBanner();
    this.showToast(`A Ruptura alcançou ${AREAS[this.areaId].name}. Explore e sobreviva.`);
    saveSession(this.session);
    this.syncHud();
  }

  update(time: number, delta: number): void {
    const player = this.player;
    if (!player?.active) return;
    if (this.health <= 0) return;
    if (this.menuOpen) return;
    const inputX = Number(this.keys.D.isDown || this.cursors.right.isDown) - Number(this.keys.A.isDown || this.cursors.left.isDown);
    const inputY = Number(this.keys.S.isDown || this.cursors.down.isDown) - Number(this.keys.W.isDown || this.cursors.up.isDown);
    const direction = new Phaser.Math.Vector2(inputX, inputY).normalize();
    const sprinting = (this.keys.SHIFT.isDown || this.cursors.shift?.isDown) && direction.lengthSq() > 0 && this.stamina > 0 && time > this.dodgeUntil;
    const dodging = time < this.dodgeUntil;
    const movementSpeed = deriveStats(this.session).moveSpeed;
    const speed = dodging ? 440 : sprinting ? movementSpeed * 1.48 : movementSpeed;
    if (!dodging) {
      player.setAcceleration(direction.x * 950, direction.y * 950);
      if (sprinting) this.stamina = Math.max(0, this.stamina - delta * 0.023);
      else this.stamina = Math.min(100, this.stamina + delta * 0.016);
    }
    if (direction.lengthSq() > 0) this.facing.copy(direction);
    const moving = direction.lengthSq() > 0 || player.body!.velocity.length() > 15;
    this.setPlayerPose(player.getData('attacking') ? 'attack' : dodging || moving ? 'run' : 'idle');
    if (time >= this.dodgeUntil) player.setMaxVelocity(speed);
    if (time > this.invulnerableUntil && time < this.dodgeUntil) player.setAlpha(Math.floor(time / 55) % 2 ? 0.45 : 1);
    else if (time >= this.invulnerableUntil) player.setAlpha(1);
    player.setFlipX(this.facing.x < 0);
    if (time > this.attackUntil && player.getData('attacking')) {
      player.setData('attacking', false);
      player.setTint(0xffffff);
    }
    this.updateEnemies(time);
    this.updateInteractionPrompt();
    this.syncHud();
    this.drawMinimap();
    this.timeLabel?.setPosition(this.scale.width - 54, this.scale.height - 34);
    this.session.x = this.player.x;
    this.session.y = this.player.y;
    if (time - this.lastSaveAt > 5000) {
      saveSession(this.session);
      this.lastSaveAt = time;
    }
  }

  private drawWorld(): void {
    const area = AREAS[this.areaId];
    const graphics = this.add.graphics();
    graphics.fillStyle(area.ground).fillRect(0, 0, WORLD.width, WORLD.height);
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLUMNS; col++) {
        const variation = ((col * 13 + row * 7 + this.layout.seed) % 19);
        const x = col * MAP_TILE_SIZE;
        const y = row * MAP_TILE_SIZE;
        graphics.fillStyle(variation < 3 ? area.trim : variation > 16 ? 0x202821 : area.ground, 0.42);
        graphics.fillRect(x, y, MAP_TILE_SIZE - 2, MAP_TILE_SIZE - 2);
        if (this.layout.roads[row][col]) {
          graphics.fillStyle(area.path, 0.94).fillRect(x, y, MAP_TILE_SIZE, MAP_TILE_SIZE);
          graphics.lineStyle(1, area.trim, 0.2).strokeRect(x + 3, y + 3, MAP_TILE_SIZE - 6, MAP_TILE_SIZE - 6);
        }
      }
    }
    this.drawRubble(graphics);
    this.drawLanterns();
    const entry = worldPosition(this.layout.entry);
    this.add.text(entry.x + 22, entry.y + 72, area.name.toUpperCase(), { fontFamily: 'DM Mono', fontSize: '10px', color: '#c6b394', letterSpacing: 2 }).setAlpha(0.48).setDepth(1);
    (Object.entries(exitsFor(this.session)) as Array<[PortalDirection, AreaId]>).forEach(([direction, target]) => this.drawPortal(direction, target));
  }

  private drawPortal(direction: PortalDirection, target: AreaId): void {
    const { x, y } = PORTAL_POSITIONS[direction];
    const glow = this.add.ellipse(x, y, 75, 156, 0x9ab9a0, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    this.add.ellipse(x, y, 38, 122, 0x171f19, 0.9).setStrokeStyle(3, 0xb19868, 0.82).setDepth(3);
    this.add.ellipse(x, y, 22, 96, AREAS[this.areaId].trim, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    const labelPosition = direction === 'north' ? { x, y: y + 88 } : direction === 'south' ? { x, y: y - 88 } : direction === 'east' ? { x: x - 78, y } : { x: x + 78, y };
    this.add.text(labelPosition.x, labelPosition.y, PORTAL_LABELS[direction], { fontFamily: 'DM Mono', fontSize: '8px', color: '#e0c995', letterSpacing: 1 }).setOrigin(0.5).setDepth(4);
    this.add.text(labelPosition.x, labelPosition.y + 11, AREAS[target].name, { fontFamily: 'DM Mono', fontSize: '7px', color: '#c2c1ad' }).setOrigin(0.5).setDepth(4);
    this.tweens.add({ targets: glow, alpha: 0.04, scale: 1.12, duration: 1200, yoyo: true, repeat: -1 });
  }

  private drawRubble(graphics: Phaser.GameObjects.Graphics): void {
    this.layout.features.forEach((feature) => this.drawFeature(graphics, feature));
    for (let index = 0; index < 90; index++) {
      const x = (index * 173 + this.layout.seed) % WORLD.width;
      const y = (index * 293 + (this.layout.seed >>> 5)) % WORLD.height;
      graphics.fillStyle(index % 4 ? 0x9a8865 : 0xb1573c, 0.32).fillCircle(x, y, 1 + (index % 3));
    }
  }

  private drawFeature(graphics: Phaser.GameObjects.Graphics, feature: MapFeature): void {
    if (feature.kind === 'chest') {
      if (!this.isChestCollected(feature.id)) this.drawChestSprite(feature);
      return;
    }
    const x = feature.col * MAP_TILE_SIZE;
    const y = feature.row * MAP_TILE_SIZE;
    const width = feature.width * MAP_TILE_SIZE;
    const height = feature.height * MAP_TILE_SIZE;
    const variation = feature.variant;
    const stoneColors = [0x655e4c, 0x716951, 0x5a5d52, 0x77705d, 0x625a49, 0x74766a];
    const stone = stoneColors[variation];
    graphics.fillStyle(0x111713, 0.34).fillEllipse(x + width / 2, y + height * 0.78, width * 1.15, height * 0.45);
    switch (feature.kind) {
      case 'tree':
        graphics.fillStyle(0x493b2d).fillRect(x + 25, y + 30, 14, 31);
        graphics.fillStyle([0x40563c, 0x4b603f, 0x374e3c, 0x5b6343, 0x3d5948, 0x4d5940][variation]);
        graphics.fillCircle(x + 32, y + 24, 25).fillCircle(x + 19, y + 34, 17).fillCircle(x + 45, y + 35, 17);
        break;
      case 'rock':
        graphics.fillStyle(stone).fillTriangle(x + 5, y + height - 5, x + width * 0.35, y + 8, x + width * 0.6, y + height - 5);
        graphics.fillStyle(stoneColors[(variation + 2) % stoneColors.length]).fillTriangle(x + width * 0.3, y + height - 5, x + width * 0.72, y + 15, x + width - 4, y + height - 5);
        break;
      case 'wall':
      case 'ruins':
      case 'tower':
      case 'crypt':
        graphics.fillStyle(stone).fillRect(x + 5, y + 12, width - 10, height - 14);
        graphics.fillStyle(0x91866c).fillRect(x + 2, y + 7, width - 4, 10);
        for (let pillar = 0; pillar < feature.width; pillar++) {
          graphics.fillStyle(stoneColors[(variation + pillar) % stoneColors.length]).fillRect(x + pillar * MAP_TILE_SIZE + 7, y + 18, 12, height - 23);
        }
        graphics.fillStyle(0x222720).fillRect(x + width * 0.38, y + height * 0.54, width * 0.24, height * 0.46);
        break;
      case 'house':
        graphics.fillStyle(0x594d3c).fillRect(x + 7, y + height * 0.34, width - 14, height * 0.62);
        graphics.fillStyle([0x734638, 0x74573c, 0x5e5142, 0x864f38, 0x6c6449, 0x755b4c][variation]);
        graphics.fillTriangle(x + 1, y + height * 0.38, x + width / 2, y + 3, x + width - 1, y + height * 0.38);
        graphics.fillStyle(0x25251e).fillRect(x + width * 0.42, y + height * 0.65, width * 0.16, height * 0.31);
        break;
      case 'cave':
        graphics.fillStyle(stone).fillEllipse(x + width / 2, y + height / 2, width * 0.94, height * 0.98);
        graphics.fillStyle(0x111713).fillEllipse(x + width / 2, y + height * 0.58, width * 0.58, height * 0.72);
        graphics.lineStyle(2, 0xa4946b, 0.65).strokeEllipse(x + width / 2, y + height / 2, width * 0.92, height * 0.96);
        break;
      case 'lake':
        graphics.fillStyle(0x202f32, 0.94).fillEllipse(x + width / 2, y + height / 2, width * 0.92, height * 0.84);
        graphics.lineStyle(3, 0x71857a, 0.72).strokeEllipse(x + width / 2, y + height / 2, width * 0.9, height * 0.82);
        graphics.lineStyle(1, 0x9aa995, 0.45).lineBetween(x + width * 0.27, y + height * 0.42, x + width * 0.58, y + height * 0.38);
        break;
      case 'bridge':
        graphics.fillStyle(0x574431).fillRect(x, y + height * 0.25, width, height * 0.5);
        for (let plank = 0; plank < feature.width; plank++) graphics.lineStyle(1, 0xb09364, 0.7).lineBetween(x + plank * MAP_TILE_SIZE, y + height * 0.25, x + plank * MAP_TILE_SIZE, y + height * 0.75);
        break;
      case 'clearing':
        graphics.fillStyle(0xa1a16d, 0.16).fillEllipse(x + width / 2, y + height / 2, width, height * 0.75);
        for (let tuft = 0; tuft < 5; tuft++) graphics.fillStyle(0x87906a, 0.42).fillCircle(x + 12 + (tuft * 23) % Math.max(24, width - 16), y + 12 + (tuft * 31) % Math.max(24, height - 16), 2);
        break;
      case 'secret':
        graphics.lineStyle(2, 0xc2a66d, this.isSecretDiscovered(feature.id) ? 0.78 : 0.2).strokeEllipse(x + width / 2, y + height / 2, width * 0.8, height * 0.72);
        graphics.fillStyle(0x202820, this.isSecretDiscovered(feature.id) ? 0.6 : 0.2).fillEllipse(x + width / 2, y + height / 2, width * 0.54, height * 0.48);
        break;
      case 'camp':
        graphics.fillStyle(0x775c3f).fillTriangle(x + 7, y + height - 5, x + width * 0.48, y + 9, x + width * 0.72, y + height - 5);
        graphics.fillStyle(0xb65b3e, 0.9).fillCircle(x + width * 0.82, y + height * 0.72, 7);
        graphics.fillStyle(0xf0bd69, 0.75).fillCircle(x + width * 0.82, y + height * 0.72, 3);
        break;
    }
  }

  private drawChestSprite(feature: MapFeature): void {
    const centerX = feature.col * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    const centerY = feature.row * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    const shadow = this.add.ellipse(0, 14, 48, 15, 0x101612, 0.4);
    const body = this.add.rectangle(0, 6, 38, 23, 0x65452f).setStrokeStyle(2, 0xc19b5e);
    const lid = this.add.rectangle(0, -8, 42, 10, 0xa27e4a).setStrokeStyle(2, 0xd2b173);
    const clasp = this.add.rectangle(0, 7, 4, 12, 0xd7bb78);
    const container = this.add.container(centerX, centerY, [shadow, body, lid, clasp]).setDepth(4);
    this.chestSprites.set(feature.id, container);
  }

  private isChestCollected(chestId: string): boolean {
    if (this.session.collectedChests[this.areaId]?.includes(chestId)) return true;
    return this.areaId === 'valdora' && chestId === 'valdora-chest-0' && this.session.cacheCollected;
  }

  private isSecretDiscovered(secretId: string): boolean {
    return this.session.discoveredSecrets[this.areaId]?.includes(secretId) ?? false;
  }

  private nearbyChest(): MapFeature | null {
    let nearest: MapFeature | null = null;
    let nearestDistance = 82;
    this.layout.chests.forEach((chest) => {
      if (this.isChestCollected(chest.id)) return;
      const position = worldPosition({ col: chest.col, row: chest.row });
      const distance = Phaser.Math.Distance.Between(position.x, position.y, this.player.x, this.player.y);
      if (distance < nearestDistance) {
        nearest = chest;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  private nearbySecret(): MapFeature | null {
    let nearest: MapFeature | null = null;
    let nearestDistance = 74;
    this.layout.secrets.forEach((secret) => {
      if (this.isSecretDiscovered(secret.id)) return;
      const position = worldPosition({ col: secret.col, row: secret.row });
      const distance = Phaser.Math.Distance.Between(position.x, position.y, this.player.x, this.player.y);
      if (distance < nearestDistance) {
        nearest = secret;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  private drawLanterns(): void {
    const camps = this.layout.features.filter((feature) => feature.kind === 'camp').map((feature) => ({
      x: feature.col * MAP_TILE_SIZE + feature.width * MAP_TILE_SIZE * 0.82,
      y: feature.row * MAP_TILE_SIZE + feature.height * MAP_TILE_SIZE * 0.72,
    }));
    camps.forEach(({ x, y }) => {
      this.add.circle(x, y, 52, 0xe79b54, 0.035).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
      const flame = this.add.circle(x, y, 12, 0xe27947, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      this.tweens.add({ targets: flame, alpha: 0.08, scale: 1.65, duration: 900 + (x % 4) * 120, yoyo: true, repeat: -1 });
      this.add.circle(x, y, 4, 0xeabd74, 0.85).setDepth(4);
    });
  }

  private createTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
    graphics.generateTexture('pixel', 2, 2);
    graphics.clear();
    graphics.fillStyle(0x000000, 0.35).fillEllipse(16, 29, 25, 10);
    graphics.fillStyle(COLORS.player).fillCircle(16, 12, 8);
    graphics.fillStyle(0x553e32).fillRoundedRect(8, 19, 16, 12, 4);
    graphics.fillStyle(0x96815a).fillRect(7, 20, 18, 4);
    graphics.fillStyle(0xddd0ae).fillTriangle(22, 21, 32, 26, 22, 27);
    graphics.generateTexture('kael-fallback', 34, 34);
    graphics.clear();
    graphics.fillStyle(0x000000, 0.35).fillEllipse(15, 29, 26, 9);
    graphics.fillStyle(0x843f38).fillCircle(15, 15, 12);
    graphics.fillStyle(0x392522).fillTriangle(5, 12, 10, 0, 14, 12);
    graphics.fillStyle(0xb77a57).fillCircle(20, 13, 2);
    graphics.generateTexture('hollow', 32, 32);
    graphics.clear();
    graphics.fillStyle(0x000000, 0.25).fillEllipse(16, 26, 23, 8);
    graphics.fillStyle(0x5d7760).fillCircle(16, 15, 10);
    graphics.fillStyle(0xa2a36d).fillCircle(12, 12, 2).fillCircle(20, 12, 2);
    graphics.generateTexture('stalker', 32, 32);
    graphics.clear();
    graphics.fillStyle(0x7aa7a0, 0.7).fillCircle(14, 14, 11);
    graphics.fillStyle(0xd1eed5, 0.9).fillCircle(13, 12, 4);
    graphics.generateTexture('wisp', 28, 28);
    graphics.destroy();
  }

  private playerTexture(pose: 'idle' | 'run' | 'attack'): string {
    const key = `kael-${pose}`;
    return this.textures.exists(key) ? key : 'kael-fallback';
  }

  private setPlayerPose(pose: 'idle' | 'run' | 'attack'): void {
    const texture = this.playerTexture(pose);
    if (this.player.texture.key === texture) return;
    this.player.setTexture(texture);
    this.player.setScale(texture === 'kael-fallback' ? 1 : 0.62);
  }

  private addObstacles(): void {
    this.layout.features.filter((feature) => feature.blocksMovement).forEach((feature) => {
      const width = feature.width * MAP_TILE_SIZE;
      const height = feature.height * MAP_TILE_SIZE;
      const x = feature.col * MAP_TILE_SIZE;
      const y = feature.row * MAP_TILE_SIZE;
      const body = this.obstacles.create(x + width / 2, y + height / 2, 'pixel') as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false).setSize(width - 12, height - 12).refreshBody();
    });
  }

  private spawnEnemies(): void {
    const archetypes: Enemy['kind'][] = ['hollow', 'stalker', 'hollow', 'wisp', 'hollow', 'stalker', 'wisp', 'stalker'];
    const defeated = new Set(this.session.defeated[this.areaId] ?? []);
    this.layout.enemySpawns.forEach((cell, index) => {
      const kind = archetypes[index % archetypes.length];
      const enemyId = `${this.areaId}-${index}`;
      if (defeated.has(enemyId)) return;
      const { x, y } = worldPosition(cell);
      const texture = kind === 'hollow' ? 'hollow' : kind === 'stalker' ? 'stalker' : 'wisp';
      const enemy = this.enemies.create(x, y, texture) as Enemy;
      enemy.id = enemyId;
      enemy.kind = kind;
      enemy.level = enemyLevelFor(this.session, this.areaId, index);
      const regionScale = 1 + (enemy.level - 1) * 0.14;
      enemy.hp = Math.round((kind === 'hollow' ? 46 : kind === 'stalker' ? 34 : 27) * regionScale);
      enemy.maxHp = enemy.hp;
      enemy.speed = (kind === 'stalker' ? 85 : kind === 'wisp' ? 72 : 62) * Math.min(1.45, 1 + (enemy.level - 1) * 0.018);
      enemy.attackAt = 0;
      enemy.hurtAt = 0;
      enemy.setDepth(4).setCircle(kind === 'wisp' ? 9 : 11, 5, 5).setCollideWorldBounds(true);
      enemy.setData('homeX', x);
      enemy.setData('homeY', y);
      enemy.setData('phase', index % 2 ? 'patrol' : 'guard');
      enemy.setData('phaseAt', 0);
      if (kind === 'wisp') this.tweens.add({ targets: enemy, y: y - 9, duration: 950 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
  }

  private updateEnemies(time: number): void {
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) return;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (distance < 300) {
        if (distance > (enemy.kind === 'wisp' ? 58 : 38)) {
          this.physics.moveToObject(enemy, this.player, enemy.speed);
          enemy.setFlipX(this.player.x < enemy.x);
          enemy.setTint(time < enemy.hurtAt ? 0xffffff : 0xd2aaa0);
        } else {
          enemy.setVelocity(0, 0);
          if (time > enemy.attackAt) {
            enemy.attackAt = time + (enemy.kind === 'wisp' ? 1700 : 1350);
            this.enemyAttack(enemy, time);
          }
        }
      } else {
        enemy.setVelocity(0, 0);
        const phase = enemy.getData('phaseAt') as number;
        if (time > phase) {
          enemy.setData('phaseAt', time + 1600);
          enemy.setData('phase', Math.random() > 0.5 ? 'patrol' : 'guard');
          if (enemy.getData('phase') === 'patrol') {
            this.physics.moveTo(enemy, (enemy.getData('homeX') as number) + Phaser.Math.Between(-45, 45), (enemy.getData('homeY') as number) + Phaser.Math.Between(-35, 35), 22);
          }
        }
      }
    });
  }

  private attack(): void {
    const now = this.time.now;
    if (now < this.attackReadyAt || now < this.dodgeUntil) return;
    const stats = deriveStats(this.session);
    this.attackReadyAt = now + stats.attackCooldown;
    this.attackUntil = now + 170;
    this.player.setData('attacking', true).setTint(0xffd29a);
    const centerX = this.player.x + this.facing.x * 36;
    const centerY = this.player.y + this.facing.y * 36;
    const slash = this.add.arc(centerX, centerY, 30, this.facing.angle() - 50, this.facing.angle() + 50, false, 0xf5d69c, 0.85).setStrokeStyle(5, 0xf3c27c, 0.9).setDepth(10);
    slash.setRotation(this.facing.angle());
    this.tweens.add({ targets: slash, alpha: 0, scale: 1.45, duration: 190, onComplete: () => slash.destroy() });
    let hit = false;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distance = Math.hypot(dx, dy);
      const dot = distance ? (dx * this.facing.x + dy * this.facing.y) / distance : 1;
      if (enemy.active && distance < 72 && dot > 0.22) {
        const weapon = this.session.equipment.weapon ? ITEMS[this.session.equipment.weapon] : null;
        const legendaryBonus = weapon?.id === 'twilight_blade' && enemy.hp / enemy.maxHp < 0.3 ? 1.25 : 1;
        const critical = Phaser.Math.Between(1, 100) <= stats.critChance;
        const rawDamage = stats.attack * Phaser.Math.FloatBetween(0.88, 1.12) * legendaryBonus * (critical ? stats.critDamage / 100 : 1);
        this.damageEnemy(enemy, Math.max(1, Math.round(rawDamage * 100 / (100 + enemy.level * 0.7))), false, critical);
        hit = true;
      }
    });
    this.playTone(hit ? 170 : 110, 0.055, 'triangle');
  }

  private castPulse(): void {
    const now = this.time.now;
    if (now < this.specialReadyAt || this.mana < 15 || now < this.dodgeUntil) return;
    this.specialReadyAt = now + 2100;
    this.mana -= 15;
    const pulse = this.add.circle(this.player.x, this.player.y, 12, 0x87c3b7, 0.5).setStrokeStyle(3, 0xc0ead2, 0.9).setDepth(9);
    this.tweens.add({ targets: pulse, scale: 6, alpha: 0, duration: 500, onComplete: () => pulse.destroy() });
    this.cameras.main.shake(100, 0.002);
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 175) {
        const stats = deriveStats(this.session);
        const rawDamage = stats.magicAttack * Phaser.Math.FloatBetween(1.25, 1.55);
        this.damageEnemy(enemy, Math.max(1, Math.round(rawDamage * 100 / (100 + enemy.level * 0.4))), true);
        enemy.setVelocity(this.facing.x * 110, this.facing.y * 110);
      }
    });
    this.playTone(440, 0.22, 'sine');
    this.showToast('Pulso de éter · 15 de éter');
  }

  private dodge(): void {
    const now = this.time.now;
    if (now < this.dodgeUntil || now < this.invulnerableUntil || this.stamina < 22) return;
    const velocity = this.player.body!.velocity;
    if (velocity.length() > 5) this.facing.set(velocity.x, velocity.y).normalize();
    this.stamina -= 22;
    this.dodgeUntil = now + 245;
    this.invulnerableUntil = now + Phaser.Math.Clamp(360 + (this.session.attributes.dexterity - 4) * 8, 300, 500);
    this.player.setVelocity(this.facing.x * 440, this.facing.y * 440).setAlpha(0.55);
    this.add.circle(this.player.x, this.player.y, 17, 0xa3c9ad, 0.35).setDepth(3);
    this.playTone(230, 0.08, 'sawtooth');
  }

  private enemyAttack(enemy: Enemy, time: number): void {
    const direction = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize();
    const telegraph = this.add.circle(this.player.x + direction.x * 15, this.player.y + direction.y * 15, enemy.kind === 'wisp' ? 42 : 31, 0xb54937, 0.13).setStrokeStyle(2, 0xd9674d, 0.65).setDepth(2);
    this.tweens.add({ targets: telegraph, alpha: 0, scale: 1.25, duration: 260, onComplete: () => telegraph.destroy() });
    this.time.delayedCall(280, () => {
      if (!enemy.active || !this.player.active) return;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < (enemy.kind === 'wisp' ? 92 : 66)) {
        const damage = (enemy.kind === 'wisp' ? 13 : 9) * (1 + (enemy.level - 1) * 0.11);
        this.damagePlayer(damage, time + 280);
      }
    });
  }

  private damageEnemy(enemy: Enemy, damage: number, magic: boolean, critical = false): void {
    enemy.hp -= damage;
    enemy.hurtAt = this.time.now + 130;
    enemy.setTint(magic ? 0x9de2d6 : 0xffffff);
    const label = this.add.text(enemy.x, enemy.y - 24, `${critical ? 'CRÍTICO ' : ''}${damage}`, { fontFamily: 'DM Mono', fontSize: critical ? '15px' : '13px', color: critical ? '#ffdc82' : magic ? '#a6eee0' : '#ffe0bd', stroke: '#1a1713', strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: label, y: label.y - 24, alpha: 0, duration: 600, onComplete: () => label.destroy() });
    this.tweens.add({ targets: enemy, x: enemy.x + this.facing.x * 9, y: enemy.y + this.facing.y * 9, duration: 70, yoyo: true });
    if (enemy.hp <= 0) {
      const x = enemy.x, y = enemy.y;
      enemy.disableBody(true, true);
      const burst = this.add.circle(x, y, 7, magic ? 0x8acbc0 : 0xc86b4e, 0.75).setDepth(8);
      this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 320, onComplete: () => burst.destroy() });
      const defeated = this.session.defeated[this.areaId] ?? [];
      defeated.push(enemy.id);
      this.session.defeated[this.areaId] = defeated;
      const reward = Math.round((enemy.kind === 'hollow' ? 22 : enemy.kind === 'stalker' ? 18 : 26) * (1 + enemy.level * 0.12));
      this.grantExperience(reward, x, y);
      this.rollLoot(enemy, x, y);
      saveSession(this.session);
      this.playTone(90, 0.12, 'triangle');
    }
  }

  private touchDamage(enemy: Enemy): void {
    if (enemy.active && this.time.now > this.invulnerableUntil && this.time.now > enemy.attackAt - 250) this.damagePlayer(7, this.time.now);
  }

  private damagePlayer(amount: number, time: number): void {
    if (time < this.invulnerableUntil) return;
    const defense = deriveStats(this.session).defense;
    const mitigated = Math.max(1, Math.round(amount * 100 / (100 + defense)));
    this.health = Math.max(0, this.health - mitigated);
    this.invulnerableUntil = time + 500;
    this.player.setTint(0xff7663);
    this.cameras.main.shake(125, 0.004);
    this.playTone(75, 0.12, 'square');
    this.time.delayedCall(170, () => this.player?.setTint(0xffffff));
    this.showToast(`-${mitigated} vida`);
    if (this.health <= 0) {
      document.querySelector('#game-over')?.removeAttribute('hidden');
      this.physics.pause();
    }
  }

  private grantExperience(amount: number, x = this.player.x, y = this.player.y): void {
    const before = deriveStats(this.session);
    const gainedLevels = addExperience(this.session, amount);
    const after = deriveStats(this.session);
    const rewardText = this.add.text(x, y - 16, `+${amount} XP`, { fontFamily: 'DM Mono', fontSize: '11px', color: '#e3cd82', stroke: '#182018', strokeThickness: 3 }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: rewardText, y: rewardText.y - 36, alpha: 0, duration: 850, onComplete: () => rewardText.destroy() });
    if (gainedLevels > 0) {
      this.health = Math.min(after.maxHealth, this.health + after.maxHealth - before.maxHealth);
      this.mana = Math.min(after.maxMana, this.mana + after.maxMana - before.maxMana);
      this.stamina = Math.min(after.maxStamina, this.stamina + after.maxStamina - before.maxStamina);
      this.showLevelUp();
    }
    this.syncHud();
    if (this.menuOpen) this.renderMenu();
  }

  private showLevelUp(): void {
    const banner = document.querySelector<HTMLElement>('#level-banner');
    if (banner) {
      banner.innerHTML = `<span>PROGRESSO DE KAEL</span><b>NÍVEL ${this.level}</b><span>+3 PONTOS DE ATRIBUTO${this.level % 5 === 0 ? ' · +1 HABILIDADE' : ''}</span>`;
      banner.hidden = false;
      this.time.delayedCall(2300, () => { banner.hidden = true; });
    }
    this.cameras.main.flash(220, 199, 177, 112);
    this.cameras.main.shake(100, 0.002);
    this.playTone(520, 0.28, 'sine');
    this.showToast(`Nível ${this.level} · +3 pontos de atributo`);
    saveSession(this.session);
  }

  private rollLoot(enemy: Enemy, x: number, y: number): void {
    const luck = this.session.attributes.luck;
    if (Phaser.Math.Between(1, 100) <= 68) this.spawnLoot(null, Phaser.Math.Between(4, 9) + enemy.level, x + Phaser.Math.Between(-18, 18), y + Phaser.Math.Between(-18, 18));
    if (Phaser.Math.Between(1, 100) > 16 + luck * 0.45) return;
    const rarityRoll = Phaser.Math.Between(1, 1000) / 10;
    let pool: string[];
    if (enemy.level >= 18 && rarityRoll < 1 + luck * 0.08) pool = ['twilight_blade'];
    else if (enemy.level >= 7 && rarityRoll < 7 + luck * 0.25) pool = ['sunken_circlet', 'ash_charm'];
    else if (rarityRoll < 4 + luck * 0.2) pool = ['ash_charm', 'iron_helm'];
    else if (rarityRoll < 29 + luck * 0.4) pool = ['iron_sword', 'oak_shield', 'ether_potion', 'leather_armor'];
    else if (rarityRoll < 62) pool = ['health_potion', 'ether_potion'];
    else pool = ['moonroot', 'ember_ore', 'leather_gloves', 'leather_boots', 'copper_ring'];
    const itemId = pool[Phaser.Math.Between(0, pool.length - 1)];
    this.spawnLoot(itemId, 1, x + Phaser.Math.Between(-24, 24), y + Phaser.Math.Between(-24, 24));
  }

  private spawnLoot(itemId: string | null, amount: number, x: number, y: number): void {
    const item: ItemDefinition | undefined = itemId ? ITEMS[itemId] : undefined;
    const colors: Record<Rarity, number> = { common: 0x9fa58e, uncommon: 0x70bb83, rare: 0x72a7dc, epic: 0xb782cf, legendary: 0xe6bd65 };
    const color = item ? colors[item.rarity] : 0xdab96a;
    const medallion = this.add.circle(0, 0, 13, 0x172019, 0.95).setStrokeStyle(2, color, 0.95);
    const glyph = this.add.text(0, -1, item?.icon ?? 'Au', { fontFamily: 'DM Mono', fontSize: '8px', color: item ? `#${color.toString(16).padStart(6, '0')}` : '#e7ca7a' }).setOrigin(0.5);
    const quantity = this.add.text(0, 15, item ? '' : `${amount} Au`, { fontFamily: 'DM Mono', fontSize: '8px', color: '#e8d8aa', stroke: '#121713', strokeThickness: 2 }).setOrigin(0.5);
    const view = this.add.container(x, y, [medallion, glyph, quantity]).setDepth(12).setSize(30, 30);
    this.tweens.add({ targets: view, y: y - 5, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.drops.push({ x, y, itemId, amount, view });
  }

  private collectNearbyDrop(): boolean {
    const index = this.drops.findIndex((drop) => Phaser.Math.Distance.Between(drop.x, drop.y, this.player.x, this.player.y) < 65);
    if (index < 0) return false;
    const drop = this.drops[index];
    if (drop.itemId) {
      if (!addItem(this.session, drop.itemId, drop.amount)) {
        this.showToast(`Carga máxima atingida · ${inventoryWeight(this.session).toFixed(1)} kg`);
        return true;
      }
      const item = ITEMS[drop.itemId];
      this.showToast(item.rarity === 'common' ? `Item adquirido · ${item.name}` : `${item.rarity.toUpperCase()} · ${item.name}`);
    } else {
      this.session.gold += drop.amount;
      this.showToast(`+${drop.amount} ouro`);
    }
    drop.view.destroy();
    this.drops.splice(index, 1);
    this.syncHud();
    saveSession(this.session);
    if (this.menuOpen) this.renderMenu();
    return true;
  }

  private updateInteractionPrompt(): void {
    const prompt = document.querySelector<HTMLElement>('#interaction-prompt');
    if (!prompt) return;
    if (this.drops.some((drop) => Phaser.Math.Distance.Between(drop.x, drop.y, this.player.x, this.player.y) < 65)) {
      prompt.textContent = 'F · coletar item';
      prompt.hidden = false;
      return;
    }
    if (this.nearbySecret()) {
      prompt.textContent = 'F · revelar passagem oculta';
      prompt.hidden = false;
      return;
    }
    if (this.nearbyChest()) {
      prompt.textContent = 'F · abrir baú';
      prompt.hidden = false;
      return;
    }
    const portals = Object.entries(exitsFor(this.session)) as Array<[PortalDirection, AreaId]>;
    const nearest = portals.map(([direction, target]) => ({
      direction,
      target,
      distance: Phaser.Math.Distance.Between(PORTAL_POSITIONS[direction].x, PORTAL_POSITIONS[direction].y, this.player.x, this.player.y),
    })).sort((first, second) => first.distance - second.distance)[0];
    this.nearbyPortal = nearest && nearest.distance < 115 ? { direction: nearest.direction, target: nearest.target } : null;
    if (this.nearbyPortal) {
      prompt.textContent = `E · ${PORTAL_LABELS[this.nearbyPortal.direction]} · ${AREAS[this.nearbyPortal.target].name}`;
      prompt.hidden = false;
    } else prompt.hidden = true;
  }

  private usePortal(): void {
    if (this.transitioning || this.menuOpen) return;
    this.updateInteractionPrompt();
    if (this.nearbyPortal) this.transitionArea(this.nearbyPortal.target, this.nearbyPortal.direction);
    else this.showToast('Aproxime-se de um portal para viajar.');
  }

  private transitionArea(areaId: AreaId, exitDirection: PortalDirection): void {
    this.transitioning = true;
    this.physics.world.pause();
    const entry = OPPOSITE_PORTAL[exitDirection];
    const spawn = PORTAL_SPAWNS[entry];
    this.session.x = spawn.x;
    this.session.y = spawn.y;
    crossPortal(this.session, areaId, exitDirection);
    if (!this.session.discovered.includes(areaId)) {
      this.session.discovered.push(areaId);
      this.grantExperience(45 + AREAS[areaId].enemyLevel * 8, this.player.x, this.player.y);
      this.showToast(`Nova região descoberta · +${45 + AREAS[areaId].enemyLevel * 8} XP`);
    }
    this.showToast(`Pressão da Ruptura ${this.session.difficultyTier}/25 · ${AREAS[areaId].name}`);
    saveSession(this.session);
    this.cameras.main.fadeOut(520, 9, 13, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ area: areaId, entry });
    });
  }

  private showRegionBanner(): void {
    const banner = document.querySelector<HTMLElement>('#region-banner');
    if (!banner) return;
    banner.innerHTML = renderAreaBanner(this.areaId, this.session.difficultyTier);
    banner.hidden = false;
    this.time.delayedCall(2600, () => { banner.hidden = true; });
  }

  private openMenu(tab: string): void {
    if (this.transitioning || document.querySelector('#game-over:not([hidden])')) return;
    this.menuOpen = true;
    this.menuTab = tab;
    this.physics.world.pause();
    document.querySelector('#game-menu')?.removeAttribute('hidden');
    this.renderMenu();
  }

  private closeMenu(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    document.querySelector('#game-menu')?.setAttribute('hidden', '');
    this.physics.world.resume();
  }

  private handleMenuTab(tab: string): void {
    if (!['attributes', 'equipment', 'inventory', 'skills'].includes(tab)) return;
    this.menuTab = tab;
    this.renderMenu();
  }

  private renderMenu(): void {
    const content = document.querySelector<HTMLElement>('#menu-content');
    if (!content) return;
    content.innerHTML = renderCharacterMenu(this.session, this.menuTab);
    const headings: Record<string, string> = { attributes: 'Atributos', equipment: 'Equipamentos', inventory: 'Mochila', skills: 'Habilidades' };
    document.querySelector('#menu-heading')!.textContent = headings[this.menuTab] ?? 'Personagem';
    document.querySelectorAll('.menu-tab').forEach((button) => button.classList.toggle('active', (button as HTMLElement).dataset.tab === this.menuTab));
  }

  private handleMenuAction(action: MenuAction): void {
    const oldStats = deriveStats(this.session);
    switch (action.action) {
      case 'attribute': {
        const attribute = action.attribute as AttributeName | undefined;
        if (!attribute || this.session.attributePoints < 1) return;
        this.session.attributes[attribute] += 1;
        this.session.attributePoints -= 1;
        this.refreshResources(oldStats);
        this.showToast(`${attribute.toUpperCase()} aumentado`);
        break;
      }
      case 'equip': {
        if (!action.itemId || !equipItem(this.session, action.itemId)) return;
        this.refreshResources(oldStats);
        this.showToast(`Equipado · ${ITEMS[action.itemId].name}`);
        break;
      }
      case 'unequip': {
        const slot = action.slot as GearSlot | undefined;
        if (!slot || !unequipItem(this.session, slot)) return;
        this.refreshResources(oldStats);
        this.showToast('Equipamento devolvido à mochila');
        break;
      }
      case 'use':
      case 'quick-potion':
        this.useConsumable(action.itemId ?? 'health_potion');
        break;
      case 'drop': {
        if (!action.itemId || !dropItem(this.session, action.itemId)) return;
        this.spawnLoot(action.itemId, 1, this.player.x + 25, this.player.y);
        this.showToast(`Largado · ${ITEMS[action.itemId].name}`);
        break;
      }
      case 'save': {
        const success = saveSession(this.session, Number(action.slot));
        document.querySelector('#save-status')!.textContent = success ? `Espaço ${action.slot} salvo` : 'Não foi possível gravar';
        break;
      }
      case 'load': {
        const loaded = loadSession(Number(action.slot));
        if (!loaded) { this.showToast('Espaço vazio ou salvamento inválido.'); return; }
        this.session = loaded;
        saveSession(this.session);
        this.scene.restart({ area: loaded.area, entry: 'saved' });
        return;
      }
      case 'delete-save':
        deleteSave(Number(action.slot));
        document.querySelector('#save-status')!.textContent = `Espaço ${action.slot} apagado`;
        break;
    }
    saveSession(this.session);
    this.syncHud();
    this.renderMenu();
  }

  private refreshResources(before: ReturnType<typeof deriveStats>): void {
    const after = deriveStats(this.session);
    this.health = Math.max(0, Math.min(after.maxHealth, this.health + after.maxHealth - before.maxHealth));
    this.mana = Math.max(0, Math.min(after.maxMana, this.mana + after.maxMana - before.maxMana));
    this.stamina = Math.max(0, Math.min(after.maxStamina, this.stamina + after.maxStamina - before.maxStamina));
  }

  private useConsumable(itemId: string): void {
    const item = ITEMS[itemId];
    if (!item || !useItem(this.session, itemId)) { this.showToast('Recurso cheio ou item indisponível.'); return; }
    this.showToast(`${item.name} usado`);
    this.syncHud();
    saveSession(this.session);
    if (this.menuOpen) this.renderMenu();
  }

  private returnCheckpoint(): void {
    const stats = deriveStats(this.session);
    const spawn = worldPosition(respawnCell(this.session.returnDirection, this.layout));
    this.session.health = stats.maxHealth;
    this.session.mana = stats.maxMana;
    this.session.stamina = stats.maxStamina;
    this.session.area = this.areaId;
    this.session.x = spawn.x;
    this.session.y = spawn.y;
    saveSession(this.session);
    document.querySelector('#game-over')?.setAttribute('hidden', '');
    this.scene.restart({ area: this.session.area, entry: 'saved' });
  }

  private interact(): void {
    if (this.collectNearbyDrop()) return;
    const secret = this.nearbySecret();
    if (secret) {
      this.revealSecret(secret);
      return;
    }
    const chest = this.nearbyChest();
    if (chest) {
      this.openChest(chest);
      return;
    }
    this.showToast('Nada por perto responde ao chamado.');
  }

  private revealSecret(secret: MapFeature): void {
    const discovered = this.session.discoveredSecrets[this.areaId] ?? [];
    if (discovered.includes(secret.id)) return;
    discovered.push(secret.id);
    this.session.discoveredSecrets[this.areaId] = discovered;
    const rewards = ['ember_ore', 'moonroot', 'ether_potion'];
    const itemId = rewards[secret.variant % rewards.length];
    const position = worldPosition({ col: secret.col, row: secret.row });
    this.session.gold += 12 + secret.variant * 3;
    this.grantExperience(30 + AREAS[this.areaId].enemyLevel * 5, position.x, position.y);
    if (!addItem(this.session, itemId)) this.spawnLoot(itemId, 1, position.x + 24, position.y);
    const marker = this.add.text(position.x, position.y - 28, 'PASSAGEM REVELADA', { fontFamily: 'DM Mono', fontSize: '9px', color: '#e4ce8a', stroke: '#182018', strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: marker, y: marker.y - 24, alpha: 0, duration: 1000, onComplete: () => marker.destroy() });
    this.showToast(`Área secreta descoberta · ${ITEMS[itemId].name}`);
    this.syncHud();
    saveSession(this.session);
  }

  private openChest(chest: MapFeature): void {
    const collected = this.session.collectedChests[this.areaId] ?? [];
    if (collected.includes(chest.id)) return;
    collected.push(chest.id);
    this.session.collectedChests[this.areaId] = collected;
    const firstValdoraChest = this.areaId === 'valdora' && chest.id === 'valdora-chest-0';
    if (firstValdoraChest) this.session.cacheCollected = true;
    const coinReward = 14 + chest.variant * 7 + AREAS[this.areaId].enemyLevel;
    this.session.gold += coinReward;
    const rewards = firstValdoraChest ? ['iron_sword', 'health_potion', 'health_potion'] : [['health_potion', 'ether_potion', 'ember_ore', 'moonroot', 'copper_ring'][chest.variant % 5]];
    rewards.forEach((itemId) => {
      if (!addItem(this.session, itemId)) {
        const position = worldPosition({ col: chest.col, row: chest.row });
        this.spawnLoot(itemId, 1, position.x + 24, position.y + 10);
      }
    });
    this.health = Math.min(deriveStats(this.session).maxHealth, this.health + 18);
    this.mana = Math.min(deriveStats(this.session).maxMana, this.mana + 12);
    this.chestSprites.get(chest.id)?.destroy();
    this.chestSprites.delete(chest.id);
    this.showToast(firstValdoraChest ? `Baú de Valdora · espada · poções · +${coinReward} ouro` : `Baú aberto · suprimentos · +${coinReward} ouro`);
    this.syncHud();
    saveSession(this.session);
  }

  private syncHud(): void {
    const stats = deriveStats(this.session);
    this.health = Math.min(this.health, stats.maxHealth);
    this.mana = Math.min(this.mana, stats.maxMana);
    this.stamina = Math.min(this.stamina, stats.maxStamina);
    this.setMeter('health', this.health, stats.maxHealth);
    this.setMeter('mana', this.mana, stats.maxMana);
    this.setMeter('stamina', this.stamina, stats.maxStamina);
    this.setMeter('xp', this.xp, xpToNextLevel(this.level));
    document.querySelector('#level-label')!.textContent = `NÍVEL ${this.level}`;
    document.querySelector('#xp-value')!.textContent = `${this.xp} / ${this.level >= MAX_LEVEL ? 'MAX' : xpToNextLevel(this.level)}`;
    document.querySelector('#gold-label')!.textContent = `${this.session.gold} OURO`;
    document.querySelector('#region-label')!.textContent = AREAS[this.areaId].name.toUpperCase();
    document.querySelector('#region-footer')!.textContent = `${AREAS[this.areaId].name.toUpperCase()} · ${AREAS[this.areaId].recommended} · AMEAÇA ${this.session.difficultyTier}/25`;
    const chapter = document.querySelector<HTMLElement>('.chapter');
    if (chapter?.dataset.area !== this.areaId) {
      const chapterNumber = (['valdora', 'nareth', 'valen', 'mire', 'khar'] as AreaId[]).indexOf(this.areaId) + 1;
      chapter!.dataset.area = this.areaId;
      chapter!.innerHTML = `<span class="chapter-dot"></span> CAPÍTULO ${chapterNumber} <b>·</b> ${AREAS[this.areaId].name.toUpperCase()}`;
    }
    document.querySelector('#potion-count')!.textContent = `×${this.session.inventory.find((entry) => entry.itemId === 'health_potion')?.quantity ?? 0}`;
    const remaining = this.enemies?.countActive(true) ?? 8;
    document.querySelector('#objective-progress')!.textContent = remaining > 0 ? `${remaining} ${remaining === 1 ? 'criatura restante' : 'criaturas restantes'} · ${AREAS[this.areaId].recommended}` : 'A área está livre destas criaturas.';
  }

  private setMeter(name: string, value: number, max: number): void {
    document.querySelector<HTMLElement>(`#${name}-fill`)!.style.width = `${Math.max(0, value / max * 100)}%`;
    if (name === 'xp') return;
    const label = name === 'health' ? 'health-value' : name === 'mana' ? 'mana-value' : 'stamina-value';
    document.querySelector<HTMLElement>(`#${label}`)!.textContent = `${Math.ceil(value)} / ${Math.ceil(max)}`;
  }

  private drawMinimap(): void {
    const canvas = this.minimap;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const sx = canvas.width / WORLD.width, sy = canvas.height / WORLD.height;
    context.fillStyle = `#${AREAS[this.areaId].ground.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = `#${AREAS[this.areaId].path.toString(16).padStart(6, '0')}`;
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLUMNS; col++) {
        if (this.layout.roads[row][col]) context.fillRect(col * MAP_TILE_SIZE * sx, row * MAP_TILE_SIZE * sy, MAP_TILE_SIZE * sx, MAP_TILE_SIZE * sy);
      }
    }
    this.layout.features.forEach((feature) => {
      if (feature.kind === 'chest' && this.isChestCollected(feature.id)) return;
      const colors: Partial<Record<MapFeature['kind'], string>> = { lake: '#426f78', chest: '#e4bd6c', camp: '#ca734d', secret: '#9c8a62' };
      context.fillStyle = colors[feature.kind] ?? (feature.blocksMovement ? '#71705f' : '#83906a');
      context.fillRect(feature.col * MAP_TILE_SIZE * sx, feature.row * MAP_TILE_SIZE * sy, feature.width * MAP_TILE_SIZE * sx, feature.height * MAP_TILE_SIZE * sy);
    });
    context.fillStyle = '#d7bf83';
    (Object.keys(exitsFor(this.session)) as PortalDirection[]).forEach((direction) => {
      const portal = PORTAL_POSITIONS[direction];
      context.fillRect(portal.x * sx - 2, portal.y * sy - 2, 4, 4);
    });
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active) { context.fillStyle = enemy.kind === 'wisp' ? '#8dbdb0' : '#c46b55'; context.fillRect(enemy.x*sx-1, enemy.y*sy-1, 3, 3); }
    });
    context.fillStyle = '#e7dbb8';
    context.beginPath(); context.arc(this.player.x*sx, this.player.y*sy, 3, 0, Math.PI*2); context.fill();
  }

  private showToast(text: string): void {
    const toast = document.querySelector<HTMLElement>('#toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('visible');
    this.toastTimer?.remove(false);
    this.toastTimer = this.time.delayedCall(2100, () => toast.classList.remove('visible'));
  }

  private toggleSound(): void {
    this.soundOn = !this.soundOn;
    if (this.soundOn && !this.audio) this.audio = new AudioContext();
    this.playTone(330, 0.08, 'sine');
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (!this.soundOn || !this.audio) return;
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.07, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start();
    oscillator.stop(this.audio.currentTime + duration);
  }
}
