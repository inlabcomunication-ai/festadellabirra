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
window.logout = () => { sessionStorage.removeItem('ms_auth'); location.href = '/admin/login'; };

/* ── TABS ── */
window.switchTab = (name, btn) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $('panel-' + name).classList.add('active');
  if (name === 'impostazioni') loadSettings();
};

function dayLabel(id) {
  const d = (CFG.eventDays || []).find(x => x.id === id);
  return d ? d.label.charAt(0) + d.label.slice(1).toLowerCase() : (id || '—');
}

/* ── POPOLA select giorni ── */
function fillDaySelects() {
  const opts = '<option value="">Tutte</option>' +
    (CFG.eventDays || []).map(d => `<option value="${d.id}">${dayLabel(d.id)}</option>`).join('');
  $('f-day').innerHTML = opts;
  $('m-day').innerHTML = (CFG.eventDays || []).map(d => `<option value="${d.id}">${dayLabel(d.id)}</option>`).join('');
}

/* ── RENDER ── */
async function renderAll() {
  ALL = await MS.getBookings();
  updateCapacity();
  updateStats();
  applyFilters();
}

function updateCapacity() {
  const used = MS.countPeople(ALL);
  const cap = MS.capacity();
  const pct = Math.min(100, Math.round((used / cap) * 100));
  $('cap-used').textContent = used;
  $('cap-max').textContent = '/ ' + cap;
  $('cap-pct').textContent = pct + '% occupato';
  $('cap-left').textContent = Math.max(0, cap - used) + ' posti liberi';
  const fill = $('cap-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('full', used >= cap);
}

function updateStats() {
  const paid = ALL.filter(b => b.payment === 'paid');
  const due = ALL.filter(b => b.payment === 'da_saldare');
  const pending = ALL.filter(b => b.payment === 'pending');
  const income = paid.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  $('s-book').textContent = ALL.filter(b => b.payment !== 'pending').length;
  $('s-paid').textContent = paid.length;
  $('s-due').textContent = due.length;
  $('s-pending').textContent = pending.length;
  $('s-income').textContent = eur(income).replace(',00', '');
}

window.applyFilters = function () {
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
        ${b.payment !== 'paid' ? `<button class="act" onclick="markPaid('${b.id}')">✓ Paga</button>` : ''}
        <button class="act" onclick="openEdit('${b.id}')">✏️</button>
        <button class="act act--danger" onclick="delBooking('${b.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

window.clearFilters = () => { ['f-day', 'f-payment', 'f-source'].forEach(id => $(id).value = ''); $('f-search').value = ''; applyFilters(); };

/* ── AZIONI RIGA ── */
window.markPaid = async (id) => { await MS.updateBooking(id, { payment: 'paid', paidAt: new Date().toISOString() }); await renderAll(); toast('Segnata come pagata'); };
window.delBooking = async (id) => { if (!confirm('Eliminare questa prenotazione? L\'azione è irreversibile.')) return; await MS.deleteBooking(id); await renderAll(); toast('Prenotazione eliminata'); };

/* ── MODALE MODIFICA ── */
window.openEdit = (id) => {
  const b = ALL.find(x => x.id === id); if (!b) return;
  $('e-id').value = id;
  $('e-nome').value = b.nome || ''; $('e-cognome').value = b.cognome || '';
  $('e-tel').value = b.tel || ''; $('e-email').value = b.email || '';
  $('e-day').innerHTML = (CFG.eventDays || []).map(d => `<option value="${d.id}" ${d.id === b.day ? 'selected' : ''}>${dayLabel(d.id)}</option>`).join('');
  $('e-adults').value = b.adults || 0; $('e-kids').value = b.kids || 0; $('e-free').value = b.kidsFree || 0;
  $('e-payment').value = b.payment || 'paid';
  $('e-note').value = b.note || '';
  $('modal-bg').classList.add('open');
};
window.closeModal = () => $('modal-bg').classList.remove('open');
window.saveEdit = async () => {
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
};

/* ── AGGIUNTA MANUALE (telefono) ── */
window.mstep = (key, delta) => {
  const el = $('m-' + key);
  const min = key === 'adults' ? 1 : 0;
  el.value = Math.max(min, (+el.value || 0) + delta);
  recalcManual();
};
function recalcManual() {
  const a = +$('m-adults').value || 0, k = +$('m-kids').value || 0;
  $('m-total').textContent = eur(a * CFG.priceAdult + k * CFG.priceChild).replace(',00', '');
}
window.recalcManual = recalcManual;
window.addManual = async () => {
  const nome = $('m-nome').value.trim(), cognome = $('m-cognome').value.trim(), tel = $('m-tel').value.trim();
  const err = $('m-err');
  if (!nome || !cognome) { err.textContent = 'Inserisci nome e cognome.'; return; }
  if (!tel) { err.textContent = 'Inserisci il telefono.'; return; }
  err.textContent = '';
  const adults = +$('m-adults').value || 0, kids = +$('m-kids').value || 0, kidsFree = +$('m-free').value || 0;
  const people = adults + kids + kidsFree;
  const amount = adults * CFG.priceAdult + kids * CFG.priceChild;

  // controllo capienza
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
  // reset
  ['m-nome', 'm-cognome', 'm-tel', 'm-email', 'm-note'].forEach(id => $(id).value = '');
  $('m-adults').value = 1; $('m-kids').value = 0; $('m-free').value = 0; recalcManual();
  await renderAll(); toast('Prenotazione aggiunta');
};

/* ── CSV ── */
window.exportCSV = async () => {
  const bks = await MS.getBookings();
  if (!bks.length) { toast('Nessun dato da esportare'); return; }
  const H = ['Nome', 'Cognome', 'Telefono', 'Email', 'Giorno', 'Adulti', 'Bambini 6-18', 'Under 6', 'Persone', 'Importo €', 'Pagamento', 'Origine', 'Note', 'Creato il'];
  const R = bks.map(b => [b.nome, b.cognome, b.tel, b.email, b.day, b.adults, b.kids, b.kidsFree, b.people, ((b.amount || 0) / 100).toFixed(2), b.payment, b.source || 'online', b.note || '', b.createdAt]);
  const csv = [H, ...R].map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'festa_birra_prenotazioni_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
};

/* ── IMPOSTAZIONI ── */
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
}
window.saveSettings = async (group) => {
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
};

/* ── TOAST ── */
let toastT;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── INIT ── */
(async () => {
  CFG = await MS.loadCfg();
  if (MS.backend === 'local') $('localbanner').classList.remove('hidden');
  fillDaySelects();
  recalcManual();
  await renderAll();
  // aggiornamento in tempo reale (solo cloud)
  MS.onBookingsChange(bks => { ALL = bks; updateCapacity(); updateStats(); applyFilters(); });
})();
