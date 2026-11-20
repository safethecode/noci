const $ = (id) => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
const categoryNames = {
  foundation: 'Basic shapes',
  navigation: 'Navigation',
  actions: 'Actions',
  status: 'Status',
  inclusion: 'Accessibility & text',
  files: 'Files & documents',
  communication: 'Communication',
  editing: 'Editing',
  layout: 'Layout',
  security: 'Security',
  devices: 'Devices & connectivity',
  media: 'Media',
  people: 'People',
  time: 'Time & calendar',
  weather: 'Weather',
  finance: 'Finance',
  commerce: 'Shopping',
  charts: 'Charts',
  development: 'Development',
  maps: 'Maps & wayfinding',
  transport: 'Transport',
  buildings: 'Buildings',
  home: 'Home',
  nature: 'Nature',
  food: 'Food & kitchen',
  tools: 'Tools',
  sports: 'Sports & fitness',
  health: 'Health',
  education: 'Education',
  science: 'Science',
  electronics: 'Electronics',
  instruments: 'Musical instruments',
  animals: 'Animals',
  clothing: 'Clothing',
  'personal-care': 'Personal care',
  craft: 'Crafts & sewing',
  games: 'Games',
};
const koreanCategories = {
  foundation: '기본 기호',
  navigation: '탐색',
  actions: '동작',
  status: '상태',
  inclusion: '접근성 텍스트',
  files: '파일 문서',
  communication: '메시지 알림',
  editing: '편집',
  layout: '배치',
  security: '보안',
  devices: '기기 연결',
  media: '미디어',
  people: '사용자 사람',
  time: '날짜 시간',
  weather: '날씨',
  finance: '금액 결제',
  commerce: '쇼핑',
  charts: '차트',
  development: '개발 설정',
  maps: '지도 길찾기',
  transport: '교통',
  buildings: '건물',
  home: '생활용품',
  nature: '자연 정원',
  food: '음식 식기',
  tools: '공구',
  sports: '스포츠 운동',
  health: '건강 위생',
  education: '교육',
  science: '과학 관측',
  electronics: '전자회로',
  instruments: '악기',
  animals: '동물',
  clothing: '의류',
  'personal-care': '개인 관리',
  craft: '봉제 공예',
  games: '게임 놀이',
};
const acronyms = {
  cpu: 'CPU',
  cctv: 'CCTV',
  dna: 'DNA',
  ev: 'EV',
  id: 'ID',
  iv: 'IV',
  led: 'LED',
  usb: 'USB',
  qr: 'QR',
  rss: 'RSS',
  hdmi: 'HDMI',
  nfc: 'NFC',
  sim: 'SIM',
  sd: 'SD',
  wifi: 'Wi-Fi',
};
const state = {
  icons: [],
  matches: [],
  category: '',
  view: 'grid',
  size: 24,
  page: 1,
  version: '',
  etag: '',
  selected: null,
  loading: false,
};
const spriteCache = new Map();
let toastTimer;
let detailTrigger;
let exportRequest = 0;
let searchFrame;

function labelFor(icon) {
  return icon.name
    .split('-')
    .map(
      (word, index) =>
        acronyms[word] ?? (index ? word : word.charAt(0).toUpperCase() + word.slice(1)),
    )
    .join(' ');
}

function glyph(name, size, sourceSize = size === 16 ? 16 : size === 48 ? 48 : 24) {
  const symbol = spriteCache.get(sourceSize)?.getElementById(`noci-${name}-${sourceSize}`);
  if (!symbol) {
    throw new Error(`The ${sourceSize}px icon is unavailable.`);
  }
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  for (const attribute of symbol.attributes) {
    if (attribute.name !== 'id') {
      svg.setAttribute(attribute.name, attribute.value);
    }
  }
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const child of symbol.childNodes) {
    svg.append(document.importNode(child, true));
  }
  return svg;
}

function artboard(name, size, sourceSize) {
  const board = document.createElement('span');
  board.className = 'artboard';
  board.style.setProperty('--size', `${size}px`);
  board.style.setProperty('--inset', `${size === 16 ? 2 : size / 8}px`);
  board.append(glyph(name, size, sourceSize));
  return board;
}

