'use strict';

/**
 * Prometeo — modo incógnito.
 *
 * Reglas de esta casa:
 * 1. La conversación vive únicamente en esta variable, en memoria RAM.
 * 2. Nunca se usa localStorage, sessionStorage, IndexedDB ni cookies.
 * 3. Al cerrar o recargar la pestaña, no queda nada.
 * 4. Tras un rato sin actividad, el fuego se apaga solo.
 */

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');

const MAX_CHARS = 2000;
const MAX_HISTORY = 24;
const INACTIVITY_MS = 20 * 60 * 1000;

const SUGGESTIONS = [
  'Me pesa algo y no sé cómo decirlo',
  'No puedo parar de darle vueltas',
  'Solo necesito que alguien escuche',
];

/** @type {{ role: 'user' | 'assistant', content: string }[]} */
let history = [];
let busy = false;
let inFlight = null;
let idleTimer = null;
let epoch = 0;

// ---------------------------------------------------------------------------
// Estado vacío
// ---------------------------------------------------------------------------

function buildEmptyState(note) {
  const empty = document.createElement('div');
  empty.className = 'empty';

  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Modo incógnito';

  const title = document.createElement('h1');
  title.innerHTML = 'Deja aquí lo que <em>no pudiste decir</em>.';

  const text = document.createElement('p');
  text.textContent =
    'No hay cuentas, no hay historial. Escribe, suéltalo, y cuando cierres la pestaña, se apaga.';

  const chips = document.createElement('div');
  chips.className = 'chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Ideas para empezar');

  for (const suggestion of SUGGESTIONS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = suggestion;
    chip.addEventListener('click', () => {
      userInput.value = suggestion;
      resizeInput();
      updateSendState();
      userInput.focus();
    });
    chips.append(chip);
  }

  empty.append(kicker, title, text, chips);

  if (note) {
    const notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent = note;
    empty.append(notice);
  }

  return empty;
}

function renderEmptyState(note) {
  chatLog.replaceChildren(buildEmptyState(note));
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

function flameIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M12.6 1.5c2.4 3.6 5.9 5.8 5.9 10.1A6.5 6.5 0 0 1 5.5 11.6c0-1.9.7-3.6 2-5 .1 1.6.7 2.8 2 3.6.3-3.3 1.3-6.2 3.1-8.7Z'
  );
  path.setAttribute('fill', 'currentColor');

  svg.append(path);
  return svg;
}

function scrollToEnd() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendMessage(role, text, { isError = false } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg msg-${role}${isError ? ' msg-error' : ''}`;

  if (role === 'assistant') {
    const from = document.createElement('span');
    from.className = 'msg-from';
    from.append(flameIcon(), document.createTextNode('Prometeo'));
    wrapper.append(from);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  wrapper.append(bubble);
  chatLog.append(wrapper);
  scrollToEnd();
}

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg msg-bot msg-typing';

  const from = document.createElement('span');
  from.className = 'msg-from';
  from.append(flameIcon(), document.createTextNode('Prometeo'));

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-label', 'Prometeo está pensando');

  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));

  bubble.append(dots);
  wrapper.append(from, bubble);
  chatLog.append(wrapper);
  scrollToEnd();

  return wrapper;
}

// ---------------------------------------------------------------------------
// Compositor
// ---------------------------------------------------------------------------

function resizeInput() {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
}

function updateSendState() {
  sendBtn.disabled = busy || userInput.value.trim().length === 0;
}

function clearInput() {
  userInput.value = '';
  resizeInput();
  updateSendState();
}

userInput.addEventListener('input', () => {
  resizeInput();
  updateSendState();
  scheduleIdleWipe();
});

userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (!busy) chatForm.requestSubmit();
  }
});

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

class ChatError extends Error {}

function friendlyMessage(status, serverMessage) {
  if (serverMessage) return serverMessage;
  if (status === 429) return 'Estás escribiendo muy rápido. Respira un momento y vuelve a intentarlo.';
  if (status === 413) return 'Ese mensaje es demasiado largo.';
  if (status >= 500) return 'Prometeo no pudo responder ahora mismo. Inténtalo otra vez.';
  return 'No pude enviar el mensaje. Inténtalo otra vez.';
}

async function sendMessage(text) {
  const myEpoch = epoch;

  clearEmptyState();
  appendMessage('user', text);
  history.push({ role: 'user', content: text });

  busy = true;
  updateSendState();
  chatLog.setAttribute('aria-busy', 'true');

  const typing = showTyping();
  inFlight = new AbortController();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      signal: inFlight.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ChatError(friendlyMessage(response.status, data?.error));
    }

    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    if (!reply) throw new ChatError('La respuesta llegó vacía. Inténtalo otra vez.');

    if (epoch !== myEpoch) return;

    history.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);
  } catch (error) {
    if (error.name === 'AbortError' || epoch !== myEpoch) return;

    const message =
      error instanceof ChatError
        ? error.message
        : 'Se cortó la conexión. Revisa tu red e inténtalo de nuevo.';

    appendMessage('assistant', message, { isError: true });
  } finally {
    typing.remove();
    chatLog.removeAttribute('aria-busy');
    inFlight = null;

    if (epoch === myEpoch) {
      busy = false;
      updateSendState();
      scheduleIdleWipe();
      userInput.focus();
    }
  }
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (busy) return;

  const text = userInput.value.trim().slice(0, MAX_CHARS);
  if (!text) return;

  clearInput();
  void sendMessage(text);
});

function clearEmptyState() {
  chatLog.querySelector('.empty')?.remove();
}

// ---------------------------------------------------------------------------
// Borrado
// ---------------------------------------------------------------------------

function wipe(note) {
  epoch += 1;
  inFlight?.abort();
  inFlight = null;
  busy = false;
  history = [];

  chatLog.replaceChildren(buildEmptyState(note));
  chatLog.removeAttribute('aria-busy');

  clearInput();
  scheduleIdleWipe();
  userInput.focus();
}

function scheduleIdleWipe() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (history.length > 0 || chatLog.querySelector('.msg')) {
      wipe('La conversación se apagó por inactividad.');
    }
  }, INACTIVITY_MS);
}

resetBtn.addEventListener('click', () => {
  wipe('Fuego nuevo. Lo anterior ya no existe.');
});

// Al salir, la conversación se suelta: no hay nada que recuperar.
window.addEventListener('pagehide', () => {
  history = [];
  inFlight?.abort();
  inFlight = null;
});

// Si el navegador restaura la página desde la caché de retroceso, se limpia igual.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) wipe();
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

renderEmptyState();
resizeInput();
updateSendState();
scheduleIdleWipe();
userInput.focus();
