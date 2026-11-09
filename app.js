'use strict';
/* ============================================================
   Diseñoteca · powered by Glob.AI
   ------------------------------------------------------------
   Todo funciona en el navegador (localStorage + IndexedDB).
   Para conectar una IA real, escribe la URL de tu backend en
   CONFIG.AI_ENDPOINT (ver aiRequest() más abajo).
   ============================================================ */

const CONFIG = {
  AI_ENDPOINT: '',   // p. ej. 'https://tu-servidor.com/api/ai'  (vacío = respuestas simuladas locales)
  MAX_MB: 2048,      // 2 GB por archivo (el límite real lo marca el espacio libre del navegador)
};
const fmtLimit = mb => mb >= 1024 ? (mb / 1024) + ' GB' : mb + ' MB';
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduceMotion() ? 0 : ms));

/* ---------- Utilidades ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtDate = ts => new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const dayKey = d => { d = new Date(d); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : fmtDate(ts);
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* ---------- Iconos (SVG inline) ---------- */
const ICONS = {
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  paperclip: '<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wand: '<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  heart: '<path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  upload: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
function hydrateIcons(root = document) {
  $$('i[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); el.classList.add('ic'); });
}

/* ---------- Estado persistente ---------- */
const KEY = 'disenoteca.v1';
const defaults = () => ({ user: null, resources: [], favorites: [], activity: [], drive: false, avatar: null, chat: [] });
function loadState() {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return defaults(); }
}
let state = loadState();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('No se pudo guardar: el almacenamiento del navegador está lleno.'); }
}
function logActivity(type, text) {
  state.activity.unshift({ id: uid(), type, text, ts: Date.now() });
  state.activity = state.activity.slice(0, 2000);
}

/* ---------- IndexedDB (guarda los archivos reales) ---------- */
const idb = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('disenoteca', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('files', mode);
      const req = fn(t.objectStore('files'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: (k, v) => tx('readwrite', s => s.put(v, k)),
    get: k => tx('readonly', s => s.get(k)),
    del: k => tx('readwrite', s => s.delete(k)),
    clear: () => tx('readwrite', s => s.clear()),
  };
})();

/* ---------- Catálogo ---------- */
const CATEGORIES = ['Presentaciones', 'Brandbooks', 'Plantillas', 'Piezas gráficas', 'Imágenes', 'Emails', 'Proyectos'];
const CAT_GRAD = {
  'Presentaciones': 'linear-gradient(135deg,#4c7bf4,#8f6af5)',
  'Brandbooks': 'linear-gradient(135deg,#8f6af5,#1fb0b8)',
  'Plantillas': 'linear-gradient(135deg,#4c7bf4,#1fb0b8)',
  'Piezas gráficas': 'linear-gradient(135deg,#1fb0b8,#5cc94a)',
  'Imágenes': 'linear-gradient(135deg,#8f6af5,#4c7bf4)',
  'Emails': 'linear-gradient(135deg,#4c7bf4,#5cc94a)',
  'Proyectos': 'linear-gradient(135deg,#0b0b0f,#4c7bf4)',
};
const PALETTES = [
  { name: 'Glob.AI', c: ['#4c7bf4', '#8f6af5', '#1fb0b8'], ink: '#ffffff' },
  { name: 'Medianoche', c: ['#0b0b0f', '#1d2a6b', '#4c7bf4'], ink: '#ffffff' },
  { name: 'Lima', c: ['#1fb0b8', '#5cc94a', '#e9fbd9'], ink: '#0b0b0f' },
  { name: 'Claro', c: ['#ffffff', '#e4ecff', '#d6f4ee'], ink: '#0b0b0f' },
];
const FORMATS = {
  post:   { label: 'Post cuadrado · 1080 × 1080', w: 1080, h: 1080, tip: 'Composición centrada, titular en máximo 4 líneas y logotipo discreto en la esquina inferior.' },
  slack:  { label: 'Slack · 1200 × 628',          w: 1200, h: 628,  tip: 'Titular a la izquierda y respiro a la derecha; se lee bien en miniatura dentro de un hilo.' },
  deck:   { label: 'Presentación · 16:9',          w: 1920, h: 1080, tip: 'Portada con titular grande, subtítulo corto y mucho espacio vacío para dar jerarquía.' },
  banner: { label: 'Banner · 970 × 250',           w: 970,  h: 250,  tip: 'Una sola idea: titular corto y un llamado a la acción visible; evita textos secundarios.' },
  email:  { label: 'Email · 600 px',               w: 600,  h: 760,  tip: 'Cabecera con degradado, titular claro y un botón de acción. Ancho máximo de 600 px.' },
};

/* ---------- Vista actual ---------- */
const view = { name: 'library', query: '', cat: 'Todas', sort: 'recent', attach: null, aiNote: null, range: 365,
               format: 'post', refs: new Set(), paletteIdx: 0, gen: null, sig: '' };

/* ============================================================
   BÚSQUEDA "INTELIGENTE" (local)
   ============================================================ */
const CAT_HINTS = [
  [/presentaci|slide|deck|diapositiv|pitch|ppt/, 'Presentaciones'],
  [/brand|marca|logo|identidad|manual/, 'Brandbooks'],
  [/plantilla|template|mockup|figma/, 'Plantillas'],
  [/pieza|post|banner|afiche|poster|flyer|grafic|red(es)? social/, 'Piezas gráficas'],
  [/imagen|foto|ilustracion|icono|png|jpg|jpeg|svg/, 'Imágenes'],
  [/email|correo|newsletter|mailing|boletin/, 'Emails'],
  [/proyecto|campana|rebrand/, 'Proyectos'],
];
const STOP = new Set(('busca buscar buscame encuentra encontrar necesito quiero algo para con los las del una uno que por sobre mas muestrame muestra dame tienes tiene hay recursos recurso archivos archivo ' +
  'como cual cuales donde esta este esto esos esas unos unas desde entre pero porque tambien muy ver').split(' '));
const stem = t => t.length > 4 ? t.replace(/(es|s)$/, '') : t;

