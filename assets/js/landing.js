/* ═══════════════════════════════════════════════
   landing.js — Flusso di prenotazione Festa della Birra
   Masseria Sacramento
═══════════════════════════════════════════════ */
import { MS } from './storage.js';
import { initPixel, trackEvent } from './pixel.js';

/* ── STATO ── */
const state = { day: null, adults: 1, kids: 0, kidsFree: 0 };
let cfg = {};
let remaining = null;     // posti residui (people)

const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const $ = id => document.getElementById(id);

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', async () => {
  cfg = await MS.loadCfg();
  initPixel(cfg.pixelId);
  trackEvent('PageView');

  renderDays();
  renderTiers();
  renderHeroDate();
  bindSteppers();
  bindNav();
  await refreshAvailability();
  recalc();

  // CTA hero / nav → scroll al modulo
  document.querySelectorAll('[data-goto-prenota]').forEach(b =>
    b.addEventListener('click', () => {
      trackEvent('ClickPrenota');
      $('prenota').scrollIntoView({ behavior: 'smooth' });
    }));

  $('pay-btn').addEventListener('click', handlePay);
});

/* ── NAV scroll state ── */
function bindNav() {
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── DATA HERO ── */
function renderHeroDate() {
  const el = $('hero-date');
  if (!el) return;
  const days = cfg.eventDays || [];
  if (!days.length) return;
  // estrai i numeri del giorno dalle label (es. "17 GIUGNO" → "17")
  const nums = days.map(d => {
    const m = d.label.match(/\d+/);
    return m ? `<b>${m[0]}</b>` : d.label;
  });
  const month = days[0].label.match(/[A-Za-z]+/)?.[0] || 'giugno';
  const time = (days[0].sub || '').match(/dalle \d+:\d+/)?.[0] || 'dalle 20:30';
  const dateStr = nums.length === 1
    ? `${nums[0]} ${month.toLowerCase()}`
    : `${nums.join(' e ')} ${month.toLowerCase()}`;
  el.innerHTML = `${dateStr} <span class="hero__dot"></span> ${time}`;
}

/* ── GIORNI ── */
function renderDays() {
  const wrap = $('days');
  wrap.innerHTML = '';
  (cfg.eventDays || []).forEach((d, i) => {
    const el = document.createElement('button');
    el.className = 'day-opt' + (i === 0 ? ' active' : '');
    el.type = 'button';
    el.innerHTML = `<div class="day-opt__d">${d.label.replace(/ GIUGNO| GIU/i,'')}</div>
                    <div class="day-opt__m">${d.label.match(/[A-Za-z]+$/) ? d.label.split(' ').slice(-1) : 'GIUGNO'}</div>
                    <div class="day-opt__m">${d.sub}</div>`;
    el.onclick = () => {
      document.querySelectorAll('.day-opt').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.day = d.id;
    };
    wrap.appendChild(el);
    if (i === 0) state.day = d.id;
  });
}

/* ── TARIFFE (sezione prezzi) ── */
function renderTiers() {
  $('tier-adult-price').innerHTML = (cfg.priceAdult / 100).toFixed(0) + '<small>€</small>';
  $('tier-child-price').innerHTML = (cfg.priceChild / 100).toFixed(0) + '<small>€</small>';
  // etichette stepper
  $('q-adult-price').textContent = eur(cfg.priceAdult).replace(',00', '');
  $('q-kid-price').textContent = eur(cfg.priceChild).replace(',00', '');
}

/* ── STEPPER ── */
function bindSteppers() {
  document.querySelectorAll('.stepper').forEach(st => {
    const key = st.dataset.key;
    const min = Number(st.dataset.min || 0);
    st.querySelector('[data-act="minus"]').onclick = () => { state[key] = Math.max(min, state[key] - 1); recalc(); };
    st.querySelector('[data-act="plus"]').onclick = () => { state[key] = Math.min(50, state[key] + 1); recalc(); };
  });
}

/* ── RICALCOLO totale + pinta + righe ── */
function recalc() {
  // aggiorna i numeri nello stepper
  document.querySelectorAll('.stepper').forEach(st => {
    const key = st.dataset.key;
    const min = Number(st.dataset.min || 0);
    st.querySelector('.stepper__val').textContent = state[key];
    st.querySelector('[data-act="minus"]').disabled = state[key] <= min;
  });

  const people = state.adults + state.kids + state.kidsFree;
  const amount = state.adults * cfg.priceAdult + state.kids * cfg.priceChild;

  $('pint-amt').textContent = '€' + (amount / 100).toFixed(0);
  $('pint-people').textContent = people + (people === 1 ? ' persona' : ' persone');
  setPint(Math.min(people / 8, 1));

  // riepilogo righe
  const rows = [];
  rows.push(row('Adulti × ' + state.adults, eur(state.adults * cfg.priceAdult)));
  if (state.kids) rows.push(row('Bambini 6–18 × ' + state.kids, eur(state.kids * cfg.priceChild)));
  if (state.kidsFree) rows.push(row('Under 6 × ' + state.kidsFree, 'Gratis', true));
  $('sum-rows').innerHTML = rows.join('');
  $('sum-total').innerHTML = `<span>Totale</span><span class="gold">${eur(amount)}</span>`;

  // controllo capienza
  checkCapacityUI(people);
}
function row(l, v, muted) {
  return `<div class="sum-row${muted ? ' sum-row--muted' : ''}"><span>${l}</span><span>${v}</span></div>`;
}

/* ── PINTA (riempimento) ── */
function setPint(r) {
  r = Math.max(0, Math.min(1, r));
  const top = 18, bottom = 106, range = bottom - top;
  const h = range * r, y = bottom - h;
  const beer = $('beer'), foam = $('foam');
  beer.setAttribute('y', y); beer.setAttribute('height', h);
  if (r <= 0.001) { foam.style.opacity = 0; beer.style.opacity = 0; }
  else { foam.style.opacity = 1; beer.style.opacity = 1; foam.setAttribute('y', Math.max(top - 2, y - 5)); }
}

/* ── DISPONIBILITÀ ── */
async function refreshAvailability() {
  try {
    const bks = await MS.getBookings();
    const used = MS.countPeople(bks);
    remaining = Math.max(0, MS.capacity() - used);
  } catch (e) { remaining = null; }
  const el = $('hero-avail');
  if (remaining === null) {
    el.innerHTML = `<span class="live-dot"></span> Ingresso a <b>numero limitato</b> — prenota il tuo posto`;
  } else if (remaining <= 0) {
    el.innerHTML = `Posti <b>esauriti</b> — chiama per la lista d'attesa`;
  } else {
    el.innerHTML = `<span class="live-dot"></span> Ancora <b>${remaining}</b> posti disponibili su ${MS.capacity()}`;
  }
}

function checkCapacityUI(people) {
  const warn = $('cap-warn');
  if (remaining !== null && people > remaining) {
    warn.classList.remove('hidden');
    warn.textContent = remaining <= 0
      ? 'I posti per l\'evento sono esauriti. Chiama il numero in fondo alla pagina per la lista d\'attesa.'
      : `Restano solo ${remaining} posti: riduci il numero di persone per completare la prenotazione.`;
    $('pay-btn').disabled = true;
  } else {
    warn.classList.add('hidden');
    $('pay-btn').disabled = false;
  }
}

/* ── VALIDAZIONE ── */
function validate() {
  const err = $('pay-err');
  const nome = $('f-nome').value.trim();
  const cognome = $('f-cognome').value.trim();
  const tel = $('f-tel').value.trim();
  const email = $('f-email').value.trim();
  if (!state.day) { err.textContent = 'Scegli la serata.'; return null; }
  if (!nome || !cognome) { err.textContent = 'Inserisci nome e cognome.'; return null; }
  if (!/^[\d\s+().-]{6,}$/.test(tel)) { err.textContent = 'Inserisci un numero di telefono valido.'; return null; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'L\'email non sembra valida.'; return null; }
  if (!$('f-privacy').checked) { err.textContent = 'Accetta il trattamento dei dati per procedere.'; return null; }
  if (state.adults < 1) { err.textContent = 'È richiesto almeno un adulto nella prenotazione.'; return null; }
  err.textContent = '';
  return { nome, cognome, tel, email };
}

/* ── PAGAMENTO ── */
async function handlePay() {
  const data = validate();
  if (!data) return;

  const people = state.adults + state.kids + state.kidsFree;
  const amount = state.adults * cfg.priceAdult + state.kids * cfg.priceChild;

  // ricontrolla capienza in tempo reale
  await refreshAvailability();
  if (remaining !== null && people > remaining) { recalc(); return; }

  const btn = $('pay-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Attendere…';

  const booking = {
    ...data,
    day: state.day,
    adults: state.adults, kids: state.kids, kidsFree: state.kidsFree,
    people, amount,
    payment: 'pending', source: 'online',
    note: '', createdAt: new Date().toISOString(),
  };

  let bid = '';
  try { bid = await MS.addBooking(booking); } catch (e) { bid = 'tmp_' + Date.now(); }

  const params = new URLSearchParams({
    bid, nome: data.nome, cognome: data.cognome, tel: data.tel,
    day: state.day, adults: state.adults, kids: state.kids, kidsFree: state.kidsFree,
    amount,
  });
  const successUrl = window.location.origin + '/grazie?' + params.toString();
  const cancelUrl = window.location.origin + '/#prenota';

  localStorage.setItem('ms_pending', JSON.stringify({ bid, ...booking }));
  trackEvent('InitiateCheckout', { value: amount / 100, currency: 'EUR', num_items: people });

  // 1) Stripe Checkout via serverless function
  const items = [];
  if (state.adults > 0 && cfg.stripePriceAdult) items.push({ price: cfg.stripePriceAdult, quantity: state.adults });
  if (state.kids > 0 && cfg.stripePriceChild) items.push({ price: cfg.stripePriceChild, quantity: state.kids });

  if (cfg.stripePk && items.length) {
    try {
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adulti: state.adults,
          bambini: state.kids,
          nome: data.nome,
          telefono: data.tel,
          priceAdult: cfg.stripePriceAdult,
          priceChild: cfg.stripePriceChild,
          successUrl,
          cancelUrl,
        }),
      });
      const result = await resp.json();
      if (result.url) { window.location.href = result.url; return; }
      throw new Error(result.error || 'Errore server');
    } catch (e) {
      $('pay-err').textContent = 'Pagamento non disponibile: ' + (e.message || 'errore Stripe') + '. La prenotazione è stata registrata, ti ricontatteremo.';
    }
  } else if (cfg.paymentLink) {
    // 2) Payment Link generico
    window.location.href = cfg.paymentLink + (cfg.paymentLink.includes('?') ? '&' : '?') +
      'client_reference_id=' + encodeURIComponent(bid);
    return;
  } else {
    // 3) Nessun pagamento configurato → prenota e salda in struttura
    window.location.href = successUrl + '&unpaid=1';
    return;
  }

  // ripristina pulsante in caso di errore
  btn.disabled = false;
  btn.innerHTML = 'Paga e prenota';
}
