(() => {
  'use strict';

  const QUESTIONS = Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS : [];
  const SUBJECTS = {
    all: 'Tutte le materie',
    criminal: 'Procedura penale',
    civil: 'Procedura civile',
    registry: 'Servizi di cancelleria',
    administrative: 'Diritto amministrativo'
  };
  
  // Unified store for all user data
  const STORE_KEY = 'quiz-progressioni-2026.userdata.v2';
  
  const store = {
    read() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || this.default(); }
      catch (e) { return this.default(); }
    },
    default() { return { errors: {}, bookmarks: [], history: [], seen: [] }; },
    write(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); },
    
    migrate() {
      // Migrate v1 errors if present
      const old = localStorage.getItem('quiz-progressioni-2026.errors.v1');
      if (old) {
        try {
          const oldErrs = JSON.parse(old);
          const data = this.read();
          data.errors = oldErrs;
          this.write(data);
          localStorage.removeItem('quiz-progressioni-2026.errors.v1');
        } catch(e) {}
      }
    },
    
    getErrors() { return Object.keys(this.read().errors).map(Number); },
    addError(id) { const d = this.read(); d.errors[id] = true; this.write(d); },
    removeError(id) { const d = this.read(); delete d.errors[id]; this.write(d); },
    
    getBookmarks() { return this.read().bookmarks; },
    toggleBookmark(id) {
      const d = this.read();
      const idx = d.bookmarks.indexOf(id);
      if(idx >= 0) d.bookmarks.splice(idx, 1);
      else d.bookmarks.push(id);
      this.write(d);
      return idx < 0; // returns true if added
    },
    isBookmarked(id) { return this.read().bookmarks.includes(id); },
    
    getSeen() { return this.read().seen || []; },
    addSeen(ids) {
      const d = this.read();
      if(!d.seen) d.seen = [];
      const set = new Set(d.seen);
      ids.forEach(i => set.add(i));
      d.seen = Array.from(set);
      this.write(d);
    },
    
    getHistory() { return this.read().history || []; },
    addHistory(score, total, percent) {
      const d = this.read();
      if(!d.history) d.history = [];
      const date = new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date());
      d.history.unshift({ date, score, total, percent });
      if(d.history.length > 5) d.history = d.history.slice(0, 5); // Keep last 5
      this.write(d);
    },
    
    clearAll() { this.write(this.default()); }
  };

  const letters = ['A', 'B', 'C'];
  const state = { subject: 'all', count: 20, timer: 0, filter: 'all', session: null };
  const $ = (id) => document.getElementById(id);

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function showView(name) {
    ['home-view', 'quiz-view', 'results-view'].forEach(v => {
      $(v).hidden = (v !== name + '-view');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 3000);
  }

  function updateHomeStats() {
    const errs = store.getErrors().length;
    const favs = store.getBookmarks().length;
    const seen = store.getSeen().length;
    
    $('err-count').textContent = errs;
    $('btn-quiz-err').disabled = errs === 0;
    
    $('fav-count').textContent = favs;
    $('btn-quiz-fav').disabled = favs === 0;
    
    $('seen-count').textContent = seen;

    const hist = store.getHistory();
    const hl = $('history-list');
    hl.innerHTML = '';
    if(hist.length === 0) {
      hl.innerHTML = '<div class="stat-item"><span class="stat-date">Nessuna prova completata</span></div>';
    } else {
      hist.forEach(h => {
        hl.innerHTML += `<div class="stat-item"><span class="stat-date">${h.date}</span><span class="stat-score">${h.percent}% (${h.score}/${h.total})</span></div>`;
      });
    }
  }

  function setSelection(containerId, dataAttr, val) {
    const btns = $(containerId).querySelectorAll(`[data-${dataAttr}]`);
    btns.forEach(b => {
      if(b.dataset[dataAttr] == val) b.classList.add('selected');
      else b.classList.remove('selected');
    });
  }

  function startQuiz(mode = 'training') {
    let pool = [];
    if(mode === 'errors') {
      const e = new Set(store.getErrors());
      pool = QUESTIONS.filter(q => e.has(q.id));
    } else if(mode === 'bookmarks') {
      const f = new Set(store.getBookmarks());
      pool = QUESTIONS.filter(q => f.has(q.id));
    } else {
      // standard training
      pool = state.subject === 'all' ? QUESTIONS : QUESTIONS.filter(q => q.subject === state.subject);
      if(state.filter === 'new') {
        const s = new Set(store.getSeen());
        pool = pool.filter(q => !s.has(q.id));
      }
    }

    if(pool.length === 0) {
      showToast('Nessuna domanda trovata per questi filtri.');
      return;
    }

    pool = shuffle(pool).slice(0, Math.min(state.count, pool.length));
    
    state.session = {
      mode,
      questions: pool.map(q => {
        const opts = shuffle([{t: q.correct, c: true}, ...q.wrong.map(w => ({t: w, c: false}))]);
        return { ...q, options: opts };
      }),
      index: 0,
      correct: 0,
      answers: []
    };

    if(state.session.timerId) clearInterval(state.session.timerId);
    if(state.timer > 0 && mode !== 'errors' && mode !== 'bookmarks') {
      state.session.rem = state.timer * pool.length;
      $('timer-display').hidden = false;
      updateTimer();
      state.session.timerId = setInterval(() => {
        if(!state.session) return;
        state.session.rem -= 1;
        updateTimer();
        if(state.session.rem <= 0) {
          clearInterval(state.session.timerId);
          showToast('Tempo esaurito!');
          showResults();
        }
      }, 1000);
    } else {
      $('timer-display').hidden = true;
    }

    showView('quiz');
    renderQuestion();
  }

  function updateTimer() {
    if(!state.session || state.session.rem == null) return;
    const m = String(Math.floor(state.session.rem / 60)).padStart(2, '0');
    const s = String(state.session.rem % 60).padStart(2, '0');
    $('timer-display').textContent = `${m}:${s}`;
  }

  function renderQuestion() {
    const s = state.session;
    const q = s.questions[s.index];
    const tot = s.questions.length;
    
    store.addSeen([q.id]); // mark as seen

    $('progress-label').textContent = `Domanda ${s.index + 1} di ${tot}`;
    $('progress-bar-fill').style.width = `${((s.index + 1) / tot) * 100}%`;
    $('subject-label').textContent = SUBJECTS[q.subject];
    $('live-score').textContent = `${s.correct} corrette`;
    
    $('q-number-label').textContent = `QUESITO ${q.id}`;
    const star = $('star-toggle');
    star.textContent = store.isBookmarked(q.id) ? '★' : '☆';
    star.className = store.isBookmarked(q.id) ? 'star-btn active' : 'star-btn';
    star.onclick = () => {
      const added = store.toggleBookmark(q.id);
      star.textContent = added ? '★' : '☆';
      star.className = added ? 'star-btn active' : 'star-btn';
    };

    $('question-text').textContent = q.question;
    $('feedback-box').hidden = true;
    $('explain-content').hidden = true;
    $('next-action-container').hidden = true;

    const list = $('answer-list');
    list.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.idx = i;
      btn.innerHTML = `<span class="answer-letter">${letters[i]}</span> <span>${opt.t}</span>`;
      btn.onclick = () => handleAnswer(i);
      list.appendChild(btn);
    });
  }

  function handleAnswer(idx) {
    const s = state.session;
    const q = s.questions[s.index];
    if(s.answers.length > s.index) return; // already answered

    const sel = q.options[idx];
    const isCorrect = sel.c;
    if(isCorrect) s.correct++;

    s.answers.push({ q, sel: sel.t, isCorrect });

    if(isCorrect && s.mode === 'errors') store.removeError(q.id);
    if(!isCorrect) store.addError(q.id);

    // Update UI
    const btns = $('answer-list').querySelectorAll('.answer-btn');
    btns.forEach((b, i) => {
      b.disabled = true;
      if(q.options[i].c) b.classList.add('correct');
      else if(i === idx && !isCorrect) b.classList.add('incorrect');
      else b.classList.add('dimmed');
    });

    const fb = $('feedback-box');
    fb.className = 'feedback-box ' + (isCorrect ? 'success' : 'error');
    $('feedback-title').textContent = isCorrect ? 'Risposta Corretta' : 'Risposta Errata';
    $('feedback-desc').textContent = isCorrect ? 'Ottimo lavoro.' : `Risposta esatta: ${q.correct}`;
    fb.hidden = false;
    $('next-action-container').hidden = false;
    $('live-score').textContent = `${s.correct} corrette`;
  }

  $('explain-btn').onclick = () => {
    $('explain-content').hidden = !$('explain-content').hidden;
  };

  $('next-button').onclick = () => {
    const s = state.session;
    if(s.index < s.questions.length - 1) {
      s.index++;
      renderQuestion();
    } else {
      showResults();
    }
  };

  function showResults() {
    if(state.session && state.session.timerId) clearInterval(state.session.timerId);
    
    const s = state.session;
    const tot = s.questions.length;
    const percent = Math.round((s.correct / tot) * 100);
    
    store.addHistory(s.correct, tot, percent);
    updateHomeStats();

    $('score-percent').textContent = `${percent}%`;
    $('score-ring').style.setProperty('--score', `${percent}%`);
    $('correct-total').textContent = s.correct;
    $('question-total').textContent = tot;
    $('wrong-total').textContent = tot - s.correct;

    const wrongAns = s.answers.filter(a => !a.isCorrect);
    
    if(wrongAns.length > 0) {
      $('mistakes-section').hidden = false;
      $('review-mistakes-btn').hidden = false;
      const mlist = $('mistakes-list');
      mlist.innerHTML = '';
      wrongAns.forEach(a => {
        mlist.innerHTML += `
          <div class="mistake-card">
            <div class="m-meta">Quesito ${a.q.id} • ${SUBJECTS[a.q.subject]}</div>
            <div class="m-q">${a.q.question}</div>
            <div class="m-ans wrong">La tua risposta: ${a.sel}</div>
            <div class="m-ans right">Corretta: ${a.q.correct}</div>
          </div>
        `;
      });
    } else {
      $('mistakes-section').hidden = true;
      $('review-mistakes-btn').hidden = true;
    }

    showView('results');
  }

  $('brand-home').onclick = (e) => { e.preventDefault(); quitToHome(); };
  $('quit-button').onclick = quitToHome;
  $('new-quiz-btn').onclick = quitToHome;
  $('review-mistakes-btn').onclick = () => startQuiz('errors');
  
  function quitToHome() {
    if(state.session && state.session.timerId) clearInterval(state.session.timerId);
    state.session = null;
    updateHomeStats();
    showView('home');
  }

  // Bind setup events
  ['subject', 'count', 'timer', 'filter'].forEach(cat => {
    $(`${cat}-options`)?.addEventListener('click', (e) => {
      const btn = e.target.closest(`[data-${cat}]`);
      if(!btn) return;
      state[cat] = cat === 'subject' || cat === 'filter' ? btn.dataset[cat] : Number(btn.dataset[cat]);
      setSelection(`${cat}-options`, cat, state[cat]);
    });
  });

  $('start-button').onclick = () => startQuiz('training');
  $('btn-quiz-fav').onclick = () => startQuiz('bookmarks');
  $('btn-quiz-err').onclick = () => startQuiz('errors');

  $('reset-all-btn').onclick = () => {
    if(confirm('Sei sicuro di voler azzerare tutti i progressi, i preferiti e lo storico?')) {
      store.clearAll();
      updateHomeStats();
      showToast('Dati azzerati con successo.');
    }
  };

  // Init
  store.migrate();
  updateHomeStats();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

})();