function smartSearch(q, attach) {
  const raw = norm(q + ' ' + (attach ? attach.name.replace(/\.[^.]+$/, '') : ''));
  const cats = new Set();
  CAT_HINTS.forEach(([re, c]) => { if (re.test(raw)) cats.add(c); });
  if (attach) {
    if (attach.type.startsWith('image/')) cats.add('Imágenes');
    if (/presentation|powerpoint/.test(attach.type)) cats.add('Presentaciones');
  }
  const tokens = [...new Set(raw.split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)))];
  const results = state.resources.map(r => {
    const title = norm(r.title);
    const hay = norm([r.desc, r.brand, (r.tags || []).join(' '), r.category, r.name].join(' '));
    let score = 0;
    tokens.forEach(t => { const s = stem(t); if (title.includes(s)) score += 3; else if (hay.includes(s)) score += 2; });
    if (cats.has(r.category)) score += 3;
    return { r, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || b.r.date - a.r.date);
  return { results, tokens, cats: [...cats] };
}

/* ============================================================
   IA: puntos de conexión (simulados por defecto)
   ============================================================ */
async function aiRequest(kind, payload) {
  if (!CONFIG.AI_ENDPOINT) return null;                 // sin backend -> se usan respuestas locales
  const res = await fetch(CONFIG.AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, ...payload }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();                                     // chat -> { reply }   |   generate -> { headline, sub, concept, copy, cta }
}
const libraryContext = () => ({
  total: state.resources.length,
  resources: state.resources.slice(0, 60).map(r => ({ title: r.title, category: r.category, brand: r.brand, tags: r.tags, desc: r.desc })),
});

/* ============================================================
   NAVEGACIÓN / RENDER
   ============================================================ */
let navTimer;
function go(name) {
  view.name = name;
  $$('.view').forEach(s => s.hidden = s.id !== 'view-' + name);
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  $('#app').classList.remove('nav-open');
  $('#profileMenu').hidden = true;
  // las tarjetas entran escalonadas solo al navegar (no al marcar favoritos, etc.)
  document.body.classList.add('navigating');
  clearTimeout(navTimer);
  navTimer = setTimeout(() => document.body.classList.remove('navigating'), 900);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function render() {
  renderProfile();
  ({ library: renderLibrary, create: renderCreate, files: renderFiles, favorites: renderFavorites, activity: renderActivity })[view.name]();
}

/* ---------- Tarjetas ---------- */
const extOf = r => ((r.name || '').split('.').pop() || 'FILE').slice(0, 5).toUpperCase();
function cardHTML(r, i = 0) {
  const fav = state.favorites.includes(r.id);
  return `<article class="card" data-id="${r.id}" style="--i:${Math.min(i, 12)}">
    <div class="thumb${r.ai ? ' ai' : ''}${r.tk === 'doc' ? ' doc' : ''}" data-act="open" title="Abrir vista previa">${thumbMedia(r)}
      <button class="fav ${fav ? 'on' : ''}" data-act="fav" aria-label="${fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${icon('heart')}</button>
    </div>
    <div class="body">
      <div class="tags"><span class="tag cat">${esc(r.category)}</span>${r.ai ? '<span class="tag ai-tag">✦ Creado con IA</span>' : ''}</div>
      <h4 data-act="open" title="Abrir vista previa">${esc(r.title)}</h4>
      ${r.desc ? `<p>${esc(r.desc)}</p>` : ''}
      <div class="meta">${r.brand ? esc(r.brand) + ' · ' : ''}${fmtDate(r.date)}</div>
      ${r.tags && r.tags.length ? `<div class="tags">${r.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="actions">
        <button data-act="open">${icon('eye')}Ver</button>
        <button data-act="download">${icon('download')}Descargar</button>
        <button data-act="delete" class="danger" aria-label="Eliminar recurso" title="Eliminar">${icon('trash')}</button>
      </div>
    </div>
  </article>`;
}
const emptyLibraryHTML = `<div class="empty"><span class="orb">${icon('library')}</span><h4>Tu biblioteca está vacía</h4>
  <p>Sube tu primer recurso o carga algunos ejemplos para probar la búsqueda con IA.</p>
  <div class="row"><button class="btn primary" data-action="upload">Subir un recurso</button><button class="btn ghost" data-action="samples">Cargar recursos de ejemplo</button></div></div>`;

/* ---------- Biblioteca ---------- */
function sortList(list) {
  return view.sort === 'az' ? list.sort((a, b) => a.title.localeCompare(b.title, 'es')) : list.sort((a, b) => b.date - a.date);
}
function filteredLibrary() {
  let list = [...state.resources];
  if (view.cat !== 'Todas') list = list.filter(r => r.category === view.cat);
  if (view.query.trim() || view.attach) {
    const s = smartSearch(view.query, view.attach);
    const score = new Map(s.results.map(x => [x.r.id, x.score]));
    list = list.filter(r => score.has(r.id)).sort((a, b) => score.get(b.id) - score.get(a.id));
  } else sortList(list);
  return list;
}
function renderLibrary() {
  const total = state.resources.length;
  $('#statStatus').textContent = 'Biblioteca lista';
  $('#statSub').textContent = total ? 'Todo sincronizado' : 'Esperando recursos';
  $('#statCount').textContent = `${total} ${total === 1 ? 'recurso' : 'recursos'}`;
  $('#sortSelect').value = view.sort;

  $('#catChips').innerHTML = ['Todas', ...CATEGORIES].map(c => {
    const n = c === 'Todas' ? total : state.resources.filter(r => r.category === c).length;
    return `<button class="chip ${view.cat === c ? 'on' : ''}" data-cat="${c}">${c}<small>${n}</small></button>`;
  }).join('');

  const note = $('#aiNote');
  note.hidden = !view.aiNote;
  if (view.aiNote) note.innerHTML = view.aiNote;

  const list = filteredLibrary();
  const grid = $('#libGrid');
  if (!total) grid.innerHTML = emptyLibraryHTML;
  else if (!list.length) {
    grid.innerHTML = `<div class="empty"><h4>Sin resultados</h4><p>No encontré nada${view.query ? ` para «${esc(view.query)}»` : ''}. Puedo ayudarte a buscarlo de otra forma.</p>
      <div class="row"><button class="btn primary" data-action="ask-query">Preguntar a la IA →</button><button class="btn ghost" id="clearFilters2" data-action="clear">Limpiar filtros</button></div></div>`;
  } else grid.innerHTML = list.map(cardHTML).join('');

  // transición suave solo cuando cambia el filtro / búsqueda / orden
  const sig = [view.cat, view.query, view.sort, !!view.attach, total].join('|');
  if (sig !== view.sig) {
    view.sig = sig;
    grid.classList.remove('swap'); void grid.offsetWidth; grid.classList.add('swap');
  }
}
function clearFilters() {
  view.query = ''; view.cat = 'Todas'; view.attach = null; view.aiNote = null;
  $('#searchInput').value = ''; $('#searchAttach').value = '';
  updateAttachChip(); render();
}

/* ---------- Mis archivos / Favoritos ---------- */
function renderFiles() {
  const list = sortList([...state.resources]);
  $('#filesGrid').innerHTML = list.length ? list.map(cardHTML).join('') : emptyLibraryHTML;
}
function renderFavorites() {
  const list = state.resources.filter(r => state.favorites.includes(r.id));
  $('#favGrid').innerHTML = list.length ? list.map(cardHTML).join('')
    : `<div class="empty"><span class="orb">${icon('heart')}</span><h4>Aún no tienes favoritos</h4><p>Toca el corazón en cualquier recurso para guardarlo aquí.</p><div class="row"><button class="btn primary" data-nav="library">Ir a la biblioteca</button></div></div>`;
}

/* ---------- Perfil ---------- */
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'U';
const firstName = () => (state.user?.name || '').split(' ')[0];
function renderProfile() {
  if (!state.user) return;
  $('#userName').textContent = state.user.name;
  $('#userRole').textContent = state.user.role || 'Equipo de diseño';
  const av = $('#avatarSide');
  if (state.avatar) { av.style.backgroundImage = `url(${state.avatar})`; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = initials(state.user.name); }
  $('#driveState').textContent = state.drive ? 'Conectado' : 'No conectado';
}

/* ============================================================
   CREAR CON IA
   ============================================================ */
function renderCreate() {
  $$('#formatPills .chip').forEach(c => c.classList.toggle('on', c.dataset.format === view.format));
  const grid = $('#refGrid');
  if (!state.resources.length) {
    grid.innerHTML = '<div class="ref-empty">Aún no hay recursos para usar como referencia. Sube alguno o carga los ejemplos desde la biblioteca.</div>';
    return;
  }
  grid.innerHTML = state.resources.map(r => `<button class="ref ${view.refs.has(r.id) ? 'on' : ''}" data-ref="${r.id}" title="${esc(r.title)}">
    <div class="t">${thumbSrc(r) ? `<img src="${thumbSrc(r)}" alt="">` : `<div style="height:100%;background:${CAT_GRAD[r.category] || CAT_GRAD.Proyectos}"></div>`}</div>
    <span>${esc(r.title)}</span></button>`).join('');
}

function wrapText(text, max, maxLines) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = trunc(lines[maxLines - 1] + '…', max); }
  return lines;
}
function buildSVG({ w, h, headline, sub, pal, tag = 'Diseñoteca · Glob.AI' }) {
  const [c1, c2, c3] = pal.c, ink = pal.ink;
  const base = Math.min(w, h * 1.6), size = Math.round(base * 0.07);
  const maxChars = Math.max(8, Math.floor((w * 0.82) / (size * 0.55)));
  const lines = wrapText(headline, maxChars, 4);
  const lh = size * 1.12, blockH = lines.length * lh;
  const x = Math.round(w * 0.09);
  const y = Math.round((h - blockH) / 2 + size * 0.8);
  const tspans = lines.map((l, i) => `<tspan x="${x}" y="${Math.round(y + i * lh)}">${esc(l)}</tspan>`).join('');
  const subSize = Math.max(11, Math.round(size * 0.32));
  const subY = Math.round(y + (lines.length - 1) * lh + size * 0.95);
  const showSub = sub && subY < h * 0.84;
  const tagSize = Math.max(10, Math.round(base * 0.022));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(base * 0.07)}"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g filter="url(#b)" opacity=".85"><circle cx="${Math.round(w * 0.85)}" cy="${Math.round(h * 0.15)}" r="${Math.round(base * 0.28)}" fill="#ffffff" opacity=".55"/><circle cx="${Math.round(w * 0.12)}" cy="${Math.round(h * 0.98)}" r="${Math.round(base * 0.3)}" fill="${c3}"/></g>
<text font-family="Heebo,Arial,sans-serif" font-weight="700" font-size="${size}" fill="${ink}">${tspans}</text>
${showSub ? `<text x="${x}" y="${subY}" font-family="Heebo,Arial,sans-serif" font-size="${subSize}" fill="${ink}" opacity=".8">${esc(trunc(sub, Math.floor(maxChars * 1.7)))}</text>` : ''}
<text x="${x}" y="${Math.round(h * 0.93)}" font-family="Heebo,Arial,sans-serif" font-weight="600" font-size="${tagSize}" fill="${ink}" opacity=".65">${esc(tag)}</text>
</svg>`;
}
const svgDataUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
function svgToPng(svg, w, h) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png');
    };
    img.onerror = rej; img.src = url;
  });
}

