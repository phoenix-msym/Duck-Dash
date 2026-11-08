import { makeTextures, refreshLook } from '../art.js';
import { makeButton, sunsetBackdrop, FONT } from '../ui.js';
import { wallet, SHOP_ITEMS } from '../wallet.js';
import { audio } from '../audio.js';

// The Bread Shop: spend the bread crumbs you collected on scarves, bike colours and hats.
// Click an item (or use the arrow keys + Enter) to buy it; click an item you own to wear it.

const ROWS = [
  { cat: 'scarf', label: 'Scarf' },
  { cat: 'bike', label: 'Bike' },
  { cat: 'hat', label: 'Hat' },
];

export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    sunsetBackdrop(this);
    audio.music('menu');

    const panel = this.add.graphics();
    panel.fillStyle(0x2a1440, 0.82); panel.fillRoundedRect(40, 20, W - 80, H - 40, 28);
    this.add.text(W / 2, 62, 'Bread Shop', {
      fontFamily: FONT, fontSize: '50px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 8,
    }).setOrigin(0.5);

    // how many crumbs you have
    this.add.image(W - 210, 62, 'crumb').setScale(1.3);
    this.bag = this.add.text(W - 185, 62, '', {
      fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#ffe680', stroke: '#3b1d4a', strokeThickness: 6,
    }).setOrigin(0, 0.5);
    this.message = this.add.text(W / 2, 285, '', {
      fontFamily: FONT, fontSize: '22px', color: '#ffe680', fontStyle: 'italic',
    }).setOrigin(0.5);

    // live preview of Crumb wearing everything
    this.preview = this.add.container(0, 0);
    this.buildPreview();

    // the item buttons: one row per category
    this.grid = ROWS.map((row, r) => {
      const y = 350 + r * 100;
      this.add.text(90, y, row.label, { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0, 0.5);
      return SHOP_ITEMS[row.cat].map((item, i) => {
        const b = makeButton(this, 300 + i * 212, y, '', () => this.choose(row.cat, item), { w: 200, h: 72, size: 19 });
        b.cat = row.cat; b.item = item;
        return b;
      });
    });
    this.back = makeButton(this, W / 2, H - 62, 'Back', () => this.scene.start('Menu'), { w: 220, h: 54, size: 26 });

    // keyboard: arrows move around the grid, Enter buys/wears, Esc goes back
    this.sel = { r: 0, c: 0 };
    const kb = this.input.keyboard;
    const move = (dr, dc) => {
      const r = Phaser.Math.Clamp(this.sel.r + dr, 0, this.grid.length);
      const cols = r === this.grid.length ? 1 : this.grid[r].length;
      this.sel = { r, c: Phaser.Math.Clamp(this.sel.c + dc, 0, cols - 1) };
      audio.sfx.select();
      this.refresh();
    };
    kb.on('keydown-UP', () => move(-1, 0)); kb.on('keydown-W', () => move(-1, 0));
    kb.on('keydown-DOWN', () => move(1, 0)); kb.on('keydown-S', () => move(1, 0));
    kb.on('keydown-LEFT', () => move(0, -1)); kb.on('keydown-A', () => move(0, -1));
    kb.on('keydown-RIGHT', () => move(0, 1)); kb.on('keydown-D', () => move(0, 1));
    const press = () => {
      if (this.sel.r === this.grid.length) { this.scene.start('Menu'); return; }
      const b = this.grid[this.sel.r][this.sel.c];
      this.choose(b.cat, b.item);
    };
    kb.on('keydown-ENTER', press); kb.on('keydown-SPACE', press);
    kb.on('keydown-ESC', () => this.scene.start('Menu'));

    this.refresh();
  }

  buildPreview() {
    const { width: W } = this.scale;
    this.preview.removeAll(true);
    const bike = this.add.container(W / 2 - 120, 190, [
      this.add.image(-30, 20, 'wheel'),
      this.add.image(30, 20, 'wheel'),
      this.add.image(0, 0, 'bike').setOrigin(0.5, 0.6),
    ]).setScale(1.5);
    const stand = this.add.image(W / 2 + 140, 250, 'duckStand').setOrigin(0.5, 1).setScale(1.5);
    this.preview.add([bike, stand]);
    this.tweens.add({ targets: bike, y: 184, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  choose(cat, item) {
    const result = wallet.buyOrEquip(cat, item.id);
    if (result === 'poor') {
      this.message.setText(`You need ${item.price - wallet.crumbs} more bread crumbs for the ${item.name}!`);
      this.cameras.main.shake(120, 0.003);
      audio.sfx.bonk();
    } else {
      this.message.setText(result === 'bought' ? `Bought the ${item.name}! Looking good, Crumb.` : `Wearing the ${item.name}.`);
      audio.sfx[result === 'bought' ? 'checkpoint' : 'click']();
      refreshLook(this);   // redraw Crumb with the new look...
      this.buildPreview(); // ...and show it
    }
    this.refresh();
  }

  refresh() {
    this.bag.setText(`${wallet.crumbs}`);
    this.grid.forEach((row, r) => row.forEach((b, c) => {
      const owned = wallet.owns(b.cat, b.item.id);
      const wearing = wallet.isEquipped(b.cat, b.item.id);
      b.text.setText(`${b.item.name}\n${wearing ? '✔ Wearing' : owned ? 'Owned' : `${b.item.price} crumbs`}`);
      b.text.setAlign('center');
      b.text.setColor(!owned && wallet.crumbs < b.item.price ? '#8a6a8f' : '#3b1d4a');
      b.setSelected(this.sel.r === r && this.sel.c === c);
    }));
    this.back.setSelected(this.sel.r === this.grid.length);
  }
}
