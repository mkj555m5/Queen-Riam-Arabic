'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/wwsee.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["wwsee", "seer", "vision", "wse"],
    description: "حركة العرّاف ليلاً - اطّلع على دور الهدف",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/wwsee.mjs", sock, chatId, message, args, query, '');
});
