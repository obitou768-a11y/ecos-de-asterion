import Phaser from 'phaser';
import { loadSession } from './systems';

export class TitleScene extends Phaser.Scene {
  private landscape!: Phaser.GameObjects.Graphics;
  private ashEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private transitioning = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.setBackgroundColor('#151d1d');
    this.landscape = this.add.graphics().setDepth(0);
    this.drawLandscape();
    this.createAshTexture();
    this.createAsh();

    const distantFire = this.add.circle(this.scale.width * 0.61, this.scale.height * 0.7, 13, 0xd07648, 0.4)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.tweens.add({ targets: distantFire, alpha: 0.12, scale: 1.8, duration: 1100, yoyo: true, repeat: -1 });

    const session = loadSession();
    const button = document.querySelector<HTMLButtonElement>('#start-game');
    const state = document.querySelector<HTMLElement>('#title-save-state');
    if (button) button.querySelector('span')!.textContent = session ? 'CONTINUAR JORNADA' : 'INICIAR JORNADA';
    if (state) state.textContent = session ? `${session.level}º NÍVEL · ${session.area.toUpperCase()}` : 'NOVA EXPEDIÇÃO · VALDORA';
    document.querySelector('#start-screen')?.removeAttribute('hidden');
    document.querySelector('.hud')?.setAttribute('hidden', '');
    document.querySelector('#game-footer')?.setAttribute('hidden', '');
    document.querySelector('.chapter')?.setAttribute('hidden', '');

