'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/susunkata.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["susunkata", "susun", "scramble"],
    description: "رتّب الكلمة من الحروف",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/susunkata.mjs", sock, chatId, message, args, query, '');
});
