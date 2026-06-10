# Festa della Birra · Masseria Sacramento

Landing page con prenotazione dinamica + dashboard staff per l'evento
**Festa della Birra** (17 e 18 giugno, dalle 20:30) alla Masseria Sacramento,
C.da Sacramento S.S. 7 — Palagianello (TA).

Il visitatore sceglie la serata e quante persone (adulti 15€, bambini 6–18 anni 10€,
under 6 gratis), paga online e riceve una pagina di conferma da mostrare all'ingresso.
Lo staff vede tutto in dashboard, con tetto massimo di **800 persone** e possibilità di
aggiungere a mano le prenotazioni prese al telefono.

---

## 1. Struttura

```
index.html            Landing + prenotazione
grazie.html           Pagina di conferma / "biglietto"
admin/login.html      Accesso staff
admin/dashboard.html  Dashboard (capienza, prenotazioni, aggiunta manuale, impostazioni)
assets/css/           global.css · landing.css · dashboard.css
assets/js/            storage.js (dati) · pixel.js · landing.js · dashboard.js
vercel.json           Rewrites e URL puliti
```

Pagine pubbliche: `/` e `/grazie`. Area staff: `/admin` → login → `/admin/dashboard`.
Password staff predefinita: **`sacramento2026`** (modificabile in *Impostazioni*).

---

## 2. Avvio rapido (demo)

Funziona subito senza configurare nulla: i dati vengono salvati nel **browser**
(`localStorage`). Utile per provarlo, ma le prenotazioni restano solo sul dispositivo
in uso. Per un evento vero serve Firebase (vedi sotto): la dashboard mostra un avviso
quando è in modalità locale.

Per provarlo in locale serve un piccolo server (i moduli JS non funzionano da `file://`):

```bash
cd masseria-sacramento-festa
python3 -m http.server 8080
# apri http://localhost:8080
```

---

## 3. Firebase (consigliato per l'evento reale)

Senza un database condiviso, la cassa non vede le prenotazioni fatte dai clienti sui
loro telefoni. Firebase Firestore risolve questo (piano gratuito sufficiente).

1. Vai su <https://console.firebase.google.com> → **Crea progetto**.
2. **Build → Firestore Database → Crea database** (modalità produzione va bene).
3. In **Regole** consenti lettura/scrittura alle collezioni dell'evento, ad es.:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /bookings/{doc} { allow read, write: if true; }
       match /config/{doc}   { allow read, write: if true; }
     }
   }
   ```
   (Regole aperte = semplici ma pubbliche. Per più sicurezza limita la scrittura della
   config o usa Firebase App Check.)
4. **Impostazioni progetto → Le tue app → Web** → copia l'oggetto `firebaseConfig`.
5. Incollalo in **`assets/js/storage.js`**, nel blocco indicato:
   ```js
   const firebaseConfig = {
     apiKey: "…", authDomain: "…", projectId: "…",
     storageBucket: "…", messagingSenderId: "…", appId: "…"
   };
   ```

Appena `projectId` è valido, il sito passa automaticamente al cloud e la dashboard si
aggiorna in tempo reale su tutti i dispositivi.

---

## 4. Pagamenti Stripe (prezzi dinamici, senza backend)

Le quantità (adulti/bambini) variano a ogni ordine, quindi si usa il **Checkout
client-only** di Stripe con due prezzi predefiniti.

1. Crea un account su <https://dashboard.stripe.com>.
2. **Prodotti** → crea due prezzi:
   - *Ticket adulto* → **15,00 €** (one-time) → copia il **Price ID** (`price_…`).
   - *Ticket bambino 6–18* → **10,00 €** (one-time) → copia il **Price ID**.
3. Abilita il **client-only Checkout**: Impostazioni Stripe → Checkout →
   *Client-only integration* attivo, e aggiungi il dominio del sito tra quelli consentiti.
4. Copia la **Publishable key** (`pk_live_…` oppure `pk_test_…` per le prove).
5. In dashboard → **Impostazioni → Pagamenti Stripe** incolla:
   Publishable key, Price ID adulto, Price ID bambino → **Salva**.

Al pagamento riuscito Stripe riporta su `/grazie`, che conferma la prenotazione.

**Alternative:**
- *Payment Link*: incolla un link `https://buy.stripe.com/…` nel campo apposito
  (usato se non imposti i Price ID). Nota: un Payment Link ha importo fisso.
- *Nessuna configurazione*: il pulsante registra comunque la prenotazione come
  **“da saldare in struttura”** e mostra la pagina di conferma.

I prezzi mostrati a video si impostano in *Impostazioni → Evento e capienza* (devono
coincidere con quelli su Stripe).

---

## 5. Dashboard staff

- **Prenotazioni**: barra di **capienza X / 800**, statistiche (pagate, da saldare,
  in attesa, incasso), filtri (serata, pagamento, origine, ricerca), tabella ed
  esportazione **CSV**. Ogni riga può essere segnata come pagata, modificata o eliminata.
- **+ Aggiungi (telefono)**: registra a mano le prenotazioni ricevute in chiamata
  (nome, telefono, serata, numero di persone, pagato o da saldare). Vengono conteggiate
  nella capienza esattamente come quelle online; se superi gli 800 chiede conferma.
- **Impostazioni**: capienza massima (default **800**), prezzi, telefono di contatto,
  chiavi Stripe, Meta Pixel e password staff.

Conteggio capienza: contano le prenotazioni **pagate** e **da saldare** (online o
manuali). Le prenotazioni online non completate (in attesa) non occupano posti.

---

## 6. Deploy su Vercel

```bash
npm i -g vercel
cd masseria-sacramento-festa
vercel        # anteprima
vercel --prod # produzione
```

Oppure: nuovo progetto su <https://vercel.com> → importa la cartella/repo → deploy.
`vercel.json` gestisce gli URL puliti (`/grazie`, `/admin`, `/admin/dashboard`).

Dopo il deploy ricordati di aggiungere il dominio Vercel tra quelli consentiti in Stripe.

---

## 7. Checklist pre-evento

- [ ] Config Firebase inserita in `storage.js` (multi-dispositivo).
- [ ] Prezzi Stripe creati e Price ID + Publishable key salvati in dashboard.
- [ ] Dominio del sito autorizzato in Stripe.
- [ ] Capienza confermata (800 o altro) in Impostazioni.
- [ ] Password staff cambiata.
- [ ] Prova completa: prenotazione di test → pagina `/grazie` → comparsa in dashboard.
