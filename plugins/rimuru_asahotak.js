'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/asahotak.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["asahotak", "asah"],
    description: "لعبة صقل العقل - خمّن الجواب",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/asahotak.mjs", sock, chatId, message, args, query, '');
});
