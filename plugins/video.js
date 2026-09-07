// plugins/video.js — تحميل فيديو من يوتيوب (جودة 360p افتراضية + اختيار يدوي)
// الاستخدام:
//   .video <search query or URL>            — تحميل بجودة 360p الافتراضية
//   .video <search query or URL> 720p       — تحميل بجودة محددة (144p/240p/360p/480p/720p/1080p)
//   .video <search query or URL> list       — عرض كل الجودات المتاحة للاختيار
//   .video <number>                          — تحميل بجودة معينة بعد عرض القائمة
// مثال:
//   .video https://youtu.be/xxxxx          — يحمّل بـ 360p ويبعت صورة مع الأمر
//   .video https://youtu.be/xxxxx 720p     — يحمّل بـ 720p
//   .video https://youtu.be/xxxxx list     — يعرض قائمة الجودات

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getVideo, getAvailableQualities, VIDEO_QUALITIES } = require('../lib/media');
const { getLang } = require('../lib/lang');

// ── Convert any video to H.264/AAC MP4 (required by WhatsApp) ─────────────────
function convertToH264(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-y',
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '28',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-progress', 'pipe:1',
            outputPath,
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stderrData = '';
        ff.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
        });

        ff.on('close', (code, signal) => {
            if (code === 0) {
                resolve();
            } else {
                // استخرج آخر سطر فيه error من stderr
                const errLines = stderrData.split('\n').filter(l => /error|invalid|not found/i.test(l)).slice(-3);
                const errMsg = errLines.join('; ') || `ffmpeg exited with code ${code} (signal: ${signal})`;
                reject(new Error(errMsg));
            }
        });

        ff.on('error', (err) => {
            reject(new Error(`ffmpeg spawn error: ${err.message}`));
        });

        // timeout 5 دقايق
        const timeout = setTimeout(() => {
            try { ff.kill('SIGKILL'); } catch {}
            reject(new Error('ffmpeg تجاوز الحد الزمني (5 دقائق)'));
        }, 5 * 60 * 1000);

        ff.on('close', () => clearTimeout(timeout));
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
            maxContentLength: 100 * 1024 * 1024, // حد أقصى 100MB للخام
        });
        fs.writeFileSync(rawFile, Buffer.from(videoRes.data));

        // تحقق إن الملف مش فارغ
        const stats = fs.statSync(rawFile);
        if (stats.size < 1000) {
            throw new Error('الملف المحمّل فارغ أو تالف (حجم أقل من 1KB)');
        }

        await convertToH264(rawFile, outFile);

        const outStats = fs.statSync(outFile);
        if (outStats.size > 62 * 1024 * 1024) {
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
const qualitySessions = new Map();
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 دقائق

function setSession(chatId, senderJid, data) {
    const key = `${chatId}:${senderJid}`;
    data.expires = Date.now() + SESSION_TIMEOUT_MS;
    qualitySessions.set(key, data);
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

// ── إرسال صورة الفيديو مع رسالة الأمر ────────────────────────────────────────
async function sendVideoThumbnail(sock, chatId, message, info) {
    if (!info.thumbnail) return; // مفيش صورة — نتخطى
    try {
        await sock.sendMessage(chatId, {
            image: { url: info.thumbnail },
            caption:
                `🎬 *${info.title || 'فيديو'}*\n\n` +
                `⏳ *جاري التحميل...*\n` +
                `📊 الجودة: ${info.quality || '360p'}\n\n` +
                `> _Queen Riam_`,
        }, { quoted: message });
    } catch (err) {
        console.error('[video.js] thumbnail send error:', err.message);
        // نكمل لو الصورة فشلت
    }
}

// ── تحميل مباشر بجودة محددة ─────────────────────────────────────────────────────
async function downloadWithQuality(sock, chatId, message, info, quality) {
    const t = getLang(sock);
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    let outFile = null;
    try {
        // جرب الجودة المطلوبة، ولو فشلت نرجع لـ 360p
        let actualQuality = quality || '360p';
        let result;
        try {
            result = await getVideo(info.url, actualQuality);
        } catch (err) {
            console.warn(`[video.js] failed quality ${actualQuality}:`, err.message);
            if (actualQuality !== '360p') {
                console.log('[video.js] falling back to 360p...');
                actualQuality = '360p';
                result = await getVideo(info.url, '360p');
            } else {
                throw err;
            }
        }

        outFile = await downloadAndConvert(result.fileUrl, tempDir);

        const safeName = (info.title || 'video').replace(/[^a-zA-Z0-9-_\.]/g, '_').slice(0, 50);

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(outFile),
            mimetype: 'video/mp4',
            fileName: safeName + '.mp4',
            caption:
                `🎬 *${info.title}*\n` +
                `📊 ${t.dl_quality} *${actualQuality}*\n\n` +
                `> *_Downloaded by Queen Riam_*`,
        });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } finally {
        if (outFile) {
            setTimeout(() => {
                try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
            }, 5000);
        }
    }
}

