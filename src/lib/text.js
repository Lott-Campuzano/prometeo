/**
 * Utilidades de texto sin dependencias.
 *
 * `normalize` quita acentos, mayúsculas y espacios sobrantes para que la
 * búsqueda de países funcione aunque se escriba "peru", "Perú" o "PERU".
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
