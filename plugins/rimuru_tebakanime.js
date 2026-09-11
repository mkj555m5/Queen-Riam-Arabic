'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakanime.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakanime", "tebaknime", "guessanime"],
    description: "خمّن الأنمي من الوصف (يستهلك الحد اليومي)",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakanime.mjs", sock, chatId, message, args, query, '');
});
