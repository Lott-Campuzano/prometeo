/**
 * Endpoint del chat.
 *
 * `prerender = false` es la única excepción al modo estático: esta ruta se
 * compila como función serverless de Vercel. Todo lo demás (HTML, CSS, fuentes
 * y datos) se sirve como archivos estáticos.
 *
 * La lógica vive en `src/lib/prometeo.js` para poder probarla y documentarla
 * por separado.
 */

import { handleChat } from '../../lib/prometeo.js';

/** Fuerza renderizado bajo demanda para esta ruta. */
export const prerender = false;

/**
 * @param {{ request: Request }} context
 * @returns {Promise<Response>}
 */
export const POST = ({ request }) => handleChat(request);

/**
 * El endpoint solo acepta POST. Un GET explícito evita respuestas ambiguas y
 * deja claro en la cabecera `Allow` cuál es el método correcto.
 *
 * @returns {Response}
 */
export const GET = () =>
  new Response(JSON.stringify({ error: 'Usa POST para enviar mensajes.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Allow: 'POST',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
