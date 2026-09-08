import yts from 'yt-search';

/*═══════════════════════════════════════════════════════════
  تــحــمــيــلات يــوتــيــوب — فيديو + صوت
  بـــودي بوت 💀
  ─────────────────────────────────────────────
  • مبني على Hector Worker API (نفس الـ API من الشات)
  • الجودة الافتراضية 360p بدون سؤال
  • تحديد الجودة يدوياً: .فيديو <رابط> 720p
  • عرض الجودات المتاحة: .فيديو <رابط> list
  • fallback تلقائي لـ 360p لو الجودة المطلوبة فشلت
  • fallback تلقائي لجودة أقل لو الحجم كبير
  • يدعم الرابط مباشرة أو البحث بالاسم
═══════════════════════════════════════════════════════════*/

const DECOR = '*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*';
const SIGN = '> ৎ୭࠭͢𝑩𝑶𝑫𝒀-𝑩𝑶𝑻💀𓆪͟͞ ';

const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';
const OCHINPO_API = 'https://ochinpo-helper.hf.space/yt';
const DEFAULT_QUALITY = '360';
const QUALITY_ORDER = ['2160', '1440', '1080', '720', '480', '360', '240', '144'];
const MAX_BYTES = 500 * 1024 * 1024;   // حد أقصى 500MB
const DOC_THRESHOLD = 100 * 1024 * 1024; // فوق 100MB يرسل كمستند

// ═════════ استخراج معرف الفيديو من أي صيغة رابط ═════════
function extractVideoId(text) {
    if (!text) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
        /^([A-Za-z0-9_-]{11})$/
    ];
    for (const p of patterns) {
        const mt = text.match(p);
        if (mt) return mt[1];
    }
    return null;
}

// ═════════ جلب البيانات من Hector Worker (المحاولة الرئيسية) ═════════
async function fetchFromHector(videoId) {
    const target = 'https://www.youtube.com/watch?v=' + videoId;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await fetch(`${HECTOR_API}/?url=${encodeURIComponent(target)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && data.status === true && (data.videos || data.audio)) return data;
            throw new Error(data?.error || 'لا توجد بيانات');
        } catch (e) {
            lastErr = e;
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastErr;
}

// ═════════ fallback للصوت عبر ochinpo ═════════
async function fetchFromOchinpo(query) {
    const res = await fetch(`${OCHINPO_API}?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const audio = data?.result?.download?.audio;
    if (!audio) throw new Error('لا يوجد رابط صوت');
    return audio;
}

// ═════════ اختيار الجودة الأنسب (fallback ذكي) ═════════
function pickQuality(videos, requested) {
    const available = Object.keys(videos || {}).map(String);
    if (!available.length) return null;
    if (available.includes(requested)) return requested;
    const req = parseInt(requested, 10);
    if (!isNaN(req) && req > 0) {
        // أعلى جودة متاحة أقل من أو تساوي المطلوبة
        const lower = available.map(Number).filter(n => n <= req).sort((a, b) => b - a);
        if (lower.length) return String(lower[0]);
        // لا توجد جودة أقل → أقل جودة متاحة فوق المطلوبة
        const higher = available.map(Number).sort((a, b) => a - b);
        return String(higher[0]);
    }
    // جودة غير رقمية → الافتراضي 360 أو الأقل المتاح
    if (available.includes('360')) return '360';
    const sorted = available.map(Number).sort((a, b) => a - b);
    return String(sorted[0]);
}

// ═════════ فحص حجم الملف عبر HEAD ═════════
async function checkSize(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return parseInt(res.headers.get('content-length') || '0', 10) || 0;
    } catch { return 0; }
}

