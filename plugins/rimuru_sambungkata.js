'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/sambungkata.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["sambungkata", "skata", "sambungkat", "wordchain"],
    description: "لعبة وصل الكلمات من آخر حرف بالكلمة السابقة — خاصة من Ai~! ⭐",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/sambungkata.mjs", sock, chatId, message, args, query, '');
});
