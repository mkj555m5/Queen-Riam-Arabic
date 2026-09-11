'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/capcutdl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["capcutdl", "ccdl", "capcut", "cc"],
    description: "Download video CapCut",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/capcutdl.mjs", sock, chatId, message, args, query, '');
});
