/* ===== Complicadas — lógica del chat (texto + notas de voz) ===== */

const intro     = document.getElementById('intro');
const app       = document.getElementById('app');
const messages  = document.getElementById('messages');
const form      = document.getElementById('composer');
const input     = document.getElementById('input');
const sendBtn   = document.getElementById('send');
const micBtn    = document.getElementById('mic');
const recBar    = document.getElementById('recBar');
const recTime   = document.getElementById('recTime');
const recStop   = document.getElementById('recStop');
const recCancel = document.getElementById('recCancel');

const AVATAR_SRC = 'assets/avatar.jpg';
const MAX_REC_MS = 90000; // tope de grabación: 90 s (control de costos)

/* ---------- Alto de viewport real (teclado móvil) ---------- */
function setVH() {
  const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty('--vh', `${h / 100}px`);
}
setVH();
window.addEventListener('resize', setVH);
if (window.visualViewport) window.visualViewport.addEventListener('resize', setVH);

// Historial de la conversación que se envía al modelo (solo user/assistant).
const history = [];

/* ---------- Secuencia de introducción ---------- */
window.addEventListener('load', () => {
  setTimeout(() => {
    intro.classList.add('hide');
    app.setAttribute('aria-hidden', 'false');
    app.classList.add('show');
    setTimeout(saludoInicial, 500);
  }, 3000);
});

function saludoInicial() {
  const typing = showTyping();
  setTimeout(() => {
    typing.remove();
    addBubble(
      'Hola, qué bueno que estás aquí. Soy tu amiga de Complicadas. ' +
      'Puedes escribirme o mandarme una nota de voz, lo que te sea más cómodo. ' +
      'Cuéntame lo que quieras, desde una duda del día a día hasta eso que a veces ' +
      'da vergüenza preguntar. Aquí no hay temas prohibidos. ¿Qué tienes en mente?',
      'bot'
    );
  }, 1400);
}

/* ---------- Render de mensajes ---------- */
function addBubble(text, who, opts = {}) {
  const row = document.createElement('div');
  row.className = `row ${who}`;

  if (who === 'bot') {
    const av = document.createElement('img');
    av.className = 'msg-avatar';
    av.src = AVATAR_SRC;
    av.alt = 'Complicadas';
    row.appendChild(av);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (opts.voice) {
    const tag = document.createElement('span');
    tag.className = 'voice-tag';
    tag.textContent = 'Nota de voz';
    bubble.appendChild(tag);
  }

  const p = document.createElement('div');
  p.textContent = text;
  bubble.appendChild(p);

  if (opts.audioBase64) {
    const audio = document.createElement('audio');
    audio.className = 'voice-player';
    audio.controls = true;
    audio.src = `data:audio/mp3;base64,${opts.audioBase64}`;
    bubble.appendChild(audio);
    // Intentamos reproducir automáticamente (puede bloquearlo el navegador).
    audio.play().catch(() => {});
  }

  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
  return bubble;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'row bot';
  row.innerHTML = `
    <img class="msg-avatar" src="${AVATAR_SRC}" alt="Complicadas" />
    <div class="bubble typing"><span></span><span></span><span></span></div>`;
  messages.appendChild(row);
  scrollToBottom();
  return row;
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

/* ---------- Textarea: auto-crecer, atajos y botones ---------- */
function autoGrow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
}
// Muestra el botón de enviar cuando hay texto; el micrófono cuando está vacío.
function updateComposerButtons() {
  const hayTexto = input.value.trim().length > 0;
  sendBtn.hidden = !hayTexto;
  micBtn.hidden = hayTexto;
}
input.addEventListener('input', () => { autoGrow(); updateComposerButtons(); });
updateComposerButtons();

input.addEventListener('keydown', (e) => {
  const esTactil = window.matchMedia('(pointer: coarse)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !esTactil) {
    e.preventDefault();
    form.requestSubmit();
  }
});

function resetInput() {
  input.value = '';
  input.style.height = 'auto';
  updateComposerButtons();
}

/* ---------- Envío de TEXTO ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addBubble(text, 'user');
  history.push({ role: 'user', content: text });
  resetInput();
  setBusy(true);

  const typing = showTyping();
  try {
    const res = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    typing.remove();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    const reply = (data.reply || '').trim() ||
      'Perdona, me quedé sin palabras un momento. ¿Me lo cuentas otra vez?';
    addBubble(reply, 'bot');
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    typing.remove();
    addBubble(mensajeError(err), 'bot');
    console.error(err);
  } finally {
    setBusy(false);
    input.focus();
  }
});

/* ====================== NOTAS DE VOZ ====================== */
let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let recTimer = null;
let recStartedAt = 0;
let cancelled = false;

function pickMime() {
  const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const t of tipos) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

micBtn.addEventListener('click', startRecording);
recStop.addEventListener('click', () => stopRecording(false));
recCancel.addEventListener('click', () => stopRecording(true));

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    addBubble('Tu navegador no permite grabar audio. Escríbeme y te respondo igual.', 'bot');
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    addBubble('No pude acceder al micrófono. Revisa los permisos del navegador e inténtalo otra vez.', 'bot');
    return;
  }

  cancelled = false;
  chunks = [];
  const mime = pickMime();
  mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = handleRecordingStop;
  mediaRecorder.start();

  showRecBar(true);
  recStartedAt = Date.now();
  tickTimer();
  recTimer = setInterval(tickTimer, 250);
}

function tickTimer() {
  const ms = Date.now() - recStartedAt;
  const s = Math.floor(ms / 1000);
  recTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (ms >= MAX_REC_MS) stopRecording(false); // corta solo al llegar al tope
}

function stopRecording(cancel) {
  cancelled = cancel;
  clearInterval(recTimer);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

async function handleRecordingStop() {
  showRecBar(false);
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());

  if (cancelled || !chunks.length) return;

  const type = mediaRecorder.mimeType || 'audio/webm';
  const blob = new Blob(chunks, { type });
  const base64 = await blobToBase64(blob);

  // Burbuja provisional del usuario mientras se transcribe.
  const placeholder = addBubble('Transcribiendo tu nota de voz…', 'user', { voice: true });
  setBusy(true);
  const typing = showTyping();

  try {
    const res = await fetch('/.netlify/functions/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType: type, messages: history }),
    });
    typing.remove();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    // Reemplaza el placeholder con la transcripción real.
    placeholder.querySelector('div:last-child').textContent =
      data.transcript || '(no se entendió el audio)';
    if (data.transcript) history.push({ role: 'user', content: data.transcript });

    const reply = (data.reply || '').trim();
    if (reply) {
      addBubble(reply, 'bot', { audioBase64: data.audio || null });
      history.push({ role: 'assistant', content: reply });
    }
  } catch (err) {
    typing.remove();
    placeholder.querySelector('div:last-child').textContent = '(nota de voz)';
    addBubble(mensajeError(err), 'bot');
    console.error(err);
  } finally {
    setBusy(false);
  }
}

function showRecBar(on) {
  recBar.hidden = !on;
  form.style.display = on ? 'none' : '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]); // quita el prefijo data:
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* ---------- Utilidades ---------- */
function setBusy(state) {
  sendBtn.disabled = state;
  micBtn.disabled = state;
  input.disabled = state;
}

function mensajeError(err) {
  const m = (err && err.message) || '';
  if (m && !/^Error \d+$/.test(m)) return m; // mensaje claro del backend (ej. límite de uso)
  return 'Uy, tuve un problema para responderte. Revisa la conexión e inténtalo de nuevo en un momento.';
}