function localProposal(prompt, refs) {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  const quoted = clean.match(/[«"“]([^»"”]{4,80})[»"”]/);
  const firstSentence = clean.split(/[.!?\n]/)[0];
  const headline = cap(trunc(quoted ? quoted[1] : firstSentence, 64));
  const refNames = refs.map(r => r.title);
  const tags = [...new Set(refs.flatMap(r => r.tags || []))].slice(0, 5);
  return {
    headline,
    sub: refs.length ? `Inspirado en ${refs.length} ${refs.length === 1 ? 'recurso' : 'recursos'} del equipo` : 'Propuesta creada con Glob.AI',
    concept: `Una pieza limpia y luminosa que reutiliza el lenguaje visual del equipo: degradados suaves en la paleta Glob.AI, titular de alto contraste y un único mensaje principal.`,
    copy: `Cuerpo sugerido: ${trunc(clean, 140)}`,
    cta: 'Descúbrelo en Diseñoteca →',
    refs: refNames, tags,
  };
}

async function generateProposal() {
  const prompt = $('#genPrompt').value.trim();
  if (prompt.length < 8) { toast('Cuéntame un poco más de lo que quieres crear.'); $('#genPrompt').focus(); return; }
  const fmt = FORMATS[view.format];
  const refs = state.resources.filter(r => view.refs.has(r.id));
  const box = $('#genResult');
  box.innerHTML = '<div class="loading"><span class="orb">' + icon('sparkle') + '</span><p class="muted" style="margin-top:14px">Glob.AI está creando tu propuesta…</p></div>';
  $('#genBtn').disabled = true;
  let p = localProposal(prompt, refs);
  try {
    const remote = await aiRequest('generate', { prompt, format: view.format, references: refs.map(r => ({ title: r.title, category: r.category, tags: r.tags })) });
    if (remote) p = { ...p, ...remote };
    else await new Promise(r => setTimeout(r, 900));
  } catch (e) { toast('No pude contactar al servicio de IA; usé una propuesta local.'); }
  $('#genBtn').disabled = false;
  view.gen = { p, fmt, key: view.format };
  logActivity('ai', `Generaste una propuesta: «${trunc(p.headline, 40)}»`);
  save();
  paintProposal();
}
function syncGenResource(svg) {
  const g = view.gen, { p, fmt } = g;
  const thumb = svgDataUrl(svg);
  let r = g.resId && state.resources.find(x => x.id === g.resId);
  if (r) { r.thumb = thumb; r.size = svg.length; save(); return; }
  const slug = norm(p.headline).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'propuesta';
  r = {
    id: uid(), title: p.headline, desc: `Propuesta creada con IA · ${fmt.label}`, category: 'Piezas gráficas', brand: 'Crear con IA',
    tags: ['ia', g.key, ...(p.tags || [])].slice(0, 6), name: slug + '.svg', type: 'image/svg+xml', size: svg.length,
    date: Date.now(), author: state.user?.name || '', thumb, ai: true,
  };
  state.resources.unshift(r); g.resId = r.id; save();
  toast('Tu diseño se guardó en Mis archivos');
}
function paintProposal() {
  if (!view.gen) return;
  const { p, fmt } = view.gen;
  const pal = PALETTES[view.paletteIdx % PALETTES.length];
  const svg = buildSVG({ w: fmt.w, h: fmt.h, headline: p.headline, sub: p.sub, pal });
  view.gen.svg = svg;
  syncGenResource(svg);
  $('#genResult').innerHTML = `
    <div class="preview">${svg}</div>
    <div class="proposal">
      <h4>Dirección creativa</h4>
      <p class="muted">${esc(p.concept)}</p>
      <dl>
        <dt>Titular</dt><dd>${esc(p.headline)}</dd>
        <dt>Apoyo</dt><dd>${esc(p.copy || p.sub)}</dd>
        <dt>Llamado</dt><dd>${esc(p.cta)}</dd>
        <dt>Paleta</dt><dd class="swatches">${pal.c.map(c => `<i class="swatch" style="background:${c}"></i>`).join('')}<span class="muted">${esc(pal.name)}</span></dd>
        <dt>Formato</dt><dd>${esc(fmt.label)}</dd>
        <dt>Composición</dt><dd>${esc(fmt.tip)}</dd>
        ${p.refs.length ? `<dt>Referencias</dt><dd>${p.refs.map(esc).join(', ')}${p.tags.length ? `<br><span class="muted">Etiquetas guía: ${p.tags.map(t => '#' + esc(t)).join(' ')}</span>` : ''}</dd>` : ''}
      </dl>
      <div class="row">
        <button class="btn primary sm" data-gen="svg">Descargar SVG</button>
        <button class="btn ghost sm" data-gen="png">Descargar PNG</button>
        <button class="btn ghost sm" data-gen="palette">↻ Cambiar paleta</button>
      </div>
    </div>`;
}

/* ============================================================
   MI ACTIVIDAD
   ============================================================ */
const ACT_ICON = { upload: 'upload', download: 'download', ai: 'sparkle', fav: 'heart', drive: 'folder' };
function renderActivity() {
  $('#rangeSelect').value = String(view.range);
  const inRange = a => Date.now() - a.ts <= view.range * 864e5;
  const acts = state.activity.filter(inRange);
  $('#kUp').textContent = acts.filter(a => a.type === 'upload').length;
  $('#kDown').textContent = acts.filter(a => a.type === 'download').length;
  $('#kAi').textContent = acts.filter(a => a.type === 'ai').length;
  $('#kFav').textContent = state.favorites.length;

  // Mapa de calor: últimos 12 meses
  const counts = {};
  state.activity.forEach(a => { const k = dayKey(a.ts); counts[k] = (counts[k] || 0) + 1; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - (52 * 7 + today.getDay()));
  let cols = '', labels = '', last = -1, total = 0;
  for (let w = 0; w < 53; w++) {
    const first = new Date(start); first.setDate(start.getDate() + w * 7);
    const m = first.getMonth();
    labels += `<span>${m !== last && !(w === 0 && first.getDate() > 20) ? MONTHS[m] : ''}</span>`; last = m;
    let cells = '';
    for (let d = 0; d < 7; d++) {
      const day = new Date(first); day.setDate(first.getDate() + d);
      if (day > today) { cells += '<i class="cell void"></i>'; continue; }
      const c = counts[dayKey(day)] || 0; total += c;
      cells += `<i class="cell l${Math.min(c, 4)}" title="${c} ${c === 1 ? 'contribución' : 'contribuciones'} · ${fmtDate(day)}"></i>`;
    }
    cols += `<div class="col">${cells}</div>`;
  }
  $('#heatMonths').innerHTML = labels;
  $('#heat').innerHTML = cols;
  $('#heatTotal').textContent = `${total} ${total === 1 ? 'contribución' : 'contribuciones'} durante el último año`;

  // Aporte del mes
  const now = new Date();
  const monthUploads = state.activity.filter(a => { const d = new Date(a.ts); return a.type === 'upload' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const GOAL = 5;
  $('#monthBox').innerHTML = monthUploads
    ? `<div class="month-big">${monthUploads}</div><p class="muted">${monthUploads === 1 ? 'recurso aportado' : 'recursos aportados'} este mes</p>
       <div class="bar"><i style="width:${Math.min(100, monthUploads / GOAL * 100)}%"></i></div><p class="muted" style="font-size:.78rem">Meta sugerida: ${GOAL} recursos al mes</p>`
    : `<p><strong>Aún no hay datos<br>para mostrar.</strong></p><p class="muted">Empieza cargando tu primer recurso a Diseñoteca.</p>`;

  // Feed
  $('#feed').innerHTML = acts.length
    ? acts.slice(0, 12).map(a => `<li><span class="dot">${icon(ACT_ICON[a.type] || 'file')}</span><span>${esc(a.text)}</span><small>${relTime(a.ts)}</small></li>`).join('')
    : `<li><span class="none" style="width:100%">○ <strong>Aún no tienes actividad</strong><br>Las cargas, descargas y creaciones aparecerán aquí.</span></li>`;
}

/* ============================================================
   RECURSOS: acciones
   ============================================================ */
function toggleFav(id) {
  const r = state.resources.find(x => x.id === id); if (!r) return;
  const i = state.favorites.indexOf(id);
  const wasFav = i >= 0;
  if (wasFav) state.favorites.splice(i, 1);
  else { state.favorites.push(id); logActivity('fav', `Guardaste «${trunc(r.title, 40)}» en favoritos`); }
  save();
  // en Favoritos, la tarjeta se desvanece antes de salir de la lista
  if (view.name === 'favorites' && wasFav) {
    const c = $(`.card[data-id="${id}"]`);
    if (c) { c.classList.add('leaving'); wait(260).then(render); return; }
  }
  // en el resto de vistas se actualiza el corazón sin redibujar todo
  const on = state.favorites.includes(id);
  $$(`.card[data-id="${id}"] .fav`).forEach(b => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-label', on ? 'Quitar de favoritos' : 'Guardar en favoritos');
  });
  if (view.name === 'activity') render();
}
async function downloadResource(id) {
  const r = state.resources.find(x => x.id === id); if (!r) return;
  try {
    const blob = await idb.get(id);
    if (blob) download(blob, r.name || r.title);
    else if (r.thumb) { const b = await (await fetch(r.thumb)).blob(); download(b, (r.title || 'recurso') + (r.thumb.startsWith('data:image/svg') ? '.svg' : '.jpg')); }
    else return toast('Este recurso no tiene un archivo asociado.');
    logActivity('download', `Descargaste «${trunc(r.title, 40)}»`); save();
    toast('Descarga iniciada');
    if (view.name === 'activity') render();
  } catch { toast('No se pudo descargar el archivo.'); }
}
async function deleteResource(id) {
  const r = state.resources.find(x => x.id === id); if (!r) return;
  const ok = await confirmDialog({ title: '¿Eliminar este recurso?', text: `«${r.title}» se quitará de la biblioteca y del almacenamiento de este navegador.`, ok: 'Eliminar' });
  if (!ok) return;
  await wait(230);                                                    // deja terminar el cierre del diálogo
  $$(`.card[data-id="${id}"]`).forEach(el => el.classList.add('leaving'));
  await wait(260);
  state.resources = state.resources.filter(x => x.id !== id);
  state.favorites = state.favorites.filter(x => x !== id);
  view.refs.delete(id); thumbCache.delete(id);
  try { await idb.del(id); await idb.del('thumb:' + id); } catch {}
  save(); render(); toast('Recurso eliminado');
}
async function wipeLibrary() {
  if (!state.resources.length) return toast('La biblioteca ya está vacía.');
  const ok = await confirmDialog({ title: '¿Vaciar la biblioteca?', text: `Se eliminarán los ${state.resources.length} recursos y sus archivos de este navegador. No se puede deshacer.`, ok: 'Vaciar biblioteca' });
  if (!ok) return;
  state.resources = []; state.favorites = []; view.refs.clear(); thumbCache.clear();
  try { await idb.clear(); } catch {}
  save(); render(); toast('Biblioteca vaciada');
}
function loadSamples() {
  const day = 864e5, now = Date.now();
  const data = [
    ['Presentación institucional 2026', 'Presentaciones', 'Glob.AI', 'Deck principal para clientes con la nueva identidad.', ['institucional', 'clientes', '2026'], 0],
    ['Brandbook Glob.AI v3', 'Brandbooks', 'Glob.AI', 'Logotipo, colores, tipografía y reglas de uso de la marca.', ['marca', 'logo', 'colores'], 1],
    ['Plantilla post para redes', 'Plantillas', 'Social', 'Plantilla editable de post cuadrado con degradado.', ['social', 'post', 'instagram'], 2],
    ['Banner campaña fin de año', 'Piezas gráficas', 'Campaña Q4', 'Banner 970×250 con mensaje de cierre de año.', ['banner', 'campaña', 'navidad'], 3],
    ['Newsletter de noviembre', 'Emails', 'Comunicaciones', 'Email mensual para el equipo con novedades.', ['newsletter', 'interno'], 4],
    ['Ilustraciones abstractas', 'Imágenes', 'Glob.AI', 'Set de formas orgánicas en lavanda, azul y menta.', ['ilustración', 'abstracto', 'azul'], 5],
    ['Proyecto rebranding', 'Proyectos', 'Glob.AI', 'Carpeta del proyecto de actualización de marca.', ['rebranding', 'marca', 'proyecto'], 6],
  ];
  data.forEach(([title, category, brand, desc, tags, i]) => {
    const pal = PALETTES[i % 3];
    state.resources.push({
      id: uid(), title, category, brand, desc, tags, name: title.replace(/\s+/g, '-').toLowerCase() + '.svg', type: 'image/svg+xml',
      size: 4096, date: now - i * day * 2, author: state.user?.name || 'Equipo', sample: true,
      thumb: svgDataUrl(buildSVG({ w: 480, h: 300, headline: title, sub: category, pal })),
    });
  });
  save(); render(); toast('Se cargaron 7 recursos de ejemplo');
}

/* ============================================================
   SUBIR RECURSO
   ============================================================ */
let pending = null;
function openModal(id) { const m = $('#' + id); m.classList.remove('closing'); m.hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal(id) {
  const m = $('#' + id);
  if (m.hidden || m.classList.contains('closing')) return;
  if (id === 'confirmModal' && cfResolve) { const r = cfResolve; cfResolve = null; r(false); }   // cerrar = cancelar
  m.classList.add('closing');
  wait(220).then(() => {
    m.hidden = true; m.classList.remove('closing');
    if (id === 'viewerModal') cleanupViewer();
    if (!$$('.modal').some(x => !x.hidden)) document.body.style.overflow = '';
  });
}

/* ---------- Diálogo de confirmación (reemplaza a confirm()) ---------- */
let cfResolve = null;
function confirmDialog({ title, text, ok = 'Eliminar', danger = true, ico = 'trash' }) {
  return new Promise(res => {
    cfResolve = res;
    $('#cfTitle').textContent = title;
    $('#cfText').textContent = text || '';
    $('#cfIcon').innerHTML = icon(ico);
    $('#cfIcon').classList.toggle('neutral', !danger);
    const b = $('#cfOk'); b.textContent = ok; b.classList.toggle('danger-btn', danger);
    openModal('confirmModal');
    setTimeout(() => b.focus(), 60);
  });
}
function answerConfirm(v) { const r = cfResolve; cfResolve = null; if (r) r(v); closeModal('confirmModal'); }

/* ============================================================
   VISTAS PREVIAS (portadas tipo Drive) y VISOR DE ARCHIVOS
   ============================================================ */
const thumbCache = new Map();                                    // id -> dataURL (guardado en IndexedDB como 'thumb:<id>')
const thumbSrc = r => r.thumb || thumbCache.get(r.id) || null;
const extName = n => ((n || '').split('.').pop() || '').toLowerCase();
const TEXT_EXT = new Set('txt md markdown csv tsv json xml html htm css scss js mjs ts jsx tsx py rb php java c h cpp cs go rs sql yml yaml toml ini log'.split(' '));
function fileKind(r) {
  const ext = extName(r.name), t = r.type || '';
  if (ext === 'ai') return 'ai';
  if (t === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (['pptx', 'potx', 'ppsx'].includes(ext)) return 'pptx';
  if (['docx', 'dotx'].includes(ext)) return 'docx';
  if (['xlsx', 'xlsm', 'xltx'].includes(ext)) return 'xlsx';
  if (['key', 'pages', 'numbers'].includes(ext)) return 'apple';
  if (['odp', 'ods', 'odt'].includes(ext)) return 'odf';
  if (ext === 'fig' || ext === 'sketch') return 'zipdesign';
  if (t.startsWith('text/') || TEXT_EXT.has(ext)) return 'text';
  return 'other';
}
const KIND_COLOR = { pdf: '#e5484d', ai: '#f08c00', pptx: '#e8590c', docx: '#2b6cb0', xlsx: '#2f9e44', image: '#8f6af5', video: '#d6409f', audio: '#d6409f', text: '#6a6d78', apple: '#6a6d78', odf: '#6a6d78', zipdesign: '#0b0b0f', other: '#0b0b0f' };
const typeBadge = r => ({ label: (extName(r.name) || 'file').slice(0, 5).toUpperCase(), color: KIND_COLOR[fileKind(r)] || '#0b0b0f' });

/* contenido del recuadro de portada de una tarjeta */
function thumbMedia(r) {
  const src = thumbSrc(r);
  if (!src) return `<div class="ph" style="background:${CAT_GRAD[r.category] || CAT_GRAD.Proyectos}">${esc(extOf(r))}</div>`;
  const tb = typeBadge(r);
  return `<img src="${src}" alt="" loading="lazy">${r.sample || r.ai ? '' : `<span class="ftype" style="--c:${tb.color}">${esc(tb.label)}</span>`}`;
}
function refreshThumb(id) {
  const r = state.resources.find(x => x.id === id); if (!r) return;
  $$(`.card[data-id="${id}"] .thumb`).forEach(t => {
    t.classList.toggle('doc', r.tk === 'doc');
    $$(':scope > img, :scope > .ph, :scope > .ftype', t).forEach(n => n.remove());
    t.insertAdjacentHTML('afterbegin', thumbMedia(r));
  });
}

/* ---------- Lector ZIP mínimo (docx / pptx / xlsx / key / fig …) sin librerías ---------- */
async function zipEntries(file) {
  const size = file.size, tailLen = Math.min(size, 66000);
  const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip');
  const count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
  if (cdOff === 0xffffffff) throw new Error('zip64');
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder(), map = {};
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const nlen = cd.getUint16(p + 28, true), elen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen));
    map[name] = { method: cd.getUint16(p + 10, true), csize: cd.getUint32(p + 20, true), usize: cd.getUint32(p + 24, true), off: cd.getUint32(p + 42, true) };
    p += 46 + nlen + elen + clen;
  }
  return map;
}
async function zipRead(file, e) {
  const hdr = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer());
  const start = e.off + 30 + hdr.getUint16(26, true) + hdr.getUint16(28, true);
  const raw = file.slice(start, start + e.csize);
  if (e.method === 0) return raw;
  return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
}
const zipText = async (file, ents, name, max = 25e6) => { const e = ents[name]; return !e || e.usize > max ? null : (await zipRead(file, e)).text(); };
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const numIn = s => parseInt((s.match(/(\d+)\.xml$/) || [0, 0])[1], 10);
const tagTexts = (el, tag) => [...el.getElementsByTagName(tag)].map(t => t.textContent).join('');

async function pptxSlides(file, ents, limit = 80) {
  const names = Object.keys(ents).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => numIn(a) - numIn(b)).slice(0, limit);
  const out = [];
  for (const n of names) {
    const xml = await zipText(file, ents, n); if (!xml) { out.push([]); continue; }
    out.push([...xmlDoc(xml).getElementsByTagName('a:p')].map(p => tagTexts(p, 'a:t').trim()).filter(Boolean));
  }
  return out;
}
async function docxParas(file, ents, limit = 400) {
  const xml = await zipText(file, ents, 'word/document.xml'); if (!xml) return [];
  return [...xmlDoc(xml).getElementsByTagName('w:p')].map(p => tagTexts(p, 'w:t').trim()).filter(Boolean).slice(0, limit);
}
const colIdx = ref => ((ref || 'A').match(/^[A-Z]+/) || ['A'])[0].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
async function xlsxRows(file, ents, maxRows = 60, maxCols = 20) {
  const sst = await zipText(file, ents, 'xl/sharedStrings.xml');
  const shared = sst ? [...xmlDoc(sst).getElementsByTagName('si')].map(si => tagTexts(si, 't')) : [];
  const sheet = Object.keys(ents).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => numIn(a) - numIn(b))[0];
  const xml = sheet && await zipText(file, ents, sheet); if (!xml) return [];
  const rows = [];
  for (const row of [...xmlDoc(xml).getElementsByTagName('row')].slice(0, maxRows)) {
    const cells = [];
    for (const c of row.getElementsByTagName('c')) {
      const i = colIdx(c.getAttribute('r')); if (i >= maxCols) continue;
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
      cells[i] = t === 's' && v ? (shared[+v.textContent] ?? '') : t === 'inlineStr' ? tagTexts(c, 't') : v ? v.textContent : '';
    }
    rows.push(Array.from(cells, x => x ?? ''));
  }
  return rows;
}

