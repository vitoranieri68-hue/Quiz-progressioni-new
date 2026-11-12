# Quiz Progressioni 2026 — v1.0.0

Web app responsive/PWA statica per esercitarsi sui 180 quesiti della banca dati Excel `dog_progressioni_aree_26giu2026_banca_dati.xlsx`.

## Funzioni incluse

- quattro materie e opzione **Tutte le materie**;
- sessioni da 10, 20 o 30 domande;
- estrazione casuale senza ripetizioni nella sessione;
- risposte A/B/C mescolate a ogni sessione;
- correzione immediata;
- punteggio, percentuale e riepilogo delle risposte errate;
- **Ripassa gli errori**, con salvataggio nel browser tramite `localStorage`;
- utilizzo offline dopo il primo accesso, se pubblicata via HTTPS;
- installazione come PWA sui dispositivi compatibili;
- nessun database, login, cookie di profilazione o servizio esterno.

## Prova sul PC

### Metodo rapido

Apri `index.html` con un doppio clic. Il quiz funziona; l'installazione PWA e la cache offline richiedono invece un piccolo server locale o la pubblicazione via HTTPS.

### Metodo completo

Se Python è installato, apri un terminale nella cartella dell'app ed esegui:

```bash
python -m http.server 8080
```

Poi visita `http://localhost:8080`.

Su Windows puoi anche eseguire `avvia-quiz.bat`; su macOS/Linux, `./avvia-quiz.sh`.

## Condivisione con i colleghi

Pubblica **l'intero contenuto di questa cartella** su un hosting statico HTTPS. Sono adatti, per esempio:

- GitHub Pages;
- Netlify Drop;
- Cloudflare Pages;
- un sito web/intranet che permetta file statici.

Non caricare soltanto `index.html`: devono essere presenti anche `app.js`, `questions.js`, `styles.css`, `sw.js`, `manifest.webmanifest` e la cartella `icons`.

Una volta pubblicata, condividi l'URL HTTPS. Ogni collega avrà i propri errori salvati esclusivamente sul proprio dispositivo/browser. Se cancella i dati del sito o usa un altro dispositivo, lo storico locale non viene trasferito.

## Aggiornare la banca dati

L'app in esecuzione non legge Excel: i quesiti sono incorporati in `questions.js`. Per rigenerare quel file dopo una modifica dell'Excel:

1. installa Python e `openpyxl`;
2. copia l'Excel nella cartella principale;
3. esegui:

```bash
python tools/build_questions.py dog_progressioni_aree_26giu2026_banca_dati.xlsx questions.js
```

Lo script controlla intestazioni, campi mancanti, ID duplicati e risposte duplicate nella stessa domanda.

## Struttura

- `index.html` — interfaccia;
- `styles.css` — design responsive;
- `app.js` — logica del quiz e salvataggio locale;
- `questions.js` — 180 quesiti incorporati;
- `manifest.webmanifest`, `sw.js`, `icons/` — componenti PWA/offline;
- `source-info.json` — tracciabilità della sorgente;
- `tools/build_questions.py` — rigenerazione della banca dati incorporata.
