// ★ أمر الفيديو — نظام مطابق لبوت Rimuru MD v4.6 (النسخة العربية)
// المالك: ShowyWharf27322
// الاستخدام:
//   .video <كلمة بحث أو رابط يوتيوب>
//   .video <كلمة بحث>|<جودة>   مثال: .video سورة البقرة|720
// التحميل بثلاثة مستويات مثل Rimuru: nexray ← izuka ← y2mate
'use strict';

const yts = require('yt-search');
const { getVideoDownloadUrl, isYouTubeUrl, extractVideoId } = require('../lib/youtubeEngine');

function formatNumber(num) {
    const n = Number(num) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

async function videoCommand(sock, chatId, message, query) {
    const input = String(query || '').trim();

    if (!input) {
        return sock.sendMessage(chatId, {
            text: '🎬 *أمر الفيديو*\n\nأرسل كلمة بحث أو رابط يوتيوب:\n`.video سورة البقرة`\n`.video https://youtu.be/xxxx`\n\nلتحديد الجودة:\n`.video سورة البقرة|720`',
        }, { quoted: message });
    }

    // نفس نظام Rimuru: استعلام|جودة
    let [target, resolution] = input.split('|').map(s => s && s.trim());
    resolution = (resolution || '360').replace(/[^0-9]/g, '') || '360';

    try {
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        let ytUrl = target;
        let info = { title: '', author: '', views: 0, timestamp: '', ago: '', thumbnail: '' };

        if (!isYouTubeUrl(target)) {
            const search = await yts(target);
            if (!search.videos || search.videos.length === 0) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return sock.sendMessage(chatId, { text: `❌ لم أجد أي فيديو عن: *${target}*` }, { quoted: message });
            }
            const v = search.videos[0];
            ytUrl = v.url;
            info = {
                title: v.title || '',
                author: v.author?.name || '',
                views: v.views || 0,
                timestamp: v.timestamp || '',
                ago: v.ago || '',
                thumbnail: v.thumbnail || '',
            };
        }

        const vid = extractVideoId(ytUrl);
        const thumb = info.thumbnail || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '');

        await sock.sendMessage(chatId, { react: { text: '🕐', key: message.key } });

        const dl = await getVideoDownloadUrl(ytUrl, resolution);

        const title = info.title || dl.title || 'فيديو يوتيوب';
        const caption =
            `🎬 *${title}*\n` +
            (info.author ? `📺 *القناة:* ${info.author}\n` : '') +
            (info.timestamp ? `⏱️ *المدة:* ${info.timestamp}\n` : '') +
            (info.views ? `👁️ *المشاهدات:* ${formatNumber(info.views)}\n` : '') +
            (info.ago ? `📅 *النشر:* ${info.ago}\n` : '') +
            (dl.resolution ? `📐 *الجودة:* ${String(dl.resolution).replace('p', '')}p\n` : '') +
            `\n🔗 *يوتيوب:* ${ytUrl}\n\n` +
            `✅ تفضل الفيديو~`;

        await sock.sendMessage(chatId, {
            video: { url: dl.url },
            caption,
            contextInfo: thumb ? {
                externalAdReply: {
                    title,
                    body: '🎬 Powered by Queen Riam',
                    thumbnailUrl: thumb,
                    sourceUrl: ytUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            } : undefined,
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[VIDEO]', error.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `❌ *فشل تحميل الفيديو*\n\n${error?.message || 'حاول مرة أخرى لاحقاً.'}`,
        }, { quoted: message });
    }
}

const { bot } = require('../lib/pluginLoader');

bot({
    command: ['video', 'ytmp4', 'playvid', 'ytv', 'فيديو'],
    description: 'تحميل فيديو من يوتيوب بنظام Rimuru (بحث أو رابط + جودة اختيارية)',
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await videoCommand(sock, chatId, message, query);
});