function formatBytes(bytes) {
    if (!bytes) return 'غير معروف';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ═══════════════════ الـ Handler ═══════════════════
let handler = async (m, { conn, text, usedPrefix, command }) => {
    const isAudio = /^(صوتوي|موسيقى|ytmp3|music)$/i.test(command);

    // ═ رسالة الاستخدام الصحيح ═
    if (!text) return m.reply(
`${DECOR}
*❀ ابـعـت رابـط يـوتـيـوب أو اسـم الـفـيـديـو ☘️*
> *مــثــال:*
> ${usedPrefix + command} https://youtu.be/xxxxx
> ${usedPrefix + command} اسم الفيديو
> ${usedPrefix + command} الرابط 720p ← تحديد الجودة
> ${usedPrefix + command} الرابط list ← عرض الجودات
*الجودة الافتراضية ↞ 360p*
${SIGN}
${DECOR}`);

    await conn.sendMessage(m.chat, { react: { text: '⏱️', key: m.key } });

    // ═ تحليل الجودة / وضع القائمة من آخر كلمة ═
    let args = text.trim().split(/\s+/);
    let quality = DEFAULT_QUALITY;
    let wantList = false;
    const last = (args[args.length - 1] || '').toLowerCase();
    if (last === 'list' || last === 'قائمة' || last === 'جودات') {
        wantList = true;
        args.pop();
    } else {
        const qm = last.match(/^(\d{3,4})p?$/);
        if (qm) { quality = qm[1]; args.pop(); }
    }
    const query = args.join(' ').trim();
    if (!query) return m.reply(`${DECOR}\n*ابعت اسم أو رابط صحيح يا صديقي 🥲*\n${DECOR}`);

    // ═ الرابط مباشرة؟ أو بحث بالاسم ═
    let videoId = extractVideoId(query);
    let info = null;

    if (!videoId) {
        try {
            let search = await yts(query);
            let videos = (search.all || []).filter(v => v.type === 'video');
            if (!videos.length) videos = search.videos || [];
            if (!videos.length) {
                await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
                return m.reply(`${DECOR}\n*لم يتم العثور على نتائج 🥲 حاول اسم أوضح*\n${DECOR}`);
            }
            info = videos[0];
            videoId = info.videoId;
        } catch (e) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(`${DECOR}\n*فشل البحث:* ${e.message}\n${DECOR}`);
        }
    }

    const thumbnail = info?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const watchUrl = `https://youtu.be/${videoId}`;

    // ═ جلب البيانات من الـ API ═
    let hector = null;
    try {
        hector = await fetchFromHector(videoId);
    } catch (e) {
        // لو الصوت نكمل لـ fallback ochinpo تحت، الفيديو هيرفض
        if (!isAudio) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(`${DECOR}\n*❌ السيرفر مش متاح حالياً 🔄*\n> جرب تاني بعد دقيقة\n${DECOR}`);
        }
    }

    const title = hector?.title || info?.title || 'فيديو يوتيوب';
    const author = info?.author?.name || '—';
    const duration = info?.timestamp || '—';

    // ═ وضع قائمة الجودات ═
    if (wantList) {
        if (!hector || !hector.videos) {
            return m.reply(`${DECOR}\n*تعذر جلب قائمة الجودات 🔄 حاول مرة أخرى*\n${DECOR}`);
        }
        const lines = Object.keys(hector.videos)
            .sort((a, b) => (+b) - (+a))
            .map(q => `◦ *${q}p*`)
            .join('\n');
        return m.reply(
`${DECOR}
*📊 الجودات المتاحة لهذا الفيديو*
*الاسم:* ${title}
${lines}
> *مثال:* ${usedPrefix + command} ${watchUrl} 720p
${SIGN}
${DECOR}`);
    }

    // ═ إرسال الصورة + رسالة المعلومات فوراً (نفس سلوك الشات) ═
    const capInfo = `${DECOR}\n*${isAudio ? '🎧 جاري تحميل الصوت' : '🎬 جاري تحميل الفيديو'} ⏱️⏳*\n*الاســم:* ${title}\n*القنــاة:* ${author}\n*الــمــدة:* ${duration}\n*الــجــودة:* ${isAudio ? 'MP3 🎵' : quality + 'p'}\n${SIGN}\n${DECOR}`;
    try {
        await conn.sendMessage(m.chat, {
            image: { url: thumbnail },
            caption: capInfo,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: true,
                    title: title,
                    body: 'بـــودي بوت 💀',
                    mediaType: 2,
                    renderLargerThumbnail: true,
                    thumbnail: { url: thumbnail },
                    mediaUrl: watchUrl,
                    sourceUrl: watchUrl
                }
            }
        }, { quoted: m });
    } catch {
        await m.reply(capInfo);
    }

    // ═ التحميل الفعلي والإرسال ═
    try {
        if (isAudio) {
            // ─────────── الصوت ───────────
            let audioUrl = hector?.audio || null;
            if (!audioUrl) {
                audioUrl = await fetchFromOchinpo(info?.title || query).catch(() => null);
            }
            if (!audioUrl) throw new Error('لم أجد رابط الصوت، جرب تاني بعد شويه 🔄');

            const sentAudio = await conn.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                contextInfo: { mentionedJid: [m.sender] }
            }, { quoted: m });

            await conn.sendMessage(m.chat, { react: { text: '🎧', key: sentAudio?.key || m.key } });

        } else {
            // ─────────── الفيديو ───────────
            if (!hector || !hector.videos) throw new Error('السيرفر مش متاح حالياً، جرب تاني بعد شويه 🔄');

            let q = pickQuality(hector.videos, quality);
            if (!q) throw new Error('لا توجد جودات متاحة لهذا الفيديو');
            let videoUrl = hector.videos[q];

            // لو الحجم ضخم → ننزل لجودة أقل
            let size = await checkSize(videoUrl);
            if (size > MAX_BYTES) {
                const lower = QUALITY_ORDER.filter(x => (+x) < (+q) && hector.videos[x]);
                if (lower.length) {
                    q = lower[0];
                    videoUrl = hector.videos[q];
                    size = await checkSize(videoUrl);
                }
            }
            const asDocument = size > DOC_THRESHOLD;

            let sent;
            try {
                sent = await conn.sendFile(m.chat, videoUrl, `${title}.mp4`,
`${DECOR}
*تم تحميل الفيديو بنجاح ✅*
*الاســم:* ${title}
*الــجــودة:* ${q}p
*الــحــجــم:* ${formatBytes(size)}
${SIGN}
${DECOR}`, m, null, { mimetype: 'video/mp4', asDocument });
            } catch (err) {
                // المحاولة الأخيرة: الجودة 360p مباشرة
                if (q !== '360' && hector.videos['360']) {
                    await m.reply(`${DECOR}\n*الجودة ${q}p فشلت ⟶ جاري 360p تلقائياً 🔄*\n${DECOR}`);
                    const size360 = await checkSize(hector.videos['360']);
                    sent = await conn.sendFile(m.chat, hector.videos['360'], `${title}.mp4`,
`${DECOR}
*تم تحميل الفيديو بنجاح ✅*
*الاســم:* ${title}
*الــجــودة:* 360p (تلقائي)
*الــحــجــم:* ${formatBytes(size360)}
${SIGN}
${DECOR}`, m, null, { mimetype: 'video/mp4' });
                } else throw err;
            }

            await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        }
    } catch (err) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply(`${DECOR}\n*❌ حصل خطأ أثناء التحميل*\n> السبب: ${err.message}\n${DECOR}`);
    }
};

handler.help = ['فيديو <رابط|اسم>', 'فيد <رابط>', 'صوتوي <رابط>', 'موسيقى <اسم>'];
handler.tags = ['downloader', 'التنزيل'];
handler.command = /^(فيديو|فيد|تحميل-فيديو|ytmp4|ytvid|video|mp4|صوتوي|موسيقى|ytmp3|music)$/i;
handler.register = false;
handler.premium = false;
export default handler;
