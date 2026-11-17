const $ = selector => document.querySelector(selector);
const main = $('main');
const cache = new Map();
const pending = new Map();
const money = value => '$' + (+value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => '&#' + char.charCodeAt(0) + ';');
const link = (type, value) => '#/' + type + '/' + encodeURIComponent(value);
const pot = bounty => +(bounty.potUsd ?? bounty.rewardAmount ?? 0);
const isLive = bounty => bounty.status === 'open' && new Date(bounty.deadline) > Date.now();
const deadline = bounty => +new Date(bounty.deadline) || Infinity;
const categories = ['Code', 'Games', 'Growth', 'Trading', 'Forecasting', 'Security', 'Automation'];
const listMarkup = '<div id="list" role="list" aria-label="Results" tabindex="0"></div>';
const backLink = '<a class="back" href="#/">← Back to the board</a>';

let view;
let disconnect = () => {};
let bounties = [];
let generation = 0;
let query = '';
let category = '';
let sort = 'soon';
let showAll = false;

function text(node, value) {
  value = String(value ?? '');
  if (node && node.textContent !== value) node.textContent = value;
}

const set = (id, value) => text($('#' + id), value);

async function request(path) {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < 20000) return cached.data;
  if (pending.has(path)) return pending.get(path);

  const task = (async () => {
    const headers = cached?.etag ? { 'If-None-Match': cached.etag } : {};
    const response = await fetch('https://make.fun/api/' + path, { headers });
    if (response.status !== 304 && !response.ok) {
      throw Error('Request failed (' + response.status + ').');
    }
    const unchanged = response.status === 304;
    if (unchanged && !cached) throw Error('Received 304 without a cached response.');
    const data = unchanged ? cached.data : await response.json();
    cache.delete(path);
    cache.set(path, {
      data,
      time: Date.now(),
      etag: response.headers.get('ETag') || (unchanged ? cached.etag : null),
    });
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return data;
  })();

  pending.set(path, task);
  try {
    return await task;
  } finally {
    pending.delete(path);
  }
}

function tick() {
  let expired = false;
  document.querySelectorAll('[data-time]').forEach(node => {
    const seconds = Math.floor((new Date(node.dataset.time) - Date.now()) / 1000);
    text(node, !Number.isFinite(seconds) ? 'No deadline' : seconds <= 0 ? 'Deadline passed'
      : seconds >= 86400 ? Math.floor(seconds / 86400) + 'd ' + Math.floor(seconds % 86400 / 3600) + 'h left'
        : Math.floor(seconds / 3600) + 'h ' + Math.floor(seconds % 3600 / 60) + 'm ' + seconds % 60 + 's left');
    if (seconds <= 0 && node.closest('.bounty')) {
      delete node.dataset.time;
      expired = true;
    }
  });
  if (expired) renderBoard();
}

function virtualList(rowHeight, patch, keyOf) {
  const list = $('#list');
  const space = document.createElement('div');
  const nodes = new Map();
  let items = [];
  space.className = 'space';
  list.append(space);

  function render() {
    const count = Math.ceil(list.clientHeight / rowHeight) + 2;
    const start = Math.max(0, Math.min(Math.floor(list.scrollTop / rowHeight) - 1, items.length - count));
    const visible = new Set();
    space.style.height = items.length * rowHeight + 'px';
    for (let index = start; index < Math.min(items.length, start + count); index++) {
      const item = items[index];
      const key = keyOf(item);
      let node = nodes.get(key);
      visible.add(key);
      if (!node) {
        node = document.createElement('div');
        node.className = 'row';
        node.setAttribute('role', 'listitem');
        nodes.set(key, node);
        space.append(node);
      }
      node.style.cssText = 'top:' + index * rowHeight + 'px;height:' + rowHeight + 'px';
      node.setAttribute('aria-posinset', index + 1);
      node.setAttribute('aria-setsize', items.length);
      patch(node, item);
    }
    for (const [key, node] of nodes) {
      if (!visible.has(key)) {
        node.remove();
        nodes.delete(key);
      }
    }
    tick();
  }

  list.onscroll = render;
  const observer = new ResizeObserver(render);
  observer.observe(list);
  disconnect = () => observer.disconnect();
  return next => {
    items = next;
    render();
  };
}

