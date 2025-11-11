// app.js
import { initFirebase, db, auth, userId, isAuthReady, dbAvailable, getNotesRef } from './firebase-config.js';

// === TEMA ===
export function loadTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.body.classList.add('dark');
  }
  updateThemeIcon();
}

export function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  icon.innerHTML = document.body.classList.contains('dark')
    ? `<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 10a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 00-.707-.293h-1.096a1 1 0 000 2h1.096c.264 0 .52.105.707.293l.707.707a1 1 0 101.414-1.414l-.707-.707zM3.464 15.657l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 12a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zM2 7a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm14 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>`
    : `<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`;
}

// === VISTAS ===
export function showView(viewName) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(viewName);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'notes-view' && isAuthReady) setupNotes();
  if (viewName === 'password-view') generatePassword();
  if (viewName === 'games-view') renderGameOptions();
}

// === TOAST ===
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('app-toast');
  const msg = document.getElementById('toast-message');
  toast.className = 'toast show';
  toast.classList.add(
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'error' ? 'bg-red-600 text-white' :
    type === 'warning' ? 'bg-yellow-500 text-gray-900' :
    'bg-blue-600 text-white'
  );
  msg.textContent = message;
  setTimeout(() => toast.classList.remove('show'), duration);
}

// === GENERADOR DE CONTRASEÑAS ===
const CHAR_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
};