/* ---------- Dibujo de portadas cuando el archivo no trae miniatura propia ---------- */
const FONT = 'Heebo, Arial, sans-serif';
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.textBaseline = 'top'; return [c, x]; }
function wrapLines(ctx, text, maxW, maxLines) {
  const lines = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length >= maxLines) return lines; } else cur = t;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
function slideCanvas(paras) {
  const [c, x] = newCanvas(480, 270);
  const g = x.createLinearGradient(0, 0, 0, 270); g.addColorStop(0, '#4c7bf4'); g.addColorStop(1, '#1fb0b8');
  x.fillStyle = g; x.fillRect(0, 0, 8, 270);
  x.fillStyle = '#0b0b0f'; x.font = `700 26px ${FONT}`;
  let y = 44;
  for (const l of wrapLines(x, paras[0], 400, 3)) { x.fillText(l, 36, y); y += 32; }
  y += 8; x.font = `400 14px ${FONT}`; x.fillStyle = '#5f6368';
  outer: for (const p of paras.slice(1)) for (const l of wrapLines(x, p, 400, 2)) { if (y > 238) break outer; x.fillText(l, 36, y); y += 20; }
  return c.toDataURL('image/jpeg', .8);
}
function pageCanvas(lines, mono) {
  const [c, x] = newCanvas(480, 300);
  let y = 28;
  lines.forEach((p, i) => {
    const head = i === 0 && !mono, lh = head ? 22 : mono ? 13 : 16;
    x.font = head ? `700 17px ${FONT}` : mono ? '400 10px ui-monospace,Menlo,Consolas,monospace' : `400 11px ${FONT}`;
    x.fillStyle = head ? '#0b0b0f' : '#3c4043';
    for (const l of wrapLines(x, p, 408, head ? 3 : mono ? 1 : 4)) { if (y > 282) return; x.fillText(l, 36, y); y += lh; }
    y += mono ? 0 : 6;
  });
  return c.toDataURL('image/jpeg', .8);
}
function sheetCanvas(rows) {
  const [c, x] = newCanvas(480, 300), cw = 92, rh = 24, ox = 28, oy = 22;
  x.font = `500 11px ${FONT}`; x.textBaseline = 'middle';
  x.fillStyle = '#f1f3f4'; x.fillRect(0, 0, 480, oy); x.fillRect(0, 0, ox, 300);
  for (let j = 0; j < 5; j++) { x.fillStyle = '#80868b'; x.fillText(String.fromCharCode(65 + j), ox + j * cw + cw / 2 - 3, oy / 2); }
  for (let i = 0; i < 11; i++) {
    const y = oy + i * rh;
    x.fillStyle = '#80868b'; x.fillText(String(i + 1), 8, y + rh / 2);
    for (let j = 0; j < 5; j++) {
      const v = (rows[i] && rows[i][j]) || '';
      x.fillStyle = i === 0 ? '#0b0b0f' : '#3c4043'; x.font = `${i === 0 ? 700 : 400} 11px ${FONT}`;
      let s = String(v); while (s.length > 1 && x.measureText(s).width > cw - 10) s = s.slice(0, -1);
      x.fillText(s, ox + j * cw + 6, y + rh / 2);
    }
  }
  x.strokeStyle = '#e0e3e7'; x.lineWidth = 1;
  for (let j = 0; j <= 5; j++) { x.beginPath(); x.moveTo(ox + j * cw + .5, 0); x.lineTo(ox + j * cw + .5, 300); x.stroke(); }
  for (let i = 0; i <= 12; i++) { x.beginPath(); x.moveTo(0, oy + i * rh - .5); x.lineTo(480, oy + i * rh - .5); x.stroke(); }
  return c.toDataURL('image/jpeg', .8);
}

