// calculator.js
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
// Features: Sleek Dark UI, History, Glassmorphism, Sound Effects, responsive layout
// ESM Plugin for YATO BOT MD

const html = `
<style>
:root {
  --bg: #111b21;
  --card: #202c33;
  --btn-bg: #2a3942;
  --btn-hover: #354752;
  --btn-op: #00a884;
  --btn-danger: #ef5350;
  --line: #3b4a54;
  --text: #e9edef;
  --muted: #8696a0;
  --accent: #25d366;
  --shadow: 0 18px 50px rgba(0,0,0,.45);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  min-height: 100vh;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  user-select: none;
}

.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
}

.card {
  width: 100%;
  max-width: 360px;
  background: rgba(17, 27, 33, 0.96);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--accent);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 9px rgba(37,211,102,.7);
}

.screen {
  background: #0b141a;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  text-align: right;
  margin-bottom: 14px;
  word-wrap: break-word;
  word-break: break-all;
}

.history {
  min-height: 20px;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 4px;
}

.output {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.btn {
  border: 0;
  background: var(--btn-bg);
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  border-radius: 12px;
  padding: 14px 0;
  cursor: pointer;
  transition: transform .08s ease, background .15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:hover {
  background: var(--btn-hover);
}

.btn:active {
  transform: scale(0.92);
}

.btn.op {
  background: rgba(0, 168, 132, 0.2);
  color: var(--btn-op);
}

.btn.danger {
  background: rgba(239, 83, 80, 0.2);
  color: var(--btn-danger);
}

.btn.equal {
  background: var(--btn-op);
  color: #071b16;
  font-weight: 800;
  grid-column: span 2;
}

.footer {
  text-align: center;
  margin-top: 14px;
  font-size: 11px;
  color: var(--muted);
}
</style>

<main class="stage">
  <div class="card">
    <div class="header">
      <div class="title">🧮Calculator</div>
      <div class="badge"><span class="dot"></span> READY</div>
    </div>

    <div class="screen">
      <div class="history" id="history"></div>
      <div class="output" id="output">0</div>
    </div>

    <div class="grid">
      <button class="btn danger" id="clear">C</button>
      <button class="btn op" id="backspace">⌫</button>
      <button class="btn op" id="percent">%</button>
      <button class="btn op" id="divide">÷</button>

      <button class="btn" id="n7">7</button>
      <button class="btn" id="n8">8</button>
      <button class="btn" id="n9">9</button>
      <button class="btn op" id="multiply">×</button>

      <button class="btn" id="n4">4</button>
      <button class="btn" id="n5">5</button>
      <button class="btn" id="n6">6</button>
      <button class="btn op" id="subtract">-</button>

      <button class="btn" id="n1">1</button>
      <button class="btn" id="n2">2</button>
      <button class="btn" id="n3">3</button>
      <button class="btn op" id="add">+</button>

      <button class="btn" id="n0">0</button>
      <button class="btn" id="dot">.</button>
      <button class="btn equal" id="equals">=</button>
    </div>

    <div class="footer">YATO BOT MD — Rich App Interface</div>
  </div>
</main>

<script>
(() => {
  const historyEl = document.getElementById('history');
  const outputEl = document.getElementById('output');
  let currentExpr = '';
  let lastAns = '';

  function playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch(e) {}
  }

  function updateDisplay() {
    outputEl.textContent = currentExpr || '0';
  }

  function appendChar(ch) {
    playSound();
    if (currentExpr === '0' && ch !== '.') currentExpr = '';
    currentExpr += ch;
    updateDisplay();
  }

  function clearAll() {
    playSound();
    currentExpr = '';
    historyEl.textContent = '';
    updateDisplay();
  }

  function backspace() {
    playSound();
    currentExpr = currentExpr.slice(0, -1);
    updateDisplay();
  }

  function calculate() {
    playSound();
    if (!currentExpr) return;
    try {
      let parsed = currentExpr.replace(/×/g, '*').replace(/÷/g, '/');
      let result = Function('"use strict"; return (' + parsed + ')')();
      historyEl.textContent = currentExpr + ' =';
      currentExpr = String(result);
      updateDisplay();
    } catch (err) {
      outputEl.textContent = 'Error';
      currentExpr = '';
    }
  }

  document.getElementById('clear').onclick = clearAll;
  document.getElementById('backspace').onclick = backspace;
  document.getElementById('equals').onclick = calculate;

  document.getElementById('percent').onclick = () => appendChar('%');
  document.getElementById('divide').onclick = () => appendChar('÷');
  document.getElementById('multiply').onclick = () => appendChar('×');
  document.getElementById('subtract').onclick = () => appendChar('-');
  document.getElementById('add').onclick = () => appendChar('+');
  document.getElementById('dot').onclick = () => appendChar('.');

  for(let i=0; i<=9; i++) {
    const btn = document.getElementById('n' + i);
    if(btn) btn.onclick = () => appendChar(String(i));
  }
})();
</script>
`;

const handler = async (m, { conn }) => {
  try {
    await conn.relayMessage(
      m.chat,
      {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          botMetadata: {}
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [
                {
                  messageType: 2,
                  messageText: 'YATO Advanced Calculator 🧮'
                }
              ],
              unifiedResponse: {
                data: Buffer.from(
                  JSON.stringify({
                    response_id: 'yato-calculator-rich-html',
                    sections: [
                      {
                        view_model: {
                          primitive: {
                            __typename: 'GenAIaeacdsnwHtmlPrimitive',
                            payload: html,
                            trusted_sources: []
                          },
                          __typename: 'GenAISingleLayoutViewModel'
                        }
                      }
                    ]
                  })
                ).toString('base64')
              },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: {
                  botJid: '867051314767696@bot'
                },
                forwardOrigin: 4
              }
            }
          }
        }
      },
      {}
    );
  } catch (e) {
    console.error('[CALCULATOR ERROR]', e);
    await m.reply('❌ فشل إرسال واجهة الحاسبة.');
  }
};

handler.help = ['calc'];
handler.description = 'Interactive calculator';
handler.tags = ['tools'];
handler.command = ['calc', 'calculator'];

export default handler;