    this.game.events.off('start-game', this.startGame, this);
    this.game.events.on('start-game', this.startGame, this);
    this.input.keyboard?.on('keydown-ENTER', this.startGame, this);
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownTitle, this);
  }

  private drawLandscape(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const horizon = height * 0.63;
    const graphics = this.landscape;
    graphics.clear();

    const skyBands = [0x151d1d, 0x1d2624, 0x29302b, 0x393a30, 0x514237, 0x684535];
    skyBands.forEach((color, index) => {
      const bandHeight = height * 0.12;
      graphics.fillStyle(color).fillRect(0, index * bandHeight, width, bandHeight + 2);
    });
    graphics.fillStyle(0xc6a679, 0.06).fillCircle(width * 0.69, height * 0.33, Math.min(width, height) * 0.24);
    graphics.fillStyle(0xd2c09c, 0.55).fillCircle(width * 0.69, height * 0.34, Math.min(width, height) * 0.065);

    graphics.fillStyle(0x333a33).fillTriangle(-30, horizon + 10, width * 0.2, height * 0.2, width * 0.47, horizon + 10);
    graphics.fillStyle(0x2a342e).fillTriangle(width * 0.25, horizon + 8, width * 0.55, height * 0.14, width * 0.87, horizon + 8);
    graphics.fillStyle(0x394036).fillTriangle(width * 0.61, horizon + 12, width * 0.84, height * 0.28, width * 1.08, horizon + 12);

    graphics.fillStyle(0x202923).fillRect(0, horizon, width, height - horizon);
    graphics.fillStyle(0x2b3027, 0.85).fillTriangle(0, horizon + 25, width * 0.18, horizon - 18, width * 0.39, horizon + 35);
    graphics.fillStyle(0x1a211d).fillTriangle(width * 0.48, horizon + 22, width * 0.75, horizon - 28, width * 1.04, horizon + 30);

    this.drawRuinedKeep(graphics, width * 0.79, horizon - 12, Math.max(0.65, Math.min(1.2, width / 1050)));
    this.drawTreeLine(graphics, width, horizon, height);

    graphics.fillStyle(0x171e19, 0.92).fillRect(0, height * 0.88, width, height * 0.12);
    graphics.fillStyle(0x8a5540, 0.24).fillRect(0, horizon + 3, width, 2);
    for (let index = 0; index < 46; index++) {
      const x = ((index * 197 + 53) % 997) / 997 * width;
      const y = horizon + ((index * 83 + 21) % 311) / 311 * (height * 0.34);
      graphics.fillStyle(index % 4 === 0 ? 0xb78159 : 0x929180, index % 3 === 0 ? 0.2 : 0.11).fillCircle(x, y, 1 + index % 2);
    }
  }

  private drawRuinedKeep(graphics: Phaser.GameObjects.Graphics, centerX: number, baseY: number, scale: number): void {
    const towerWidth = 56 * scale;
    const towerHeight = 142 * scale;
    graphics.fillStyle(0x181f1c, 0.95).fillRect(centerX - towerWidth / 2, baseY - towerHeight, towerWidth, towerHeight);
    graphics.fillStyle(0x202622).fillRect(centerX - towerWidth * 0.72, baseY - towerHeight * 0.71, towerWidth * 0.4, towerHeight * 0.71);
    graphics.fillStyle(0x191f1b).fillTriangle(centerX - towerWidth * 0.63, baseY - towerHeight * 0.69, centerX - towerWidth * 0.52, baseY - towerHeight * 1.12, centerX - towerWidth * 0.39, baseY - towerHeight * 0.69);
    graphics.fillStyle(0x151b18).fillTriangle(centerX - towerWidth * 0.48, baseY - towerHeight, centerX - towerWidth * 0.22, baseY - towerHeight * 1.18, centerX - towerWidth * 0.02, baseY - towerHeight);
    graphics.fillStyle(0x7a5540, 0.72).fillRect(centerX - 4 * scale, baseY - towerHeight * 0.68, 8 * scale, 17 * scale);
    graphics.fillStyle(0x141a17).fillRect(centerX - 78 * scale, baseY - 29 * scale, 156 * scale, 31 * scale);
    graphics.fillStyle(0x252b24).fillRect(centerX - 62 * scale, baseY - 41 * scale, 124 * scale, 13 * scale);
  }

  private drawTreeLine(graphics: Phaser.GameObjects.Graphics, width: number, horizon: number, height: number): void {
    const positions = [0.04, 0.11, 0.19, 0.31, 0.42, 0.55, 0.91, 0.98];
    positions.forEach((ratio, index) => {
      const x = width * ratio;
      const scale = 0.55 + (index % 3) * 0.16;
      const baseY = horizon + height * (index % 2 ? 0.11 : 0.16);
      graphics.fillStyle(0x211f19).fillRect(x - 3 * scale, baseY - 36 * scale, 7 * scale, 43 * scale);
      graphics.fillStyle(index % 2 ? 0x202b22 : 0x283027);
      graphics.fillTriangle(x - 28 * scale, baseY - 17 * scale, x, baseY - 80 * scale, x + 29 * scale, baseY - 17 * scale);
      graphics.fillTriangle(x - 23 * scale, baseY - 39 * scale, x, baseY - 92 * scale, x + 25 * scale, baseY - 39 * scale);
    });
  }

  private createAshTexture(): void {
    if (this.textures.exists('menu-ash')) return;
    const ash = this.make.graphics({ x: 0, y: 0 });
    ash.fillStyle(0xd5d0bd, 0.9).fillCircle(4, 4, 2.4);
    ash.generateTexture('menu-ash', 8, 8);
    ash.destroy();
  }

  private createAsh(): void {
    this.ashEmitter?.destroy();
    const width = this.scale.width;
    const height = this.scale.height;
    this.ashEmitter = this.add.particles(0, 0, 'menu-ash', {
      x: { min: 0, max: width },
      y: { min: height * 0.36, max: height + 18 },
      lifespan: { min: 8500, max: 15000 },
      speedX: { min: -16, max: 9 },
      speedY: { min: -31, max: -9 },
      frequency: 125,
      quantity: 1,
      scale: { start: 0.7, end: 0.12 },
      alpha: { start: 0.42, end: 0 },
      tint: [0xc9c2ae, 0xaaa899, 0xc0916c],
      rotate: { min: -35, max: 35 },
      blendMode: Phaser.BlendModes.NORMAL,
    }).setDepth(4);
    this.ashEmitter.explode(26, width * 0.52, height * 0.78);
  }

  private handleResize(): void {
    this.drawLandscape();
    this.createAsh();
  }

  private startGame(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const screen = document.querySelector<HTMLElement>('#start-screen');
    screen?.classList.add('leaving');
    this.time.delayedCall(240, () => {
      screen?.setAttribute('hidden', '');
      this.game.events.off('start-game', this.startGame, this);
      this.scene.start('GameScene');
    });
  }

  private shutdownTitle(): void {
    this.game.events.off('start-game', this.startGame, this);
    this.scale.off('resize', this.handleResize, this);
  }
}
