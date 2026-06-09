/* ===== Complicadas — chat inmersivo (texto + voz + avatar que "habla") ===== */

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
const modeRead  = document.getElementById('modeRead');
const modeListen= document.getElementById('modeListen');
const speakWave = document.getElementById('speakWave');
const bgAvatar  = document.querySelector('.bg-avatar');

const AVATAR_SRC = 'assets/avatar.jpg';
const MAX_REC_MS = 90000;

/* ---------- Alto de viewport real (teclado móvil) ---------- */
function setVH() {
  const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty('--vh', `${h / 100}px`);
}
setVH();
window.addEventListener('resize', setVH);
if (window.visualViewport) window.visualViewport.addEventListener('resize', setVH);

const history = [];

/* ---------- Modo de respuesta: Leer vs Escuchar ---------- */
let listenMode = (localStorage.getItem('cmpl_listen') ?? '1') === '1';
function applyMode() {
  modeListen.classList.toggle('active', listenMode);
  modeRead.classList.toggle('active', !listenMode);
  modeListen.setAttribute('aria-pressed', String(listenMode));
  modeRead.setAttribute('aria-pressed', String(!listenMode));
}
modeListen.addEventListener('click', () => { listenMode = true;  localStorage.setItem('cmpl_listen', '1'); ensureCtx(); applyMode(); });
modeRead.addEventListener('click',   () => { listenMode = false; localStorage.setItem('cmpl_listen', '0'); applyMode(); });
applyMode();

/* ====================== MOTOR DE "HABLA" ====================== */
// Analiza el audio de la voz en tiempo real (Web Audio API) y con la amplitud
// anima el fondo: la chica se mueve sutilmente, se enciende un aura y unas ondas.
let audioCtx = null, analyser = null, freqBuf = null, rafId = null, activeAudios = 0;
const connected = new WeakSet();

function ensureCtx() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* navegador sin Web Audio: el audio igual suena con los controles */ }
}
// Desbloquea el audio en la primera interacción del usuario.
['pointerdown', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, ensureCtx, { once: true }));

function connectAudio(el) {
  ensureCtx();
  if (!audioCtx || connected.has(el)) return;
  try {
    const src = audioCtx.createMediaElementSource(el);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    connected.add(el);
  } catch { /* ya conectado o no soportado */ }
}

function registerBotAudio(el) {
  el._counted = false;
  el.addEventListener('play', () => {
    connectAudio(el);
    if (!el._counted) { el._counted = true; activeAudios++; }
    startSpeaking();
  });
  const onStop = () => {
    if (el._counted) { el._counted = false; activeAudios = Math.max(0, activeAudios - 1); }
    stopSpeaking();
  };
  el.addEventListener('pause', onStop);
  el.addEventListener('ended', onStop);
}

function startSpeaking() {
  document.body.classList.add('speaking');
  speakWave.hidden = false;
  if (!rafId) loop();
}
function stopSpeaking() {
  if (activeAudios > 0) return;
  document.body.classList.remove('speaking');
  speakWave.hidden = true;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.documentElement.style.setProperty('--level', '0');
  bgAvatar.style.transform = ''; // retoma la respiración suave
}
function loop() {
  rafId = requestAnimationFrame(loop);
  if (!analyser) return;
  analyser.getByteFrequencyData(freqBuf);
  let sum = 0;
  for (let i = 0; i < freqBuf.length; i++) sum += freqBuf[i];
  const avg = sum / freqBuf.length / 255;        // 0..1
  const level = Math.min(1, avg * 2.4);          // amplificado
  document.documentElement.style.setProperty('--level', level.toFixed(3));
  bgAvatar.style.transform = `scale(${(1 + level * 0.03).toFixed(4)}) translateY(${(level * -0.9).toFixed(2)}%)`;
}

/* ---------- Intro ---------- */
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
      'Hola, qué bueno que estás aquí. Soy Mia, tu amiga de Complicadas. ' +
      'Puedes escribirme o mandarme una nota de voz, y elegir arriba si prefieres ' +
      'leer o escuchar mis respuestas. Cuéntame lo que quieras, aquí no hay temas ' +
      'prohibidos. ¿Qué tienes en mente?',
      'bot'
    );
  }, 1400);
}

/* ---------- Render ---------- */
function addBubble(text, who, opts = {}) {
  const row = document.createElement('div');
  row.className = `row ${who}`;

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
    audio.preload = 'auto';
    audio.src = `data:audio/mp3;base64,${opts.audioBase64}`;
    registerBotAudio(audio);
    bubble.appendChild(audio);
    audio.play().catch(() => {}); // autoplay (si el navegador lo permite)
  }

  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
  return bubble;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'row bot';
  row.innerHTML = `<div class="bubble typing"><span></span><span></span><span></span></div>`;
  messages.appendChild(row);
  scrollToBottom();
  return row;
}
function scrollToBottom() { messages.scrollTop = messages.scrollHeight; }

/* ---------- Textarea ---------- */
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
function updateComposerButtons() {
  const hayTexto = input.value.trim().length > 0;
  sendBtn.hidden = !hayTexto;
  micBtn.hidden = hayTexto;
}
input.addEventListener('input', () => { autoGrow(); updateComposerButtons(); });
updateComposerButtons();
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
    e.preventDefault(); form.requestSubmit();
  }
});
function resetInput() { input.value = ''; input.style.height = 'auto'; updateComposerButtons(); }

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
      body: JSON.stringify({ messages: history, speak: listenMode }),
    });
    typing.remove();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    const reply = (data.reply || '').trim() ||
      'Perdona, me quedé sin palabras un momento. ¿Me lo cuentas otra vez?';
    addBubble(reply, 'bot', { audioBase64: listenMode ? data.audio : null });
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
let mediaRecorder = null, mediaStream = null, chunks = [], recTimer = null, recStartedAt = 0, cancelled = false;

function pickMime() {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

micBtn.addEventListener('click', startRecording);
recStop.addEventListener('click', () => stopRecording(false));
recCancel.addEventListener('click', () => stopRecording(true));

async function startRecording() {
  ensureCtx();
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
  cancelled = false; chunks = [];
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
  if (ms >= MAX_REC_MS) stopRecording(false);
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
  const base64 = await blobToBase64(new Blob(chunks, { type }));

  const placeholder = addBubble('Transcribiendo tu nota de voz…', 'user', { voice: true });
  setBusy(true);
  const typing = showTyping();

  try {
    const res = await fetch('/.netlify/functions/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType: type, messages: history, speak: listenMode }),
    });
    typing.remove();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    placeholder.querySelector('div:last-child').textContent = data.transcript || '(no se entendió el audio)';
    if (data.transcript) history.push({ role: 'user', content: data.transcript });

    const reply = (data.reply || '').trim();
    if (reply) {
      addBubble(reply, 'bot', { audioBase64: listenMode ? data.audio : null });
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

function showRecBar(on) { recBar.hidden = !on; form.style.display = on ? 'none' : ''; }

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* ---------- Utilidades ---------- */
function setBusy(state) { sendBtn.disabled = state; micBtn.disabled = state; input.disabled = state; }
function mensajeError(err) {
  const m = (err && err.message) || '';
  if (m && !/^Error \d+$/.test(m)) return m;
  return 'Uy, tuve un problema para responderte. Revisa la conexión e inténtalo de nuevo en un momento.';
}
