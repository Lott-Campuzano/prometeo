/**
 * Tema claro / oscuro / automático.
 *
 * El estado vive solo en memoria y en el atributo `data-theme` del <html>.
 * No se usa localStorage, sessionStorage ni cookies: al recargar, el tema
 * vuelve a seguir la preferencia del sistema. Es parte de la promesa de no
 * dejar rastro.
 *
 * - Sin `data-theme`: CSS usa `prefers-color-scheme` (automático).
 * - `data-theme="light"` / `"dark"`: fuerza ese tema.
 */

const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');

const MODES = ['auto', 'light', 'dark'];

const LABELS = {
  auto: {
    aria: 'Tema automático. Cambiar a tema claro.',
    title: 'Tema automático (sigue el sistema)',
  },
  light: {
    aria: 'Tema claro. Cambiar a tema oscuro.',
    title: 'Tema claro',
  },
  dark: {
    aria: 'Tema oscuro. Cambiar a tema automático.',
    title: 'Tema oscuro',
  },
};

let index = 0;

function applyTheme() {
  const mode = MODES[index];

  if (mode === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.dataset.theme = mode;
  }

  if (toggle) {
    toggle.dataset.mode = mode;
    toggle.setAttribute('aria-label', LABELS[mode].aria);
    toggle.title = LABELS[mode].title;
  }
}

if (toggle) {
  toggle.addEventListener('click', () => {
    index = (index + 1) % MODES.length;
    applyTheme();
  });
}

applyTheme();
