/**
 * Prometeo — comportamiento del navegador.
 *
 * Dos módulos independientes:
 * 1. Chat: la conversación vive solo en el array `history` de esta pestaña.
 * 2. Diálogo de líneas de ayuda: abre el <dialog>, filtra países y detecta el
 *    idioma del navegador.
 *
 * Reglas de esta casa:
 * - Nunca se usa localStorage, sessionStorage, IndexedDB ni cookies.
 * - Al cerrar o recargar la pestaña, no queda nada.
 * - Tras 20 minutos sin actividad, la conversación se borra sola.
 * - Ningún texto se escribe con innerHTML: se usa textContent.
 */

import { CHAT } from '../config.js';
import { normalize } from '../lib/text.js';

/** Error de conversación con un mensaje ya traducido para la persona. */
class ChatError extends Error {}

/**
 * Mensaje amable según el estado HTTP. Si el servidor ya manda uno, se respeta.
 *
 * @param {number} status
 * @param {unknown} serverMessage
 * @returns {string}
 */
function friendlyMessage(status, serverMessage) {
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  if (status === 429) return 'Estás escribiendo muy rápido. Respira un momento y vuelve a intentarlo.';
  if (status === 413) return 'Ese mensaje es demasiado largo.';
  if (status >= 500) return 'Prometeo no pudo responder ahora mismo. Inténtalo otra vez.';
  return 'No pude enviar el mensaje. Inténtalo otra vez.';
}

// ---------------------------------------------------------------------------
// Conversación
// ---------------------------------------------------------------------------

function initChat() {
  const log = document.getElementById('chat-log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const resetBtn = document.getElementById('reset-btn');
  const counter = document.getElementById('char-count');

  if (!log || !form || !input || !sendBtn || !resetBtn) return;

  /** @type {{ role: 'user' | 'assistant', content: string }[]} */
  let history = [];
  let busy = false;
  /** @type {AbortController | null} */
  let controller = null;
  let idleTimer = null;
  let epoch = 0;

  // Se guarda una copia del estado vacío renderizado por Astro. Al borrar, se
  // clona en lugar de reconstruirlo con HTML en el cliente.
  const emptyTemplate = log.querySelector('[data-empty-state]')?.cloneNode(true) ?? null;

  function updateSendState() {
    const length = input.value.length;

    if (counter) counter.textContent = `${length} / ${CHAT.maxChars}`;
    sendBtn.disabled = busy || input.value.trim().length === 0;
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function removeEmptyState() {
    log.querySelector('[data-empty-state]')?.remove();
  }

  /**
   * Restaura el estado vacío, opcionalmente con una nota.
   *
   * @param {string} [note]
   */
  function renderEmptyState(note) {
    if (!emptyTemplate) return;

    const node = emptyTemplate.cloneNode(true);
    if (note) {
      const noteElement = node.querySelector('.empty-note');
      if (noteElement) {
        noteElement.textContent = note;
        noteElement.hidden = false;
      }
    }

    log.replaceChildren(node);
  }

  /**
   * Añade un mensaje al registro.
   *
   * @param {'user' | 'assistant'} role
   * @param {string} text
   * @param {{ error?: boolean, typing?: boolean }} [options]
   * @returns {HTMLElement}
   */
  function appendMessage(role, text, options = {}) {
    const row = document.createElement('div');
    row.className = `msg msg-${role}`;
    if (options.error) row.classList.add('msg-error');

    if (role === 'assistant') {
      const from = document.createElement('span');
      from.className = 'msg-from';
      from.textContent = 'Prometeo';
      row.append(from);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (options.typing) {
      row.classList.add('msg-typing');
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-label', 'Prometeo está pensando');

      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
      bubble.append(dots);
    } else {
      bubble.textContent = text;
      if (options.error) bubble.setAttribute('role', 'alert');
    }

    row.append(bubble);
    log.append(row);
    scrollToEnd();

    return row;
  }

  function trimHistory() {
    if (history.length > CHAT.maxStored) {
      history = history.slice(-CHAT.maxStored);
    }
  }

  function scheduleIdleWipe() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (history.length > 0 || log.querySelector('.msg')) {
        const minutes = Math.round(CHAT.inactivityMs / 60_000);
        wipe(`La conversación se borró tras ${minutes} minutos sin actividad.`);
      }
    }, CHAT.inactivityMs);
  }

  /**
   * Borra la conversación de la memoria y de la pantalla.
   *
   * @param {string} [note]
   */
  function wipe(note) {
    epoch += 1;

    controller?.abort();
    controller = null;
    busy = false;
    history = [];

    renderEmptyState(note);
    log.removeAttribute('aria-busy');

    input.value = '';
    updateSendState();

    clearTimeout(idleTimer);
    scheduleIdleWipe();

    input.focus({ preventScroll: true });
  }

  /**
   * Envía el historial al proxy y muestra la respuesta.
   *
   * @param {string} text
   */
  async function sendMessage(text) {
    const myEpoch = epoch;

    removeEmptyState();
    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    trimHistory();

    busy = true;
    updateSendState();
    log.setAttribute('aria-busy', 'true');

    const typing = appendMessage('assistant', '', { typing: true });
    controller = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ messages: history.slice(-CHAT.maxHistory) }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ChatError(friendlyMessage(response.status, data?.error));
      }

      const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
      if (!reply) throw new ChatError('La respuesta llegó vacía. Inténtalo otra vez.');

      if (epoch !== myEpoch) return;

      history.push({ role: 'assistant', content: reply });
      trimHistory();
      appendMessage('assistant', reply);
    } catch (error) {
      if (error?.name === 'AbortError' || epoch !== myEpoch) return;

      const message =
        error instanceof ChatError
          ? error.message
          : 'Se cortó la conexión. Revisa tu red e inténtalo de nuevo.';

      appendMessage('assistant', message, { error: true });
    } finally {
      typing.remove();
      controller = null;
      log.removeAttribute('aria-busy');

      if (epoch === myEpoch) {
        busy = false;
        updateSendState();
        scheduleIdleWipe();
        input.focus({ preventScroll: true });
      }
    }
  }

  // --- Eventos de la conversación -----------------------------------------

  input.addEventListener('input', () => {
    updateSendState();
    scheduleIdleWipe();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!busy) form.requestSubmit();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;

    const text = input.value.trim().slice(0, CHAT.maxChars);
    if (!text) return;

    input.value = '';
    updateSendState();
    void sendMessage(text);
  });

  // Delegación: los chips del estado vacío se clonan al borrar y siguen
  // funcionando sin volver a registrar listeners.
  log.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-suggestion]') : null;
    if (!target) return;

    input.value = target.textContent?.trim() ?? '';
    updateSendState();
    input.focus({ preventScroll: true });
  });

  resetBtn.addEventListener('click', () => {
    wipe('Empezaste de nuevo. Lo anterior ya no existe.');
  });

  // Al salir se suelta todo. `pagehide` también cubre el botón atrás.
  window.addEventListener('pagehide', () => {
    history = [];
    controller?.abort();
    controller = null;
    clearTimeout(idleTimer);
  });

  // Si el navegador restaura la página desde la caché de retroceso, se limpia.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) wipe('Esta conversación no se recupera. Empezamos de cero.');
  });

  updateSendState();
  scheduleIdleWipe();
}

