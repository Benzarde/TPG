/* ptGIGI main app module */

// ------------------------------
// Constants and Data Model
// ------------------------------
const STORAGE_KEYS = {
  players: "ptgigi_players",
  currentGame: "ptgigi_current_game",
  themeTracker: "ptgigi_theme_tracker",
  diceFlags: "ptgigi_dice_flags"
};

const POKEMON_SPRITE_URL = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

// Event tiers and sample themes (minimal set; can be expanded)
const EVENT_TIERS = {
  Common: { chance: 1 / 20, duration: 8, boosts: { shiny: 0, legendary: 0.01, gmax: 0.005 } },
  Uncommon: { chance: 1 / 100, duration: 10, boosts: { shiny: 0, legendary: 0.012, gmax: 0.0075 } },
  Rare: { chance: 1 / 500, duration: 12, boosts: { shiny: 0, legendary: 0.015, gmax: 0.01 } },
  Epic: { chance: 1 / 2000, duration: 12, boosts: { shiny: 0, legendary: 0.02, gmax: 0.0125 } },
  Legendary: { chance: 1 / 5000, duration: 12, boosts: { shiny: "x2", legendary: 0.025, gmax: 0.015 } },
  Mythical: { chance: 1 / 10000, duration: 12, boosts: { shiny: "x3", legendary: 0.03, gmax: 0.02 } }
};

const THEMES = [
  { name: "Pokémon Café", emoji: "☕", tier: "Common", theme: "event-cafe", bg: "linear-gradient(90deg,#0b1220,#0d172b)", description: "A cozy rush of regulars boosts encounters." },
  { name: "Pixel Plains", emoji: "🎮", tier: "Common", theme: "event-pixel", bg: "linear-gradient(90deg,#0b1220,#15213a)", description: "Retro vibes hum in the air." },
  { name: "Cyberstorm", emoji: "💾", tier: "Epic", theme: "event-cyberstorm", bg: "linear-gradient(90deg,#10192f,#0f1a33)", description: "Tech spirals bend the odds." },
  { name: "Frostbyte Core", emoji: "❄️", tier: "Legendary", theme: "event-frostcore", bg: "linear-gradient(90deg,#0b1326,#091023)", description: "Glacial echoes summon legends." },
  { name: "Mythical Garden", emoji: "🦄", tier: "Mythical", theme: "event-mythicalgarden", bg: "linear-gradient(90deg,#240b36,#0b1024)", description: "Only legends walk among the eternal grove." }
];

// Base rarity denominators
const RARITY_DENOMINATORS = {
  shiny: 4096,
  secret: 8192,
  rainbow: 16384
};

// Placeholder rates for special tags (until a full database is wired)
const BASE_TAG_RATES = {
  legendary: 0.01, // 1%
  mythical: 0.003, // 0.3%
  gmax: 0.005 // 0.5%
};

// ------------------------------
// Utilities
// ------------------------------
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function randInt(minInclusive, maxInclusive) { return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive; }
function chanceOneIn(denominator) { return randInt(1, denominator) === 1; }
function formatPercent(value) { return `${(value * 100).toFixed(2)}%`; }

// ------------------------------
// Storage Shapes
// ------------------------------
/** Player shape
{
  username: string,
  password: string,
  level: number,
  xp: number,
  wins: number,
  titles: string[],
  equippedDiceSkin: null | 'shiny' | 'secret' | 'rainbow',
  trophies: { shiny: number[], secret: number[], rainbow: number[] },
  pokedex: { shiny: number[], secret: number[], rainbow: number[] }
}
*/

/** Game state shape
{
  players: Array<{ username: string, score: number, bust: boolean, superUsed25: boolean, superUsed75: boolean, megaUsed50: boolean }>,
  turnIndex: number,
  turnCount: number,
  active: boolean
}
*/

/** Theme tracker shape
{
  active: null | { name, emoji, tier, theme, bg, remainingTurns: number },
  lastCheckedTurn: number
}
*/

