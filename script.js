/* ===== Complicadas — lógica del chat ===== */

const intro     = document.getElementById('intro');
const app       = document.getElementById('app');
const messages  = document.getElementById('messages');
const form      = document.getElementById('composer');
const input     = document.getElementById('input');
const sendBtn   = document.getElementById('send');

const AVATAR_SRC = 'assets/avatar.svg';

// Historial de la conversación (lo que se envía al modelo).
// El "system" lo define el backend; aquí solo guardamos user/assistant.
const history = [];

/* ---------- Secuencia de introducción ---------- */
// Logo -> avatar -> se revela el chat -> primer saludo de la avatar.
window.addEventListener('load', () => {
  setTimeout(() => {
    intro.classList.add('hide');
    app.setAttribute('aria-hidden', 'false');
    app.classList.add('show');
    // Saludo inicial con ilusión de que "ella" empieza a escribir.
    setTimeout(saludoInicial, 500);
  }, 3000); // tiempo total de la intro
});

function saludoInicial() {
  const typing = showTyping();
  setTimeout(() => {
    typing.remove();
    addBubble(
      'Hola, qué bueno que estás aquí. Soy tu amiga de Complicadas. ' +
      'Puedes contarme lo que quieras, desde una duda del día a día hasta ' +
      'eso que a veces da vergüenza preguntar. Aquí no hay temas prohibidos. ' +
      '¿Qué tienes en mente?',
      'bot'
    );
  }, 1400);
}

/* ---------- Render de mensajes ---------- */
function addBubble(text, who) {
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
  bubble.textContent = text;
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

/* ---------- Envío ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addBubble(text, 'user');
  history.push({ role: 'user', content: text });
  input.value = '';
  setSending(true);

  const typing = showTyping();

  try {
    const res = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });

    typing.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const data = await res.json();
    const reply = (data.reply || '').trim() ||
      'Perdona, me quedé sin palabras un momento. ¿Me lo cuentas otra vez?';

    addBubble(reply, 'bot');
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    typing.remove();
    addBubble(
      'Uy, tuve un problema para responderte. Revisa la conexión e inténtalo de nuevo en un momento.',
      'bot'
    );
    console.error(err);
  } finally {
    setSending(false);
    input.focus();
  }
});

function setSending(state) {
  sendBtn.disabled = state;
  input.disabled = state;
}
