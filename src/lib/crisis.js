/**
 * Utilidades para las líneas de ayuda.
 *
 * El JSON se importa en tiempo de build: Astro renderiza todos los países en
 * HTML, así que la página funciona incluso sin JavaScript y no hace peticiones
 * extra en el navegador.
 */

import data from '../data/crisis-lines.json';
import { normalize } from './text.js';

/** @typedef {{ label: string, number: string }} EmergencyNumber */
/** @typedef {{ name: string, number: string, note?: string, mode?: 'tel' | 'sms' }} CrisisLine */
/** @typedef {{ code: string, name: string, region: string, source?: string, emergency: EmergencyNumber[], lines: CrisisLine[] }} Country */

/** Orden en el que se muestran las regiones. */
export const REGION_ORDER = ['América', 'Europa', 'Asia', 'África', 'Oceanía'];

/** Datos completos, tal como se revisaron. */
export const crisisData = data;

/**
 * Agrupa los países por región y los ordena alfabéticamente.
 *
 * @param {Country[]} [countries]
 * @returns {{ region: string, countries: Country[] }[]}
 */
export function groupByRegion(countries = data.countries) {
  return REGION_ORDER.map((region) => ({
    region,
    countries: countries
      .filter((country) => country.region === region)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  })).filter((group) => group.countries.length > 0);
}

/**
 * Convierte un número en un enlace `tel:` o `sms:`.
 * Conserva `+`, `*` y `#`; elimina espacios, guiones y paréntesis.
 *
 * @param {{ number: string, mode?: 'tel' | 'sms' }} item
 * @returns {string}
 */
export function telHref(item) {
  const clean = String(item.number ?? '')
    .replace(/[^\d+*#]/g, '')
    .replace(/#/g, '%23');
  return `${item.mode === 'sms' ? 'sms' : 'tel'}:${clean}`;
}

/**
 * Texto plano que se usa para filtrar países en el diálogo.
 * Se calcula en el build y se guarda en `data-search`.
 *
 * @param {Country} country
 * @returns {string}
 */
export function countrySearchText(country) {
  const parts = [country.name, country.code, country.region];

  for (const item of country.emergency ?? []) parts.push(item.label, item.number);
  for (const line of country.lines ?? []) {
    parts.push(line.name, line.number, line.note ?? '');
  }

  return normalize(parts.join(' '));
}
