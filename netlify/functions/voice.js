// netlify/functions/voice.js
// Endpoint de VOZ. Hace todo el flujo en una sola llamada:
//   audio del usuario  ->  transcripción (STT)
//   transcripción + historial  ->  respuesta (chat)
//   respuesta  ->  audio (TTS)
// Devuelve: { transcript, reply, audio (mp3 en base64) }

const { transcribeAudio, chatCompletion, synthesizeSpeech, json, ApiError, cfg } = require('./lib/openai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Petición inválida.' }); }

  const { audio, mimeType, messages } = body;
  if (!audio || typeof audio !== 'string') {
    return json(400, { error: 'No se recibió el audio.' });
  }

  // Control de tamaño para evitar costos/abusos.
  const approxBytes = (audio.length * 3) / 4;
  if (approxBytes > cfg.MAX_AUDIO_MB * 1024 * 1024) {
    return json(413, { error: 'La nota de voz es demasiado larga. Intenta una más corta.' });
  }

  try {
    const buffer = Buffer.from(audio, 'base64');

    // 1) Audio -> texto
    const transcript = await transcribeAudio(buffer, mimeType);
    if (!transcript) {
      return json(200, {
        transcript: '',
        reply: 'No logré escuchar bien tu nota de voz. ¿Me la repites un poco más cerca del micrófono?',
        audio: null,
      });
    }

    // 2) Texto -> respuesta del bot (con contexto previo)
    const history = Array.isArray(messages) ? messages : [];
    const reply = await chatCompletion([...history, { role: 'user', content: transcript }]);

    // 3) Respuesta -> audio
    let speech = null;
    try {
      speech = await synthesizeSpeech(reply);
    } catch (e) {
      // Si falla solo la voz, igual devolvemos el texto.
      console.error('TTS falló, devuelvo solo texto:', e);
    }

    return json(200, { transcript, reply, audio: speech });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.userMessage : 'Error interno.';
    console.error('voice handler:', err);
    return json(status, { error: message });
  }
};
