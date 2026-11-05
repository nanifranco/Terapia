'use strict';

/* ---------- Íconos (dentro de la app, funcionan sin internet) ---------- */
const ICONS = {
  'check': '<path d="M5 12l5 5l10 -10"/>',
  'trash': '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
  'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>',
  'dots': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'chevron-down': '<path d="M6 9l6 6l6 -6"/>',
  'arrow-back-up': '<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>',
  'download': '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4v12"/>',
  'upload': '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4v12"/>',
  'face-id': '<path d="M4 8v-2a2 2 0 0 1 2 -2h2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M16 20h2a2 2 0 0 0 2 -2v-2"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/>',
};
const ic = (name) =>
  `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
document.querySelectorAll('span[data-icon]').forEach((el) => {
  el.outerHTML = ic(el.dataset.icon);
});

/* ---------- Datos (solo en este teléfono) ---------- */
const DATA_KEY = 'terapia.data.v1';
const CRED_KEY = 'terapia.credId';

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(DATA_KEY));
    if (d && Array.isArray(d.items)) return d;
  } catch (_) {}
  return { items: [] };
}
function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}
let data = null; // se carga solo después de desbloquear

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Elementos ---------- */
const $ = (id) => document.getElementById(id);
const lockEl = $('lock'), appEl = $('app');
const listEl = $('list'), emptyEl = $('empty');
const habBtn = $('habBtn'), habList = $('habList');
const toastEl = $('toast'), toastMsg = $('toastMsg'), undoBtn = $('undoBtn');
const inp = $('inp'), addErr = $('addErr');

/* ---------- Face ID (passkey de WebAuthn) como puerta ---------- */
const b64u = {
  enc(buf) {
    let s = ''; new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

function setLockUI({ msg, btn, err = '', busy = false }) {
  if (msg) $('lockMsg').textContent = msg;
  if (btn) $('unlockBtn').textContent = btn;
  $('lockErr').textContent = err;
  $('unlockBtn').disabled = busy;
  $('fid').classList.toggle('scanning', busy);
}

function refreshLockScreen() {
  if (!window.PublicKeyCredential) {
    setLockUI({ msg: 'Este navegador no permite Face ID', btn: 'No disponible', err: 'Ábrela desde Safari en tu iPhone.' });
    $('unlockBtn').disabled = true;
    return;
  }
  if (localStorage.getItem(CRED_KEY)) {
    setLockUI({ msg: 'Solo tú puedes abrirla', btn: 'Desbloquear con Face ID' });
  } else {
    setLockUI({ msg: 'La primera vez se crea una llave con tu Face ID', btn: 'Activar Face ID' });
  }
}

async function setupFaceId() {
  const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
  if (ok === false) throw new Error('nofaceid');
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'Terapia' },
      user: { id: rand(16), name: 'Terapia', displayName: 'Terapia' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  localStorage.setItem(CRED_KEY, b64u.enc(cred.rawId));
}

async function verifyFaceId() {
  const id = localStorage.getItem(CRED_KEY);
  await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: 'public-key', id: b64u.dec(id) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

$('unlockBtn').addEventListener('click', async () => {
  const firstTime = !localStorage.getItem(CRED_KEY);
  setLockUI({ busy: true, btn: 'Verificando…' });
  try {
    if (firstTime) await setupFaceId();
    else await verifyFaceId();
    unlock();
  } catch (e) {
    refreshLockScreen();
    const msg =
      e && e.message === 'nofaceid' ? 'Este dispositivo no tiene Face ID disponible.' :
      e && e.name === 'NotAllowedError' ? 'No se pudo verificar. Intenta otra vez.' :
      'Algo falló. Intenta otra vez.';
    $('lockErr').textContent = msg;
  }
});

function unlock() {
  data = loadData();
  lockEl.hidden = true;
  appEl.hidden = false;
  renderAll();
}

function lock() {
  // Se borra todo de la pantalla: sin Face ID no queda nada a la vista
  data = null;
  listEl.innerHTML = '';
  habList.innerHTML = '';
  habList.hidden = true;
  habBtn.setAttribute('aria-expanded', 'false');
  hideToast();
  closeSheet();
  inp.value = '';
  appEl.hidden = true;
  lockEl.hidden = false;
  refreshLockScreen();
}

$('lockBtn').addEventListener('click', lock);
// Se bloquea solita al salir de la app o apagar la pantalla
document.addEventListener('visibilitychange', () => { if (document.hidden && data) lock(); });
window.addEventListener('pagehide', () => { if (data) lock(); });

/* ---------- Fecha ---------- */
function renderDate() {
  const d = new Date();
  const dia = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const mes = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  $('today').textContent = `${dia} ${String(d.getDate()).padStart(2, '0')} · ${mes}`;
}

/* ---------- Render ---------- */
const pending = () => data.items.filter((i) => i.status === 'pending');
const talked = () => data.items.filter((i) => i.status === 'done').sort((a, b) => b.doneAt - a.doneAt);

function itemHTML() {
  return `<span class="num"></span><span class="tx"></span>
    <button class="ck" aria-label="Ya lo hablé">${ic('check')}</button>
    <button class="tr" aria-label="Remover">${ic('trash')}</button>`;
}

function renderList() {
  listEl.innerHTML = '';
  pending().forEach((it) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = it.id;
    li.innerHTML = itemHTML();
    li.querySelector('.tx').textContent = it.text;
    listEl.appendChild(li);
  });
  renumber();
}

function renumber() {
  [...listEl.children].forEach((li, i) => {
    const n = li.querySelector('.num');
    if (n) n.textContent = String(i + 1).padStart(2, '0');
  });
  emptyEl.hidden = listEl.children.length > 0;
}

function renderHab() {
  habList.innerHTML = '';
  if (habList.hidden) return;
  const items = talked();
  if (!items.length) {
    habList.innerHTML = '<li class="hab-empty">Aquí aparecen cuando les pongas palomita</li>';
    return;
  }
  items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'hab-item';
    li.dataset.id = it.id;
    li.innerHTML = `<span class="tx serif"></span>
      <button class="mini" data-act="back" aria-label="Regresar a la lista">${ic('arrow-back-up')}</button>
      <button class="mini" data-act="del" aria-label="Remover">${ic('trash')}</button>`;
    li.querySelector('.tx').textContent = it.text;
    habList.appendChild(li);
  });
}

function renderAll() {
  renderDate();
  renderList();
  renderHab();
}

/* ---------- Acciones de la lista ---------- */
let lastDone = null, toastTimer = null;

function showToast(msg) {
  toastMsg.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4500);
}
function hideToast() { toastEl.hidden = true; lastDone = null; }

listEl.addEventListener('click', (e) => {
  const li = e.target.closest('.item');
  if (!li || !data) return;
  const it = data.items.find((x) => x.id === li.dataset.id);
  if (!it) return;

  if (e.target.closest('.ck')) {
    e.target.closest('.ck').classList.add('on');
    setTimeout(() => {
      li.classList.add('out');
      setTimeout(() => {
        it.status = 'done';
        it.doneAt = Date.now();
        saveData();
        li.remove();
        renumber();
        renderHab();
        lastDone = it.id;
        showToast('Movido a ya hablados');
      }, 350);
    }, 220);
    return;
  }

  if (e.target.closest('.tr')) {
    li.innerHTML = `<span class="confirm">¿Remover?</span>
      <button class="pill pill-line" data-act="no">No</button>
      <button class="pill pill-red" data-act="si">Sí</button>`;
    return;
  }

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'no') {
    li.innerHTML = itemHTML();
    li.querySelector('.tx').textContent = it.text;
    renumber();
  } else if (act === 'si') {
    li.classList.add('out');
    setTimeout(() => {
      data.items = data.items.filter((x) => x.id !== it.id);
      saveData();
      li.remove();
      renumber();
    }, 350);
  }
});

undoBtn.addEventListener('click', () => {
  if (!lastDone || !data) return;
  const it = data.items.find((x) => x.id === lastDone);
  if (it) { it.status = 'pending'; delete it.doneAt; saveData(); }
  hideToast();
  renderList();
  renderHab();
});

habBtn.addEventListener('click', () => {
  const open = habList.hidden;
  habList.hidden = !open;
  habBtn.setAttribute('aria-expanded', String(open));
  renderHab();
});

habList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  const li = e.target.closest('.hab-item');
  if (!btn || !li || !data) return;
  const it = data.items.find((x) => x.id === li.dataset.id);
  if (!it) return;
  if (btn.dataset.act === 'back') {
    it.status = 'pending'; delete it.doneAt;
    // regresa al final de la lista de pendientes
    data.items = data.items.filter((x) => x !== it).concat(it);
    saveData(); renderList(); renderHab();
  } else if (btn.dataset.act === 'del') {
    li.innerHTML = `<span class="confirm" style="font-size:16px">¿Remover?</span>
      <button class="pill pill-line" data-act="no">No</button>
      <button class="pill pill-red" data-act="si">Sí</button>`;
  } else if (btn.dataset.act === 'no') {
    renderHab();
  } else if (btn.dataset.act === 'si') {
    data.items = data.items.filter((x) => x.id !== it.id);
    saveData(); renderHab();
  }
});

/* ---------- Agregar ---------- */
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inp.value.trim();
  if (!text) { addErr.textContent = 'Escribe algo primero'; return; }
  data.items.push({ id: uid(), text, created: Date.now(), status: 'pending' });
  saveData();
  inp.value = '';
  renderList();
  listEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
inp.addEventListener('input', () => (addErr.textContent = ''));

/* ---------- Reordenar: mantener presionado y arrastrar ---------- */
let drag = null, holdTimer = null, startX = 0, startY = 0;

listEl.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('.item');
  if (!li || e.target.closest('button') || !li.querySelector('.ck')) return;
  startX = e.clientX; startY = e.clientY;
  const pid = e.pointerId;
  holdTimer = setTimeout(() => {
    drag = { li, startY, pid };
    li.classList.add('lift');
    li.style.transform = 'scale(1.04)';
    try { li.setPointerCapture(pid); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(10);
  }, 380);
});

document.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (holdTimer && (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8)) {
      clearTimeout(holdTimer); holdTimer = null;
    }
    return;
  }
  const li = drag.li;
  let dy = e.clientY - drag.startY;
  li.style.transform = `translateY(${dy}px) scale(1.04)`;
  const center = li.offsetTop + li.offsetHeight / 2 + dy;
  let before = null;
  for (const o of listEl.children) {
    if (o === li) continue;
    if (center < o.offsetTop + o.offsetHeight / 2) { before = o; break; }
  }
  const moved = (before && before !== li.nextSibling) || (!before && li !== listEl.lastElementChild);
  if (moved) {
    const old = li.offsetTop;
    listEl.insertBefore(li, before);
    drag.startY += li.offsetTop - old;
    dy = e.clientY - drag.startY;
    li.style.transform = `translateY(${dy}px) scale(1.04)`;
    renumber();
  }
});

// Mientras arrastras, la pantalla no se desplaza
document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
listEl.addEventListener('contextmenu', (e) => e.preventDefault());

function endDrag() {
  clearTimeout(holdTimer); holdTimer = null;
  if (!drag) return;
  const li = drag.li;
  li.classList.remove('lift');
  li.style.transform = '';
  drag = null;
  // guardar el nuevo orden
  const order = [...listEl.children].map((x) => x.dataset.id);
  const byId = new Map(data.items.map((x) => [x.id, x]));
  const rest = data.items.filter((x) => x.status !== 'pending');
  data.items = order.map((id) => byId.get(id)).filter(Boolean).concat(rest);
  saveData();
  renumber();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- Respaldo ---------- */
const sheet = $('sheet');
function closeSheet() { sheet.hidden = true; }
$('menuBtn').addEventListener('click', () => (sheet.hidden = false));
$('closeSheet').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

$('exportBtn').addEventListener('click', async () => {
  if (!data) return;
  const payload = JSON.stringify({ app: 'Terapia', version: 1, exportedAt: new Date().toISOString(), items: data.items }, null, 2);
  const name = `terapia-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([payload], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Respaldo de Terapia' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  } catch (_) { /* cancelado */ }
  closeSheet();
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !data) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.items)) throw new Error();
    if (!confirm('Esto reemplaza tu lista actual con la del respaldo. ¿Continuar?')) return;
    data.items = d.items
      .filter((x) => x && typeof x.text === 'string')
      .map((x) => ({
        id: x.id || uid(),
        text: x.text,
        created: x.created || Date.now(),
        status: x.status === 'done' ? 'done' : 'pending',
        ...(x.status === 'done' ? { doneAt: x.doneAt || Date.now() } : {}),
      }));
    saveData();
    renderAll();
    closeSheet();
  } catch (_) {
    alert('Ese archivo no parece un respaldo de Terapia.');
  }
});

/* ---------- Inicio ---------- */
refreshLockScreen();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