function uiIcon(name) {
  const svg = glyph(name, 16, 16);
  svg.classList.add('ui-icon');
  return svg;
}

function updateUIIcons() {
  for (const node of document.querySelectorAll('[data-icon]')) {
    node.replaceChildren(uiIcon(node.dataset.icon));
  }
}

function categoryButton(category, count) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'category-button';
  button.dataset.category = category;
  button.setAttribute('aria-pressed', String(state.category === category));
  const label = document.createElement('span');
  label.textContent = category ? (categoryNames[category] ?? category) : 'All categories';
  const total = document.createElement('span');
  total.className = 'category-count';
  total.textContent = count.toLocaleString('en-US');
  button.append(label, total);
  return button;
}

function renderCategories() {
  const counts = new Map();
  for (const icon of state.icons) {
    counts.set(icon.category, (counts.get(icon.category) ?? 0) + 1);
  }
  const categories = [...counts.keys()].sort((a, b) =>
    (categoryNames[a] ?? a).localeCompare(categoryNames[b] ?? b, 'en'),
  );
  for (const container of [$('categories'), $('mobile-categories')]) {
    const fragment = document.createDocumentFragment();
    fragment.append(categoryButton('', state.icons.length));
    for (const category of categories) {
      fragment.append(categoryButton(category, counts.get(category)));
    }
    container.replaceChildren(fragment);
  }
  $('category-count').textContent = String(categories.length);
}

function syncCategorySelection() {
  for (const button of document.querySelectorAll('[data-category]')) {
    button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
  }
  $('active-filters').hidden = !state.category;
  $('category-chip').firstElementChild.textContent =
    categoryNames[state.category] ?? state.category;
}

function actionButton(icon, action, label) {
  const button = document.createElement('button');
  button.className = 'icon-text';
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', `${label} ${icon.name} SVG`);
  button.title = `${label} SVG`;
  button.append(uiIcon(action === 'copy' ? 'copy' : 'download'));
  const text = document.createElement('span');
  text.className = 'control-label';
  text.textContent = action === 'copy' ? 'Copy' : 'SVG';
  button.append(text);
  return button;
}

function tileFor(icon) {
  const tile = document.createElement('li');
  tile.className = 'tile';
  tile.dataset.name = icon.name;
  const open = document.createElement('button');
  open.className = 'tile-open';
  open.type = 'button';
  open.dataset.action = 'preview';
  open.setAttribute('aria-label', `Preview ${icon.name}`);
  open.setAttribute('aria-haspopup', 'dialog');
  const info = document.createElement('span');
  info.className = 'icon-info';
  const label = document.createElement('span');
  label.className = 'sample-label';
  label.textContent = $('sample').value.trim() ? $('sample').value : labelFor(icon);
  const name = document.createElement('span');
  name.className = 'icon-name';
  name.textContent = icon.name;
  info.append(label);
  if (state.view !== 'text') {
    info.append(name);
  }
  open.append(artboard(icon.name, state.size), info);
  const metadata = document.createElement('span');
  metadata.className = 'tile-meta';
  const metadataName = document.createElement('span');
  metadataName.className = 'meta-name';
  metadataName.textContent = icon.name;
  metadataName.title = icon.name;
  metadata.append(metadataName);
  const actions = document.createElement('span');
  actions.className = 'tile-actions';
  actions.append(actionButton(icon, 'download', 'Download'), actionButton(icon, 'copy', 'Copy'));
  tile.append(open, metadata, actions);
  return tile;
}