function patchFields(node, markup, values) {
  if (!node.firstChild) {
    node.innerHTML = markup;
    node._fields = node.querySelectorAll('[data-v]');
  }
  values.forEach((value, index) => text(node._fields[index], value));
}

function patchBounty(node, bounty) {
  const ended = !isLive(bounty);
  patchFields(node, '<a class="bounty"><span class="icon" aria-hidden="true">↗</span><span><b data-v></b><small data-v></small></span><span><b class="pill" data-v></b><small class="pill muted" data-v></small></span><span class="timer pill" data-v></span><small class="entries" data-v></small></a>', [
    bounty.title,
    bounty.category + ' · ' + (bounty.sponsor?.name || 'make.fun'),
    money(pot(bounty)) + ' pot',
    +bounty.entryFeeUsd ? money(bounty.entryFeeUsd) + ' entry' : 'Free entry',
    ended ? 'Deadline passed' : bounty.deadline,
    bounty.submissionCount + ' entries',
  ]);
  node.firstChild.classList.toggle('ended', ended);
  node.firstChild.href = link('bounty', bounty.slug);
  const timer = node.querySelector('.timer');
  if (ended) delete timer.dataset.time;
  else timer.dataset.time = bounty.deadline;
}

function renderBoard() {
  if (view?.type !== 'board') return;
  const items = bounties.filter(bounty => (showAll || bounty.status === 'open')
    && (!category || bounty.category === category)
    && [bounty.title, bounty.summary, bounty.category].join(' ').toLowerCase().includes(query));
  items.sort((a, b) => isLive(b) - isLive(a) || (sort === 'pot' ? pot(b) - pot(a)
    : sort === 'entries' ? b.submissionCount - a.submissionCount : deadline(a) - deadline(b)));
  view.update(items);
  set('count', items.length + ' bounties');
  set('empty', items.length ? '' : 'No matching bounties.');
  set('live-tab', 'Live · ' + bounties.filter(bounty => bounty.status === 'open').length);
}

async function refreshTotals() {
  let path = 'competitions?activity=times';
  const items = [];
  do {
    const page = await request(path);
    items.push(...page.items);
    path = page.next_cursor ? 'competitions?activity=times&cursor=' + encodeURIComponent(page.next_cursor) : null;
  } while (path);
  bounties = items;
  const live = items.filter(bounty => bounty.status === 'open');
  set('live', live.length);
  set('pots', money(live.reduce((sum, bounty) => sum + pot(bounty), 0)));
  set('entries', items.reduce((sum, bounty) => sum + (+bounty.submissionCount || 0), 0).toLocaleString());
}

function patchEntry(node, entry) {
  patchFields(node, '<span data-v></span><span><a data-v></a><small data-v></small></span><span data-v></span><b data-v></b>', [
    '#' + (entry.rank ?? '—'), entry.handle, entry.title, entry.score, entry.prize,
  ]);
  node.querySelector('a').href = link('profile', entry.handle);
  node.dataset.rank = entry.rank || '';
}

function patchSolution(node, solution) {
  patchFields(node, '<a class="solution"><span><b data-v></b><small data-v></small></span><span data-v></span></a>', [
    solution.title, solution.competition.title,
    (solution.placement ? '#' + solution.placement : 'Entered') + (solution.prize_usd ? ' · ' + money(solution.prize_usd) : ''),
  ]);
  node.firstChild.href = link('bounty', solution.competition.slug);
}