// ---------------------------------------------------------------------------
// Líneas de ayuda
// ---------------------------------------------------------------------------

function initCrisisDialog() {
  const dialog = document.getElementById('crisis-dialog');
  if (!dialog) return;

  const search = document.getElementById('crisis-search');
  const list = document.getElementById('crisis-list');
  const empty = document.getElementById('search-empty');
  const banner = document.getElementById('detected-banner');
  const detectedName = document.getElementById('detected-name');
  const detectedLink = document.getElementById('detected-link');

  if (!search || !list || !empty) return;

  const cards = [...dialog.querySelectorAll('[data-country]')];
  const sections = [...dialog.querySelectorAll('[data-region]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {HTMLElement | null} */
  let detectedCard = null;

  /**
   * Intenta adivinar el país con el idioma del navegador (`es-MX`, `pt-BR`).
   * No se hace ninguna petición ni se usa geolocalización.
   *
   * @returns {HTMLElement | null}
   */
  function detectCountry() {
    const languages = [navigator.language, ...(navigator.languages ?? [])];
    const codes = new Set();

    for (const language of languages) {
      const match = /[-_]([A-Za-z]{2})$/.exec(language ?? '');
      if (match) codes.add(match[1].toUpperCase());
    }

    for (const code of codes) {
      const card = dialog.querySelector(`[data-country="${code}"]`);
      if (card) return /** @type {HTMLElement} */ (card);
    }

    return null;
  }

  function filterCountries() {
    const query = normalize(search.value);
    let visible = 0;

    for (const card of cards) {
      const matches = !query || card.dataset.search?.includes(query);
      const item = card.closest('li');

      if (item) item.hidden = !matches;
      if (matches) visible += 1;
    }

    for (const section of sections) {
      const hasVisible = [...section.querySelectorAll('[data-country]')].some((card) => {
        const item = card.closest('li');
        return item ? !item.hidden : false;
      });
      section.hidden = !hasVisible;
    }

    empty.hidden = visible > 0;

    if (banner) {
      banner.hidden = Boolean(query) || !detectedCard;
    }
  }

  function showDetectedCountry() {
    detectedCard = detectCountry();
    if (!detectedCard || !banner || !detectedName || !detectedLink) return;

    const name = detectedCard.querySelector('.country-name')?.textContent?.trim() || 'tu país';
    detectedName.textContent = name;
    detectedLink.setAttribute('href', `#${detectedCard.id}`);
    detectedCard.classList.add('is-detected');
    banner.hidden = Boolean(normalize(search.value));
  }

  function openDialog() {
    if (typeof dialog.showModal !== 'function') {
      window.location.href = '/ayuda';
      return;
    }

    if (!dialog.open) dialog.showModal();

    document.body.classList.add('dialog-open');
    showDetectedCountry();
    filterCountries();
    requestAnimationFrame(() => search.focus({ preventScroll: true }));
  }

  // El navbar enlaza a /ayuda; en la página principal se abre el diálogo.
  document.querySelectorAll('[data-crisis-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openDialog();
    });
  });

  search.addEventListener('input', filterCountries);

  detectedLink?.addEventListener('click', (event) => {
    if (!detectedCard) return;
    event.preventDefault();

    detectedCard.scrollIntoView({
      block: 'start',
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
    detectedCard.focus({ preventScroll: true });
  });

  // Clic fuera de la tarjeta = cerrar. El botón de la cabecera usa
  // <form method="dialog">, que cierra de forma nativa.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    search.value = '';
    filterCountries();
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

initChat();
initCrisisDialog();