// ------------------------------
// DOM Refs
// ------------------------------
const el = {
  // Profile
  profileSection: document.getElementById('profileSection'),
  registerForm: document.getElementById('registerForm'),
  regUsername: document.getElementById('regUsername'),
  regPassword: document.getElementById('regPassword'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  profilesList: document.getElementById('profilesList'),
  selectedPlayers: document.getElementById('selectedPlayers'),
  startGameBtn: document.getElementById('startGameBtn'),
  clearSelectionBtn: document.getElementById('clearSelectionBtn'),

  // Game
  gameSection: document.getElementById('gameSection'),
  eventBanner: document.getElementById('eventBanner'),
  diceSkinIndicator: document.getElementById('diceSkinIndicator'),
  scoreboard: document.getElementById('scoreboard'),
  dice3d: document.getElementById('dice3d'),
  rollBtn: document.getElementById('rollBtn'),
  turnInfo: document.getElementById('turnInfo'),
  pullsGrid: document.getElementById('pullsGrid'),
  pullsLog: document.getElementById('pullsLog'),
  statusBar: document.getElementById('statusBar'),

  // Modals & buttons
  openTrophiesBtn: document.getElementById('openTrophiesBtn'),
  openPokedexBtn: document.getElementById('openPokedexBtn'),
  openTradeBtn: document.getElementById('openTradeBtn'),
  openDevBtn: document.getElementById('openDevBtn'),
  trophiesModal: document.getElementById('trophiesModal'),
  trophiesContent: document.getElementById('trophiesContent'),
  pokedexModal: document.getElementById('pokedexModal'),
  pokedexContent: document.getElementById('pokedexContent'),
  tradeModal: document.getElementById('tradeModal'),
  tradePlayerA: document.getElementById('tradePlayerA'),
  tradePlayerB: document.getElementById('tradePlayerB'),
  tradeAList: document.getElementById('tradeAList'),
  tradeBList: document.getElementById('tradeBList'),
  confirmTradeBtn: document.getElementById('confirmTradeBtn'),
  devModal: document.getElementById('devModal'),
  devEventSelect: document.getElementById('devEventSelect'),
  devTriggerEventBtn: document.getElementById('devTriggerEventBtn'),
  devClearEventBtn: document.getElementById('devClearEventBtn'),
  devResetGameBtn: document.getElementById('devResetGameBtn'),
  devResetProfilesBtn: document.getElementById('devResetProfilesBtn'),
  devDumpStorageBtn: document.getElementById('devDumpStorageBtn'),
  devStorageDump: document.getElementById('devStorageDump')
};

// ------------------------------
// Profiles
// ------------------------------
function loadPlayers() {
  return loadJSON(STORAGE_KEYS.players, []);
}
function savePlayers(players) {
  saveJSON(STORAGE_KEYS.players, players);
}
function upsertPlayer(username, password) {
  const players = loadPlayers();
  const existing = players.find((p) => p.username === username);
  if (existing) {
    if (existing.password !== password) throw new Error('Incorrect password');
    return existing;
  }
  const newPlayer = {
    username,
    password,
    level: 1,
    xp: 0,
    wins: 0,
    titles: [],
    equippedDiceSkin: null,
    trophies: { shiny: [], secret: [], rainbow: [] },
    pokedex: { shiny: [], secret: [], rainbow: [] }
  };
  players.push(newPlayer);
  savePlayers(players);
  return newPlayer;
}

let uiState = {
  selected: [] // array of usernames
};

function renderProfilesUI() {
  const players = loadPlayers();
  // Selected players chips
  el.selectedPlayers.innerHTML = uiState.selected.map((u) => `<span class="chip">${u}</span>`).join('');
  el.startGameBtn.disabled = uiState.selected.length < 2;

  // Profiles list
  el.profilesList.innerHTML = players.map((p) => {
    return `<div class="profile-card">
      <div class="level"><span class="level-dot"></span> Lv ${p.level}</div>
      <div class="username">${p.username}</div>
      <div class="title">Wins: ${p.wins} · Trophies: 🦄${p.trophies.rainbow.length} • 🔮${p.trophies.secret.length} • ✨${p.trophies.shiny.length}</div>
      <div class="row" style="display:flex; gap: 6px;">
        <button data-username="${p.username}" class="select-player">Select</button>
        <button data-username="${p.username}" class="delete-player secondary">Delete</button>
      </div>
    </div>`;
  }).join('');

  // Wire buttons
  el.profilesList.querySelectorAll('.select-player').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-username');
      if (!uiState.selected.includes(name)) {
        uiState.selected.push(name);
        renderProfilesUI();
      }
    });
  });
  el.profilesList.querySelectorAll('.delete-player').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-username');
      const players = loadPlayers();
      const idx = players.findIndex((p) => p.username === name);
      if (idx !== -1) {
        players.splice(idx, 1);
        savePlayers(players);
        uiState.selected = uiState.selected.filter((u) => u !== name);
        renderProfilesUI();
      }
    });
  });
}

