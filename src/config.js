/**
 * Constantes compartidas por el cliente y el servidor.
 *
 * Este archivo es JavaScript puro (sin APIs del navegador ni de Node) para que
 * pueda importarse tanto en los componentes de Astro como en el endpoint y en
 * los scripts del navegador.
 */

/** Identidad y textos base del proyecto. */
export const SITE = {
  name: 'Prometeo',
  tagline: 'Un lugar para soltar lo que pesa.',
  description:
    'Espacio anónimo y efímero para desahogarte. Sin cuentas, sin historial y sin rastro: lo que escribes se va con la pestaña.',
  repo: 'https://github.com/Lott-Campuzano/prometeo',
};

/**
 * Límites de la conversación.
 *
 * `inactivityMs` se aplica solo en el navegador: si no hay actividad, la
 * conversación se borra de la memoria de la pestaña.
 */
export const CHAT = {
  maxChars: 2000,
  maxHistory: 24,
  maxStored: 60,
  inactivityMs: 20 * 60 * 1000,
};

/** Ideas para romper el hielo. Se muestran solo cuando no hay mensajes. */
export const SUGGESTIONS = [
  'Me pesa algo y no sé cómo decirlo',
  'No puedo parar de darle vueltas',
  'Solo necesito que alguien escuche',
];
