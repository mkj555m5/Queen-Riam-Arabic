'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/soundcloud.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["soundcloudplay", "soundcloud", "scdl"],
    description: "soundcloudplay",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/soundcloud.mjs", sock, chatId, message, args, query, '');
});
