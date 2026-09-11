'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/caklontong.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["caklontong", "cak", "lontong"],
    description: "لعبة كاك لونتون - إجابات مرحة",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/caklontong.mjs", sock, chatId, message, args, query, '');
});