/* ---------- Miniaturas por tipo ---------- */
function videoFrame(file) {
  return new Promise(res => {
    const url = URL.createObjectURL(file), v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.playsInline = true;
    let t;
    const done = u => { clearTimeout(t); URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); res(u); };
    t = setTimeout(() => done(null), 8000);
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 1) / 4); };
    v.onseeked = () => {
      try {
        const k = Math.min(1, 480 / (v.videoWidth || 480)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((v.videoWidth || 480) * k)); c.height = Math.max(1, Math.round((v.videoHeight || 270) * k));
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', .8));
      } catch { done(null); }
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}
let pdfLibP;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfLibP || (pdfLibP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { pdfLibP = null; rej(new Error('pdfjs')); };
    document.head.appendChild(s);
  }));
}
async function pdfThumb(file) {
  if (file.size > 250 * 1048576) return null;
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1), vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 480 / vp0.width });
    const [c, x] = newCanvas(Math.round(vp.width), Math.round(vp.height));
    await page.render({ canvasContext: x, viewport: vp }).promise;
    const h = Math.min(c.height, 480);                                  // como Drive: se muestra la parte superior de la página
    const out = document.createElement('canvas'); out.width = c.width; out.height = h;
    out.getContext('2d').drawImage(c, 0, 0);
    return out.toDataURL('image/jpeg', .8);
  } finally { doc.destroy(); }
}
async function textThumb(file) {
  const raw = (await file.slice(0, 6000).text()).replace(/\r/g, '');
  const lines = raw.split('\n').map(l => l.replace(/\t/g, '  ')).filter(l => l.trim()).slice(0, 22);
  return lines.length ? pageCanvas(lines, true) : null;
}
const ZIP_KINDS = new Set(['pptx', 'docx', 'xlsx', 'apple', 'odf', 'zipdesign']);
const ZIP_THUMBS = ['docProps/thumbnail.jpeg', 'docProps/thumbnail.jpg', 'docProps/thumbnail.png', 'QuickLook/Thumbnail.jpg', 'QuickLook/Preview.jpg', 'Thumbnails/thumbnail.png', 'previews/preview.png', 'thumbnail.png', 'preview.png', 'preview.jpg'];

/* ¿la miniatura embebida está en blanco? (pasa con plantillas o archivos guardados sin vista previa) */
function isBlankImage(url) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data; let min = 255, max = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < min) min = l; if (l > max) max = l; }
      res(max - min < 14);
    };
    img.onerror = () => res(true);
    img.src = url;
  });
}

/* devuelve { url, doc } o null.  doc = true → se muestra recortada por arriba, como un documento */
async function buildPreview(file) {
  const kind = fileKind({ name: file.name, type: file.type });
  try {
    if (kind === 'image') { const u = await downscale(file); return u && { url: u, doc: false }; }
    if (kind === 'video') { const u = await videoFrame(file); return u && { url: u, doc: false }; }
    if (kind === 'pdf' || kind === 'ai') { const u = await pdfThumb(file); return u && { url: u, doc: true }; }
    if (kind === 'text') { const u = await textThumb(file); return u && { url: u, doc: true }; }
    if (ZIP_KINDS.has(kind)) {
      const ents = await zipEntries(file);
      const hit = ZIP_THUMBS.find(n => ents[n]);
      if (hit) {                                                          // miniatura que el propio programa guardó dentro del archivo
        const b = await zipRead(file, ents[hit]);
        const u = await downscale(new Blob([b], { type: hit.endsWith('png') ? 'image/png' : 'image/jpeg' }));
        if (u && !(await isBlankImage(u))) return { url: u, doc: kind !== 'zipdesign' };
      }
      if (kind === 'pptx') { const s = (await pptxSlides(file, ents, 5)).find(p => p.length); if (s) return { url: slideCanvas(s), doc: false }; }
      if (kind === 'docx') { const p = await docxParas(file, ents, 25); if (p.length) return { url: pageCanvas(p, false), doc: true }; }
      if (kind === 'xlsx') { const r = await xlsxRows(file, ents, 12, 5); if (r.length) return { url: sheetCanvas(r), doc: true }; }
    }
  } catch (e) { console.warn('Sin vista previa:', e); }
  return null;
}

