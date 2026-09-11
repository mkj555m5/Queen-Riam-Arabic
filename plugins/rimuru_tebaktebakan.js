'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebaktebakan.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebaktebakan", "tbt", "tebak2an", "receh"],
    description: "أسئلة تخمين خفيفة",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebaktebakan.mjs", sock, chatId, message, args, query, '');
});
