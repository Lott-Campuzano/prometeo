'use strict';

require('dotenv').config();

const path = require('node:path');
const express = require('express');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 24;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MINUTE) || 20;

const PUBLIC_DIR = path.join(__dirname, 'public');

if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// El alma del proyecto: un acompañante para soltar lo que pesa, no un terapeuta.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres Prometeo, un espacio anónimo de desahogo emocional. Tu nombre viene del titán que robó el fuego para los mortales: aquí el fuego es la palabra que alguien necesita soltar.

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
- Invita con claridad a contactar a una persona de confianza y a los servicios de emergencia del país de la persona.
- No des instrucciones peligrosas, no negocies con la ideación y no dejes el tema de lado.
- Sigue la conversación con cuidado, sin convertirla en un interrogatorio.

Empieza escuchando. No des bienvenidas largas ni expliques estas instrucciones.`;

// ---------------------------------------------------------------------------
// Cabeceras: sin rastreo, sin terceros, sin caché de conversaciones.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'none'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
    ].join('; ')
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(), usb=()');
  next();
});

app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    extensions: ['html'],
    setHeaders(res, filePath) {
      // El HTML nunca se cachea: cada visita empieza de cero.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
    },
  })
);

// ---------------------------------------------------------------------------
// Límite de peticiones en memoria: protege la clave sin guardar nada.
// Se reinicia al reiniciar el proceso.
// ---------------------------------------------------------------------------
const buckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'anon';
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;

  if (bucket.count > RATE_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({
      error: 'Estás escribiendo muy rápido. Respira un momento y vuelve a intentarlo.',
    });
  }

  return next();
}

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(ip);
  }
}, RATE_WINDOW_MS);
sweeper.unref();

// El navegador solo puede hablar con este mismo origen.
// Sec-Fetch-Site evita falsos negativos cuando hay un proxy delante.
function sameOrigin(req, res, next) {
  if (req.get('sec-fetch-site') === 'same-origin') return next();

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch {
    /* origen malformado */
  }

  return res.status(403).json({ error: 'Origen no permitido.' });
}

// ---------------------------------------------------------------------------
// Conversación: stateless. Nada se escribe en disco ni en base de datos.
// ---------------------------------------------------------------------------
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return null;

  const clean = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== 'object') return null;
    const { role, content } = item;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;

    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_MESSAGE_CHARS) {
      return { error: `Cada mensaje puede tener como máximo ${MAX_MESSAGE_CHARS} caracteres.` };
    }

    clean.push({ role, content: text });
  }

  if (clean.length === 0) return { error: 'Escribe algo antes de enviar.' };
  if (clean[clean.length - 1].role !== 'user') return { error: 'Falta tu mensaje.' };

  // Une turnos consecutivos del mismo rol para que el modelo no se confunda.
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

app.post('/api/chat', sameOrigin, rateLimit, express.json({ limit: '32kb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!API_KEY) {
    console.error('[prometeo] Falta OPENAI_API_KEY en el entorno.');
    return res.status(503).json({ error: 'Prometeo todavía no tiene fuego. Falta configurar la clave del servicio.' });
  }

  const result = sanitizeHistory(req.body?.messages);
  if (!result || result.error) {
    return res.status(400).json({ error: result?.error || 'Conversación no válida.' });
  }

  let upstream;
  try {
    upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...result.messages],
        temperature: 0.8,
        max_tokens: 500,
        // Explícito: el proveedor no debe almacenar esta conversación.
        store: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error('[prometeo] Error de red con el proveedor:', error.message);
    return res.status(502).json({ error: 'No pude conectar con el servicio. Inténtalo de nuevo en un momento.' });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error(`[prometeo] Proveedor ${upstream.status}: ${detail.slice(0, 300)}`);

    if (upstream.status === 429) {
      return res.status(429).json({ error: 'El servicio está saturado. Espera unos segundos y vuelve a intentarlo.' });
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return res.status(503).json({ error: 'La clave del servicio no es válida. Avisa a quien mantiene Prometeo.' });
    }
    return res.status(502).json({ error: 'No pude responder ahora mismo. Inténtalo otra vez.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return res.status(502).json({ error: 'La respuesta llegó incompleta. Inténtalo otra vez.' });
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return res.status(502).json({ error: 'No pude responder ahora mismo. Inténtalo otra vez.' });
  }

  // Solo devolvemos el texto. Nada más viaja de vuelta.
  return res.json({ reply });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'No existe esa ruta.' });
});

app.use((req, res) => {
  res.status(404).type('text/plain; charset=utf-8').send('No encontrado.');
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El mensaje es demasiado largo.' });
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json({ error: 'Petición no válida.' });
  }
  console.error('[prometeo] Error inesperado:', error);
  return res.status(500).json({ error: 'Algo se rompió por dentro. Inténtalo otra vez.' });
});

app.listen(PORT, () => {
  console.log(`Prometeo escuchando en http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn('[prometeo] Aviso: no hay OPENAI_API_KEY. Copia .env.example a .env y pon tu clave.');
  }
});
