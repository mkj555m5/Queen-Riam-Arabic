'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/tiktokdl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tiktok", "tt", "ttmp4", "tiktokdl", "ttdown"],
    description: "Download video/slide TikTok tanpa watermark",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/tiktokdl.mjs", sock, chatId, message, args, query, '');
});