export function generatePassword() {
  const length = parseInt(document.getElementById('length-slider')?.value) || 12;
  const useLowercase = document.getElementById('checkbox-lowercase')?.checked;
  const useUppercase = document.getElementById('checkbox-uppercase')?.checked;
  const useNumbers = document.getElementById('checkbox-numbers')?.checked;
  const useSymbols = document.getElementById('checkbox-symbols')?.checked;
  const output = document.getElementById('password-output');

  if (!output) return;

  let allChars = '';
  if (useLowercase) allChars += CHAR_SETS.lowercase;
  if (useUppercase) allChars += CHAR_SETS.uppercase;
  if (useNumbers) allChars += CHAR_SETS.numbers;
  if (useSymbols) allChars += CHAR_SETS.symbols;

  if (allChars.length === 0) {
    output.value = 'Selecciona al menos un tipo.';
    return;
  }

  let password = '';
  const ensure = [];
  if (useLowercase) ensure.push(CHAR_SETS.lowercase);
  if (useUppercase) ensure.push(CHAR_SETS.uppercase);
  if (useNumbers) ensure.push(CHAR_SETS.numbers);
  if (useSymbols) ensure.push(CHAR_SETS.symbols);

  for (let i = 0; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  if (password.length >= ensure.length) {
    for (let i = 0; i < ensure.length; i++) {
      const char = ensure[i][Math.floor(Math.random() * ensure[i].length)];
      password = password.substring(0, i) + char + password.substring(i + 1);
    }
  }

  password = password.split('').sort(() => 0.5 - Math.random()).join('');
  output.value = password;
}

export function copyPassword() {
  const output = document.getElementById('password-output');
  if (!output?.value || output.value.includes('Selecciona')) {
    showToast('¡Primero genera una contraseña!', 'warning');
    return;
  }
  output.select();
  document.execCommand('copy');
  showToast('¡Contraseña copiada!', 'success');
}

// === JUEGOS ===
export function renderGameOptions() {
  const count = parseInt(document.getElementById('player-count').value);
  const area = document.getElementById('game-options-area');
  const results = document.getElementById('game-results');
  area.innerHTML = '';
  results.innerHTML = '';

  if (isNaN(count) || count < 2) {
    area.innerHTML = `<p class="text-center p-4 text-gray-600 dark:text-gray-400">Mínimo 2 jugadores.</p>`;
  } else if (count === 2) {
    area.innerHTML = `
      <div class="p-6 bg-green-50 dark:bg-gray-700 rounded-xl text-center">
        <h4 class="text-xl font-bold text-green-700 dark:text-green-400 mb-4">Cara o Cruz</h4>
        <button onclick="flipCoin()" class="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">
          LANZAR MONEDA
        </button>
      </div>`;
  } else {
    const dice = count - 1;
    area.innerHTML = `
      <div class="p-6 bg-blue-50 dark:bg-gray-700 rounded-xl text-center">
        <h4 class="text-xl font-bold text-blue-700 dark:text-blue-400 mb-4">Dados (${dice}d6)</h4>
        <button onclick="runDiceGame(${count})" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
          TIRAR DADOS
        </button>
      </div>`;
  }
}

window.flipCoin = function() {
  const results = document.getElementById('game-results');
  const isHeads = Math.random() < 0.5;
  const winner = isHeads ? 'Jugador 1' : 'Jugador 2';
  const text = isHeads ? 'CARA' : 'CRUZ';
  results.innerHTML = `
    <div class="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-green-500">
      <p class="text-6xl mb-4 animate-bounce">${isHeads ? 'Cara' : 'Cruz'}</p>
      <h4 class="text-3xl font-bold">${text}!</h4>
      <p class="text-2xl text-green-600 dark:text-green-400">¡${winner} gana!</p>
    </div>`;
};

window.runDiceGame = function(count) {
  const results = document.getElementById('game-results');
  const dice = count - 1;
  const players = [];

  for (let i = 1; i <= count; i++) {
    let total = 0;
    const rolls = [];
    for (let d = 0; d < dice; d++) {
      const roll = Math.floor(Math.random() * 6) + 1;
      rolls.push(roll);
      total += roll;
    }
    players.push({ id: i, rolls, total });
  }

  players.sort((a, b) => b.total - a.total);
  const max = players[0].total;
  const winners = players.filter(p => p.total === max);

  const html = players.map(p => `
    <div class="p-4 rounded-lg shadow ${winners.some(w => w.id === p.id) ? 'border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/50' : 'bg-white dark:bg-gray-700'}">
      <h5 class="font-bold ${winners.some(w => w.id === p.id) ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}">
        ${winners.some(w => w.id === p.id) ? 'Trophy' : ''} Jugador ${p.id}
      </h5>
      <p>Dados: <span class="font-mono">${p.rolls.join(' | ')}</span></p>
      <p class="text-2xl font-bold">Total: ${p.total}</p>
    </div>
  `).join('');

  results.innerHTML = `
    <h4 class="text-2xl font-bold mb-4">Resultados:</h4>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${html}</div>
    <div class="text-center mt-6 p-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
      <p class="text-xl font-bold">
        ${winners.length === 1 ? `¡Jugador ${winners[0].id} gana con ${max}!` : `¡Empate con ${max}!`}
      </p>
    </div>`;
};

// === NOTAS ===
let unsubscribeNotes = null;

function setupNotes() {
  if (!dbAvailable || !userId) return;
  if (unsubscribeNotes) unsubscribeNotes();

  const q = query(getNotesRef());
  unsubscribeNotes = onSnapshot(q, snapshot => {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
    renderNotes(notes);
  });
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  container.innerHTML = notes.length === 0
    ? '<p class="text-center text-gray-500 dark:text-gray-400 py-4">No hay notas.</p>'
    : notes.map(n => createNoteElement(n)).join('');
}

function createNoteElement(note) {
  const date = note.createdAt ? new Date(note.createdAt.toDate()).toLocaleString() : 'Local';
  return `
    <div class="bg-white dark:bg-gray-700 p-4 rounded-xl shadow mb-4 border-l-4 border-indigo-500">
      <p class="whitespace-pre-wrap">${note.content}</p>
      <p class="text-xs text-gray-400 mt-2">Creada: ${date}</p>
      <div class="flex space-x-2 mt-2">
        <button onclick="editNote('${note.id}', '${btoa(encodeURIComponent(note.content))}')" class="text-indigo-600 hover:underline">Editar</button>
        <button onclick="copyNote('${note.id}')" class="text-green-600 hover:underline">Copiar</button>
        <button onclick="showDeleteConfirmation('${note.id}')" class="text-red-600 hover:underline">Borrar</button>
      </div>
    </div>`;
}

window.editNote = function(id, encoded) {
  document.getElementById('note-input').value = decodeURIComponent(atob(encoded));
  document.getElementById('editing-note-id').value = id;
  document.getElementById('save-note-button').textContent = 'Actualizar Nota';
};

window.copyNote = function(id) {
  const el = document.createElement('textarea');
  el.value = document.querySelector(`#note-content-${id}`)?.textContent || '';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  showToast('Nota copiada', 'success');
};

window.showDeleteConfirmation = function(id) {
  document.getElementById('delete-modal').classList.remove('hidden');
  document.getElementById('confirm-delete-button').onclick = () => deleteNote(id);
};

window.hideDeleteConfirmation = function() {
  document.getElementById('delete-modal').classList.add('hidden');
};

async function deleteNote(id) {
  hideDeleteConfirmation();
  if (dbAvailable) {
    await deleteDoc(doc(db, getNotesRef().path, id));
  } else {
    let notes = JSON.parse(localStorage.getItem('local_notes') || '[]');
    notes = notes.filter(n => n.id !== id);
    localStorage.setItem('local_notes', JSON.stringify(notes));
  }
  showToast('Nota borrada', 'success');
}

document.getElementById('save-note-button').onclick = async () => {
  const input = document.getElementById('note-input');
  const content = input.value.trim();
  const id = document.getElementById('editing-note-id').value;

  if (!content) return showToast('Escribe algo', 'warning');

  if (dbAvailable) {
    if (id) {
      await updateDoc(doc(db, getNotesRef().path, id), { content });
    } else {
      await addDoc(getNotesRef(), { content, createdAt: serverTimestamp() });
    }
  } else {
    let notes = JSON.parse(localStorage.getItem('local_notes') || '[]');
    if (id) {
      notes = notes.map(n => n.id === id ? { ...n, content } : n);
    } else {
      notes.unshift({ id: Date.now().toString(), content, createdAt: new Date().toISOString() });
    }
    localStorage.setItem('local_notes', JSON.stringify(notes));
  }

  input.value = '';
  document.getElementById('editing-note-id').value = '';
  document.getElementById('save-note-button').textContent = 'Guardar Nota';
  showToast(id ? 'Nota actualizada' : 'Nota guardada', 'success');
};

// === INICIO ===
window.addEventListener('load', () => {
  loadTheme();
  initFirebase();

  document.getElementById('theme-toggle').onclick = toggleTheme;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => showView(btn.dataset.view);
  });

  const slider = document.getElementById('length-slider');
  const display = document.getElementById('length-display');
  if (slider && display) {
    display.textContent = slider.value;
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
      generatePassword();
    });
  }

  document.getElementById('player-count')?.addEventListener('input', renderGameOptions);

  showView('home-view');
});