function render() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  state.matches = state.icons.filter(
    (icon) =>
      (!state.category || icon.category === state.category) &&
      terms.every((term) => icon.searchText.includes(term)),
  );
  const perPage = Number($('per-page').value);
  const pages = Math.max(1, Math.ceil(state.matches.length / perPage));
  state.page = Math.min(Math.max(1, state.page), pages);
  const start = (state.page - 1) * perPage;
  const visible = state.matches.slice(start, start + perPage);
  const fragment = document.createDocumentFragment();
  for (const icon of visible) {
    fragment.append(tileFor(icon));
  }
  $('catalogue').replaceChildren(fragment);
  $('catalogue').classList.toggle('with-text', state.view === 'text');
  $('catalogue').style.setProperty('--preview-size', `${state.size}px`);
  $('grid-view').setAttribute('aria-pressed', String(state.view === 'grid'));
  $('text-view').setAttribute('aria-pressed', String(state.view === 'text'));
  $('text-controls').hidden = state.view !== 'text';
  $('clear-search').hidden = !$('search').value;
  $('search-key').hidden = Boolean($('search').value);
  $('summary').textContent =
    `${state.matches.length.toLocaleString('en-US')} ${state.matches.length === 1 ? 'icon' : 'icons'}${state.category || query ? ' found' : ''}`;
  $('empty').hidden = state.matches.length > 0;
  $('empty-title').textContent = 'No icons found';
  $('empty-description').textContent = 'Try another name or choose a different category.';
  $('empty-reset').textContent = 'Clear filters';
  $('pagination').hidden = state.matches.length === 0;
  $('page-range').textContent =
    `${start + 1}–${start + visible.length} of ${state.matches.length.toLocaleString('en-US')}`;
  $('page-position').textContent = `${state.page} / ${pages}`;
  $('first-page').disabled = state.page === 1;
  $('previous-page').disabled = state.page === 1;
  $('next-page').disabled = state.page === pages;
  $('last-page').disabled = state.page === pages;
  syncCategorySelection();
}

function resetFilters() {
  state.category = '';
  state.page = 1;
  $('search').value = '';
  render();
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  toastTimer = setTimeout(() => {
    $('toast').textContent = '';
  }, 3500);
}

async function standaloneSVG(icon, size) {
  const sourceSize = size === 32 ? 24 : size;
  const symbol = spriteCache.get(sourceSize)?.getElementById(`noci-${icon.name}-${sourceSize}`);
  if (!symbol) {
    throw new Error('This icon is unavailable. Please try again.');
  }
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  for (const attribute of symbol.attributes) {
    if (attribute.name !== 'id') {
      svg.setAttribute(attribute.name, attribute.value);
    }
  }
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const child of symbol.childNodes) {
    svg.append(document.importNode(child, true));
  }
  return new XMLSerializer().serializeToString(svg);
}