// ------------------------------
// Game State
// ------------------------------
function loadGame() { return loadJSON(STORAGE_KEYS.currentGame, null); }
function saveGame(game) { saveJSON(STORAGE_KEYS.currentGame, game); }

function createNewGame(selectedUsernames) {
  const playersState = selectedUsernames.map((u) => ({
    username: u,
    score: 0,
    bust: false,
    superUsed25: false,
    superUsed75: false,
    megaUsed50: false
  }));
  const game = { players: playersState, turnIndex: 0, turnCount: 0, active: true };
  saveGame(game);
  return game;
}

// ------------------------------
// Events Engine
// ------------------------------
function loadThemeTracker() { return loadJSON(STORAGE_KEYS.themeTracker, { active: null, lastCheckedTurn: 0 }); }
function saveThemeTracker(tt) { saveJSON(STORAGE_KEYS.themeTracker, tt); }

function maybeTriggerEvent(game) {
  const tracker = loadThemeTracker();
  if (!game.active) return tracker;
  if (game.turnCount % 6 !== 0) return tracker;

  // If an event is active, decrement remaining
  if (tracker.active) {
    tracker.active.remainingTurns -= 1;
    if (tracker.active.remainingTurns <= 0) tracker.active = null;
  }

  // Consider triggering a new event (only if none active)
  if (!tracker.active) {
    const tryOrder = ["Mythical", "Legendary", "Epic", "Rare", "Uncommon", "Common"]; // roll rarest first
    for (const tier of tryOrder) {
      const t = EVENT_TIERS[tier];
      if (Math.random() < t.chance) {
        const candidates = THEMES.filter((th) => th.tier === tier);
        const theme = candidates[randInt(0, candidates.length - 1)];
        tracker.active = { ...theme, remainingTurns: t.duration };
        break;
      }
    }
  }
  saveThemeTracker(tracker);
  return tracker;
}

function getShinyDenominatorWithBoosts(base, themeActive) {
  if (!themeActive) return base;
  if (themeActive.tier === 'Legendary') return Math.max(1, Math.floor(base / 2));
  if (themeActive.tier === 'Mythical') return Math.max(1, Math.floor(base / 3));
  return base;
}

function getTagRatesWithBoosts(themeActive) {
  // Boost legendary/gmax odds during events as per tier
  const base = { ...BASE_TAG_RATES };
  if (!themeActive) return base;
  const tier = EVENT_TiersMap[themeActive.tier] || EVENT_TIERS[themeActive.tier];
  const boosts = EVENT_TIERS[themeActive.tier]?.boosts || {};
  return {
    legendary: Math.min(0.5, base.legendary + (boosts.legendary || 0)),
    mythical: base.mythical, // unchanged by events per doc (implicitly)
    gmax: Math.min(0.5, base.gmax + (boosts.gmax || 0))
  };
}

// Map helper for quick lookup
const EVENT_TiersMap = EVENT_TIERS;

// ------------------------------
// Rarity and Pull Generation
// ------------------------------
function generatePokemonPull(themeActive) {
  // Random ID in 1..1010 (excluding gen 9 if needed; we include all for demo)
  const id = randInt(1, 1010);

  // Determine special tags
  const tagRates = getTagRatesWithBoosts(themeActive);
  const isLegendary = Math.random() < tagRates.legendary;
  const isMythical = Math.random() < tagRates.mythical;
  const isGmax = Math.random() < tagRates.gmax;

  // Rarity resolution: shiny -> secret -> rainbow (mutually exclusive)
  const shinyDen = getShinyDenominatorWithBoosts(RARITY_DENOMINATORS.shiny, themeActive);
  const isShiny = chanceOneIn(shinyDen);
  let rarity = null;
  if (isShiny) rarity = 'shiny';
  else if (chanceOneIn(RARITY_DENOMINATORS.secret)) rarity = 'secret';
  else if (chanceOneIn(RARITY_DENOMINATORS.rainbow)) rarity = 'rainbow';

  // Scoring
  let points = 0;
  if (isLegendary || isMythical) points += 1;
  if (isGmax) points += 2;
  if (rarity === 'shiny') points += 5;

  return {
    id,
    sprite: POKEMON_SPRITE_URL(id),
    isLegendary,
    isMythical,
    isGmax,
    rarity, // null | 'shiny' | 'secret' | 'rainbow'
    points
  };
}

