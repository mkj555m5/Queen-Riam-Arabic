'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/dungeon.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["dungeon", "dg", "explore", "labirin"],
    description: "استكشف الزنزانة وقاتل الوحوش بشكل تفاعلي",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/dungeon.mjs", sock, chatId, message, args, query, '');
});
