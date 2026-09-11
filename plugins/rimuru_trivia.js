'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/trivia.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["kuis"],
    description: "أسئلة معلومات عامة",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/trivia.mjs", sock, chatId, message, args, query, '');
});
