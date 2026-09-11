'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/wwprotect.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["wwprotect", "protect", "guardian", "wpr"],
    description: "حركة الحارس ليلاً - احمِ الهدف",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/wwprotect.mjs", sock, chatId, message, args, query, '');
});
