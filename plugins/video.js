// plugins/video.js — تحميل فيديو من يوتيوب (مع اختيار الجودة)
// الاستخدام:
//   .video <search query or URL>
//   → يجلب قائمة بالجودات المتاحة
//   .video <number>   ← اختيار الجودة بالرقم (خلال 60 ثانية)
// مثال:
//   .video https://youtu.be/xxxxx
//   → قائمة: [1] 144p  [2] 360p  [3] 720p  [4] 1080p
//   .video 3   ← يحمّل الجودة 720p

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getVideo, getAvailableQualities } = require('../lib/media');
const { getLang } = require('../lib/lang');

// ── Convert any video to H.264/AAC MP4 (required by WhatsApp) ─────────────────
function convertToH264(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '28',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-y',
            outputPath
        ]);
        ff.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error('ffmpeg exited with code ' + code));
        });
        ff.on('error', reject);
    });
}

// ── جلب رابط يوتيوب من البحث ───────────────────────────────────────────────────
async function resolveYouTubeUrl(searchQuery) {
    if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
        return { url: searchQuery, title: '', thumbnail: '' };
    }
    const { videos } = await yts(searchQuery);
    if (!videos || videos.length === 0) return null;
    return { url: videos[0].url, title: videos[0].title, thumbnail: videos[0].thumbnail };
}

// ── تنزيل الفيديو بصيغة H.264/AAC MP4 ──────────────────────────────────────────
async function downloadAndConvert(fileUrl, tempDir) {
    const stamp = Date.now();
    const rawFile = path.join(tempDir, stamp + '_raw.mp4');
    const outFile = path.join(tempDir, stamp + '_out.mp4');

    try {
        const videoRes = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: 80 * 1024 * 1024, // حد أقصى 80MB للخام
        });
        fs.writeFileSync(rawFile, Buffer.from(videoRes.data));

        await convertToH264(rawFile, outFile);

        const stats = fs.statSync(outFile);
        if (stats.size > 62 * 1024 * 1024) {
            throw new Error('الفيديو كبير جداً على واتساب (الحد الأقصى 62MB). جرب جودة أقل.');
        }
        return outFile;
    } finally {
        // احذف الملف الخام دايماً (نحتفظ بـ outFile لإرساله)
        setTimeout(() => {
            try { if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile); } catch {}
        }, 1000);
    }
}

// ── جلسات اختيار الجودة لكل مستخدم ────────────────────────────────────────────
// key = `${chatId}:${senderJid}` → { qualities, url, title, thumbnail, expires }
const qualitySessions = new Map();
const SESSION_TIMEOUT_MS = 60 * 1000; // 60 ثانية

function setSession(chatId, senderJid, data) {
    const key = `${chatId}:${senderJid}`;
    data.expires = Date.now() + SESSION_TIMEOUT_MS;
    qualitySessions.set(key, data);
    // نظّف الجلسات المنتهية
    cleanupSessions();
}

function getSession(chatId, senderJid) {
    const key = `${chatId}:${senderJid}`;
    const data = qualitySessions.get(key);
    if (!data) return null;
    if (Date.now() > data.expires) {
        qualitySessions.delete(key);
        return null;
    }
    return data;
}

function clearSession(chatId, senderJid) {
    const key = `${chatId}:${senderJid}`;
    qualitySessions.delete(key);
}

function cleanupSessions() {
    const now = Date.now();
    for (const [key, data] of qualitySessions.entries()) {
        if (now > data.expires) qualitySessions.delete(key);
    }
}