/* Genera portadas de archivos ya subidos que aún no tienen (p. ej. subidos antes de esta versión) */
let hydrating = false;
async function hydrateThumbs() {
  if (hydrating) return; hydrating = true;
  for (const r of [...state.resources]) {
    if (r.thumb || thumbCache.has(r.id) || r.sample || r.ai || (r.pvTry || 0) >= 2) continue;
    try {
      const blob = await idb.get(r.id); if (!blob) continue;
      const file = blob.name ? blob : new File([blob], r.name || 'archivo', { type: r.type || blob.type });
      const pv = await buildPreview(file);
      if (pv) { thumbCache.set(r.id, pv.url); r.tk = pv.doc ? 'doc' : 'img'; await idb.put('thumb:' + r.id, pv.url); refreshThumb(r.id); }
      else r.pvTry = (r.pvTry || 0) + 1;
      save();
    } catch {}
  }
  hydrating = false;
}
async function loadThumbCache() {
  await Promise.all(state.resources.filter(r => !r.thumb).map(async r => {
    try { const u = await idb.get('thumb:' + r.id); if (u) thumbCache.set(r.id, u); } catch {}
  }));
}

/* ---------- Visor ---------- */
let vwUrl = null, vwId = null;
function cleanupViewer() {
  if (vwUrl) URL.revokeObjectURL(vwUrl);
  vwUrl = null; vwId = null; $('#vwBody').innerHTML = '';
}
async function officeViewHTML(file, kind) {
  const ents = await zipEntries(file);
  if (kind === 'pptx') {
    const slides = await pptxSlides(file, ents, 80); if (!slides.length) return null;
    return `<div class="vw-note">Vista de texto de la presentación · descarga el archivo para ver el diseño completo.</div><div class="vw-stack">` +
      slides.map((p, i) => `<section class="vw-slide"><span class="vw-n">${i + 1}</span>${p.length ? `<h4>${esc(p[0])}</h4>${p.slice(1).map(s => `<p>${esc(s)}</p>`).join('')}` : '<em>Diapositiva sin texto</em>'}</section>`).join('') + '</div>';
  }
  if (kind === 'docx') {
    const paras = await docxParas(file, ents); if (!paras.length) return null;
    return `<div class="vw-note">Vista de texto del documento · descarga el archivo para ver el formato completo.</div><article class="vw-page">${paras.map((p, i) => i === 0 ? `<h4>${esc(p)}</h4>` : `<p>${esc(p)}</p>`).join('')}</article>`;
  }
  if (kind === 'xlsx') {
    const rows = await xlsxRows(file, ents, 60, 20); if (!rows.length) return null;
    const w = Math.max(...rows.map(r => r.length));
    return `<div class="vw-note">Primera hoja del libro (hasta 60 filas) · descarga el archivo para verlo completo.</div><div class="vw-sheet"><table>${rows.map((r, i) => `<tr>${Array.from({ length: w }, (_, j) => `<${i ? 'td' : 'th'}>${esc(r[j] ?? '')}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></div>`;
  }
  return null;
}
async function openViewer(id) {
  const r = state.resources.find(x => x.id === id); if (!r) return;
  vwId = id;
  const kind = fileKind(r), tb = typeBadge(r), body = $('#vwBody');
  $('#vwTitle').textContent = r.title;
  $('#vwMeta').textContent = [r.name, fmtSize(r.size), fmtDate(r.date)].filter(Boolean).join(' · ');
  const ty = $('#vwType'); ty.textContent = tb.label; ty.style.setProperty('--c', tb.color);
  body.innerHTML = `<div class="vw-msg"><span class="orb sm pulse">${icon('sparkle')}</span><p>Abriendo archivo…</p></div>`;
  openModal('viewerModal');

  let blob = null;
  try { blob = await idb.get(id); } catch {}
  if (vwId !== id) return;                                             // se cerró el visor mientras cargaba
  const set = h => { if (vwId === id) body.innerHTML = h; };
  const fallback = msg => set(`<div class="vw-msg">${thumbSrc(r) ? `<img class="vw-thumb" src="${thumbSrc(r)}" alt="">` : ''}<p>${esc(msg)}</p><button class="btn primary sm" data-vw="download">Descargar archivo</button></div>`);
  if (!blob) return fallback('No encontré el archivo original en este navegador, solo su portada.');

  const mime = r.type || blob.type || (kind === 'pdf' ? 'application/pdf' : '');
  const typed = blob.type === mime ? blob : new Blob([blob], { type: mime });
  const file = blob.name ? blob : new File([blob], r.name || 'archivo', { type: mime });
  try {
    if (['image', 'video', 'audio', 'pdf'].includes(kind)) vwUrl = URL.createObjectURL(typed);
    if (kind === 'image') set(`<div class="vw-center"><img src="${vwUrl}" alt="${esc(r.title)}"></div>`);
    else if (kind === 'video') set(`<div class="vw-center"><video src="${vwUrl}" controls playsinline></video></div>`);
    else if (kind === 'audio') set(`<div class="vw-center"><audio src="${vwUrl}" controls></audio></div>`);
    else if (kind === 'pdf') set(`<iframe class="vw-frame" src="${vwUrl}" title="${esc(r.title)}"></iframe>`);
    else if (kind === 'text') {
      const t = await typed.slice(0, 200000).text();
      set(`<pre class="vw-text">${esc(t)}</pre>${typed.size > 200000 ? '<div class="vw-note">Se muestran los primeros 200 KB.</div>' : ''}`);
    } else if (['pptx', 'docx', 'xlsx'].includes(kind)) {
      const html = await officeViewHTML(file, kind);
      if (html) set(html); else fallback('No pude leer el contenido de este archivo. Descárgalo para abrirlo.');
    } else fallback('Este tipo de archivo no se puede abrir en el navegador. Descárgalo para abrirlo con su programa.');
  } catch (e) { console.warn(e); fallback('No pude abrir este archivo en el navegador. Descárgalo para verlo.'); }
}
function openUpload() {
  pending = null;
  $('#uploadForm').reset(); $('#fileInput').value = '';
  $('#dzTitle').textContent = 'Arrastra un archivo aquí';
  $('#dzSub').textContent = `o haz clic para seleccionarlo · Máximo ${fmtLimit(CONFIG.MAX_MB)}`;
  $('#upNote').hidden = true;
  openModal('uploadModal');
}
function suggestMeta(file) {
  const base = file.name.replace(/\.[^.]+$/, '');
  const title = cap(base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim());
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let category = 'Proyectos';
  if (file.type.startsWith('image/')) category = 'Imágenes';
  else if (['ppt', 'pptx', 'key', 'pdf'].includes(ext)) category = 'Presentaciones';
  else if (['fig', 'psd', 'ai', 'sketch', 'indd', 'xd'].includes(ext)) category = 'Plantillas';
  else if (['html', 'eml'].includes(ext)) category = 'Emails';
  const hint = norm(base);
  CAT_HINTS.forEach(([re, c]) => { if (re.test(hint)) category = c; });
  const tags = [...new Set(norm(base).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)))].slice(0, 4);
  if (ext) tags.push(ext);
  return { title, category, tags };
}
async function setPendingFile(file) {
  if (!file) return;
  if (file.size > CONFIG.MAX_MB * 1048576) return toast(`El archivo supera ${fmtLimit(CONFIG.MAX_MB)}.`);
  // los archivos viven en el navegador: se comprueba que haya espacio libre
  try {
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    if (est && est.quota && file.size > est.quota - (est.usage || 0)) {
      return toast(`No hay espacio suficiente en el navegador (${fmtSize(Math.max(0, est.quota - (est.usage || 0)))} libres).`);
    }
  } catch {}
  pending = file;
  $('#dzTitle').textContent = file.name;
  $('#dzSub').textContent = `${fmtSize(file.size)} · haz clic para cambiarlo`;
  const s = suggestMeta(file);
  if (!$('#upTitle').value) $('#upTitle').value = s.title;
  if (!$('#upTags').value) $('#upTags').value = s.tags.join(', ');
  $('#upCategory').value = s.category;
  const n = $('#upNote'); n.hidden = false;
  n.innerHTML = '✦ Glob.AI sugirió el título, la categoría y las etiquetas. Revísalos antes de publicar.';
}
function downscale(file, max = 480) {
  return new Promise(res => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width || max, img.height || max));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.width || max) * k)); c.height = Math.max(1, Math.round((img.height || max) * k));
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height);   // fondo blanco para PNG/SVG con transparencia
      cx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
async function publishResource(e) {
  e.preventDefault();
  if (!pending) return toast('Primero selecciona un archivo.');
  const title = $('#upTitle').value.trim();
  if (!title) return;
  const btn = $('#uploadForm button[type=submit]'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Procesando archivo…';
  try {
    // portada tipo Drive (máx. 15 s para no bloquear la subida)
    const pv = await Promise.race([buildPreview(pending), new Promise(r => setTimeout(() => r(null), 15000))]);
    const r = {
      id: uid(), title, desc: $('#upDesc').value.trim(), category: $('#upCategory').value, brand: $('#upBrand').value.trim(),
      tags: $('#upTags').value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 8),
      name: pending.name, type: pending.type, size: pending.size, date: Date.now(), author: state.user?.name || '',
      tk: pv ? (pv.doc ? 'doc' : 'img') : undefined,
    };
    btn.textContent = 'Guardando…';
    await idb.put(r.id, pending);
    if (pv) { thumbCache.set(r.id, pv.url); try { await idb.put('thumb:' + r.id, pv.url); } catch {} }
    state.resources.unshift(r);
    logActivity('upload', `Subiste «${trunc(r.title, 40)}»`);
    save(); closeModal('uploadModal'); toast('Recurso publicado');
    if (view.name !== 'library') go('library'); else render();
  } catch { toast('No se pudo guardar el archivo en el navegador.'); }
  finally { btn.disabled = false; btn.textContent = label; }
}

