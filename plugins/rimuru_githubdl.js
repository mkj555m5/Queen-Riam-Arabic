'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/githubdl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["githubdl", "gitdl", "gitclone", "repodownload"],
    description: "Download repository GitHub sebagai ZIP",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/githubdl.mjs", sock, chatId, message, args, query, '');
});
