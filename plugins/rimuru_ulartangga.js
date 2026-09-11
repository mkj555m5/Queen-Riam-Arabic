'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/ulartangga.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ulartangga", "ut", "snakeladder", "sl"],
    description: "العب الثعبان والسلم مع لاعبين آخرين بلوحة مرئية",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/ulartangga.mjs", sock, chatId, message, args, query, '');
});
