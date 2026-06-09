# Complicadas — Chatbot con texto y notas de voz

Tu amiga que te orienta. Un chatbot cálido y de confianza, pensado sobre todo
para mujeres, que ayuda a resolver dudas del día a día y temas tabú de los que
cuesta hablar. Sin emojis, con cercanía y delicadeza.

Al abrir el link aparece primero el **logo**, luego el **avatar** (la foto de
perfil de la bot), y la conversación arranca con la ilusión de que estás hablando
con ella. Puedes escribirle **o mandarle notas de voz**: ella transcribe lo que
dices, te responde en texto y además te contesta con una **nota de voz**.

---

## Estructura del proyecto

```
.
├── index.html              # Interfaz del chat
├── styles.css              # Estilos (responsive + paleta de marca)
├── script.js               # Lógica del front (texto + grabación de voz)
├── assets/
│   ├── avatar.jpg          # Foto de perfil de la bot (la chica)
│   └── logo.png            # Logo "complicadas" (fondo transparente)
├── netlify/
│   └── functions/
│       ├── chat.js         # Endpoint de TEXTO
│       ├── voice.js        # Endpoint de VOZ (STT -> chat -> TTS)
│       └── lib/
│           ├── config.js   # << AQUÍ se editan los lineamientos y modelos >>
│           └── openai.js   # Llamadas a OpenAI (la API key vive aquí)
├── netlify.toml            # Configuración de Netlify
├── .env.example            # Plantilla de variables de entorno
└── package.json
```

> La API key **nunca** se expone en el navegador: el front llama a las funciones
> de Netlify, y son ellas las que llaman a OpenAI con la clave secreta.

---

## Cómo funcionan las notas de voz

1. Tocas el botón de micrófono y grabas (el navegador usa `MediaRecorder`).
2. Al enviar, el audio va al endpoint `/voice`, que en una sola llamada:
   - **Transcribe** el audio (OpenAI Speech-to-Text).
   - Genera la **respuesta** con el system prompt (OpenAI Chat).
   - Convierte esa respuesta en **voz** (OpenAI Text-to-Speech).
3. Recibes tu transcripción, la respuesta en texto y la nota de voz para escuchar.

---

## DÓNDE poner la API key de OpenAI (lo importante)

La clave **no se escribe en el código**. Se guarda como variable de entorno en Netlify:

1. Entra a [platform.openai.com/api-keys](https://platform.openai.com/api-keys),
   crea una API key (empieza con `sk-...`) y cópiala.
2. En Netlify: tu sitio → **Site configuration → Environment variables → Add a variable**.
3. Crea la variable obligatoria:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** tu clave `sk-...`
4. (Opcional) Puedes añadir estas para ajustar modelos/voz/costos:
   `OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL`,
   `OPENAI_TTS_VOICE`, `OPENAI_MAX_TOKENS` (ver `.env.example`).
5. Vuelve a desplegar (**Deploys → Trigger deploy → Deploy site**) para que tome la variable.

---

## Desplegar en Netlify (paso a paso)

1. Sube este repositorio a GitHub (ya está).
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repo.
3. Deja la configuración por defecto (ya viene en `netlify.toml`) y despliega.
4. Agrega la variable `OPENAI_API_KEY` (sección de arriba) y vuelve a desplegar.

> El "drag & drop" simple **no** activa las funciones serverless. Usa la opción de
> GitHub (o el Netlify CLI) para que el chat de texto y de voz funcionen.

---

## Probar en tu computadora (opcional)

```bash
npm install
cp .env.example .env      # y escribe tu OPENAI_API_KEY dentro
npm run dev               # netlify dev (sirve el sitio + las funciones)
```

> Para grabar notas de voz, el navegador pide permiso de micrófono. En local
> funciona en `localhost`; en producción Netlify ya sirve por HTTPS (requisito
> del micrófono).

---

## Editar la personalidad y los modelos

Todo está en **`netlify/functions/lib/config.js`**:

- `SYSTEM_PROMPT`: el tono, los límites y cómo trata los temas sensibles.
- `CHAT_MODEL`, `TRANSCRIBE_MODEL`, `TTS_MODEL`, `TTS_VOICE`.
- `MAX_TOKENS`, `HISTORY_LIMIT`, `MAX_AUDIO_MB`.

---

## Costos y seguridad (ya contemplado)

- Modelos económicos por defecto (`gpt-4o-mini`, `*-mini-transcribe`, `*-mini-tts`).
- Respuestas limitadas en longitud (`MAX_TOKENS`).
- Historial acotado (`HISTORY_LIMIT`) para no enviar conversaciones enormes.
- Grabación de voz limitada a 90 s y tamaño de audio limitado (`MAX_AUDIO_MB`).
- Manejo de errores con mensajes claros, incluido el aviso cuando se alcanza el
  **límite de uso** de OpenAI (error 429).

---

## Cambiar el logo o la foto de perfil

- **Foto de perfil:** reemplaza `assets/avatar.jpg` (cuadrada se ve mejor; se recorta en círculo).
- **Logo:** reemplaza `assets/logo.png` (idealmente con fondo transparente).

## Paleta usada

Rojo `#f50e24` · Rosa `#fb2a5f` · Naranja `#ff7b1c` · Crema `#ffefd6`