// ── عرض قائمة الجودات للاختيار ───────────────────────────────────────────────
async function listQualities(sock, chatId, message, info, senderJid) {
    await sock.sendMessage(chatId, {
        text: `🔍 *جاري البحث عن الجودات المتاحة...*\n\n🎬 ${info.title || '(بدون عنوان)'}`,
    }, { quoted: message });

    let qualities = [];
    try {
        qualities = await getAvailableQualities(info.url);
    } catch (err) {
        console.error('[video.js] getAvailableQualities error:', err.message);
    }

    // Fallback: استخدم القائمة الافتراضية
    if (qualities.length === 0) {
        qualities = VIDEO_QUALITIES.map(q => ({ quality: q, url: null }));
    }

    // احفظ الجلسة
    setSession(chatId, senderJid, {
        qualities,
        url: info.url,
        title: info.title || 'video',
        thumbnail: info.thumbnail || '',
    });

    // اعرض القائمة
    let listText =
        `🎬 *${info.title || '(بدون عنوان)'}*\n\n` +
        `📋 *الجودات المتاحة:*\n\n`;
    qualities.forEach((q, i) => {
        listText += `*${i + 1}.* ${q.quality}\n`;
    });
    listText +=
        `\n💡 *للتحميل، أرسل:*\n` +
        `• *.video <رقم>* — لتحميل الجودة المختارة\n\n` +
        `⏰ انتهاء صلاحية الجلسة خلال 5 دقائق.`;

    // لو فيه صورة مصغّرة، أرسلها مع القائمة
    if (info.thumbnail) {
        try {
            await sock.sendMessage(chatId, {
                image: { url: info.thumbnail },
                caption: listText,
            }, { quoted: message });
        } catch {
            await sock.sendMessage(chatId, { text: listText }, { quoted: message });
        }
    } else {
        await sock.sendMessage(chatId, { text: listText }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
}

// ── الأمر الرئيسي ────────────────────────────────────────────────────────────────
async function videoCommand(sock, chatId, message, args, query, ctx) {
    const t = getLang(sock);
    const senderJid = ctx?.sender || message.key.participant || message.key.remoteJid;

    try {
        const arg = (args[0] || '').trim();

        // ── الحالة 1: المستخدم بعت رقم جودة بعد القائمة ──────────────────────
        if (/^[0-9]+$/.test(arg)) {
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
                text: `⬇️ *جاري تحميل الفيديو...*\n\n🎬 ${session.title}\n📊 الجودة المختارة: *${selected.quality}*\n\n> قد يستغرق هذا عدة دقائق.`,
            }, { quoted: message });

            // لو فيه URL مباشر، نحمّل منه. لو لأ، نستخدم getVideo
            if (selected.url) {
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
                    if (outFile) {
                        setTimeout(() => {
                            try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
                        }, 5000);
                    }
                }
            } else {
                // الجودة مالهاش URL مباشر — استخدم downloadWithQuality
                await downloadWithQuality(sock, chatId, message, session, selected.quality);
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

        // ── فحص آخر token في الاستعلام لتحديد الإجراء ────────────────────────
        const tokens = searchQuery.trim().split(/\s+/);
        const lastToken = tokens[tokens.length - 1].toLowerCase();

        // لو آخر token هو "list" — عرض قائمة الجودات
        if (lastToken === 'list' || lastToken === 'qualities' || lastToken === 'l') {
            // إزالة "list" من العنوان
            const titleQuery = tokens.slice(0, -1).join(' ').trim();
            const info = {
                url: fullUrl,
                title: resolved.title || (titleQuery || videoId),
                thumbnail: resolved.thumbnail || '',
            };
            await listQualities(sock, chatId, message, info, senderJid);
            return;
        }

        // لو آخر token هو جودة صحيحة (مثل 720p, 360p, 1080p)
        const qualityMatch = lastToken.match(/^(144|240|360|480|720|1080)p?$/i);
        let requestedQuality = '360p'; // الافتراضي
        let titleForDisplay = resolved.title;

        if (qualityMatch) {
            requestedQuality = qualityMatch[1] + 'p';
            // إزالة الجودة من العنوان
            const titleQuery = tokens.slice(0, -1).join(' ').trim();
            if (titleQuery && !resolved.title) {
                // المستخدم بعت بحث بجودة، استخدم النتائج
                titleForDisplay = resolved.title;
            }
        }

        // ── إرسال صورة الفيديو مع رسالة الأمر ───────────────────────────────
        const info = {
            url: fullUrl,
            title: titleForDisplay || 'فيديو',
            thumbnail: resolved.thumbnail || '',
            quality: requestedQuality,
        };

        // أرسل صورة الفيديو مع رسالة "جاري التحميل"
        if (resolved.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: resolved.thumbnail },
                    caption:
                        `🎬 *${titleForDisplay}*\n\n` +
                        `⏳ *جاري تحميل الفيديو...*\n` +
                        `📊 الجودة: ${requestedQuality}\n\n` +
                        `> _Queen Riam_`,
                }, { quoted: message });
            } catch (err) {
                console.error('[video.js] thumbnail send error:', err.message);
            }
        } else {
            await sock.sendMessage(chatId, {
                text: `🎬 *${titleForDisplay}*\n\n⏳ *جاري تحميل الفيديو...*\n📊 الجودة: ${requestedQuality}`,
            }, { quoted: message });
        }

        // ── تحميل الفيديو بالجودة المطلوبة ──────────────────────────────────
        await downloadWithQuality(sock, chatId, message, info, requestedQuality);

    } catch (error) {
        console.error('[video.js] Error:', error.message, error.stack);
        let errMsg = error.message || 'خطأ غير معروف';
        // رسائل خطأ أوضح
        if (errMsg.includes('ffmpeg')) {
            errMsg = 'فشل تحويل الفيديو (ffmpeg). تأكد من تثبيت ffmpeg على السيرفر.\n> ' + errMsg;
        } else if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
            errMsg = 'تجاوز الحد الزمني للتحميل. حاول مرة أخرى أو جرّب جودة أقل.';
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED')) {
            errMsg = 'تعذر الاتصال بسيرفر التحميل. حاول لاحقاً.';
        }
        await sock.sendMessage(chatId, {
            text: `❌ *فشل تحميل الفيديو*\n\n> السبب: ${errMsg}`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['video', 'ytmp4', 'mp4'],
    description: 'تحميل فيديو من يوتيوب (جودة 360p افتراضية أو محددة)',
    category: 'download',
}, async (sock, chatId, message, args, query, ctx) => {
    await videoCommand(sock, chatId, message, args, query, ctx);
});