// ------------------------------
// Trophies and Pokédex
// ------------------------------
function addTrophyAndDex(username, pull) {
  if (!pull.rarity) return; // only rare pulls are trophy/dex worthy
  const players = loadPlayers();
  const p = players.find((pl) => pl.username === username);
  if (!p) return;

  const list = p.trophies[pull.rarity];
  if (!list.includes(pull.id)) list.push(pull.id);

  const dexList = p.pokedex[pull.rarity];
  if (!dexList.includes(pull.id)) dexList.push(pull.id);

  // Titles can be recomputed here (stub)
  p.titles = computeTitles(p);

  savePlayers(players);
}

function computeTitles(p) {
  const titles = [];
  if (p.wins >= 1) titles.push('Rookie Champion');
  if (p.wins >= 5) titles.push('Seasoned Victor');
  if (p.trophies.shiny.length >= 50) titles.push('Shiny Hunter');
  if (p.trophies.secret.length >= 25) titles.push('Arcane Seeker');
  if (p.trophies.rainbow.length >= 10) titles.push('Prismatic Legend');
  return titles;
}

// ------------------------------
// UI Rendering Helpers
// ------------------------------
function renderScoreboard(game) {
  el.scoreboard.innerHTML = game.players.map((pl, idx) => {
    const playerProfile = loadPlayers().find((p) => p.username === pl.username);
    const titles = playerProfile?.titles || [];
    return `<div class="score-card">
      <div class="score-top">
        <div><strong>${pl.username}</strong> ${idx === game.turnIndex ? '• Your turn' : ''}</div>
        <div class="score-points">${pl.score}</div>
      </div>
      <div class="muted">${titles.join(' · ')}</div>
      ${pl.bust ? '<div class="score-bust">BUST</div>' : ''}
      <div class="muted" style="font-size:12px;">Bonus: ${pl.superUsed25 ? '✓' : '25'} · ${pl.megaUsed50 ? '✓' : '50'} · ${pl.superUsed75 ? '✓' : '75'}</div>
    </div>`;
  }).join('');
}

function renderEventBanner(tracker) {
  if (tracker.active) {
    el.eventBanner.classList.remove('hidden');
    el.eventBanner.style.background = tracker.active.bg;
    el.eventBanner.innerHTML = `${tracker.active.emoji} <strong>${tracker.active.name}</strong> [${tracker.active.tier}] · ${tracker.active.remainingTurns} turns left`;
  } else {
    el.eventBanner.classList.add('hidden');
    el.eventBanner.innerHTML = '';
  }
}

function renderDice(diceValues, bonus) {
  el.dice3d.innerHTML = '';
  const all = [...diceValues];
  if (bonus.super25) all.push({ value: bonus.super25, type: 'super' });
  if (bonus.mega50) all.push({ value: bonus.mega50, type: 'mega' });
  if (bonus.super75) all.push({ value: bonus.super75, type: 'super' });
  for (const d of all) {
    const value = typeof d === 'number' ? d : d.value;
    const type = typeof d === 'number' ? null : d.type;
    const div = document.createElement('div');
    div.className = `die${type ? ' ' + type : ''}`;
    div.innerHTML = `<div class="pips">${value}</div>`;
    el.dice3d.appendChild(div);
  }
}