/* ============================================================
   BÚSQUEDA con IA (barra superior)
   ============================================================ */
function updateAttachChip() {
  const chip = $('#attachChip');
  chip.hidden = !view.attach;
  chip.innerHTML = view.attach ? `<span>${esc(view.attach.name)}</span><button type="button" id="attachX" aria-label="Quitar adjunto">×</button>` : '';
}
function runAISearch() {
  const q = $('#searchInput').value.trim();
  view.query = q;
  if (!q && !view.attach) { view.aiNote = null; return go('library'); }
  const s = smartSearch(q, view.attach);
  const parts = [];
  if (s.cats.length) parts.push(`categoría <b>${s.cats.map(esc).join(', ')}</b>`);
  if (s.tokens.length) parts.push(`palabras clave <b>${s.tokens.slice(0, 6).map(esc).join(', ')}</b>`);
  if (view.attach) parts.push(`referencia adjunta <b>${esc(view.attach.name)}</b>`);
  view.aiNote = `✦ <b>Búsqueda con IA:</b> entendí ${parts.join(' · ') || 'tu consulta'} — ${s.results.length} ${s.results.length === 1 ? 'resultado' : 'resultados'}.` +
    (s.results.length ? '' : ' <a href="#" data-action="ask-query" style="color:inherit;font-weight:600">Pregúntale al asistente →</a>');
  if (view.name !== 'library') go('library'); else render();
}

/* ============================================================
   CHATBOT
   ============================================================ */
