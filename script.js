// Importaciones de Firebase (solo Auth y App - para el entorno)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Configuración de Entorno y Variables Globales ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, auth, userId = null;

// --- ALMACENAMIENTO LOCAL DE NOTAS (JSON en LocalStorage) ---
const NOTES_STORAGE_KEY = 'app-user-notes';
let notesData = [];
let nextNoteId = 1;

/** Carga las notas del LocalStorage y establece nextNoteId */
function loadNotes() {
    try {
        const data = localStorage.getItem(NOTES_STORAGE_KEY);
        notesData = data ? JSON.parse(data) : [];
        
        if (notesData.length > 0) {
            // Encontrar el ID más alto y establecer nextNoteId para evitar colisiones
            const maxId = Math.max(...notesData.map(n => parseInt(n.id, 10)));
            nextNoteId = maxId + 1;
        } else {
            nextNoteId = 1;
        }
    } catch (error) {
        console.error("Error loading notes from localStorage:", error);
        notesData = [];
        nextNoteId = 1;
    }
}

/** Guarda las notas en el LocalStorage (como string JSON) */
function saveNotes() {
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesData));
    } catch (error) {
        console.error("Error saving notes to localStorage:", error);
        showMessageBox('Error al guardar notas. ¿Memoria llena?', 'error');
    }
}

// --- ALMACENAMIENTO LOCAL DE CONTABILIDAD (JSON en LocalStorage) ---
const ACCOUNTING_STORAGE_KEY = 'app-user-transactions';
let transactions = [];
let nextTransactionId = 1;

/** Carga las transacciones del LocalStorage y establece nextTransactionId */
function loadTransactions() {
    try {
        const data = localStorage.getItem(ACCOUNTING_STORAGE_KEY);
        transactions = data ? JSON.parse(data) : [];
        
        if (transactions.length > 0) {
            // Encontrar el ID más alto
            const maxId = Math.max(...transactions.map(t => parseInt(t.id, 10)));
            nextTransactionId = maxId + 1;
        } else {
            nextTransactionId = 1;
        }
    } catch (error) {
        console.error("Error loading transactions from localStorage:", error);
        transactions = [];
        nextTransactionId = 1;
    }
}

/** Guarda las transacciones en el LocalStorage (como string JSON) */
function saveTransactions() {
    try {
        localStorage.setItem(ACCOUNTING_STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
        console.error("Error saving transactions to localStorage:", error);
        showMessageBox('Error al guardar transacciones. ¿Memoria llena?', 'error');
    }
}

// --- Funciones de Utilidad (Toast Message) ---

function showMessageBox(message, type = 'info') {
    const box = document.getElementById('message-box');
    if (!box) return;

    // Limpiar clases de tipo
    box.classList.remove('message-success', 'message-error', 'message-info');
    
    // Asignar clase de tipo y contenido
    box.classList.add(`message-${type}`);
    // Se asegura de que el elemento <p> exista o se agrega su contenido
    const p = box.querySelector('p');
    if (p) {
        p.textContent = message;
    } else {
        // Fallback si no hay <p> dentro del box
        box.textContent = message;
    }


    // Mostrar
    box.classList.add('show');

    // Ocultar después de 3 segundos
    setTimeout(() => {
        box.classList.remove('show');
    }, 3000);
}

// --- Lógica de Autenticación de Firebase ---

async function initializeFirebase() {
    try {
        if (Object.keys(firebaseConfig).length === 0) {
             console.warn("Firebase config not available. Proceeding with anonymous sign-in fallback.");
        }

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);

        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
            userId = user?.uid || crypto.randomUUID();
            console.log(`Usuario ID: ${userId}`);
            // Aquí se cargarían otras funcionalidades si las hubiera
        });

    } catch (error) {
        console.error("Error inicializando Firebase o autenticando:", error);
    }
}

// ----------------------------------------------------------------------
// --- LÓGICA DE NOTAS (INCLUYENDO COPIAR Y EDITAR) ---
// ----------------------------------------------------------------------