function renderBounty(bounty, leaderboard) {
  for (const [id, value] of Object.entries({
    title: bounty.title,
    summary: bounty.summary,
    description: bounty.description,
    meta: bounty.category + ' / ' + bounty.status,
    pot: money(pot(bounty)),
    facts: 'Entry: ' + (+bounty.entryFeeUsd ? money(bounty.entryFeeUsd) : 'Free') + ' · Fees: ' + money(bounty.entryFeesUsd),
    dates: 'Opened ' + new Date(bounty.publishedAt).toLocaleString() + '\nDeadline ' + new Date(bounty.deadline).toLocaleString(),
  })) set(id, value);
  $('#timer').dataset.time = bounty.deadline;
  const rewards = bounty.rewardsNow || Object.entries(bounty.rewards || {}).map(([place, amountUsd]) => ({ place, amountUsd }));
  const markup = '<tr><th>Place</th><th>Reward</th></tr>' + rewards.map(reward => '<tr><td>#' + escape(reward.place) + '</td><td>' + money(reward.amountUsd) + '</td></tr>').join('');
  const table = $('#rewards');
  if (table._html !== markup) {
    table.innerHTML = markup;
    table._html = markup;
  }
  const entries = [...leaderboard.entries || [], ...leaderboard.rest || []];
  set('note', leaderboard.phase?.scores_visible === false ? 'Scores hidden until results publish.' : entries.length + ' ranked entries');
  view.update(entries.map(entry => ({
    ...entry,
    score: entry.display?.[leaderboard.rank_key] ?? entry.values?.[leaderboard.rank_key] ?? '—',
    prize: entry.prize_eligible === false ? '—'
      : rewards.some(reward => +reward.place === +entry.prize_rank)
        ? money(rewards.find(reward => +reward.place === +entry.prize_rank).amountUsd) : '—',
  })));
  tick();
}

function renderProfile(profile) {
  set('title', profile.display_name || profile.handle);
  set('handle', '@' + profile.handle);
  const picture = $('#picture');
  const source = 'https://make.fun/api/profiles/' + encodeURIComponent(profile.handle) + '/picture.png';
  if (picture.src !== source) picture.src = source;
  set('bio', profile.bio || 'A maker on make.fun.');
  set('joined', profile.joined_at ? 'Joined ' + profile.joined_at.slice(0, 10) : '');
  const record = profile.record;
  set('record', record ? (record.competitions_entered ?? 0) + ' entered / ' + (record.competitions_won ?? 0)
    + ' won / ' + (record.competitions_placed ?? 0) + ' placed / ' + money(record.prize_usd) + ' earned' : '');
  view.update(profile.solutions || []);
}

async function refresh(version = generation) {
  try {
    const current = view;
    const tasks = [current.type === 'board' ? refreshTotals() : refreshTotals().catch(() => {})];
    if (current.type === 'bounty') tasks.push(
      request('competitions/' + current.slug + '?submissions=summary'),
      request('competitions/' + current.slug + '/leaderboard?rows=first'),
    );
    if (current.type === 'profile') tasks.push(request('profiles/' + current.slug));
    const results = await Promise.all(tasks);
    if (version !== generation) return;
    if (current.type === 'board') renderBoard();
    if (current.type === 'bounty') renderBounty(results[1], results[2]);
    if (current.type === 'profile') renderProfile(results[1]);
    $('#error')?.remove();
    window.__shotReady = true;
  } catch (error) {
    if (version !== generation) return;
    let notice = $('#error');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'error';
      notice.setAttribute('role', 'alert');
      main.prepend(notice);
    }
    notice.innerHTML = escape(error.message) + ' <button>Retry</button>';
    notice.querySelector('button').onclick = () => refresh();
    window.__shotReady = true;
  }
}