const SUGGESTIONS = ['¿Cuántos recursos hay?', 'Busca presentaciones', '¿Cómo subo un recurso?', '¿Cómo creo una pieza con IA?'];
function md(text) {
  let h = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = h.split('\n'); let out = '', inList = false;
  lines.forEach(l => {
    if (/^\s*[-•]\s+/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${l.replace(/^\s*[-•]\s+/, '')}</li>`; }
    else { if (inList) { out += '</ul>'; inList = false; } out += (out && !out.endsWith('</ul>') ? '<br>' : '') + l; }
  });
  return out + (inList ? '</ul>' : '');
}
function msgHTML(m) {
  const acts = (m.actions || []).map(a => `<button data-chat-act="${esc(a.act)}">${esc(a.label)}</button>`).join('');
  return `<div class="msg ${m.role === 'user' ? 'user' : 'bot'}">${md(m.text)}${acts ? `<div class="msg-actions">${acts}</div>` : ''}</div>`;
}
function renderChat() {
  const body = $('#chatBody');
  if (!state.chat.length) {
    state.chat = [{ role: 'bot', text: `¡Hola${state.user ? ', ' + firstName() : ''}! Soy el asistente de Diseñoteca. Puedo ayudarte a **encontrar recursos**, explicarte cómo **subir archivos** o cómo **crear piezas con IA**. ¿Qué necesitas?` }];
  }
  body.innerHTML = state.chat.map(msgHTML).join('');
  body.scrollTop = body.scrollHeight;
  $('#chatSuggest').innerHTML = state.chat.length <= 1 ? SUGGESTIONS.map(s => `<button type="button">${esc(s)}</button>`).join('') : '';
}
function openChat(prefill) {
  $('#chat').classList.remove('closing');
  $('#chat').hidden = false;
  renderChat(); $('#profileMenu').hidden = true; $('#app').classList.remove('nav-open');
  setTimeout(() => $('#chatInput').focus(), 50);
  if (prefill) sendChat(prefill);
}
function closeChat() {
  const c = $('#chat');
  if (c.hidden || c.classList.contains('closing')) return;
  c.classList.add('closing');
  wait(220).then(() => { c.hidden = true; c.classList.remove('closing'); });
}

function localReply(q) {
  const t = norm(q), n = state.resources.length;
  const A = { upload: { label: 'Subir un recurso', act: 'upload' }, create: { label: 'Ir a Crear con IA', act: 'nav:create' }, lib: { label: 'Ver biblioteca', act: 'nav:library' } };
  if (/^(hola|buenas|hey|buen dia|buenos dias|buenas tardes|buenas noches|saludos)\b/.test(t)) return { text: `¡Hola${state.user ? ', ' + firstName() : ''}! ¿Qué estás buscando hoy?` };
  if (/gracias/.test(t)) return { text: '¡Con gusto! Si necesitas algo más, aquí estoy.' };
  if (/(cuantos|cuantas|total|cantidad|resumen)/.test(t) && /(recurso|archivo|biblioteca|hay)/.test(t)) {
    if (!n) return { text: 'La biblioteca está vacía por ahora. Puedes subir tu primer recurso o cargar algunos de ejemplo.', actions: [A.upload, { label: 'Cargar ejemplos', act: 'samples' }] };
    const by = CATEGORIES.map(c => [c, state.resources.filter(r => r.category === c).length]).filter(x => x[1]);
    return { text: `Hay **${n} ${n === 1 ? 'recurso' : 'recursos'}** en la biblioteca:\n${by.map(([c, k]) => `- ${c}: ${k}`).join('\n')}`, actions: [A.lib] };
  }
  if (/(como|donde|quiero|puedo).*(sub|carg|public|agreg|anad)|subir|cargar|publicar/.test(t) && !/busca|encuentra/.test(t))
    return { text: `Para subir un recurso:\n- Pulsa **＋ Subir recurso**.\n- Arrastra el archivo (máx. ${fmtLimit(CONFIG.MAX_MB)}).\n- Revisa el título, categoría y etiquetas que sugiere la IA.\n- Pulsa **Publicar recurso**.`, actions: [A.upload] };
  if (/(crear|creo|generar|genero|generador|propuesta|disenar|diseno)/.test(t) && !/busca|encuentra/.test(t))
    return { text: 'En **Crear con IA** describes la pieza, eliges recursos de referencia y el formato (post, Slack, presentación, banner o email). La IA te devuelve una primera dirección creativa con titular, paleta y una vista previa que puedes descargar.', actions: [A.create] };
  if (/drive|google/.test(t)) return { text: `Google Drive ${state.drive ? 'ya está conectado (simulado)' : 'aún no está conectado'}. Puedes gestionarlo desde el menú de tu perfil, abajo a la izquierda.` };
  if (/favorit|guardad/.test(t)) return { text: `Tienes **${state.favorites.length}** ${state.favorites.length === 1 ? 'favorito' : 'favoritos'}. Toca el corazón de cualquier recurso para guardarlo.`, actions: [{ label: 'Ver favoritos', act: 'nav:favorites' }] };
  if (/(actividad|descarga|estadistic|aporte|contribu)/.test(t)) {
    const c = ty => state.activity.filter(a => a.type === ty).length;
    return { text: `Tu actividad: **${c('upload')}** recursos aportados, **${c('download')}** descargas y **${c('ai')}** creaciones con IA.`, actions: [{ label: 'Ver mi actividad', act: 'nav:activity' }] };
  }
  if (/(ayuda|que puedes|que haces|funciones|para que sirves)/.test(t))
    return { text: 'Puedo:\n- Buscar recursos por tema, categoría, marca o etiqueta.\n- Resumir qué hay en la biblioteca.\n- Explicarte cómo subir archivos o crear piezas con IA.\n- Contarte cómo va tu actividad.' };
  const s = smartSearch(q);
  if (!n) return { text: 'Todavía no hay recursos en la biblioteca para buscar. Sube el primero o carga ejemplos para probar.', actions: [A.upload, { label: 'Cargar ejemplos', act: 'samples' }] };
  if (s.results.length) {
    const top = s.results.slice(0, 4);
    return { text: `Encontré **${s.results.length}** ${s.results.length === 1 ? 'recurso' : 'recursos'} que pueden servirte:\n${top.map(x => `- ${x.r.title} (${x.r.category})`).join('\n')}`, actions: [{ label: 'Ver todos en la biblioteca', act: 'search:' + q }] };
  }
  return { text: 'No encontré recursos que coincidan con eso. Prueba con otras palabras (una categoría, marca o etiqueta), o puedo ayudarte a crear algo nuevo.', actions: [A.upload, A.create] };
}
let chatBusy = false;
async function sendChat(text) {
  text = text.trim(); if (!text || chatBusy) return;
  chatBusy = true;
  state.chat.push({ role: 'user', text });
  renderChat();
  const body = $('#chatBody');
  body.insertAdjacentHTML('beforeend', '<div class="msg bot" id="typing"><span class="typing"><i></i><i></i><i></i></span></div>');
  body.scrollTop = body.scrollHeight;
  let reply;
  try {
    const remote = await aiRequest('chat', {
      messages: state.chat.slice(-12).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })),
      library: libraryContext(),
    });
    if (remote && remote.reply) reply = { text: remote.reply };
    else { await new Promise(r => setTimeout(r, 550 + Math.random() * 450)); reply = localReply(text); }
  } catch { reply = { text: 'No pude conectar con el servicio de IA en este momento. Intenta de nuevo en unos segundos.' }; }
  state.chat.push({ role: 'bot', ...reply });
  state.chat = state.chat.slice(-40);
  save(); chatBusy = false; renderChat();
}
function runChatAction(act) {
  if (act === 'upload') return openUpload();
  if (act === 'samples') return loadSamples();
  if (act.startsWith('nav:')) return go(act.slice(4));
  if (act.startsWith('search:')) {
    const q = act.slice(7);
    $('#searchInput').value = q; view.cat = 'Todas'; runAISearch();
    if (window.innerWidth < 860) closeChat();
  }
}

/* ============================================================
   LOGIN / SESIÓN
   ============================================================ */
const nameFromEmail = e => e.split('@')[0].split(/[._-]+/).filter(Boolean).map(cap).join(' ') || 'Usuario';
let switching = false;   // evita dobles clics durante la transición
async function login(email, via) {
  if (switching) return;
  switching = true;
  state.user = { email, via, name: via === 'google' ? 'María Granados' : nameFromEmail(email), role: via === 'google' ? 'Diseñadora' : 'Equipo de diseño' };
  save();
  // 1) el login se desvanece (contenido sube y se difumina)
  $('#login').classList.add('leaving');
  await wait(520);
  // 2) entra la app: sidebar desde la izquierda, barra superior desde arriba, contenido sube
  $('#login').classList.remove('leaving');
  showApp(true);
  switching = false;
}
function showLogin(animate) {
  const l = $('#login');
  l.hidden = false; $('#app').hidden = true; document.body.style.overflow = '';
  if (animate && !reduceMotion()) {
    l.classList.add('enter');
    setTimeout(() => l.classList.remove('enter'), 1400);
  }
}
function showApp(animate) {
  $('#login').hidden = true;
  const a = $('#app');
  a.hidden = false;
  hydrateIcons(a);
  go('library');
  if (animate && !reduceMotion()) {
    a.classList.add('enter');
    setTimeout(() => a.classList.remove('enter'), 1400);
  }
}
async function logout() {
  if (switching) return;
  if (!await confirmDialog({ title: '¿Cerrar sesión?', text: 'Tus recursos quedan guardados en este navegador.', ok: 'Cerrar sesión', danger: false, ico: 'logout' })) return;
  await wait(230);
  switching = true;
  closeChat();
  $('#app').classList.add('leaving');
  await wait(380);
  state.user = null; save();
  $('#app').classList.remove('leaving');
  showLogin(true);
  switching = false;
}

/* ============================================================
   EVENTOS
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target;

  // cerrar menú de perfil al hacer clic fuera
  if (!t.closest('.profile-wrap')) $('#profileMenu').hidden = true;

  // navegación
  const nav = t.closest('[data-nav]');
  if (nav) { go(nav.dataset.nav); return; }

  // acciones globales
  const action = t.closest('[data-action]');
  if (action) {
    e.preventDefault();
    switch (action.dataset.action) {
      case 'upload': openUpload(); break;
      case 'open-chat': openChat(); break;
      case 'ask-query': openChat(view.query ? `Busco: ${view.query}` : undefined); break;
      case 'samples': loadSamples(); break;
      case 'wipe': wipeLibrary(); break;
      case 'clear': clearFilters(); break;
      case 'change-photo': $('#photoInput').click(); break;
      case 'drive':
        $('#driveConfirm').innerHTML = state.drive ? 'Desconectar Google Drive' : '<span class="g">G</span> Continuar con Google';
        $('#profileMenu').hidden = true; openModal('driveModal'); break;
      case 'logout': logout(); break;
    }
    return;
  }

  // descargar desde el visor
  if (t.closest('[data-vw="download"]')) { if (vwId) downloadResource(vwId); return; }

  // tarjetas de recursos
  const act = t.closest('[data-act]');
  if (act) {
    const id = act.closest('.card')?.dataset.id;
    if (act.dataset.act === 'open') openViewer(id);
    if (act.dataset.act === 'fav') toggleFav(id);
    if (act.dataset.act === 'download') downloadResource(id);
    if (act.dataset.act === 'delete') deleteResource(id);
    return;
  }

  // chips de categoría
  const cat = t.closest('[data-cat]');
  if (cat) { view.cat = cat.dataset.cat; render(); return; }

  // referencias en Crear con IA
  const ref = t.closest('[data-ref]');
  if (ref) { const id = ref.dataset.ref; view.refs.has(id) ? view.refs.delete(id) : view.refs.add(id); renderCreate(); return; }

  // formato
  const fmt = t.closest('[data-format]');
  if (fmt) { view.format = fmt.dataset.format; renderCreate(); return; }

  // plantillas de prompt
  const pc = t.closest('#promptChips .chip');
  if (pc) {
    view.format = pc.dataset.fmt; renderCreate();
    const ta = $('#genPrompt'); ta.value = pc.dataset.text; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    return;
  }

  // resultado de la propuesta
  const gen = t.closest('[data-gen]');
  if (gen && view.gen) {
    const { fmt: f, p, svg } = view.gen, slug = norm(p.headline).replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'propuesta';
    if (gen.dataset.gen === 'svg') download(new Blob([svg], { type: 'image/svg+xml' }), `${slug}.svg`);
    if (gen.dataset.gen === 'png') svgToPng(svg, f.w, f.h).then(b => download(b, `${slug}.png`)).catch(() => toast('No se pudo exportar el PNG.'));
    if (gen.dataset.gen === 'palette') { view.paletteIdx++; paintProposal(); }
    return;
  }

  // acciones dentro del chat
  const ca = t.closest('[data-chat-act]');
  if (ca) { runChatAction(ca.dataset.chatAct); return; }
  const cs = t.closest('#chatSuggest button');
  if (cs) { sendChat(cs.textContent); return; }

  // quitar adjunto de la búsqueda
  if (t.closest('#attachX')) { view.attach = null; $('#searchAttach').value = ''; updateAttachChip(); render(); return; }

  // cerrar modales
  if (t.closest('[data-close]') || t.classList.contains('modal')) { closeModal(t.closest('.modal').id); return; }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = $$('.modal').filter(m => !m.hidden).pop();            // el de más arriba
  if (open) closeModal(open.id);
  else if (!$('#chat').hidden) closeChat();
});

function bindEvents() {
  // login
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#loginEmail').value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    $('#loginError').hidden = ok;
    if (ok) login(v, 'email');
  });
  $('#googleLogin').addEventListener('click', () => login('maria.granados@empresa.com', 'google'));

  // menú
  $('#menuBtn').addEventListener('click', () => $('#app').classList.add('nav-open'));
  $('#scrim').addEventListener('click', () => $('#app').classList.remove('nav-open'));
  $('#profileBtn').addEventListener('click', e => { e.stopPropagation(); $('#profileMenu').hidden = !$('#profileMenu').hidden; });

  // foto de perfil
  $('#photoInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const url = await downscale(f, 160);
    if (url) { state.avatar = url; save(); renderProfile(); toast('Foto de perfil actualizada'); }
    e.target.value = '';
  });

  // buscador con IA
  let tm;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(tm);
    tm = setTimeout(() => { view.query = e.target.value; view.aiNote = null; if (view.name === 'library') render(); }, 220);
  });
  $('#aiSearch').addEventListener('submit', e => { e.preventDefault(); runAISearch(); });
  $('#searchAttach').addEventListener('change', e => { view.attach = e.target.files[0] || null; updateAttachChip(); if (view.attach) runAISearch(); });
  $('#clearFilters').addEventListener('click', clearFilters);
  $('#sortSelect').addEventListener('change', e => { view.sort = e.target.value; render(); });
  $('#rangeSelect').addEventListener('change', e => { view.range = +e.target.value; renderActivity(); });

  // crear con IA
  $('#genBtn').addEventListener('click', generateProposal);

  // chat
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#chatInput'); const v = i.value; i.value = ''; sendChat(v); });

  // subir recurso
  const dz = $('#dropzone');
  dz.addEventListener('click', () => $('#fileInput').click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => setPendingFile(e.dataTransfer.files[0]));
  $('#fileInput').addEventListener('change', e => setPendingFile(e.target.files[0]));
  $('#uploadForm').addEventListener('submit', publishResource);

  // confirmación y visor
  $('#cfOk').addEventListener('click', () => answerConfirm(true));
  $('#vwDownload').addEventListener('click', () => { if (vwId) downloadResource(vwId); });

  // drive (simulado)
  $('#driveConfirm').addEventListener('click', () => {
    state.drive = !state.drive;
    if (state.drive) logActivity('drive', 'Conectaste Google Drive (simulado)');
    save(); closeModal('driveModal'); renderProfile();
    toast(state.drive ? 'Google Drive conectado (simulado)' : 'Google Drive desconectado');
  });
}

/* ---------- Inicio ---------- */
hydrateIcons();
bindEvents();
// primero se cargan las portadas guardadas, luego se muestra la pantalla
loadThumbCache().catch(() => {}).then(() => {
  state.user ? showApp(true) : showLogin(true);
  hydrateThumbs();
});
