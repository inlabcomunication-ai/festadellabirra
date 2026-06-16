/* ═══════════════════════════════════════════════
   dashboard.js — Logica area staff
   Masseria Sacramento · Festa della Birra
═══════════════════════════════════════════════ */
import { MS } from './storage.js';

const $ = id => document.getElementById(id);
const eur = c => '€ ' + ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
let CFG = {};
let ALL = [];

/* ── AUTH ── */
if (sessionStorage.getItem('ms_auth') !== '1') location.href = '/admin/login';

/* ── TABS ── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $('panel-' + name).classList.add('active');
  if (name === 'impostazioni') loadSettings();
}

function dayLabel(id) {
  const d = (CFG.eventDays || []).find(x => x.id === id);
  return d ? d.label.charAt(0) + d.label.slice(1).toLowerCase() : (id || '—');
}

function fillDaySelects() {
  const opts = '<option value="">Tutte</option>' +
    (CFG.eventDays || []).map(d => `<option value="${d.id}">${dayLabel(d.id)}</option>`).join('');
  $('f-day').innerHTML = opts;
  $('m-day').innerHTML = (CFG.eventDays || []).map(d => `<option value="${d.id}">${dayLabel(d.id)}</option>`).join('');
}

async function renderAll() {
  ALL = await MS.getBookings();
  updateCapacity();
  updateStats();
  applyFilters();
}

function getFilteredByDay() {
  const fd = $('f-day').value;
  return fd ? ALL.filter(b => b.day === fd) : ALL;
}

function updateCapacity() {
  const fd = $('f-day').value;
  const bks = getFilteredByDay();
  const used = MS.countPeople(bks);
  const cap = MS.capacity();
  const pct = Math.min(100, Math.round((used / cap) * 100));
  $('cap-used').textContent = used;
  $('cap-max').textContent = fd ? '(serata selezionata)' : '/ ' + cap;
  $('cap-pct').textContent = fd ? '' : pct + '% occupato';
  $('cap-left').textContent = fd ? '' : Math.max(0, cap - used) + ' posti liberi';
  const fill = $('cap-fill');
  fill.style.width = fd ? '0%' : pct + '%';
  fill.classList.toggle('full', !fd && used >= cap);
}

function updateStats() {
  const bks = getFilteredByDay();
  const paid = bks.filter(b => b.payment === 'paid');
  const due = bks.filter(b => b.payment === 'da_saldare');
  const pending = bks.filter(b => b.payment === 'pending');
  const income = paid.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  $('s-book').textContent = ALL.filter(b => b.payment !== 'pending').length;
  $('s-paid').textContent = paid.length;
  $('s-due').textContent = due.length;
  $('s-pending').textContent = pending.length;
  $('s-income').textContent = eur(income).replace(',00', '');
}

function applyFilters() {
  updateCapacity();
  updateStats();
  let bks = [...ALL];
  const fd = $('f-day').value, fp = $('f-payment').value, fs = $('f-source').value, ft = $('f-search').value.trim().toLowerCase();
  if (fd) bks = bks.filter(b => b.day === fd);
  if (fp) bks = bks.filter(b => b.payment === fp);
  if (fs) bks = bks.filter(b => (b.source || 'online') === fs);
  if (ft) bks = bks.filter(b => ((b.nome || '') + ' ' + (b.cognome || '') + ' ' + (b.tel || '')).toLowerCase().includes(ft));
  const tb = $('tbody');
  if (!bks.length) { tb.innerHTML = '<tr><td colspan="11" class="empty">Nessuna prenotazione trovata.</td></tr>'; return; }
  tb.innerHTML = bks.map((b, i) => {
    const pm = { paid: ['badge--paid', 'Pagato'], da_saldare: ['badge--due', 'Da saldare'], pending: ['badge--pending', 'In attesa'], failed: ['badge--pending', 'Fallito'] }[b.payment] || ['badge--pending', '—'];
    const src = (b.source === 'manuale') ? ['badge--manual', 'Telefono'] : ['badge--online', 'Online'];
    const dt = b.createdAt ? new Date(b.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(b.nome)} ${esc(b.cognome)}</strong><br><span style="color:var(--muted);font-size:.78rem">${esc(b.email || '')}</span></td>
      <td>${esc(b.tel || '—')}</td>
      <td>${dayLabel(b.day)}</td>
      <td>${b.adults || 0} ad · ${b.kids || 0} bm · ${b.kidsFree || 0} u6<br><strong>${b.people || 0} pers.</strong></td>
      <td><strong>${eur(b.amount).replace(',00', '')}</strong></td>
      <td><span class="badge ${pm[0]}">${pm[1]}</span></td>
      <td><span class="badge ${src[0]}">${src[1]}</span></td>
      <td style="font-size:.76rem;color:var(--muted)">${dt}</td>
      <td>
        ${b.payment !== 'paid' ? `<button class="act" data-action="markpaid" data-id="${b.id}">✓ Paga</button>` : ''}
        <button class="act" data-action="edit" data-id="${b.id}">✏️</button>
        <button class="act act--danger" data-action="delete" data-id="${b.id}">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function clearFilters() {
  ['f-day', 'f-payment', 'f-source'].forEach(id => $(id).value = '');
  $('f-search').value = '';
  applyFilters();
}

async function markPaid(id) { await MS.updateBooking(id, { payment: 'paid', paidAt: new Date().toISOString() }); await renderAll(); toast('Segnata come pagata'); }
async function delBooking(id) { if (!confirm('Eliminare questa prenotazione?')) return; await MS.deleteBooking(id); await renderAll(); toast('Prenotazione eliminata'); }

function openEdit(id) {
  const b = ALL.find(x => x.id === id); if (!b) return;
  $('e-id').value = id;
  $('e-nome').value = b.nome || ''; $('e-cognome').value = b.cognome || '';
  $('e-tel').value = b.tel || ''; $('e-email').value = b.email || '';
  $('e-day').innerHTML = (CFG.eventDays || []).map(d => `<option value="${d.id}" ${d.id === b.day ? 'selected' : ''}>${dayLabel(d.id)}</option>`).join('');
  $('e-adults').value = b.adults || 0; $('e-kids').value = b.kids || 0; $('e-free').value = b.kidsFree || 0;
  $('e-payment').value = b.payment || 'paid';
  $('e-note').value = b.note || '';
  $('modal-bg').classList.add('open');
}
function closeModal() { $('modal-bg').classList.remove('open'); }
async function saveEdit() {
  const id = $('e-id').value;
  const adults = +$('e-adults').value || 0, kids = +$('e-kids').value || 0, kidsFree = +$('e-free').value || 0;
  await MS.updateBooking(id, {
    nome: $('e-nome').value.trim(), cognome: $('e-cognome').value.trim(),
    tel: $('e-tel').value.trim(), email: $('e-email').value.trim(),
    day: $('e-day').value, adults, kids, kidsFree, people: adults + kids + kidsFree,
    amount: adults * CFG.priceAdult + kids * CFG.priceChild,
    payment: $('e-payment').value, note: $('e-note').value.trim(),
  });
  closeModal(); await renderAll(); toast('Modifiche salvate');
}

function mstep(key, delta) {
  const el = $('m-' + key);
  const min = key === 'adults' ? 1 : 0;
  el.value = Math.max(min, (+el.value || 0) + delta);
  recalcManual();
}

function recalcManual() {
  const a = +$('m-adults').value || 0, k = +$('m-kids').value || 0;
  $('m-total').textContent = eur(a * CFG.priceAdult + k * CFG.priceChild).replace(',00', '');
}

async function addManual() {
  const nome = $('m-nome').value.trim(), cognome = $('m-cognome').value.trim(), tel = $('m-tel').value.trim();
  const err = $('m-err');
  if (!nome || !cognome) { err.textContent = 'Inserisci nome e cognome.'; return; }
  if (!tel) { err.textContent = 'Inserisci il telefono.'; return; }
  err.textContent = '';
  const adults = +$('m-adults').value || 0, kids = +$('m-kids').value || 0, kidsFree = +$('m-free').value || 0;
  const people = adults + kids + kidsFree;
  const amount = adults * CFG.priceAdult + kids * CFG.priceChild;
  const used = MS.countPeople(ALL);
  if (used + people > MS.capacity()) {
    if (!confirm(`Attenzione: superi la capienza (${used + people}/${MS.capacity()}). Aggiungere comunque?`)) return;
  }
  await MS.addBooking({
    nome, cognome, tel, email: $('m-email').value.trim(),
    day: $('m-day').value, adults, kids, kidsFree, people, amount,
    payment: $('m-payment').value, source: 'manuale',
    note: $('m-note').value.trim(), createdAt: new Date().toISOString(),
    paidAt: $('m-payment').value === 'paid' ? new Date().toISOString() : '',
  });
  ['m-nome', 'm-cognome', 'm-tel', 'm-email', 'm-note'].forEach(id => $(id).value = '');
  $('m-adults').value = 1; $('m-kids').value = 0; $('m-free').value = 0; recalcManual();
  await renderAll(); toast('Prenotazione aggiunta');
}

async function exportCSV() {
  const bks = await MS.getBookings();
  if (!bks.length) { toast('Nessun dato da esportare'); return; }
  const H = ['Nome', 'Cognome', 'Telefono', 'Email', 'Giorno', 'Adulti', 'Bambini 6-18', 'Under 6', 'Persone', 'Importo €', 'Pagamento', 'Origine', 'Note', 'Creato il'];
  const R = bks.map(b => [b.nome, b.cognome, b.tel, b.email, b.day, b.adults, b.kids, b.kidsFree, b.people, ((b.amount || 0) / 100).toFixed(2), b.payment, b.source || 'online', b.note || '', b.createdAt]);
  const csv = [H, ...R].map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'festa_birra_prenotazioni_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

function loadSettings() {
  const c = CFG;
  $('cfg-capacity').value = c.capacity || 800;
  $('cfg-adult').value = (c.priceAdult || 0) / 100;
  $('cfg-child').value = (c.priceChild || 0) / 100;
  $('cfg-pk').value = c.stripePk || '';
  $('cfg-pa').value = c.stripePriceAdult || '';
  $('cfg-pc').value = c.stripePriceChild || '';
  $('cfg-link').value = c.paymentLink || '';
  $('cfg-phone').value = c.contactPhone || '';
  $('cfg-pixel').value = c.pixelId || '';
  $('cfg-pw').value = c.adminPw || '';
  renderDaysList();
}

function renderDaysList() {
  const days = CFG.eventDays || [];
  $('days-list').innerHTML = days.length ? days.map((d, i) => `
    <div style="display:flex;align-items:center;gap:.8rem;background:var(--malt);border:1px solid var(--line);border-radius:10px;padding:.6rem 1rem">
      <span style="flex:1;font-family:'Oswald',sans-serif;font-size:.85rem">${d.label}</span>
      <span style="flex:2;color:var(--muted);font-size:.8rem">${d.sub}</span>
      <span style="color:var(--muted);font-size:.78rem">${d.id}</span>
      <button class="act act--danger" data-action="removeday" data-idx="${i}">🗑</button>
    </div>`).join('') : '<p class="note">Nessuna data configurata.</p>';
}

async function saveSettings(group) {
  const data = {};
  if (group === 'event') {
    data.capacity = Math.max(1, +$('cfg-capacity').value || 800);
    data.priceAdult = Math.round((+$('cfg-adult').value || 0) * 100);
    data.priceChild = Math.round((+$('cfg-child').value || 0) * 100);
    data.contactPhone = $('cfg-phone').value.trim();
  }
  if (group === 'stripe') {
    data.stripePk = $('cfg-pk').value.trim();
    data.stripePriceAdult = $('cfg-pa').value.trim();
    data.stripePriceChild = $('cfg-pc').value.trim();
    data.paymentLink = $('cfg-link').value.trim();
  }
  if (group === 'pixel') data.pixelId = $('cfg-pixel').value.trim();
  if (group === 'auth') data.adminPw = $('cfg-pw').value.trim() || 'sacramento2026';
  await MS.saveCfg(data);
  CFG = MS.cfg();
  fillDaySelects(); recalcManual(); updateCapacity();
  const ind = $('si-' + group); if (ind) { ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 1600); }
}

let toastT;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── EVENT LISTENERS ── */
document.addEventListener('DOMContentLoaded', () => {
  // logout
  const btnLogout = $('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', () => { sessionStorage.removeItem('ms_auth'); location.href = '/admin/login'; });

  // tabs
  const tabs = [
    ['tab-prenotazioni', 'prenotazioni'],
    ['tab-manuale', 'manuale'],
    ['tab-impostazioni', 'impostazioni'],
  ];
  tabs.forEach(([id, name]) => {
    const el = $(id);
    if (el) el.addEventListener('click', function() { switchTab(name, this); });
  });

  // filtri
  ['f-day', 'f-payment', 'f-source'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('change', applyFilters);
  });
  const fs = $('f-search'); if (fs) fs.addEventListener('input', applyFilters);

  // reset e csv
  const btnReset = $('btn-reset'); if (btnReset) btnReset.addEventListener('click', clearFilters);
  const btnCsv = $('btn-csv'); if (btnCsv) btnCsv.addEventListener('click', exportCSV);

  // azioni tabella (delegazione)
  const tbody = $('tbody');
  if (tbody) tbody.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'markpaid') await markPaid(id);
    if (action === 'edit') openEdit(id);
    if (action === 'delete') await delBooking(id);
  });

  // manuale
  const btnAddManual = $('btn-add-manual'); if (btnAddManual) btnAddManual.addEventListener('click', addManual);
  document.querySelectorAll('.mstep').forEach(wrap => {
    const input = wrap.querySelector('input');
    const key = input ? input.id.replace('m-', '') : null;
    if (!key) return;
    wrap.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => mstep(key, btn.textContent.trim() === '+' ? 1 : -1));
    });
    input.addEventListener('input', recalcManual);
  });

  // impostazioni
  const btnSaveEvent = $('btn-save-event'); if (btnSaveEvent) btnSaveEvent.addEventListener('click', () => saveSettings('event'));
  const btnSaveStripe = $('btn-save-stripe'); if (btnSaveStripe) btnSaveStripe.addEventListener('click', () => saveSettings('stripe'));
  const btnSavePixel = $('btn-save-pixel'); if (btnSavePixel) btnSavePixel.addEventListener('click', () => saveSettings('pixel'));
  const btnSaveAuth = $('btn-save-auth'); if (btnSaveAuth) btnSaveAuth.addEventListener('click', () => saveSettings('auth'));

  // modale
  const btnDeleteAll = $('btn-delete-all');
  if (btnDeleteAll) btnDeleteAll.addEventListener('click', async () => {
    const days = CFG.eventDays || [];
    const options = days.map(d => `"${d.label}"`).join(', ');
    const choice = prompt(`Elimina prenotazioni di quale serata?\nScrivi: 17, 18, oppure tutto\n(Serate disponibili: ${options})`);
    if (!choice) return;
    const val = choice.trim().toLowerCase();
    let toDelete;
    if (val === 'tutto') {
      toDelete = ALL;
    } else {
      const match = days.find(d => d.label.includes(val) || d.id.includes(val));
      if (!match) { alert('Serata non trovata. Scrivi 17, 18 o tutto.'); return; }
      toDelete = ALL.filter(b => b.day === match.id);
    }
    if (!toDelete.length) { alert('Nessuna prenotazione trovata.'); return; }
    if (!confirm(`Eliminare ${toDelete.length} prenotazioni? L'azione è irreversibile.`)) return;
    for (const b of toDelete) await MS.deleteBooking(b.id);
    await renderAll();
    toast(`${toDelete.length} prenotazioni eliminate`);
  });
  const btnCloseModal = $('btn-close-modal'); if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  // gestione date
  const btnAddDay = $('btn-add-day');
  if (btnAddDay) btnAddDay.addEventListener('click', () => {
    const id = $('new-day-id').value.trim();
    const label = $('new-day-label').value.trim().toUpperCase();
    const sub = $('new-day-sub').value.trim();
    if (!id || !label) { alert('Inserisci data ed etichetta.'); return; }
    if ((CFG.eventDays || []).find(d => d.id === id)) { alert('Data già presente.'); return; }
    CFG.eventDays = [...(CFG.eventDays || []), { id, label, sub }];
    renderDaysList();
    $('new-day-id').value = ''; $('new-day-label').value = ''; $('new-day-sub').value = '';
  });

  const daysList = $('days-list');
  if (daysList) daysList.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="removeday"]');
    if (!btn) return;
    const idx = +btn.dataset.idx;
    CFG.eventDays = (CFG.eventDays || []).filter((_, i) => i !== idx);
    renderDaysList();
  });

  const btnSaveDays = $('btn-save-days');
  if (btnSaveDays) btnSaveDays.addEventListener('click', async () => {
    await MS.saveCfg({ eventDays: CFG.eventDays || [] });
    CFG = MS.cfg();
    fillDaySelects();
    const ind = $('si-days'); if (ind) { ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 1600); }
    toast('Date salvate — la landing si aggiornerà automaticamente');
  });
});

/* ── INIT ── */
(async () => {
  CFG = await MS.loadCfg();
  if (MS.backend === 'local') $('localbanner').classList.remove('hidden');
  fillDaySelects();
  recalcManual();
  await renderAll();
  MS.onBookingsChange(bks => { ALL = bks; updateCapacity(); updateStats(); applyFilters(); });
})();