function renderPulls(pulls) {
  el.pullsGrid.innerHTML = pulls.map((p) => {
    const tags = [
      p.isLegendary ? '<span class="rarity legendary">Legendary</span>' : '',
      p.isMythical ? '<span class="rarity legendary">Mythical</span>' : '',
      p.isGmax ? '<span class="rarity gmax">Gmax</span>' : '',
      p.rarity ? `<span class="rarity ${p.rarity}">${p.rarity}</span>` : ''
    ].join('');
    return `<div class="pull-card">
      ${tags}
      <img src="${p.sprite}" alt="#${p.id}" />
      <div class="name">#${p.id}</div>
      <div class="muted" style="font-size:11px;">+${p.points} pts</div>
    </div>`;
  }).join('');
}

function logPulls(pulls, username) {
  const lines = pulls.map((p) => `${username} pulled #${p.id}${p.rarity ? ' [' + p.rarity + ']' : ''}${p.isLegendary ? ' (Legendary)' : ''}${p.isMythical ? ' (Mythical)' : ''}${p.isGmax ? ' (Gmax)' : ''} +${p.points}`);
  const newText = lines.join('\n') + '\n' + el.pullsLog.textContent;
  el.pullsLog.textContent = newText.slice(0, 4000);
}

// ------------------------------
// Game Loop
// ------------------------------
function getCurrentPlayer(game) { return game.players[game.turnIndex]; }

function nextTurn(game) {
  // Advance to next non-busted player
  let steps = 0;
  do {
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    steps += 1;
  } while (game.players[game.turnIndex].bust && steps <= game.players.length + 1);
  game.turnCount += 1;
  saveGame(game);
}

function checkVictoryOrBust(game, player) {
  if (player.score === 100) {
    game.active = false;
    saveGame(game);
    alert(`${player.username} hits exactly 100! Victory!`);
    // increment wins
    const players = loadPlayers();
    const profile = players.find((p) => p.username === player.username);
    if (profile) {
      profile.wins += 1;
      profile.titles = computeTitles(profile);
      savePlayers(players);
    }
    return true;
  }
  if (player.score > 100) {
    player.bust = true;
    saveGame(game);
    return false;
  }
  return false;
}

function determineBonusDice(player) {
  const result = { super25: null, mega50: null, super75: null };
  if (!player.superUsed25 && player.score >= 25) { result.super25 = randInt(1, 12); player.superUsed25 = true; }
  if (!player.megaUsed50 && player.score >= 50) { result.mega50 = randInt(1, 20); player.megaUsed50 = true; }
  if (!player.superUsed75 && player.score >= 75) { result.super75 = randInt(1, 12); player.superUsed75 = true; }
  return result;
}

function handleRoll() {
  const game = loadGame();
  if (!game || !game.active) return;
  const player = getCurrentPlayer(game);
  if (player.bust) { nextTurn(game); renderAll(); return; }

  // Base five dice
  const diceValues = [randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6)];

  // Event check
  const tracker = maybeTriggerEvent(game);

  // Bonus dice triggers based on current score BEFORE adding new points
  const bonus = determineBonusDice(player);

  // Render dice visuals
  renderDice(diceValues, bonus);

  // Total number of Pokémon to generate
  const total = diceValues.reduce((a, b) => a + b, 0) + (bonus.super25 || 0) + (bonus.mega50 || 0) + (bonus.super75 || 0);

  // Generate pulls
  const pulls = [];
  for (let i = 0; i < total; i++) {
    const pull = generatePokemonPull(tracker.active);
    pulls.push(pull);
    player.score += pull.points;
    if (pull.rarity) addTrophyAndDex(player.username, pull);
  }

  // Legendary suspense: if any legendary/mythical, delay reveal simulation (3s). We'll just log then show.
  const hasLegendary = pulls.some((p) => p.isLegendary || p.isMythical);

  // Update state and UI
  saveGame(game);
  renderScoreboard(game);
  renderEventBanner(tracker);
  el.turnInfo.textContent = `${player.username} rolled ${diceValues.join(', ')} ${bonus.super25 ? '+ d12' : ''} ${bonus.mega50 ? '+ d20' : ''} ${bonus.super75 ? '+ d12' : ''} → ${total} pulls`;

  function reveal() {
    renderPulls(pulls);
    logPulls(pulls, player.username);

    const ended = checkVictoryOrBust(game, player);
    if (!ended) {
      nextTurn(game);
      renderAll();
    } else {
      renderAll();
    }
  }

  if (hasLegendary) {
    el.pullsGrid.innerHTML = '<div class="muted">Legendary aura building... ✨</div>';
    setTimeout(reveal, 3000);
  } else {
    reveal();
  }
}

