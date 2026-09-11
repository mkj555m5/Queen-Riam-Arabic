'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/slot.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["slot", "slots", "mesin", "mesinslot"],
    description: "Inline Fruit Bonanza slot game",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/slot.mjs", sock, chatId, message, args, query, '');
});