/** 📋 Copia el contenido de una nota al portapapeles */
function copyNoteContent(noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) {
        showMessageBox('Error: Nota no encontrada para copiar.', 'error');
        return;
    }

    // Usar el Clipboard API para copiar el contenido (solo contenido)
    navigator.clipboard.writeText(note.content.trim())
        .then(() => {
            showMessageBox('Contenido de la nota copiado al portapapeles.', 'success');
        })
        .catch(err => {
            console.error('Error al copiar el contenido:', err);
            showMessageBox('Error al copiar. (Requisito: HTTPS/Permiso de portapapeles)', 'error');
        });
}

/** ✏️ Inicia el proceso de edición de una nota (Simulación con prompt) */
function startNoteEdit(noteId) {
    const noteToEdit = notesData.find(n => n.id === noteId);

    if (!noteToEdit) {
        showMessageBox('Error: Nota no encontrada para editar.', 'error');
        return;
    }

    // SIMULACIÓN DE EDICIÓN: Usamos 'prompt' y 'confirm' para obtener nuevos valores.
    const newTitle = prompt("Edita el Título:", noteToEdit.title);
    
    // Si el usuario cancela la edición del título, se detiene la edición.
    if (newTitle === null) {
        showMessageBox('Edición cancelada.', 'info');
        return;
    }
    
    const newContent = prompt("Edita el Contenido:", noteToEdit.content);
    
    // Si el usuario cancela la edición del contenido.
    if (newContent === null) {
        showMessageBox('Edición cancelada.', 'info');
        return;
    }
    
    // Si ambos valores son iguales a los originales, no se hace nada.
    if (newTitle === noteToEdit.title && newContent === noteToEdit.content) {
         showMessageBox('No se detectaron cambios.', 'info');
         return;
    }
    
    // Si hay cambios y no se canceló, actualizamos.
    updateNoteLocal(noteId, newTitle, newContent);
}

/** 💾 Actualiza el título y contenido de una nota existente */
function updateNoteLocal(idToUpdate, newTitle, newContent) {
    const noteIndex = notesData.findIndex(note => note.id === idToUpdate);
    
    if (noteIndex !== -1) {
        // El trim() elimina espacios iniciales/finales. Asegura valores por defecto si quedan vacíos.
        notesData[noteIndex].title = newTitle.trim() || 'Nota Sin Título'; 
        notesData[noteIndex].content = newContent.trim() || 'Contenido vacío.'; 
        notesData[noteIndex].updatedAt = new Date().toISOString(); // Opcional: marca la fecha de modificación

        saveNotes(); // Persistencia
        renderNotes();
        showMessageBox('Nota actualizada con éxito.', 'success');
    } else {
        showMessageBox('Error: No se encontró la nota para actualizar.', 'error');
    }
}


