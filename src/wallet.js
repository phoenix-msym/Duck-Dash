// Bread crumbs you've collected, and the shop items you own / are wearing.
// Saved in the browser so it all survives a refresh.

const KEY = 'duckdash-shop';

// Everything in the shop. price 0 = you start with it.
export const SHOP_ITEMS = {
  scarf: [
    { id: 'red', name: 'Red Scarf', color: 0xe63950, price: 0 },
    { id: 'blue', name: 'Blue Scarf', color: 0x3d8bff, price: 15 },
    { id: 'green', name: 'Green Scarf', color: 0x3ddc84, price: 15 },
    { id: 'purple', name: 'Purple Scarf', color: 0xa45cff, price: 20 },
    { id: 'gold', name: 'Gold Scarf', color: 0xffc400, price: 40 },
  ],
  bike: [
    { id: 'sky', name: 'Sky Bike', colors: [0x2e9cca, 0x22779b], price: 0 },
    { id: 'flame', name: 'Flame Bike', colors: [0xe8452c, 0xb02a17], price: 25 },
    { id: 'midnight', name: 'Midnight Bike', colors: [0x4a4a5e, 0x2a2a36], price: 25 },
    { id: 'bubblegum', name: 'Bubblegum Bike', colors: [0xff7ac0, 0xd94f9a], price: 30 },
  ],
  hat: [
    { id: 'none', name: 'No Hat', price: 0 },
    { id: 'cap', name: 'Cap', price: 30 },
    { id: 'party', name: 'Party Hat', price: 35 },
    { id: 'crown', name: 'Crown', price: 60 },
  ],
};

const DEFAULT = {
  crumbs: 0,
  owned: { scarf: ['red'], bike: ['sky'], hat: ['none'] },
  equipped: { scarf: 'red', bike: 'sky', hat: 'none' },
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) return { ...DEFAULT, ...s, owned: { ...DEFAULT.owned, ...s.owned }, equipped: { ...DEFAULT.equipped, ...s.equipped } };
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT));
}

const state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window */ } };

export const wallet = {
  get crumbs() { return state.crumbs; },
  add(n) { state.crumbs += n; save(); },

  owns(cat, id) { return state.owned[cat].includes(id); },
  isEquipped(cat, id) { return state.equipped[cat] === id; },
  // the item Crumb is wearing in a category
  equipped(cat) { return SHOP_ITEMS[cat].find((i) => i.id === state.equipped[cat]) || SHOP_ITEMS[cat][0]; },

  // returns 'bought', 'equipped', or 'poor' (not enough crumbs)
  buyOrEquip(cat, id) {
    const item = SHOP_ITEMS[cat].find((i) => i.id === id);
    if (!this.owns(cat, id)) {
      if (state.crumbs < item.price) return 'poor';
      state.crumbs -= item.price;
      state.owned[cat].push(id);
      state.equipped[cat] = id;
      save();
      return 'bought';
    }
    state.equipped[cat] = id;
    save();
    return 'equipped';
  },
};
