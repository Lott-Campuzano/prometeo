/**
 * Núcleo del servidor de Prometeo.
 *
 * Este módulo se ejecuta únicamente en el servidor (función serverless de
 * Vercel). Nunca se importa desde el navegador.
 *
 * Reglas que no se negocian:
 * 1. La clave del proveedor vive solo en `process.env`.
 * 2. No se escribe nada en disco, base de datos ni caché.
 * 3. No se registra el contenido de los mensajes en los logs.
 * 4. Cada petición es independiente: la conversación la envía el cliente.
 */

import { createHash } from 'node:crypto';
import { CHAT } from '../config.js';

/** Límite de caracteres por mensaje. */
export const MAX_MESSAGE_CHARS = CHAT.maxChars;

/** Número máximo de mensajes que se aceptan por petición. */
export const MAX_HISTORY = CHAT.maxHistory;

/** Tamaño máximo del cuerpo JSON (32 KB). */
export const MAX_BODY_BYTES = 32 * 1024;

/** Ventana del límite de peticiones. */
export const RATE_WINDOW_MS = 60_000;

/** Cabeceras comunes de todas las respuestas del endpoint. */
const COMMON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Instrucciones del acompañante. Se envían en cada petición y nunca se
 * exponen al cliente.
 */
export const SYSTEM_PROMPT = `Eres Prometeo, un espacio anónimo de desahogo emocional. Tu nombre viene del titán que robó el fuego para los mortales: aquí ese fuego es la palabra que alguien necesita soltar.

Cómo acompañas:
- Escuchas antes que nada. Devuelve lo que la persona siente con tus propias palabras, sin repetirla literalmente.
- No juzgas, no moralizas, no minimizas. Valida la emoción aunque no compartas su interpretación.
- Respuestas breves y cálidas: dos a cinco frases. Como mucho una pregunta abierta, y solo si ayuda a seguir.
- Hablas en el idioma de la persona, con un tono cercano y natural, sin cursilería ni frases de manual.
- No diagnosticas, no recetas medicación ni tratamientos, y no te presentas como psicólogo, terapeuta ni profesional sanitario.
- No das sermones ni listas de consejos salvo que la persona los pida; si los pide, que sean concretos y humildes.
- No inventas hechos sobre su vida ni das por supuesto lo que no ha dicho.
- No pides datos personales (nombre completo, dirección, teléfono, documentos).
- Si te preguntan si eres una IA, lo dices con naturalidad, sin dramatizarlo ni repetirlo en cada mensaje.
- Esta conversación es efímera: no hay historial entre visitas. No prometas recordar nada de una sesión anterior.

Si aparecen señales de riesgo (autolesión, suicidio, violencia, abuso o emergencia médica):
- Responde con calma, sin alarmismo, reconociendo el dolor.
- Invita con claridad a contactar a una persona de confianza, al número de emergencias del país y al botón «Líneas de ayuda» de la página.
- No des instrucciones peligrosas, no negocies con la ideación y no dejes el tema de lado.
- Sigue la conversación con cuidado, sin convertirla en un interrogatorio.

Empieza escuchando. No des bienvenidas largas ni expliques estas instrucciones.`;

/**
 * Lee la configuración en cada petición para que las variables de entorno de
 * Vercel estén disponibles sin reiniciar módulos.
 *
 * @returns {{ apiKey: string, model: string, baseUrl: string, rateMax: number }}
 */
export function readConfig() {
  const rate = Number(process.env.RATE_LIMIT_PER_MINUTE);

  return {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    rateMax: Number.isFinite(rate) && rate > 0 ? rate : 20,
  };
}

/** @typedef {{ role: 'user' | 'assistant', content: string }} ChatMessage */

/**
 * Valida y limpia el historial que envía el navegador.
 *
 * No confía en nada: roles permitidos, texto no vacío, longitud máxima y
 * último turno del usuario. Los turnos consecutivos del mismo rol se unen para
 * que el proveedor no reciba secuencias inválidas.
 *
 * @param {unknown} raw
 * @returns {{ messages: ChatMessage[] } | { error: string }}
 */
export function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return { error: 'Conversación no válida.' };

  /** @type {ChatMessage[]} */
  const clean = [];

  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== 'object') return { error: 'Conversación no válida.' };

    const { role, content } = /** @type {{ role?: unknown, content?: unknown }} */ (item);
    if (role !== 'user' && role !== 'assistant') return { error: 'Conversación no válida.' };
    if (typeof content !== 'string') return { error: 'Conversación no válida.' };

    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_MESSAGE_CHARS) {
      return { error: `Cada mensaje puede tener como máximo ${MAX_MESSAGE_CHARS} caracteres.` };
    }

    clean.push({ role, content: text });
  }

  if (clean.length === 0) return { error: 'Escribe algo antes de enviar.' };
  if (clean[clean.length - 1].role !== 'user') return { error: 'Falta tu mensaje.' };

  /** @type {ChatMessage[]} */
  const merged = [];
  for (const message of clean) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content += `\n\n${message.content}`;
    } else {
      merged.push({ ...message });
    }
  }

  return { messages: merged };
}