function renderNotes() {
    const container = document.getElementById('notes-container');
    if (!container) return;

    container.innerHTML = '';
    
    // Ordenar por fecha de creación descendente
    const sortedNotes = notesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (sortedNotes.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No hay notas. ¡Crea una nueva!</p>';
        return;
    }

    // Generar HTML para cada nota
    sortedNotes.forEach(note => {
        const date = new Date(note.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const noteElement = document.createElement('div');
        // Ajustado el borde y fondo para Dark Mode
        noteElement.className = 'bg-white dark:bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 hover:shadow-xl transition duration-300';
        noteElement.innerHTML = `
            <div class="flex justify-between items-start">
                <h4 class="text-lg font-bold text-gray-900 dark:text-white mb-2">${note.title}</h4>
                <div class="flex space-x-2"> 
                    <button data-id="${note.id}" class="copy-note-btn text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition" aria-label="Copiar contenido de la nota">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                            <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2h2V5a2 2 0 012-2h6a2 2 0 00-2-2H5z" />
                        </svg>
                    </button>
                    <button data-id="${note.id}" class="edit-note-btn text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300 transition" aria-label="Editar nota">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-7 7A1 1 0 003 17.07V19h1.939a1 1 0 00.707-.293l7-7-2.828-2.828z" />
                        </svg>
                    </button>
                    <button data-id="${note.id}" class="delete-note-btn text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" aria-label="Borrar nota">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${note.content}</p>
            <p class="text-xs text-right text-gray-400 dark:text-gray-500 mt-2">Creada: ${date}</p>
        `;
        container.appendChild(noteElement);
    });

    // Re-adjuntar listeners para los botones
    document.querySelectorAll('.delete-note-btn').forEach(button => {
        // Utiliza la función global showDeleteConfirmation
        button.onclick = (e) => window.showDeleteConfirmation(e.currentTarget.dataset.id, 'note');
    });
    // NUEVO: Listener para el botón de copiar
    document.querySelectorAll('.copy-note-btn').forEach(button => {
        button.onclick = (e) => copyNoteContent(e.currentTarget.dataset.id);
    });
    // NUEVO: Listener para el botón de editar
    document.querySelectorAll('.edit-note-btn').forEach(button => {
        button.onclick = (e) => startNoteEdit(e.currentTarget.dataset.id);
    });
}

// Función para añadir una nota
function addNoteLocal(title, content) {
    const newId = (nextNoteId++).toString();
    const newNote = {
        id: newId,
        title: title.trim() || 'Nota Sin Título',
        content: content.trim() || 'Contenido vacío.',
        createdAt: new Date().toISOString()
    };

    notesData.push(newNote);
    saveNotes(); // Persistencia
    renderNotes();

    showMessageBox('Nota creada con éxito (Persistencia Local).', 'success');
}

// Función para borrar una nota
function deleteNoteLocal(idToDelete) {
    const initialLength = notesData.length;
    notesData = notesData.filter(note => note.id !== idToDelete);

    if (notesData.length < initialLength) {
        saveNotes(); // Persistencia
        renderNotes();
        showMessageBox('Nota borrada con éxito.', 'info');
    } else {
        showMessageBox('Error: No se encontró la nota para borrar.', 'error');
    }
}

// --- Lógica de Contabilidad (Local Storage JSON Persistence) ---

/** Calcula el saldo total, ingresos y gastos */
function calculateSummary() {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const total = income - expense;
    return { income, expense, total };
}

/** Renderiza el resumen y la lista de transacciones */
function renderAccounting() {
    const summary = calculateSummary();
    const summaryDiv = document.getElementById('accounting-summary');
    const listDiv = document.getElementById('transactions-list');
    
    if (!summaryDiv || !listDiv) return;

    // 1. Resumen
    summaryDiv.innerHTML = `
        <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl shadow-md flex justify-between items-center">
            <span class="text-xl font-bold text-gray-900 dark:text-white">SALDO TOTAL</span>
            <span class="text-3xl font-extrabold ${summary.total >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}">
                $${summary.total.toFixed(2)}
            </span>
        </div>
        <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="p-4 bg-green-50 dark:bg-green-900 rounded-xl shadow-sm">
                <p class="text-sm font-medium text-green-700 dark:text-green-200">Ingresos</p>
                <p class="text-xl font-bold text-green-600 dark:text-green-300">$${summary.income.toFixed(2)}</p>
            </div>
            <div class="p-4 bg-red-50 dark:bg-red-900 rounded-xl shadow-sm">
                <p class="text-sm font-medium text-red-700 dark:text-red-200">Gastos</p>
                <p class="text-xl font-bold text-red-600 dark:text-red-300">$${summary.expense.toFixed(2)}</p>
            </div>
        </div>
    `;

    // 2. Lista de Transacciones
    listDiv.innerHTML = '';
    const sortedTransactions = transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (sortedTransactions.length === 0) {
        listDiv.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No hay transacciones registradas.</p>';
        return;
    }

    sortedTransactions.forEach(t => {
        const isIncome = t.type === 'income';
        const sign = isIncome ? '+' : '-';
        // Color ajustado para Dark Mode
        const colorClass = isIncome ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
        const borderColor = isIncome ? 'border-green-500' : 'border-red-500';
        const date = new Date(t.createdAt).toLocaleDateString('es-ES');

        const item = document.createElement('div');
        // Fondo ajustado para Dark Mode
        item.className = `flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-xl shadow-sm border-l-4 ${borderColor}`;
        item.innerHTML = `
            <div class="flex flex-col text-left">
                <span class="font-medium text-gray-900 dark:text-white">${t.description}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">${date} (${t.category})</span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="font-bold text-lg ${colorClass}">${sign}$${t.amount.toFixed(2)}</span>
                <button data-id="${t.id}" class="delete-transaction-btn text-gray-400 hover:text-red-500 transition" aria-label="Borrar transacción">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        listDiv.appendChild(item);
    });

    // Adjuntar listeners para borrar transacciones
    document.querySelectorAll('.delete-transaction-btn').forEach(button => {
        // Utiliza la función global showDeleteConfirmation
        button.onclick = (e) => window.showDeleteConfirmation(e.currentTarget.dataset.id, 'transaction');
    });
}

/** Añade una nueva transacción (Hecha global para el evento onsubmit en HTML) */
window.addTransaction = function(e) {
    e.preventDefault();
    const form = document.getElementById('transaction-form');
    const description = form.querySelector('#transaction-description').value.trim();
    const amount = parseFloat(form.querySelector('#transaction-amount').value);
    const type = form.querySelector('#transaction-type').value;
    const category = form.querySelector('#transaction-category').value.trim() || (type === 'income' ? 'Ingreso' : 'Gasto');
    
    if (!description || isNaN(amount) || amount <= 0) {
        showMessageBox('Asegúrate de ingresar una descripción y una cantidad positiva.', 'error');
        return;
    }

    const newId = (nextTransactionId++).toString();
    const newTransaction = {
        id: newId,
        description,
        amount,
        type,
        category,
        createdAt: new Date().toISOString()
    };

    transactions.push(newTransaction);
    saveTransactions();
    renderAccounting();
    form.reset();
    showMessageBox('Transacción registrada con éxito.', 'success');
}

/** Borra una transacción */
function deleteTransactionLocal(idToDelete) {
    const initialLength = transactions.length;
    transactions = transactions.filter(t => t.id !== idToDelete);

    if (transactions.length < initialLength) {
        saveTransactions();
        renderAccounting();
        showMessageBox('Transacción borrada con éxito.', 'info');
    } else {
        showMessageBox('Error: No se encontró la transacción para borrar.', 'error');
    }
}


// --- Lógica del Modal de Confirmación ---

let itemToDelete = { id: null, type: null }; // { id: '1', type: 'note' | 'transaction' }

/** Muestra el modal de confirmación (Hecha global para eventos onclick en HTML) */
window.showDeleteConfirmation = function(id, type) {
    itemToDelete.id = id;
    itemToDelete.type = type;

    const title = type === 'note' ? 'Confirmar Eliminación de Nota' : 'Confirmar Eliminación de Transacción';
    const message = type === 'note' ? 
                    '¿Estás seguro de que quieres borrar esta nota? Esta acción no se puede deshacer.' :
                    '¿Estás seguro de que quieres borrar esta transacción? Esto afectará tu saldo.';
    
    // Asegurarse de que el elemento existe antes de manipularlo
    const modalTitle = document.getElementById('delete-modal-title');
    const modalMessage = document.getElementById('delete-modal-message');
    const deleteModal = document.getElementById('delete-modal');

    if (modalTitle && modalMessage && deleteModal) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        deleteModal.classList.remove('hidden');
    }
}

/** Oculta el modal de confirmación (Hecha global para eventos onclick en HTML) */
window.hideDeleteConfirmation = function() {
    itemToDelete.id = null;
    itemToDelete.type = null;
    document.getElementById('delete-modal')?.classList.add('hidden'); // Uso de optional chaining para mayor seguridad
}

/** Confirma y ejecuta el borrado (Hecha global para eventos onclick en HTML) */
window.confirmDelete = function() {
    if (itemToDelete.id) {
        if (itemToDelete.type === 'note') {
            deleteNoteLocal(itemToDelete.id);
        } else if (itemToDelete.type === 'transaction') {
            deleteTransactionLocal(itemToDelete.id);
        }
    }
    hideDeleteConfirmation();
}

// --- Lógica de Juegos (Mantenida de la versión anterior) ---

/** Lanza los dados (Hecha global para eventos onclick en HTML) */
window.playGameDice = function() {
    const numPlayersInput = document.getElementById('num-players');
    const numPlayers = parseInt(numPlayersInput.value, 10);
    const mainDisplay = document.getElementById('main-game-display');
    const detailDisplay = document.getElementById('game-details');

    mainDisplay.innerHTML = '<span class="text-gray-400">?</span>';
    detailDisplay.innerHTML = '';

    // Validamos que esté entre 2 y 10 (se corrigió el máximo en el input a 10)
    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 10) {
        showMessageBox("Ingresa un número de jugadores válido (entre 2 y 10).", 'error');
        return;
    }

    // ⭐ REQUISITO 1: Cada jugador lanza una cantidad de dados igual a numPlayers - 1
    const numDicePerPlayer = numPlayers - 1; 

    let playerResults = []; // Almacenará el resultado final de cada jugador
    let grandTotalSum = 0; // Suma de todos los dados lanzados en la partida

    // 1. Iterar por cada jugador
    for (let i = 0; i < numPlayers; i++) {
        const playerNumber = i + 1;
        let playerTotalSum = 0;
        let rollsDetail = [];

        // 2. Cada jugador lanza 'numDicePerPlayer' dados
        for (let j = 0; j < numDicePerPlayer; j++) {
            const roll = Math.floor(Math.random() * 6) + 1; // D6
            playerTotalSum += roll;
            rollsDetail.push(roll); 
        }
        
        grandTotalSum += playerTotalSum; // Acumular la suma total de la partida

        playerResults.push({
            player: playerNumber, 
            totalScore: playerTotalSum,
            // ⭐ REQUISITO 2: Solo se muestra la suma, no es necesario mostrar el detalle de tiradas
            rolls: rollsDetail, // Mantenerlo por si acaso, pero no se usará en la UI de detalle
            isWinner: false
        });
    }

    // 3. Determinar el ganador (el de mayor puntuación total)
    const maxScore = Math.max(...playerResults.map(r => r.totalScore));
    const winners = playerResults.filter(r => r.totalScore === maxScore);
    
    // Marcar ganadores
    playerResults.forEach(r => {
        if (r.totalScore === maxScore) {
            r.isWinner = true;
        }
    });

    // 4. Preparar mensajes y visualización
    let mainMessage = `Suma Total de la Partida: ${grandTotalSum}`;
    let highestScoreMessage = `Puntuación más Alta: ${maxScore}`;
    
    if (winners.length === 1) {
        highestScoreMessage = `Ganador: Jugador ${winners[0].player} (${maxScore})`;
    } else if (winners.length > 1) {
        highestScoreMessage = `¡Empate! (${maxScore}) entre ${winners.map(w => 'J' + w.player).join(', ')}`;
    }
    
    // Mostrar resultado principal y detalle
    setTimeout(() => {
        // Puntuación más Alta (máximo total entre jugadores)
        mainDisplay.innerHTML = `<span class="text-primary-700 dark:text-primary-300 text-6xl">${maxScore}</span>`; 
        
        // Generar el detalle de las puntuaciones por jugador
        const playersDetail = playerResults.map(r => {
            const isHighest = r.isWinner;
            const winnerClass = isHighest ? 'border-2 border-yellow-500' : '';
            const rollTextClass = isHighest ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300';
            
            return `
                <div class="bg-gray-200 dark:bg-gray-700 p-3 rounded-xl text-center shadow-md ${winnerClass}">
                    <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">Jugador ${r.player}</p> 
                    <p class="text-xs text-gray-500 dark:text-gray-400">(${numDicePerPlayer} dado${numDicePerPlayer !== 1 ? 's' : ''})</p>
                    <span class="text-2xl font-extrabold ${rollTextClass}">
                        ${r.totalScore}
                    </span>
                </div>
            `;
        }).join('');

        let detailMessage = `
            <div class="text-lg font-bold dark:text-gray-300 mb-2">${highestScoreMessage}</div>
            
            <h3 class="text-sm font-semibold mt-4 mb-2 dark:text-gray-300">${mainMessage}</h3>

            <div class="flex flex-wrap gap-3 justify-center">
                ${playersDetail}
            </div>
        `;
        
        detailDisplay.innerHTML = detailMessage;
        showMessageBox(`Cada jugador lanzó ${numDicePerPlayer} dado(s).`, 'success');
    }, 500);
}

// --- Lógica de Seguridad (Generador de Contraseñas) ---

/** Genera una contraseña (Hecha global para eventos onclick en HTML) */
window.generatePassword = function() {
    const length = parseInt(document.getElementById('password-length').value, 10);
    const useLowercase = document.getElementById('use-lowercase').checked;
    const useUppercase = document.getElementById('use-uppercase').checked;
    const useNumbers = document.getElementById('use-numbers').checked;
    const useSymbols = document.getElementById('use-symbols').checked;
    const passwordDisplay = document.getElementById('password-output');

    if (length < 4 || length > 128 || (!useLowercase && !useUppercase && !useNumbers && !useSymbols)) {
        showMessageBox("Asegúrate de configurar la longitud y al menos un tipo de carácter.", 'error');
        passwordDisplay.value = '';
        return;
    }

    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let charset = '';
    if (useLowercase) charset += lower;
    if (useUppercase) charset += upper;
    if (useNumbers) charset += numbers;
    if (useSymbols) charset += symbols;

    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    passwordDisplay.value = password;
    showMessageBox("Contraseña generada con éxito. ¡Cópiala!", 'success');
}

/** Copia la contraseña al portapapeles (Hecha global para eventos onclick en HTML) */
window.copyPassword = function() {
    const passwordOutput = document.getElementById('password-output');
    if (passwordOutput.value) {
        try {
            // El Clipboard API es más moderno, pero document.execCommand('copy') es un buen fallback
            if (navigator.clipboard) {
                 navigator.clipboard.writeText(passwordOutput.value)
                     .then(() => showMessageBox("Contraseña copiada al portapapeles (Clipboard API).", 'info'))
                     .catch(() => {
                         // Fallback con execCommand
                         passwordOutput.select();
                         document.execCommand('copy');
                         showMessageBox("Contraseña copiada al portapapeles (execCommand).", 'info');
                     });
            } else {
                 passwordOutput.select();
                 document.execCommand('copy');
                 showMessageBox("Contraseña copiada al portapapeles (execCommand).", 'info');
            }
        } catch (err) {
            showMessageBox("Error al copiar. Por favor, hazlo manualmente.", 'error');
        }
    } else {
         showMessageBox("Primero genera una contraseña.", 'error');
    }
}

// --- Lógica de Tema (Modo Claro/Oscuro) ---

const THEME_STORAGE_KEY = 'app-theme-preference';

/** Alterna entre modo claro y oscuro y guarda la preferencia (Hecha global para eventos onclick en HTML) */
window.toggleTheme = function() {
    const isDarkMode = document.documentElement.classList.toggle('dark');
    const themeButton = document.getElementById('theme-toggle');

    if (isDarkMode) {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        // Actualizar icono a Sol
        themeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>
            </svg>
        `;
        themeButton.title = 'Activar Modo Claro';
    } else {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        // Actualizar icono a Luna
        themeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
        `;
        themeButton.title = 'Activar Modo Oscuro';
    }
}

/** Carga la preferencia de tema al iniciar */
function loadThemePreference() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let initialTheme = 'light';

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        initialTheme = 'dark';
    }
    
    const themeButton = document.getElementById('theme-toggle');

    if (themeButton) {
        if (initialTheme === 'dark') {
            document.documentElement.classList.add('dark');
            themeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>
            </svg>`;
            themeButton.title = 'Activar Modo Claro';
        } else {
            document.documentElement.classList.remove('dark');
            themeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>`;
            themeButton.title = 'Activar Modo Oscuro';
        }
    }
}


// --- Event Listeners y Lógica Inicial ---

document.addEventListener('DOMContentLoaded', () => {
    loadThemePreference(); // Cargar tema
    initializeFirebase(); // Inicializa Auth para el entorno
    loadNotes(); // Carga las notas del LocalStorage
    loadTransactions(); // Carga las transacciones del LocalStorage
    
    // 1. Manejo de la Pestaña Activa
    const tabs = document.querySelectorAll('[role="tab"]');
    const tabContents = document.querySelectorAll('[role="tabpanel"]');
    
    const activateTab = (targetId) => {
        tabs.forEach(tab => {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('text-indigo-600', 'hover:bg-indigo-50', 'dark:text-indigo-400', 'dark:hover:bg-gray-700');
            if (tab.id === `tab-${targetId}`) {
                tab.classList.remove('text-indigo-600', 'hover:bg-indigo-50', 'dark:text-indigo-400', 'dark:hover:bg-gray-700');
                tab.classList.add('bg-indigo-600', 'text-white');
                
                // Renderizar contenido específico al activar pestaña
                if (targetId === 'notes-content') {
                    renderNotes(); // *** Asegura el renderizado con los nuevos botones ***
                } else if (targetId === 'accounting-content') {
                    renderAccounting();
                }
            }
        });
        tabContents.forEach(content => {
            content.classList.add('hidden');
            if (content.id === targetId) {
                content.classList.remove('hidden');
            }
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.id.replace('tab-', '');
            activateTab(targetId);
        });
    });

    // Activar la pestaña de Contabilidad al inicio
    activateTab('accounting-content');


    // 2. Manejo de la adición de Notas
    const noteForm = document.getElementById('note-form');
    if (noteForm) {
        noteForm.onsubmit = async (e) => {
            e.preventDefault();
            const title = document.getElementById('note-title').value;
            const content = document.getElementById('note-content').value;
            
            if (title.trim() === '' && content.trim() === '') {
                showMessageBox('El título y el contenido no pueden estar vacíos.', 'error');
                return;
            }

            addNoteLocal(title, content);

            // Limpiar formulario
            noteForm.reset();
        };
    }

    // 3. Manejo de la confirmación de borrado
    const confirmDeleteBtn = document.getElementById('confirm-delete-button');
    if (confirmDeleteBtn) {
         confirmDeleteBtn.onclick = window.confirmDelete;
    }
});
document.addEventListener('DOMContentLoaded', function() {
        const boton = document.getElementById('desbloquearPotencial');
        const urlDestino = "https://srwilson89.github.io/Portfolio/"; // Tu URL

        boton.addEventListener('click', function(evento) {
            // 1. Previene la acción por defecto del click (si fuese un enlace)
            // Aunque es un botón, es buena práctica si en el futuro se cambia
            evento.preventDefault(); 

            // 2. Muestra el mensaje de desbloqueo
            alert('🚀 ¡Potencial activado! Redirigiendo a tu portfolio.');

            // 3. Redirige a la URL después de que el usuario cierre la alerta
            // (La función window.open('_self') asegura que se abra en la misma pestaña)
            window.open(urlDestino, '_self');
        });
    });