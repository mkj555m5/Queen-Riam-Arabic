'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/wwkill.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["wwkill", "wolfkill", "wk"],
    description: "حركة المستذئب ليلاً - اقتل الهدف",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/wwkill.mjs", sock, chatId, message, args, query, '');
});