function mountBoard() {
  main.innerHTML = '<section class="hero"><div><h1>Make your<br>next <em>move.</em> <span>✳</span></h1><p>Real challenges. Real rewards.</p></div></section><div class="heading"><h2>The bounty board <small>● Live</small></h2></div><div class="toolbar"><div><button id="live-tab">Live</button><button id="all-tab">All bounties</button></div><div><select id="category" aria-label="Category"><option value="">All categories</option>'
    + categories.map(name => '<option>' + name + '</option>').join('')
    + '</select> <select id="sort" aria-label="Sort"><option value="soon">Closing soon</option><option value="pot">Biggest pot</option><option value="entries">Most entries</option></select></div></div><div class="columns"><span id="count">Loading…</span><span>PRIZE POOL</span><span>TIME LEFT</span><span>ENTRIES</span></div>' + listMarkup + '<p id="empty"></p>';
  view = { type: 'board', update: virtualList(108, patchBounty, bounty => bounty.slug) };
  function selectTab() {
    for (const [id, selected] of [['live-tab', !showAll], ['all-tab', showAll]]) {
      const button = $('#' + id);
      button.classList.toggle('selected', selected);
      if (selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }
  for (const [id, all] of [['live-tab', false], ['all-tab', true]]) {
    $('#' + id).onclick = () => {
      showAll = all;
      selectTab();
      renderBoard();
    };
  }
  selectTab();
  $('#category').value = category;
  $('#sort').value = sort;
  $('#category').onchange = event => {
    category = event.target.value;
    $('#list').scrollTop = 0;
    renderBoard();
  };
  $('#sort').onchange = event => {
    sort = event.target.value;
    renderBoard();
  };
  renderBoard();
}

function route() {
  window.__shotReady = false;
  generation++;
  disconnect();
  window.scrollTo(0, 0);
  let parts;
  try {
    parts = (location.hash || '#/').slice(2).split('/').map(decodeURIComponent);
  } catch {
    parts = ['invalid'];
  }
  if (!parts[0]) mountBoard();
  else if (parts[0] === 'bounty' && parts[1]) {
    main.innerHTML = backLink + '<div class="eyebrow" id="meta"></div><h1 id="title">Loading…</h1><p id="summary"></p><div class="detail"><section><h2>The challenge</h2><div id="description"></div></section><aside><div class="eyebrow">LIVE PRIZE POOL</div><div id="pot"></div><p id="timer"></p><p id="facts"></p><p id="dates"></p><h3>Rewards</h3><table id="rewards" aria-label="Rewards"></table></aside></div><h2>Leaderboard ↗</h2><p id="note"></p><div class="leader columns"><span>RANK</span><span>BUILDER / ENTRY</span><span>SCORE</span><span>PRIZE</span></div>' + listMarkup;
    $('#list').className = 'leader';
    view = { type: 'bounty', update: virtualList(76, patchEntry, entry => entry.submission_id) };
  } else if (parts[0] === 'profile' && parts[1]) {
    main.innerHTML = backLink + '<div class="profile-head"><img id="picture" alt="" width="72" height="72"><div><h1 id="title">Loading…</h1><p id="handle"></p></div></div><p id="bio"></p><p id="joined"></p><p id="record"></p><h2>Solutions ↗</h2>' + listMarkup;
    view = { type: 'profile', update: virtualList(90, patchSolution, solution => solution.submission_id) };
  } else {
    main.innerHTML = '<h1>Not found</h1>' + backLink;
    view = null;
    window.__shotReady = true;
    return;
  }
  view.slug = encodeURIComponent(parts[1] || '');
  document.title = 'make.fun — ' + (parts[0] || 'Bounty board');
  refresh();
}

$('input').oninput = event => {
  query = event.target.value.trim().toLowerCase();
  if (view?.type === 'board') {
    $('#list').scrollTop = 0;
    renderBoard();
  } else location.hash = '#/';
};
$('form').onsubmit = event => {
  event.preventDefault();
  location.hash = '#/';
};
addEventListener('hashchange', route);
setInterval(tick, 1000);
setInterval(() => {
  if (!document.hidden && view) refresh();
}, 60000);
route();
