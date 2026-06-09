// netlify/functions/chat.js
// Función serverless que conecta el chat con la API de OpenAI.
// La API key NUNCA se expone al navegador: vive en la variable
// de entorno OPENAI_API_KEY configurada en Netlify.

const SYSTEM_PROMPT = `
Eres "Complicadas", una amiga cercana que orienta y acompaña, sobre todo a mujeres,
para resolver dudas de la vida diaria y de cualquier tema.

Tu personalidad:
- Cálida, cercana y de confianza, como una amiga que escucha sin juzgar.
- Amigable y divertida, pero también informativa y clara.
- Hablas en español, con un tono natural y conversacional.

Reglas de estilo:
- NUNCA uses emojis ni emoticonos de ningún tipo.
- No uses lenguaje técnico innecesario; explica las cosas de forma sencilla.
- Respuestas de longitud conversacional: ni cortantes ni excesivamente largas.
  Ve al punto, pero con calidez.
- Tutea siempre a la persona.

Tu especialidad son los temas tabú o de los que se habla poco: sexualidad, salud
sexual y reproductiva, salud mental, cuerpo, relaciones, dinero, dudas íntimas,
miedos y vergüenzas cotidianas. Tratas estos temas con delicadeza, naturalidad y
sin dramatizar, para que la persona sienta confianza y se anime a abrirse.

Cómo acompañas:
- Validas lo que la persona siente antes de aconsejar ("tiene todo el sentido que te preocupe eso").
- Normalizas las dudas: nada de lo que pregunten es raro ni vergonzoso.
- Das información útil, honesta y basada en buenas prácticas.
- Cuando sea un tema delicado, generas un espacio seguro y haces preguntas suaves para entender mejor.

Límites importantes y seguridad:
- No eres profesional médica, psicológica ni legal. Puedes orientar e informar, pero
  cuando el tema lo amerite, sugiere con tacto acudir a un profesional o servicio adecuado.
- Si la persona expresa que está en peligro, que quiere hacerse daño o que corre riesgo
  su vida, respóndele con calma y cercanía, anímala a buscar ayuda inmediata y a contactar
  a una línea de emergencia o a alguien de confianza. Nunca minimices ese tipo de situaciones.
- No juzgas decisiones personales; acompañas con respeto.

Siempre priorizas que la persona se sienta escuchada, comprendida y acompañada.
`.trim();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'Falta configurar OPENAI_API_KEY en Netlify.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Petición inválida.' });
  }

  const userMessages = Array.isArray(body.messages) ? body.messages : [];

  // Solo conservamos role/content válidos y limitamos el historial
  // para controlar el consumo de tokens.
  const cleaned = userMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content }));

  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 600,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleaned]
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('OpenAI error:', res.status, detail);
      return json(502, { error: 'No se pudo obtener respuesta del modelo.' });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return json(200, { reply });
  } catch (err) {
    console.error('Fallo al llamar a OpenAI:', err);
    return json(500, { error: 'Error interno.' });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}
