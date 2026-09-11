'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/snackvideodl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["snackvideodl", "svdl", "snackvideo", "sv"],
    description: "Download video SnackVideo",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/snackvideodl.mjs", sock, chatId, message, args, query, '');
});