// ── الأمر الرئيسي ────────────────────────────────────────────────────────────────
async function videoCommand(sock, chatId, message, args, query, ctx) {
    const t = getLang(sock);
    const arg = (args[0] || '').trim();

    try {
        // ── الحالة 1: المستخدم بعت رقم جودة بعد القائمة ──────────────────────
        if (/^[0-9]+$/.test(arg)) {
            const senderJid = ctx?.sender || message.key.participant || message.key.remoteJid;
            const session = getSession(chatId, senderJid);

            if (!session) {
                await sock.sendMessage(chatId, {
                    text: '⚠️ لا توجد جلسة تحميل نشطة.\n\nأرسل *.video <رابط أو بحث>* لبدء تحميل جديد.',
                }, { quoted: message });
                return;
            }

            const choice = parseInt(arg, 10);
            if (choice < 1 || choice > session.qualities.length) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ رقم غير صالح. اختر رقم من 1 إلى ${session.qualities.length}.`,
                }, { quoted: message });
                return;
            }

            const selected = session.qualities[choice - 1];
            clearSession(chatId, senderJid);

            await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
            await sock.sendMessage(chatId, {
                text: `⬇️ *جاري تحميل الفيديو...*\n\n🎬 ${session.title}\n📊 الجودة المختارة: *${selected.quality}*\n\n> قد يستغرق هذا عدة دقائق حسب الجودة.`,
            }, { quoted: message });

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            let outFile = null;
            try {
                outFile = await downloadAndConvert(selected.url, tempDir);

                const safeName = (session.title || 'video').replace(/[^a-zA-Z0-9-_\.]/g, '_').slice(0, 50);

                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(outFile),
                    mimetype: 'video/mp4',
                    fileName: safeName + '.mp4',
                    caption:
                        `🎬 *${session.title}*\n` +
                        `📊 ${t.dl_quality} *${selected.quality}*\n\n` +
                        `> *_Downloaded by Queen Riam_*`,
                });

                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            } finally {
                // امسح الملف المؤقت بعد 5 ثوان
                if (outFile) {
                    setTimeout(() => {
                        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
                    }, 5000);
                }
            }
            return;
        }

        // ── الحالة 2: المستخدم بعت رابط أو استعلام بحث ──────────────────────
        const searchQuery = query;
        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: t.dl_no_video }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        const resolved = await resolveYouTubeUrl(searchQuery);
        if (!resolved) {
            await sock.sendMessage(chatId, { text: t.dl_no_results }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        const urlMatch = resolved.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
        if (!urlMatch) {
            await sock.sendMessage(chatId, { text: t.dl_invalid_youtube }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        const videoId = urlMatch[1];
        const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

        await sock.sendMessage(chatId, {
            text: `🔍 *جاري البحث عن الجودات المتاحة...*\n\n🎬 ${resolved.title || '(بدون عنوان)'}\n\n⏳ قد يستغرق هذا عدة ثوان.`,
        }, { quoted: message });

        // اجلب كل الجودات المتاحة
        let qualities = [];
        try {
            qualities = await getAvailableQualities(fullUrl);
        } catch (err) {
            console.error('[video.js] getAvailableQualities error:', err.message);
        }

        // لو مفيش جودات متاحة من savetube، استخدم القائمة الافتراضية مع محاولة 360p
        if (qualities.length === 0) {
            console.log('[video.js] لا توجد جودات متاحة، نحاول 360p مباشرة...');
            try {
                const result = await getVideo(fullUrl, '360p');
                qualities = [{ quality: '360p', url: result.fileUrl }];
            } catch (err) {
                await sock.sendMessage(chatId, {
                    text:
                        `❌ *فشل تحميل الفيديو*\n\n` +
                        `🎬 ${resolved.title || '(بدون عنوان)'}\n` +
                        `📋 الرابط: ${resolved.url}\n\n` +
                        `> السبب: ${err.message}\n\n` +
                        `💡 *جرب لاحقاً* أو استخدم رابطاً آخر.`,
                }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return;
            }
        }

        // احفظ الجلسة للمستخدم
        const senderJid = ctx?.sender || message.key.participant || message.key.remoteJid;
        setSession(chatId, senderJid, {
            qualities,
            url: fullUrl,
            title: resolved.title || 'video',
            thumbnail: resolved.thumbnail || '',
        });

        // اعرض قائمة الجودات
        let listText =
            `🎬 *${resolved.title || '(بدون عنوان)'}*\n\n` +
            `📋 *الجودات المتاحة:*\n\n`;
        qualities.forEach((q, i) => {
            listText += `*${i + 1}.* ${q.quality}\n`;
        });
        listText +=
            `\n💡 *للتحميل، أرسل:*\n` +
            `*.video <رقم>*\n\n` +
            `⏰ انتهاء صلاحية الجلسة خلال 60 ثانية.`;

        // لو فيه صورة مصغّرة، أرسلها مع القائمة
        if (resolved.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: resolved.thumbnail },
                    caption: listText,
                }, { quoted: message });
            } catch {
                await sock.sendMessage(chatId, { text: listText }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: listText }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[video.js] Error:', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ *حدث خطأ غير متوقع*\n\n> السبب: ${error.message}`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['video', 'ytmp4', 'mp4'],
    description: 'تحميل فيديو من يوتيوب (مع اختيار الجودة)',
    category: 'download',
}, async (sock, chatId, message, args, query, ctx) => {
    await videoCommand(sock, chatId, message, args, query, ctx);
});
