# Complicadas — Chatbot

Tu amiga que te orienta. Un chatbot cálido y de confianza, pensado sobre todo
para mujeres, que ayuda a resolver dudas del día a día y temas tabú de los que
cuesta hablar. Sin emojis, con cercanía y delicadeza.

Al abrir el link aparece primero el **logo**, luego el **avatar**, y la
conversación arranca con la ilusión de que estás hablando con ella.

---

## ¿Cómo está armado?

- `index.html`, `styles.css`, `script.js` → la interfaz del chat (sitio estático).
- `assets/logo.svg`, `assets/avatar.svg` → logo y avatar (provisionales, ver abajo).
- `netlify/functions/chat.js` → función serverless que habla con OpenAI.
  **Aquí vive la personalidad del chatbot** (el "system prompt") y aquí se usa
  la API key de forma segura.
- `netlify.toml` → configuración de despliegue.

> La API key **nunca** se expone en el navegador: el navegador llama a la función
> de Netlify, y la función es la que llama a OpenAI usando la clave secreta.

---

## DÓNDE poner la API key de OpenAI (lo importante)

La clave **no se escribe en el código**. Se guarda como variable de entorno en Netlify:

1. Entra a [platform.openai.com](https://platform.openai.com/api-keys) y crea una
   API key (empieza con `sk-...`). Cópiala.
2. En Netlify, abre tu sitio → **Site configuration** → **Environment variables**
   → **Add a variable**.
3. Crea esta variable:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** tu clave `sk-...`
4. (Opcional) Otra variable para elegir el modelo:
   - **Key:** `OPENAI_MODEL`
   - **Value:** `gpt-4o-mini` (por defecto) o el que prefieras.
5. Vuelve a desplegar el sitio (**Deploys → Trigger deploy → Deploy site**) para
   que tome la variable.

Listo: el chat ya funciona.

---

## Desplegar en Netlify (paso a paso)

**Opción A — desde GitHub (recomendada):**
1. Sube este repositorio a GitHub.
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repo.
3. Deja la configuración por defecto (ya viene en `netlify.toml`) y despliega.
4. Agrega la variable `OPENAI_API_KEY` (ver sección de arriba) y vuelve a desplegar.

**Opción B — arrastrando la carpeta:**
- Las funciones serverless **no** funcionan con el "drag & drop" simple. Usa la
  Opción A o el Netlify CLI para que `chat.js` funcione.

---

## Probar en tu computadora (opcional)

```bash
npm install
cp .env.example .env      # y escribe tu OPENAI_API_KEY dentro
npm run dev               # abre netlify dev (incluye las funciones)
```

---

## Cambiar el logo y el avatar por los tuyos

Los archivos actuales son **provisionales** y coinciden con tu paleta.
Para usar los reales, tienes dos opciones:

- **Más fácil:** reemplaza los archivos `assets/logo.svg` y `assets/avatar.svg`
  por los tuyos manteniendo esos mismos nombres.
- **Con tus PNG:** guarda tus imágenes como `assets/logo.png` y `assets/avatar.png`
  y cambia las referencias `assets/logo.svg` / `assets/avatar.svg` por
  `.png` en `index.html`, `script.js` (constante `AVATAR_SRC`) y `styles.css`.

Para el avatar, una imagen cuadrada se ve mejor (se recorta en círculo).

---

## Personalizar el carácter del chatbot

Edita el texto `SYSTEM_PROMPT` en `netlify/functions/chat.js`. Ahí defines su tono,
sus límites y cómo trata los temas sensibles.

## Paleta usada

- Rojo `#f50e24` · Rosa `#fb2a5f` · Naranja `#ff7b1c` · Crema `#ffefd6`
