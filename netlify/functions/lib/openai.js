// Helpers compartidos para hablar con la API de OpenAI.
// La API key se lee de la variable de entorno OPENAI_API_KEY (nunca del frontend).

const cfg = require('./config');

const OPENAI_BASE = 'https://api.openai.com/v1';

// Error con código HTTP y un mensaje apto para mostrar al usuario.
class ApiError extends Error {
  constructor(status, userMessage) {
    super(userMessage);
    this.status = status;
    this.userMessage = userMessage;
  }
}

function getKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ApiError(500, 'Falta configurar OPENAI_API_KEY en el servidor.');
  return key;
}

// Traduce errores de OpenAI a mensajes claros (incluye límite de uso 429).
function mapOpenAIError(status) {
  if (status === 429) {
    return new ApiError(429, 'Se alcanzó el límite de uso por ahora. Inténtalo de nuevo en unos minutos.');
  }
  if (status === 401) {
    return new ApiError(500, 'La clave de OpenAI no es válida. Revisa la configuración.');
  }
  return new ApiError(502, 'No pude obtener respuesta en este momento. Inténtalo de nuevo.');
}

// ---- Chat: genera la respuesta de texto ----
async function chatCompletion(messages) {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-cfg.HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: cfg.CHAT_MODEL,
      temperature: cfg.TEMPERATURE,
      max_tokens: cfg.MAX_TOKENS,
      messages: [{ role: 'system', content: cfg.SYSTEM_PROMPT }, ...cleaned],
    }),
  });

  if (!res.ok) {
    console.error('OpenAI chat error', res.status, await safeText(res));
    throw mapOpenAIError(res.status);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
}

// ---- Speech-to-Text: transcribe el audio del usuario ----
async function transcribeAudio(buffer, mimeType) {
  const form = new FormData();
  const ext = mimeType && mimeType.includes('mp4') ? 'mp4'
            : mimeType && mimeType.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
  form.append('model', cfg.TRANSCRIBE_MODEL);
  form.append('language', 'es');

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKey()}` },
    body: form,
  });

  if (!res.ok) {
    console.error('OpenAI transcribe error', res.status, await safeText(res));
    throw mapOpenAIError(res.status);
  }
  const data = await res.json();
  return (data?.text || '').trim();
}

// ---- Text-to-Speech: convierte la respuesta en audio mp3 (base64) ----
async function synthesizeSpeech(text) {
  const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: cfg.TTS_MODEL,
      voice: cfg.TTS_VOICE,
      input: text,
      instructions: cfg.TTS_INSTRUCTIONS,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    console.error('OpenAI tts error', res.status, await safeText(res));
    throw mapOpenAIError(res.status);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

module.exports = { ApiError, chatCompletion, transcribeAudio, synthesizeSpeech, json, cfg };
