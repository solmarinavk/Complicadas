// netlify/functions/chat.js
// Endpoint de TEXTO: recibe el historial y devuelve la respuesta del bot.
// La personalidad se edita en config.js. La API key vive en OPENAI_API_KEY.

const { chatCompletion, json, ApiError } = require('./lib/openai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Petición inválida.' }); }

  try {
    const reply = await chatCompletion(body.messages);
    return json(200, { reply });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.userMessage : 'Error interno.';
    console.error('chat handler:', err);
    return json(status, { error: message });
  }
};