// ------------------------------
// Trophies / Pokédex UI
// ------------------------------
function openTrophies() {
  const players = loadPlayers();
  // For simplicity, show current selected user 0 if in game else list of players
  const active = loadGame();
  const username = active?.players?.[active.turnIndex]?.username || uiState.selected[0] || players[0]?.username;
  const p = players.find((pl) => pl.username === username);
  if (!p) return;
  function renderTab(kind) {
    const list = p.trophies[kind];
    el.trophiesContent.innerHTML = list.map((id) => `<div class="dex-card"><img src="${POKEMON_SPRITE_URL(id)}" alt="#${id}"><div>#${id}</div></div>`).join('');
  }
  // Default shiny as last tab; but preserve selected
  renderTab('rainbow');
  el.trophiesModal.showModal();
  el.trophiesModal.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      el.trophiesModal.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.getAttribute('data-tab'));
    });
  });
}

function openPokedex() {
  const players = loadPlayers();
  const active = loadGame();
  const username = active?.players?.[active.turnIndex]?.username || uiState.selected[0] || players[0]?.username;
  const p = players.find((pl) => pl.username === username);
  if (!p) return;
  const kinds = ['rainbow','secret','shiny'];
  el.pokedexContent.innerHTML = kinds.map((k) => {
    const list = p.pokedex[k];
    return `<div><div style="margin:6px 0; font-weight:600;">${k.toUpperCase()}</div><div class="dex-grid">${list.map((id) => `<div class="dex-card"><img src="${POKEMON_SPRITE_URL(id)}" alt="#${id}"><div>#${id}</div></div>`).join('')}</div></div>`;
  }).join('');
  el.pokedexModal.showModal();
}

// ------------------------------
// Trade (basic stub)
// ------------------------------
function openTrade() {
  const players = loadPlayers();
  const usernames = players.map((p) => p.username);
  el.tradePlayerA.innerHTML = usernames.map((u) => `<option>${u}</option>`).join('');
  el.tradePlayerB.innerHTML = usernames.map((u) => `<option>${u}</option>`).join('');
  function renderLists() {
    const a = players.find((p) => p.username === el.tradePlayerA.value);
    const b = players.find((p) => p.username === el.tradePlayerB.value);
    el.tradeAList.innerHTML = renderTradeList(a);
    el.tradeBList.innerHTML = renderTradeList(b);
    wireTradeSelection();
  }
  function renderTradeList(p) {
    function itemize(kind) {
      return p.trophies[kind].map((id) => `<label style="display:block; font-size:12px;"><input type="checkbox" data-user="${p.username}" data-kind="${kind}" value="${id}" /> ${kind} #${id}</label>`).join('');
    }
    return `<div>RAINBOW<hr>${itemize('rainbow')}<hr>SECRET<hr>${itemize('secret')}<hr>SHINY<hr>${itemize('shiny')}</div>`;
  }
  function wireTradeSelection() {
    const boxes = el.tradeModal.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box) => box.addEventListener('change', () => {
      const any = Array.from(boxes).some((b) => b.checked);
      el.confirmTradeBtn.disabled = !any;
    }));
  }
  el.confirmTradeBtn.onclick = () => {
    // Collect selections
    const boxes = el.tradeModal.querySelectorAll('input[type="checkbox"]:checked');
    const changes = {};
    boxes.forEach((b) => {
      const user = b.getAttribute('data-user');
      const kind = b.getAttribute('data-kind');
      const id = parseInt(b.value, 10);
      changes[user] = changes[user] || { shiny: [], secret: [], rainbow: [] };
      changes[user][kind].push(id);
    });
    // Requires two players selected
    const involved = Object.keys(changes);
    if (involved.length !== 2) { alert('Select trophies from exactly two players'); return; }
    const [ua, ub] = involved;
    const db = loadPlayers();
    const pa = db.find((p) => p.username === ua);
    const pb = db.find((p) => p.username === ub);
    // Remove from owners and add to the other
    for (const kind of ['shiny','secret','rainbow']) {
      for (const id of changes[ua][kind]) {
        pa.trophies[kind] = pa.trophies[kind].filter((x) => x !== id);
        if (!pb.trophies[kind].includes(id)) pb.trophies[kind].push(id);
      }
      for (const id of changes[ub][kind]) {
        pb.trophies[kind] = pb.trophies[kind].filter((x) => x !== id);
        if (!pa.trophies[kind].includes(id)) pa.trophies[kind].push(id);
      }
    }
    // Recompute titles
    pa.titles = computeTitles(pa);
    pb.titles = computeTitles(pb);
    savePlayers(db);
    alert('Trade complete. Titles recalculated.');
    el.tradeModal.close();
  };
  el.tradePlayerA.onchange = renderLists;
  el.tradePlayerB.onchange = renderLists;
  renderLists();
  el.tradeModal.showModal();
}