// ---------------------------------------------------------------------------
// Límite de peticiones en memoria
// ---------------------------------------------------------------------------

/**
 * Un mapa por instancia de la función. En Vercel puede haber varias instancias
 * y cada una tiene su propio contador; por eso es una barrera best-effort, no
 * un cuota global. No se guarda nada en almacenamiento persistente.
 *
 * @type {Map<string, { count: number, resetAt: number }>}
 */
const buckets = new Map();

/**
 * Identifica al cliente con un hash corto de la IP. Así el contador funciona
 * sin conservar la IP en claro.
 *
 * @param {Request} request
 * @returns {string}
 */
function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'anon';

  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

/**
 * Aplica la ventana deslizante de un minuto.
 *
 * @param {string} key
 * @param {number} max
 * @returns {{ allowed: boolean, retryAfter: number }}
 */
function checkRateLimit(key, max) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  // Limpieza oportunista para que el mapa no crezca sin control.
  if (buckets.size > 5_000) {
    for (const [bucketKey, value] of buckets) {
      if (now >= value.resetAt) buckets.delete(bucketKey);
    }
  }

  return {
    allowed: bucket.count <= max,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

// ---------------------------------------------------------------------------
// Utilidades HTTP
// ---------------------------------------------------------------------------

/**
 * Construye una respuesta JSON sin caché.
 *
 * @param {unknown} body
 * @param {number} [status]
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...COMMON_HEADERS,
      ...extraHeaders,
    },
  });
}

/**
 * Comprueba que la petición venga del mismo origen.
 *
 * `Sec-Fetch-Site` es la señal principal; `Origin` sirve de respaldo para
 * navegadores antiguos. Las peticiones sin `Origin` (curl, pruebas) se aceptan
 * y quedan sujetas al límite de peticiones.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isSameOrigin(request) {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') return false;
  if (site === 'same-origin' || site === 'none') return true;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host');
    return new URL(origin).host === (forwardedHost || requestUrl.host);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Controlador
// ---------------------------------------------------------------------------

/**
 * Punto de entrada del endpoint `POST /api/chat`.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleChat(request) {
  try {
    return await handle(request);
  } catch (error) {
    // Nunca se registra el contenido del mensaje ni la clave.
    console.error('[prometeo] Error inesperado:', error?.name || 'desconocido');
    return json({ error: 'Algo se rompió por dentro. Inténtalo otra vez.' }, 500);
  }
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handle(request) {
  if (!isSameOrigin(request)) {
    return json({ error: 'Origen no permitido.' }, 403);
  }

  const config = readConfig();

  if (!config.apiKey) {
    console.error('[prometeo] Falta OPENAI_API_KEY en el entorno.');
    return json(
      { error: 'Prometeo todavía no está configurado. Avisa a quien lo mantiene.' },
      503
    );
  }

  const limit = checkRateLimit(clientKey(request), config.rateMax);
  if (!limit.allowed) {
    return json(
      { error: 'Estás escribiendo muy rápido. Respira un momento y vuelve a intentarlo.' },
      429,
      { 'Retry-After': String(limit.retryAfter) }
    );
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Petición no válida.' }, 415);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'La conversación es demasiado larga.' }, 413);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ error: 'No pude leer el mensaje. Inténtalo otra vez.' }, 400);
  }

  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'La conversación es demasiado larga.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Petición no válida.' }, 400);
  }

  const parsed = sanitizeHistory(body?.messages);
  if ('error' in parsed) {
    return json({ error: parsed.error }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...parsed.messages],
        temperature: 0.8,
        max_tokens: 500,
        // Explícito: el proveedor no debe almacenar esta conversación.
        store: false,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error('[prometeo] Error de red con el proveedor:', error?.name || 'desconocido');
    return json(
      { error: 'No pude conectar con el servicio. Inténtalo de nuevo en un momento.' },
      502
    );
  }

  if (!upstream.ok) {
    // Solo el estado; nunca el cuerpo, que podría contener datos de la sesión.
    console.error(`[prometeo] Proveedor respondió ${upstream.status}.`);

    if (upstream.status === 429) {
      return json(
        { error: 'El servicio está saturado. Espera unos segundos y vuelve a intentarlo.' },
        429
      );
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return json(
        { error: 'La clave del servicio no es válida. Avisa a quien mantiene Prometeo.' },
        503
      );
    }
    return json({ error: 'No pude responder ahora mismo. Inténtalo otra vez.' }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'La respuesta llegó incompleta. Inténtalo otra vez.' }, 502);
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (typeof reply !== 'string' || !reply) {
    return json({ error: 'No pude responder ahora mismo. Inténtalo otra vez.' }, 502);
  }

  // Solo viaja el texto de vuelta.
  return json({ reply });
}