async function copyIcon(icon, button) {
  const size = state.size;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const svg = await standaloneSVG(icon, size);
    await navigator.clipboard.writeText(svg);
    notify(`Copied ${icon.name} · ${size}px`);
  } catch {
    showDetail(icon, button);
    $('source-disclosure').open = true;
    $('detail-status').hidden = false;
    $('detail-status').textContent =
      'Copy was unavailable. Select the SVG source to copy it, or download the file.';
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

async function downloadIcon(icon, button) {
  const size = state.size;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const svg = await standaloneSVG(icon, size);
    const url = URL.createObjectURL(new Blob([`${svg}\n`], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `noci-${icon.name}-${size}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Downloaded ${icon.name} · ${size}px`);
  } catch {
    notify('The SVG could not be downloaded. Please try again.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function showDetail(icon, trigger) {
  state.selected = icon;
  if (!$('detail').open) {
    detailTrigger = trigger;
  }
  $('detail-name').textContent = icon.name;
  $('detail-category').textContent = categoryNames[icon.category] ?? icon.category;
  $('detail-description').textContent = icon.description;
  $('detail-hero').replaceChildren(artboard(icon.name, 96, 48));
  const samples = document.createDocumentFragment();
  for (const size of [16, 24, 32, 48]) {
    const cell = document.createElement('div');
    cell.className = 'size-sample';
    const stage = document.createElement('div');
    stage.append(artboard(icon.name, size));
    const label = document.createElement('p');
    label.textContent = `${size}px`;
    cell.append(stage, label);
    samples.append(cell);
  }
  $('detail-sizes').replaceChildren(samples);
  const pairText = document.createElement('span');
  pairText.textContent = $('sample').value.trim() ? $('sample').value : labelFor(icon);
  $('detail-pair').style.setProperty('--preview-size', `${state.size}px`);
  $('detail-pair').replaceChildren(artboard(icon.name, state.size), pairText);
  $('detail-tags').replaceChildren(
    ...icon.tags.map((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-button';
      button.dataset.tag = tag;
      button.setAttribute('aria-label', `Search for ${tag}`);
      button.textContent = tag;
      return button;
    }),
  );
  $('export-size').textContent = `${state.size} × ${state.size}px · SVG`;
  $('svg-source').textContent = 'Loading SVG…';
  $('detail-status').hidden = true;
  $('source-disclosure').open = false;
  const request = ++exportRequest;
  standaloneSVG(icon, state.size)
    .then((svg) => {
      if (request === exportRequest) {
        $('svg-source').textContent = svg;
      }
    })
    .catch(() => {
      if (request === exportRequest) {
        $('svg-source').textContent = 'Could not load the SVG. Close this preview and try again.';
      }
    });
  if (!$('detail').open) {
    $('detail').showModal();
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('light-theme').setAttribute('aria-pressed', String(theme === 'light'));
  $('dark-theme').setAttribute('aria-pressed', String(theme === 'dark'));
}

function changePage(page) {
  state.page = page;
  render();
  $('explorer').scrollIntoView({ block: 'start' });
  $('results').focus({ preventScroll: true });
}

async function refresh() {
  if (state.loading) {
    return;
  }
  state.loading = true;
  try {
    const response = await fetch('./metadata.json', {
      cache: 'no-store',
      headers: state.etag ? { 'If-None-Match': state.etag } : {},
    });
    if (response.status === 304) {
      return;
    }
    if (!response.ok) {
      throw new Error('Could not load the collection.');
    }
    const liveVersion = response.headers.get('x-noci-version');
    if (liveVersion && liveVersion === state.version) {
      return;
    }
    const metadata = await response.json();
    if (!Array.isArray(metadata.icons) || !metadata.icons.length) {
      throw new Error('The collection is empty.');
    }
    const version =
      liveVersion ?? metadata.buildVersion ?? response.headers.get('etag') ?? 'static';
    const sprites = await Promise.all(
      [16, 24, 48].map(async (size) => {
        const asset = await fetch(`./sprite/${size}.svg?v=${encodeURIComponent(version)}`, {
          cache: 'no-store',
        });
        if (!asset.ok || (liveVersion && asset.headers.get('x-noci-version') !== liveVersion)) {
          throw new Error('The icon collection is updating.');
        }
        const doc = new DOMParser().parseFromString(await asset.text(), 'image/svg+xml');
        if (
          doc.querySelector('parsererror') ||
          !doc.getElementById(`noci-${metadata.icons[0].name}-${size}`)
        ) {
          throw new Error('Could not read the icons.');
        }
        return [size, doc];
      }),
    );
    spriteCache.clear();
    for (const [size, doc] of sprites) {
      spriteCache.set(size, doc);
    }
    state.icons = metadata.icons.map((icon) => ({
      ...icon,
      searchText: [
        icon.name,
        icon.name.replaceAll('-', ' '),
        icon.category,
        categoryNames[icon.category],
        koreanCategories[icon.category],
        icon.description,
        icon.useCase,
        ...icon.tags,
      ]
        .join(' ')
        .toLocaleLowerCase(),
    }));
    state.version = version;
    state.etag = response.headers.get('etag') ?? '';
    if (!liveVersion) {
      clearInterval(refreshTimer);
    }
    const count = state.icons.length.toLocaleString('en-US');
    $('intro-count').textContent = count;
    $('total-count').textContent = count;
    renderCategories();
    updateUIIcons();
    render();
    if (state.selected && $('detail').open) {
      const selected = state.icons.find((icon) => icon.name === state.selected.name);
      if (selected) {
        showDetail(selected, detailTrigger);
      } else {
        $('detail').close();
      }
    }
  } catch {
    if (!state.icons.length) {
      $('summary').textContent = 'Icons could not be loaded.';
      $('empty').hidden = false;
      $('empty-title').textContent = 'Could not load the icons';
      $('empty-description').textContent = 'Check your connection and try again.';
      $('empty-reset').textContent = 'Try again';
    }
  } finally {
    state.loading = false;
  }
}

$('search').addEventListener('input', () => {
  cancelAnimationFrame(searchFrame);
  searchFrame = requestAnimationFrame(() => {
    state.page = 1;
    render();
  });
});
$('clear-search').addEventListener('click', () => {
  $('search').value = '';
  state.page = 1;
  render();
  $('search').focus();
});
for (const id of ['reset-sidebar', 'clear-all']) {
  $(id).addEventListener('click', resetFilters);
}
$('category-chip').addEventListener('click', () => {
  state.category = '';
  state.page = 1;
  render();
  $('search').focus();
});
$('empty-reset').addEventListener('click', () => {
  if (state.icons.length) {
    resetFilters();
  } else {
    refresh();
  }
});
for (const container of [$('categories'), $('mobile-categories')]) {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) {
      return;
    }
    state.category = button.dataset.category;
    state.page = 1;
    render();
  });
}
for (const view of ['grid', 'text']) {
  $(`${view}-view`).addEventListener('click', () => {
    state.view = view;
    render();
  });
}
for (const button of document.querySelectorAll('[data-size]')) {
  button.addEventListener('click', () => {
    state.size = Number(button.dataset.size);
    for (const option of document.querySelectorAll('[data-size]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    render();
  });
}
$('guides').addEventListener('change', () =>
  document.body.classList.toggle('guides', $('guides').checked),
);
$('sample').addEventListener('input', render);
$('per-page').addEventListener('change', () => {
  state.page = 1;
  render();
});
$('first-page').addEventListener('click', () => changePage(1));
$('previous-page').addEventListener('click', () => changePage(state.page - 1));
$('next-page').addEventListener('click', () => changePage(state.page + 1));
$('last-page').addEventListener('click', () =>
  changePage(Math.ceil(state.matches.length / Number($('per-page').value))),
);
$('light-theme').addEventListener('click', () => setTheme('light'));
$('dark-theme').addEventListener('click', () => setTheme('dark'));
$('catalogue').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const tile = button?.closest('[data-name]');
  if (!tile) {
    return;
  }
  const icon = state.icons.find((entry) => entry.name === tile.dataset.name);
  if (!icon) {
    return;
  }
  if (button.dataset.action === 'copy') {
    copyIcon(icon, button);
  } else if (button.dataset.action === 'download') {
    downloadIcon(icon, button);
  } else {
    showDetail(icon, button);
  }
});
$('close-detail').addEventListener('click', () => $('detail').close());
$('detail').addEventListener('close', () => {
  state.selected = null;
  exportRequest++;
  if (detailTrigger?.isConnected) {
    detailTrigger.focus({ preventScroll: true });
  }
});
$('detail').addEventListener('click', (event) => {
  if (event.target === $('detail')) {
    const bounds = $('detail').getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      $('detail').close();
    }
  }
});
$('detail-copy').addEventListener('click', () => {
  if (state.selected) {
    copyIcon(state.selected, $('detail-copy'));
  }
});
$('detail-download').addEventListener('click', () => {
  if (state.selected) {
    downloadIcon(state.selected, $('detail-download'));
  }
});
$('detail-tags').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tag]');
  if (!button) {
    return;
  }
  $('search').value = button.dataset.tag;
  state.category = '';
  state.page = 1;
  $('detail').close();
  render();
  $('search').focus();
});
$('open-filters').addEventListener('click', () => $('filter-dialog').showModal());
for (const id of ['close-filters', 'show-results']) {
  $(id).addEventListener('click', () => $('filter-dialog').close());
}
$('filter-dialog').addEventListener('click', (event) => {
  if (
    event.target === $('filter-dialog') &&
    event.clientX > $('filter-dialog').getBoundingClientRect().right
  ) {
    $('filter-dialog').close();
  }
});
const desktopQuery = matchMedia('(min-width: 1024px)');
desktopQuery.addEventListener('change', () => {
  if (desktopQuery.matches && $('filter-dialog').open) {
    $('filter-dialog').close();
  }
});
document.addEventListener('keydown', (event) => {
  const editing = event.target.closest('input, textarea, select, [contenteditable=true]');
  if (
    event.key === '/' &&
    !editing &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !document.querySelector('dialog[open]')
  ) {
    event.preventDefault();
    $('search').focus();
  }
  if (event.key === 'Escape' && event.target === $('search') && $('search').value) {
    event.preventDefault();
    $('search').value = '';
    state.page = 1;
    render();
  }
});
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty(
    '--tools-height',
    `${entry.target.getBoundingClientRect().height}px`,
  );
}).observe(document.querySelector('.toolbelt'));
const refreshTimer = setInterval(refresh, 10000);
refresh();
