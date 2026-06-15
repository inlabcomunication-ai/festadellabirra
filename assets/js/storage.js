/* ═══════════════════════════════════════════════
   storage.js — Dati: Firebase Firestore + fallback localStorage
   Masseria Sacramento · Festa della Birra
   ───────────────────────────────────────────────
   ⚠️  PER FUNZIONARE SU PIÙ DISPOSITIVI (clienti + staff)
       inserisci la TUA configurazione Firebase qui sotto.
       Senza Firebase il sito funziona comunque, ma i dati restano
       solo nel browser in uso (utile per prova/demo).
   Crea un progetto gratis su https://console.firebase.google.com
   → Firestore Database → copia la config nel blocco qui sotto.
═══════════════════════════════════════════════ */

// ── INCOLLA QUI LA TUA CONFIG FIREBASE ───────────
const firebaseConfig = {
  apiKey:            "AIzaSyCMnr5Ptx1a41R2sGH73lI3EtrUN41lmU8",
  authDomain:        "festa-della-birra-sacramento.firebaseapp.com",
  projectId:         "festa-della-birra-sacramento",
  storageBucket:     "festa-della-birra-sacramento.firebasestorage.app",
  messagingSenderId: "95344877116",
  appId:             "1:95344877116:web:68e8656345697fae1b6d39"
};
// ──────────────────────────────────────────────────

const CONFIGURED = !firebaseConfig.projectId.startsWith("INSERISCI");

const LS = { bookings: 'ms_bookings', cfg: 'ms_cfg' };

const DEFAULT_CFG = {
  capacity:      800,
  priceAdult:    1500,   // centesimi (15,00 €)
  priceChild:    1000,   // centesimi (10,00 €)
  eventDays: [
    { id: '2026-06-17', label: '17 GIUGNO', sub: 'Mercoledì · dalle 20:30' },
    { id: '2026-06-18', label: '18 GIUGNO', sub: 'Giovedì · dalle 20:30' },
  ],
  stripePk:          '',
  stripePriceAdult:  '',
  stripePriceChild:  '',
  paymentLink:       '',
  pixelId:           '',
  adminPw:           'sacramento2026',
  contactPhone:      '328 143 3143',
  address:           'C.da Sacramento S.S. 7 — Palagianello (TA)',
};

// Riferimenti Firestore (popolati solo se Firebase è disponibile)
let fb = null; // null = non inizializzato, false = non disponibile, oggetto = pronto

async function ensureFirebase() {
  if (fb !== null || !CONFIGURED) return fb;
  try {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app = appMod.initializeApp(firebaseConfig);
    fb = { db: fs.getFirestore(app), fns: fs };
    MS.backend = 'cloud';
  } catch (e) {
    fb = false; // import fallito → resta in locale
    MS.backend = 'local';
  }
  return fb;
}

const lsGet = () => JSON.parse(localStorage.getItem(LS.bookings) || '[]');
const lsSet = (a) => localStorage.setItem(LS.bookings, JSON.stringify(a));

export const MS = {
  backend: 'local',
  _cfg: { ...DEFAULT_CFG },

  /* ── CONFIG ── */
  async loadCfg() {
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { doc, getDoc } = f.fns;
      const snap = await getDoc(doc(f.db, 'config', 'main'));
      MS._cfg = { ...DEFAULT_CFG, ...(snap.exists() ? snap.data() : {}) };
      MS.backend = 'cloud';
    } catch (e) {
      MS.backend = 'local';
      MS._cfg = { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(LS.cfg) || '{}') };
    }
    return MS._cfg;
  },
  cfg() { return MS._cfg; },
  async saveCfg(data) {
    MS._cfg = { ...MS._cfg, ...data };
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { doc, setDoc } = f.fns;
      await setDoc(doc(f.db, 'config', 'main'), MS._cfg, { merge: true });
    } catch (e) {
      localStorage.setItem(LS.cfg, JSON.stringify(MS._cfg));
    }
  },

  /* ── PRENOTAZIONI ── */
  async getBookings() {
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { collection, getDocs, query, orderBy } = f.fns;
      const snap = await getDocs(query(collection(f.db, 'bookings'), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return lsGet().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  },
  async addBooking(b) {
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { collection, addDoc } = f.fns;
      const ref = await addDoc(collection(f.db, 'bookings'), b);
      return ref.id;
    } catch (e) {
      const id = b.id || ('loc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
      const a = lsGet(); a.push({ ...b, id }); lsSet(a);
      return id;
    }
  },
  async updateBooking(id, data) {
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { doc, updateDoc } = f.fns;
      await updateDoc(doc(f.db, 'bookings', id), data);
    } catch (e) {
      const a = lsGet(); const i = a.findIndex(x => x.id === id);
      if (i > -1) { a[i] = { ...a[i], ...data }; lsSet(a); }
    }
  },
  async deleteBooking(id) {
    const f = await ensureFirebase();
    try {
      if (!f) throw new Error('local');
      const { doc, deleteDoc } = f.fns;
      await deleteDoc(doc(f.db, 'bookings', id));
    } catch (e) {
      lsSet(lsGet().filter(x => x.id !== id));
    }
  },

  /* ── CAPACITÀ ── */
  // Contano le persone che occupano un posto: pagate, da saldare o manuali.
  // Le 'pending' (checkout non completato) NON contano.
  countPeople(bks) {
    return bks
      .filter(b => b.payment === 'paid' || b.payment === 'da_saldare')
      .reduce((sum, b) => sum + (Number(b.people) || 0), 0);
  },
  capacity() { return Number(MS._cfg.capacity) || 800; },

  /* ── REAL-TIME (dashboard) ── */
  onBookingsChange(callback) {
    if (!fb) return () => {};
    try {
      const { collection, onSnapshot, query, orderBy } = fb.fns;
      return onSnapshot(
        query(collection(fb.db, 'bookings'), orderBy('createdAt', 'desc')),
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );
    } catch (e) { return () => {}; }
  },
};
