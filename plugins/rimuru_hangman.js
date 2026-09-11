'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/hangman.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakkata2"],
    description: "خمّن الكلمة (حرفاً بحرف)",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/hangman.mjs", sock, chatId, message, args, query, '');
});
