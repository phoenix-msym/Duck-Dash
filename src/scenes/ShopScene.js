import { makeTextures, refreshLook } from '../art.js';
import { makeButton, sunsetBackdrop, FONT } from '../ui.js';
import { wallet, SHOP_ITEMS } from '../wallet.js';
import { audio } from '../audio.js';

// The Bread Shop: spend the bread crumbs you collected on scarves, bike colours and hats.
// Click an item to TRY IT ON (Crumb at the top shows it), then press the button at the bottom to buy or wear it.
// Keyboard: arrows move around (and try things on), Enter = the bottom button, Esc = back.

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
    this.message = this.add.text(W / 2, 285, 'Click something to try it on!', {
      fontFamily: FONT, fontSize: '22px', color: '#ffe680', fontStyle: 'italic',
    }).setOrigin(0.5);

    // live preview of Crumb (shows whatever you're trying on)
    this.preview = this.add.container(0, 0);
    this.buildPreview();

    // the item buttons: one row per category. Clicking one tries it on.
    this.grid = ROWS.map((row, r) => {
      const y = 350 + r * 100;
      this.add.text(90, y, row.label, { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0, 0.5);
      return SHOP_ITEMS[row.cat].map((item, i) => {
        const b = makeButton(this, 300 + i * 212, y, '', () => { this.sel = { r, c: i }; this.tryOn(); }, { w: 200, h: 72, size: 19 });
        b.cat = row.cat; b.item = item;
        return b;
      });
    });

    // bottom row: Back, and the Buy / Wear button (only shown once you've picked something)
    this.back = makeButton(this, W / 2 - 170, H - 62, 'Back', () => this.leave(), { w: 220, h: 54, size: 26 });
    this.action = makeButton(this, W / 2 + 170, H - 62, '', () => this.buyOrWear(), { w: 300, h: 54, size: 24 });
    this.showAction(false);
    this.trying = null; // the item being tried on: { cat, item }

    // keyboard
    this.sel = { r: 0, c: 0 };
    const kb = this.input.keyboard;
    const move = (dr, dc) => {
      const r = Phaser.Math.Clamp(this.sel.r + dr, 0, this.grid.length - 1);
      const c = Phaser.Math.Clamp(this.sel.c + dc, 0, this.grid[r].length - 1);
      this.sel = { r, c };
      audio.sfx.select();
      this.tryOn(true);
    };
    kb.on('keydown-UP', () => move(-1, 0)); kb.on('keydown-W', () => move(-1, 0));
    kb.on('keydown-DOWN', () => move(1, 0)); kb.on('keydown-S', () => move(1, 0));
    kb.on('keydown-LEFT', () => move(0, -1)); kb.on('keydown-A', () => move(0, -1));
    kb.on('keydown-RIGHT', () => move(0, 1)); kb.on('keydown-D', () => move(0, 1));
    kb.on('keydown-ENTER', () => (this.trying ? this.buyOrWear() : this.tryOn()));
    kb.on('keydown-SPACE', () => (this.trying ? this.buyOrWear() : this.tryOn()));
    kb.on('keydown-ESC', () => this.leave());

    // leaving the shop: Crumb goes back to wearing what you actually own/wear
    this.events.once('shutdown', () => refreshLook(this));

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

  // put the selected item on Crumb (just a preview: nothing is bought yet)
  tryOn(quiet = false) {
    const b = this.grid[this.sel.r][this.sel.c];
    this.trying = { cat: b.cat, item: b.item };
    refreshLook(this, { [b.cat]: b.item });
    this.buildPreview();
    if (!quiet) audio.sfx.select();
    // little "pop" on the preview so you notice it changed
    this.tweens.add({ targets: this.preview, scale: { from: 1.04, to: 1 }, duration: 200, ease: 'Back.out' });
    this.refresh();
  }

  buyOrWear() {
    if (!this.trying) return;
    const { cat, item } = this.trying;
    if (wallet.isEquipped(cat, item.id)) return;
    const result = wallet.buyOrEquip(cat, item.id);
    if (result === 'poor') {
      this.message.setText(`You need ${item.price - wallet.crumbs} more bread crumbs for the ${item.name}!`);
      this.cameras.main.shake(120, 0.003);
      audio.sfx.bonk();
    } else {
      this.message.setText(result === 'bought' ? `Bought the ${item.name}! Looking good, Crumb.` : `Wearing the ${item.name}.`);
      audio.sfx[result === 'bought' ? 'checkpoint' : 'click']();
      refreshLook(this, { [cat]: item });
      this.buildPreview();
    }
    this.refresh();
  }

  leave() {
    this.scene.start('Menu');
  }

  showAction(on) {
    this.action.bg.setVisible(on); this.action.text.setVisible(on);
    if (on) this.action.zone.setInteractive({ useHandCursor: true }); else this.action.zone.disableInteractive();
  }

  refresh() {
    this.bag.setText(`${wallet.crumbs}`);
    this.grid.forEach((row, r) => row.forEach((b, c) => {
      const owned = wallet.owns(b.cat, b.item.id);
      const wearing = wallet.isEquipped(b.cat, b.item.id);
      b.text.setText(`${b.item.name}\n${wearing ? '✔ Wearing' : owned ? 'Owned' : `${b.item.price} crumbs`}`);
      b.text.setAlign('center');
      b.text.setColor(!owned && wallet.crumbs < b.item.price ? '#8a6a8f' : '#3b1d4a');
      const isTrying = this.trying && this.trying.cat === b.cat && this.trying.item.id === b.item.id;
      b.setSelected(isTrying || (this.sel.r === r && this.sel.c === c));
    }));

    // the bottom button changes to match the item you're trying on
    if (!this.trying) { this.showAction(false); return; }
    const { cat, item } = this.trying;
    const owned = wallet.owns(cat, item.id), wearing = wallet.isEquipped(cat, item.id);
    this.showAction(true);
    let label;
    if (wearing) label = '✔ Wearing it';
    else if (owned) label = 'Wear it';
    else if (wallet.crumbs >= item.price) label = `Buy  (${item.price} crumbs)`;
    else label = `Need ${item.price - wallet.crumbs} more crumbs`;
    this.action.text.setText(label);
    this.action.setSelected(!wearing);
    if (!this.message.text || this.message.text.startsWith('Click')) this.message.setText(`Trying on: ${item.name}`);
    else if (!wearing && !this.message.text.startsWith('You need') && !this.message.text.startsWith('Bought')) this.message.setText(`Trying on: ${item.name}`);
  }
}
