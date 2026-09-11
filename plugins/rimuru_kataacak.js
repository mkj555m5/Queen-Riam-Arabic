'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/kataacak.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["kataacak", "ka", "acakkata"],
    description: "رتّب الحروف العشوائية",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/kataacak.mjs", sock, chatId, message, args, query, '');
});
