'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/gdrive.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["gdrive", "drive", "drivedl", "driveurl"],
    description: "Download file dari Google Drive",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/gdrive.mjs", sock, chatId, message, args, query, '');
});
