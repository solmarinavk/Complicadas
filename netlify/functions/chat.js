// netlify/functions/chat.js
// Endpoint de TEXTO. Si speak === true, también devuelve la respuesta en audio.
// La personalidad se edita en lib/config.js. La API key vive en OPENAI_API_KEY.

const { chatCompletion, synthesizeSpeech, json, ApiError } = require('./lib/openai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Petición inválida.' }); }

  try {
    const reply = await chatCompletion(body.messages);

    let audio = null;
    if (body.speak && reply) {
      try { audio = await synthesizeSpeech(reply); }
      catch (e) { console.error('TTS falló, devuelvo solo texto:', e); }
    }

    return json(200, { reply, audio });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.userMessage : 'Error interno.';
    console.error('chat handler:', err);
    return json(status, { error: message });
  }
};