// ------------------------------
// Dev Tools
// ------------------------------
function openDev() {
  // Populate event select
  el.devEventSelect.innerHTML = THEMES.map((t, i) => `<option value="${i}">${t.emoji} ${t.name} [${t.tier}]</option>`).join('');
  el.devTriggerEventBtn.onclick = (e) => {
    e.preventDefault();
    const idx = parseInt(el.devEventSelect.value, 10);
    const theme = THEMES[idx];
    const tracker = { active: { ...theme, remainingTurns: EVENT_TIERS[theme.tier].duration }, lastCheckedTurn: 0 };
    saveThemeTracker(tracker);
    renderEventBanner(tracker);
  };
  el.devClearEventBtn.onclick = (e) => {
    e.preventDefault();
    const tracker = loadThemeTracker();
    tracker.active = null;
    saveThemeTracker(tracker);
    renderEventBanner(tracker);
  };
  el.devResetGameBtn.onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem(STORAGE_KEYS.currentGame);
    alert('Current game reset.');
    renderAll();
  };
  el.devResetProfilesBtn.onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem(STORAGE_KEYS.players);
    alert('All profiles removed.');
    uiState.selected = [];
    renderProfilesUI();
  };
  el.devDumpStorageBtn.onclick = (e) => {
    e.preventDefault();
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      dump[key] = localStorage.getItem(key);
    }
    el.devStorageDump.textContent = JSON.stringify(dump, null, 2);
  };
  el.devModal.showModal();
}

// ------------------------------
// Wiring
// ------------------------------
function renderAll() {
  const game = loadGame();
  if (game && game.active) {
    el.profileSection.classList.add('hidden');
    el.gameSection.classList.remove('hidden');
    renderScoreboard(game);
    renderEventBanner(loadThemeTracker());
    const pl = getCurrentPlayer(game);
    el.turnInfo.textContent = `${pl.username}'s turn`;
  } else {
    el.gameSection.classList.add('hidden');
    el.profileSection.classList.remove('hidden');
    renderProfilesUI();
  }
}

function startGame() {
  const game = createNewGame(uiState.selected.slice(0));
  el.profileSection.classList.add('hidden');
  el.gameSection.classList.remove('hidden');
  renderScoreboard(game);
  renderEventBanner(loadThemeTracker());
}

function init() {
  // Profile forms
  el.registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = el.regUsername.value.trim();
    const p = el.regPassword.value.trim();
    if (!u || !p) return;
    try {
      upsertPlayer(u, p);
      el.regUsername.value = '';
      el.regPassword.value = '';
      renderProfilesUI();
    } catch (err) {
      alert(err.message);
    }
  });
  el.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = el.loginUsername.value.trim();
    const p = el.loginPassword.value.trim();
    try {
      upsertPlayer(u, p);
      if (!uiState.selected.includes(u)) uiState.selected.push(u);
      renderProfilesUI();
    } catch (err) {
      alert(err.message);
    }
  });
  el.startGameBtn.addEventListener('click', startGame);
  el.clearSelectionBtn.addEventListener('click', () => { uiState.selected = []; renderProfilesUI(); });

  // Game
  el.rollBtn.addEventListener('click', handleRoll);

  // Modals
  el.openTrophiesBtn.addEventListener('click', openTrophies);
  el.openPokedexBtn.addEventListener('click', openPokedex);
  el.openTradeBtn.addEventListener('click', openTrade);
  el.openDevBtn.addEventListener('click', openDev);

  renderAll();
}

init();