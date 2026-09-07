// xo.js
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
// Features: Single Player ONLY vs Balanced AI (Winable & Challenging), Sound Effects, Sleek Dark Theme
// ESM Plugin for YATO BOT MD

const html = `
<style>
:root {
  --bg: #111b21;
  --card: #202c33;
  --cell: #2a3942;
  --cell-hover: #354752;
  --line: #3b4a54;
  --text: #e9edef;
  --muted: #8696a0;
  --accent: #00a884;
  --x-color: #ef5350;
  --o-color: #53bdeb;
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
  margin-bottom: 14px;
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
  font-weight: 700;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 9px rgba(37,211,102,.7);
}

.scores {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
  text-align: center;
}

.score-box {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 4px;
}

.score-title {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 2px;
}

.score-val {
  font-size: 16px;
  font-weight: 700;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.cell {
  aspect-ratio: 1;
  background: var(--cell);
  border: 1px solid var(--line);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 800;
  cursor: pointer;
  transition: transform .1s ease, background .15s ease;
}

.cell:hover {
  background: var(--cell-hover);
}

.cell:active {
  transform: scale(0.92);
}

.cell.x {
  color: var(--x-color);
}

.cell.o {
  color: var(--o-color);
}

.status {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  min-height: 20px;
  margin-bottom: 14px;
  color: var(--accent);
}

.restart-btn {
  width: 100%;
  border: 0;
  background: var(--accent);
  color: #071b16;
  font-size: 15px;
  font-weight: 700;
  border-radius: 12px;
  padding: 12px 0;
  cursor: pointer;
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
      <div class="title">❌⭕ Smart XO</div>
      <div class="badge"><span class="dot"></span> صعوبة متوازنة</div>
    </div>

    <div class="scores">
      <div class="score-box">
        <div class="score-title">❌ أنت (X)</div>
        <div class="score-val" id="scoreX">0</div>
      </div>
      <div class="score-box">
        <div class="score-title">🤝 تعادل</div>
        <div class="score-val" id="scoreDraw">0</div>
      </div>
      <div class="score-box">
        <div class="score-title">🤖 الذكاء الاصطناعي</div>
        <div class="score-val" id="scoreO">0</div>
      </div>
    </div>

    <div class="status" id="status">دورك للعب (❌)</div>

    <div class="board" id="board">
      <div class="cell" data-i="0"></div>
      <div class="cell" data-i="1"></div>
      <div class="cell" data-i="2"></div>
      <div class="cell" data-i="3"></div>
      <div class="cell" data-i="4"></div>
      <div class="cell" data-i="5"></div>
      <div class="cell" data-i="6"></div>
      <div class="cell" data-i="7"></div>
      <div class="cell" data-i="8"></div>
    </div>

    <button class="restart-btn" id="restart">🔄 إعادة اللعب</button>

    <div class="footer">YATO BOT MD — Playable Smart Engine</div>
  </div>
</main>

<script>
(() => {
  const cells = document.querySelectorAll('.cell');
  const statusEl = document.getElementById('status');
  const restartBtn = document.getElementById('restart');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreDrawEl = document.getElementById('scoreDraw');

  let board = ['', '', '', '', '', '', '', '', ''];
  let currentPlayer = 'X';
  let isGameActive = true;

  let scores = { X: 0, O: 0, draw: 0 };

  const human = 'X';
  const ai = 'O';

  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  function playSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      if(type === 'click') {
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      } else if(type === 'win') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      } else if(type === 'lose') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(150, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      }
      osc.start(now);
      osc.stop(now + 0.3);
    } catch(e) {}
  }

  function handleCellClick(e) {
    const idx = e.target.dataset.i;
    if (board[idx] !== '' || !isGameActive || currentPlayer !== human) return;

    makeMove(idx, human);

    if (isGameActive && currentPlayer === ai) {
      statusEl.textContent = '🤖 الذكاء الاصطناعي يفكر...';
      setTimeout(smartMove, 300);
    }
  }

  function makeMove(idx, player) {
    board[idx] = player;
    cells[idx].textContent = player;
    cells[idx].classList.add(player.toLowerCase());
    playSound('click');

    if (checkWin(board, player)) {
      if (player === human) {
        statusEl.textContent = '🎉 مبارك! لقد انتصرت على البوت!';
        scores.X++;
        playSound('win');
      } else {
        statusEl.textContent = '🤖 فاز الذكاء الاصطناعي!';
        scores.O++;
        playSound('lose');
      }
      updateScores();
      isGameActive = false;
      return;
    }

    if (board.every(cell => cell !== '')) {
      statusEl.textContent = '🤝 تعادل ممتاز!';
      scores.draw++;
      updateScores();
      isGameActive = false;
      return;
    }

    currentPlayer = currentPlayer === human ? ai : human;
    if (currentPlayer === human) {
      statusEl.textContent = 'دورك للعب (❌)';
    }
  }

  // 🧠 ذكاء متوازن (80% ذكي / 20% عشوائي لإتاحة فرصة الفوز)
  function smartMove() {
    let emptyIndices = board.map((val, idx) => val === '' ? idx : null).filter(v => v !== null);
    if (emptyIndices.length === 0 || !isGameActive) return;

    // بنسبة 20% يصنع خطأ صغيراً لتتمكن من الفوز
    let makeMistake = Math.random() < 0.20;

    if (makeMistake) {
      let randomChoice = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      makeMove(randomChoice, ai);
      return;
    }

    // الحركة الذكية عبر Minimax
    let bestScore = -Infinity;
    let move;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        board[i] = ai;
        let score = minimax(board, 0, false);
        board[i] = '';
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    makeMove(move, ai);
  }

  const scoresMap = { O: 10, X: -10, tie: 0 };

  function minimax(currBoard, depth, isMaximizing) {
    if (checkWin(currBoard, ai)) return scoresMap.O - depth;
    if (checkWin(currBoard, human)) return scoresMap.X + depth;
    if (currBoard.every(cell => cell !== '')) return scoresMap.tie;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (currBoard[i] === '') {
          currBoard[i] = ai;
          let score = minimax(currBoard, depth + 1, false);
          currBoard[i] = '';
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (currBoard[i] === '') {
          currBoard[i] = human;
          let score = minimax(currBoard, depth + 1, true);
          currBoard[i] = '';
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }

  function checkWin(b, player) {
    return winPatterns.some(pattern => {
      return pattern.every(idx => b[idx] === player);
    });
  }

  function updateScores() {
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreDrawEl.textContent = scores.draw;
  }

  function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = human;
    isGameActive = true;
    statusEl.textContent = 'دورك للعب (❌)';
    cells.forEach(cell => {
      cell.textContent = '';
      cell.className = 'cell';
    });
  }

  cells.forEach(cell => cell.addEventListener('click', handleCellClick));
  restartBtn.onclick = resetGame;
})();
</script>
`;
// ᴍᴏᴅᴇ‌ʙʏ : https://t.me/YatoCoding
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
                  messageText: 'YATO Smart XO ❌⭕'
                }
              ],
              unifiedResponse: {
                data: Buffer.from(
                  JSON.stringify({
                    response_id: 'yato-xo-rich-html',
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
    console.error('[XO GAME ERROR]', e);
    await m.reply('❌ فشل إرسال لعبة إكس أو.');
  }
};

handler.help = ['xo'];
handler.description = 'Tic Tac Toe vs AI (single player)';
handler.tags = ['game'];
handler.command = ['xo', 'tictactoe', 'xoai'];

export default handler;