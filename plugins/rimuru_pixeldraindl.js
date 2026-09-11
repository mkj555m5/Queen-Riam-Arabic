'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/pixeldraindl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["pixeldraindl", "pddl", "pixeldrain", "pddownload"],
    description: "Download file dari Pixeldrain",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/pixeldraindl.mjs", sock, chatId, message, args, query, '');
});
