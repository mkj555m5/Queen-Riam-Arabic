import yts from 'yt-search';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';

/*═══════════════════════════════════════════════════════════
  تــحــمــيــلات يــوتــيــوب — فيديو + صوت
  بـــودي بوت 💀
  ─────────────────────────────────────────────
  • نظام التحميل مبني على ytdl-core مباشرة (بدون API خارجي)
  • مكتبة التحميل: @distube/ytdl-core (الأحدث) → ytdl-core (بديل)
  • الجودة الافتراضية 360p بدون سؤال
  • تحديد الجودة يدوياً: .فيديو <رابط> 720p
  • عرض الجودات المتاحة: .فيديو <رابط> list
  • الجودات فوق 360p تُدمج تلقائياً بـ ffmpeg (فيديو + صوت)
  • fallback تلقائي لجودة أقل أو 360p عند الفشل
  • يدعم الرابط مباشرة أو البحث بالاسم
  • اختياري: ضع كوكيز يوتيوب في متغير البيئة YOUTUBE_COOKIE
    لتخطي حظر سيرفرات الاستضافة (خطأ 429 / تأكيد بوت)
═══════════════════════════════════════════════════════════*/

const DECOR = '*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*';
const SIGN = '> ৎ୭࠭͢𝑩𝑶𝑫𝒀-𝑩𝑶𝑻💀𓆪͟͞ ';

const DEFAULT_QUALITY = 360;
const MAX_BYTES = 500 * 1024 * 1024;     // حد أقصى 500MB
const DOC_THRESHOLD = 100 * 1024 * 1024; // فوق 100MB يرسل كمستند
const DL_TIMEOUT = 7 * 60 * 1000;        // مهلة تحميل 7 دقائق
const INFO_TIMEOUT = 45 * 1000;          // مهلة جلب المعلومات 45 ثانية

// ═════════ تحميل مكتبة ytdl-core (مرن بين النسختين — lazy بدون TLA) ═════════
let ytdl = null;
let ytdlLibName = '';
let _ytdlPromise = null;
async function loadYtdl() {
    if (!_ytdlPromise) {
        _ytdlPromise = (async () => {
            try {
                const mod = await import('@distube/ytdl-core');
                ytdl = mod.default || mod;
                ytdlLibName = '@distube/ytdl-core';
            } catch {
                const mod = await import('ytdl-core');
                ytdl = mod.default || mod;
                ytdlLibName = 'ytdl-core';
            }
            return ytdl;
        })();
    }
    return _ytdlPromise;
}

// ═════════ فحص توفر ffmpeg (لدمج الجودات العالية) ═════════
let _ffmpegOK = null;
function hasFfmpeg() {
    if (_ffmpegOK !== null) return _ffmpegOK;
    try { execSync('ffmpeg -version', { stdio: 'ignore' }); _ffmpegOK = true; }
    catch { _ffmpegOK = false; }
    return _ffmpegOK;
}

// ═════════ كوكيز يوتيوب الاختيارية (تخطي حظر السيرفرات) ═════════
let _agent = undefined;
function buildYtdlOpts(extra = {}) {
    const cookieStr = (process.env.YOUTUBE_COOKIE || '').trim();
    if (!cookieStr) return extra;
    try {
        if (typeof ytdl.createAgent === 'function') {
            if (_agent === undefined) {
                const cookies = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
                _agent = ytdl.createAgent(cookies);
            }
            if (_agent) return { ...extra, agent: _agent };
        }
        // النسخ القديمة: كوكيز عبر الهيدرات مباشرة
        return {
            ...extra,
            requestOptions: {
                ...extra.requestOptions,
                headers: { ...(extra.requestOptions?.headers || {}), cookie: cookieStr }
            }
        };
    } catch {
        return extra;
    }
}

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

// ═════════ أدوات مساعدة ═════════
function formatBytes(bytes) {
    if (!bytes) return 'غير معروف';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function fmtHeight(f) {
    return f.height || parseInt(f.qualityLabel, 10) || 0;
}

function tmpDir() {
    const dir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// ═════════ جلب معلومات الفيديو عبر ytdl-core ═════════
async function fetchInfo(videoId) {
    await loadYtdl();
    const url = 'https://www.youtube.com/watch?v=' + videoId;
    return Promise.race([
        ytdl.getInfo(url, buildYtdlOpts({ lang: 'ar' })),
        new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت مدة جلب معلومات الفيديو')), INFO_TIMEOUT))
    ]);
}

// ═════════ تحليل فورمات الفيديو المتاحة ═════════
// direct  = فيديو + صوت مدموجين من يوتيوب (أقصى شيوعاً 360p)
// merge   = فيديو فقط + صوت فقط ← يدمجهما ffmpeg (جودات عالية)
function analyzeFormats(formats) {
    const all = formats || [];
    const direct = all.filter(f => f.hasVideo && f.hasAudio && f.url)
        .sort((a, b) => fmtHeight(b) - fmtHeight(a));
    // فيديو فقط بصيغة mp4/h264 → الدمج بدون إعادة ترميز ومتوافق مع واتساب
    const videoOnly = all.filter(f => f.hasVideo && !f.hasAudio && (f.mimeType || '').includes('video/mp4'))
        .sort((a, b) => fmtHeight(b) - fmtHeight(a));
    const audioOnly = all.filter(f => !f.hasVideo && f.hasAudio && (f.mimeType || '').includes('audio/mp4'))
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const audioAny = audioOnly.length ? audioOnly : all.filter(f => !f.hasVideo && f.hasAudio)
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    return { direct, videoOnly, audio: audioAny[0] || null, all };
}

// ═════════ اختيار أفضل خيار تحميل حسب الجودة المطلوبة ═════════
function pickVideoPlan(an, requested) {
    const req = requested || DEFAULT_QUALITY;
    const ff = hasFfmpeg() && an.audio;

    // 1) جودة مدموجة مباشرة ≤ المطلوبة
    const directFit = an.direct.filter(f => fmtHeight(f) <= req);
    // 2) جودة عالية عبر الدمج ≤ المطلوبة
    const mergeFit = ff ? an.videoOnly.filter(f => fmtHeight(f) <= req) : [];

    const bestMerge = mergeFit.length ? mergeFit[0] : null;
    const bestDirect = directFit.length ? directFit[0] : null;

    // نفضّل الأعلى دقة؛ عند التعادل المدموج المباشر أثبت
    if (bestMerge && (!bestDirect || fmtHeight(bestMerge) > fmtHeight(bestDirect))) {
        const size = (+bestMerge.contentLength || 0) + (+an.audio.contentLength || 0);
        return { type: 'merge', video: bestMerge, audio: an.audio, size, label: fmtHeight(bestMerge) + 'p' };
    }
    if (bestDirect) {
        return { type: 'direct', format: bestDirect, size: +bestDirect.contentLength || 0, label: fmtHeight(bestDirect) + 'p' };
    }

    // لا يوجد شيء ≤ المطلوبة → أقل جودة متاحة
    if (ff && an.videoOnly.length) {
        const lowest = an.videoOnly[an.videoOnly.length - 1];
        const size = (+lowest.contentLength || 0) + (+an.audio.contentLength || 0);
        return { type: 'merge', video: lowest, audio: an.audio, size, label: fmtHeight(lowest) + 'p (أقرب متاح)' };
    }
    if (an.direct.length) {
        const lowest = an.direct[an.direct.length - 1];
        return { type: 'direct', format: lowest, size: +lowest.contentLength || 0, label: fmtHeight(lowest) + 'p (أقرب متاح)' };
    }
    return null;
}

// ═════════ تنزيل ستريم إلى ملف مع عداد ومهلة ═════════
function downloadStream(stream, destPath, maxBytes, timeoutMs = DL_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const out = fs.createWriteStream(destPath);
        let total = 0, done = false;
        const finish = (err, val) => {
            if (done) return;
            done = true;
            clearTimeout(to);
            if (err) { try { fs.unlinkSync(destPath); } catch { } reject(err); }
            else resolve(val);
        };
        const to = setTimeout(() => {
            try { stream.destroy(); } catch { }
            try { out.destroy(); } catch { }
            finish(new Error('انتهت مدة التحميل، جرب جودة أقل'));
        }, timeoutMs);
        stream.on('data', c => {
            total += c.length;
            if (total > maxBytes) {
                try { stream.destroy(); } catch { }
                try { out.destroy(); } catch { }
                finish(new Error('الملف أكبر من الحد المسموح (500MB)'));
            }
        });
        stream.on('error', e => { try { out.destroy(); } catch { } finish(e); });
        out.on('error', e => { try { stream.destroy(); } catch { } finish(e); });
        out.on('finish', () => finish(null, total));
        stream.pipe(out);
    });
}

// ═════════ تنزيل فيديو بصيغة معينة ═════════
async function downloadFormat(info, format, destPath) {
    const stream = ytdl.downloadFromInfo(info, buildYtdlOpts({ format }));
    return downloadStream(stream, destPath);
}

// ═════════ تنزيل ودمج (فيديو عالي + صوت) عبر ffmpeg ═════════
async function downloadAndMerge(info, plan, base) {
    const dir = tmpDir();
    const vPath = path.join(dir, base + '.v');
    const aPath = path.join(dir, base + '.a');
    const outPath = path.join(dir, base + '.mp4');
    try {
        const vStream = ytdl.downloadFromInfo(info, buildYtdlOpts({ format: plan.video }));
        await downloadStream(vStream, vPath);
        const aStream = ytdl.downloadFromInfo(info, buildYtdlOpts({ format: plan.audio }));
        await downloadStream(aStream, aPath);

        await new Promise((resolve, reject) => {
            const ff = spawn('ffmpeg', [
                '-y', '-i', vPath, '-i', aPath,
                '-map', '0:v:0', '-map', '1:a:0',
                '-c:v', 'copy', '-c:a', 'copy',
                '-movflags', '+faststart',
                outPath
            ]);
            let err = '';
            ff.stderr.on('data', d => {
                err += d.toString();
                if (err.length > 30000) err = err.slice(-8000);
            });
            ff.on('error', reject);
            ff.on('close', code => {
                if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) resolve();
                else reject(new Error('فشل دمج الفيديو والصوت (ffmpeg exit ' + code + ') ' + err.slice(-200)));
            });
        });
        return outPath;
    } finally {
        try { fs.unlinkSync(vPath); } catch { }
        try { fs.unlinkSync(aPath); } catch { }
    }
}

// ═════════ تنزيل صوت (mp3 عبر ffmpeg أو m4a مباشرة) ═════════
async function downloadAudio(info, audioFmt, base) {
    const dir = tmpDir();
    const m4aPath = path.join(dir, base + '.m4a');
    await downloadFormat(info, audioFmt, m4aPath);

    if (!hasFfmpeg()) return { file: m4aPath, mime: 'audio/mp4', ext: 'm4a', cleanup: () => {} };

    const mp3Path = path.join(dir, base + '.mp3');
    try {
        await new Promise((resolve, reject) => {
            const ff = spawn('ffmpeg', [
                '-y', '-i', m4aPath,
                '-vn', '-c:a', 'libmp3lame', '-b:a', '128k',
                mp3Path
            ]);
            let err = '';
            ff.stderr.on('data', d => { err += d.toString(); });
            ff.on('error', reject);
            ff.on('close', code => {
                if (code === 0 && fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) resolve();
                else reject(new Error('فشل تحويل الصوت (ffmpeg exit ' + code + ') ' + err.slice(-200)));
            });
        });
        try { fs.unlinkSync(m4aPath); } catch { }
        return { file: mp3Path, mime: 'audio/mpeg', ext: 'mp3', cleanup: () => {} };
    } catch {
        // فشل التحويل → نرسل m4a كما هي (واتساب يشغله)
        return { file: m4aPath, mime: 'audio/mp4', ext: 'm4a', cleanup: () => {} };
    }
}

// ═════════ بناء قائمة الجودات من الفورمات الفعلية ═════════
function buildQualityList(an) {
    const ff = hasFfmpeg() && an.audio;
    const merged = new Set();
    for (const f of an.direct) if (fmtHeight(f)) merged.add(fmtHeight(f));
    if (ff) for (const f of an.videoOnly) if (fmtHeight(f)) merged.add(fmtHeight(f));
    return [...merged].sort((a, b) => b - a);
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

    // ═ تجهيز مكتبة ytdl-core (مرة واحدة) ═
    try {
        await loadYtdl();
    } catch (e) {
        return m.reply(`${DECOR}\n*❌ لم يتم العثور على مكتبة ytdl-core*\n> نفذ: npm install @distube/ytdl-core\n${DECOR}`);
    }

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
        if (qm) { quality = parseInt(qm[1], 10); args.pop(); }
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
    const watchUrl = 'https://youtu.be/' + videoId;

    // ═ جلب المعلومات والفورمات عبر ytdl-core ═
    let ytInfo = null;
    try {
        ytInfo = await fetchInfo(videoId);
    } catch (e) {
        const msg = String(e.message || '');
        const low = msg.toLowerCase();
        const blocked = msg.includes('429') || low.includes('bot') || low.includes('sign in')
            || msg.includes('روبوت') || msg.includes('تسجيل الدخول') || msg.includes('تأكيد');
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        if (blocked) {
            return m.reply(`${DECOR}
*❌ يوتيوب رفض الطلب من هذا السيرفر*
> يوتيوب يحجب سيرفرات الاستضافة أحياناً (429 / تأكيد بوت)
> *الحل:* ضع كوكيز حساب يوتيوب في متغير البيئة:
> YOUTUBE_COOKIE=الكوكيز_من_المتصفح
${SIGN}
${DECOR}`);
        }
        return m.reply(`${DECOR}\n*❌ تعذر جلب بيانات الفيديو*\n> السبب: ${msg}\n${DECOR}`);
    }

    const details = ytInfo.videoDetails || {};
    const title = details.title || info?.title || 'فيديو يوتيوب';
    const author = details.author?.name || info?.author?.name || '—';
    const sec = parseInt(details.lengthSeconds, 10) || 0;
    const duration = info?.timestamp || (sec ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : '—');

    const an = analyzeFormats(ytInfo.formats);

    // ═ وضع قائمة الجودات ═
    if (wantList) {
        const lines = buildQualityList(an);
        if (!lines.length) return m.reply(`${DECOR}\n*لا توجد جودات متاحة لهذا الفيديو 🥲*\n${DECOR}`);
        return m.reply(
`${DECOR}
*📊 الجودات المتاحة لهذا الفيديو*
*الاسم:* ${title}
${lines.map(q => '◦ *' + q + 'p*').join('\n')}
> *مثال:* ${usedPrefix + command} ${watchUrl} 720p
${SIGN}
${DECOR}`);
    }

    // ═ اختيار خطة التحميل ═
    let plan = null;
    if (!isAudio) {
        plan = pickVideoPlan(an, quality);
        if (!plan) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(`${DECOR}\n*لا توجد صيغة قابلة للتحميل لهذا الفيديو 🥲*\n${DECOR}`);
        }
        // حجم ضخم → ننزل لجودة أقل تلقائياً
        if (plan.size > MAX_BYTES) {
            const lower = an.direct.concat(an.videoOnly)
                .filter(f => fmtHeight(f) < parseInt(plan.label))
                .sort((a, b) => fmtHeight(b) - fmtHeight(a));
            if (lower.length) {
                const f = lower[0];
                if (an.videoOnly.includes(f) && hasFfmpeg() && an.audio) {
                    plan = { type: 'merge', video: f, audio: an.audio, size: (+f.contentLength || 0) + (+an.audio.contentLength || 0), label: fmtHeight(f) + 'p (تلقائي)' };
                } else {
                    plan = { type: 'direct', format: f, size: +f.contentLength || 0, label: fmtHeight(f) + 'p (تلقائي)' };
                }
            }
        }
    }

    // ═ إرسال الصورة + رسالة المعلومات فوراً ═
    const sizeTxt = isAudio ? '' : '\n*الــحــجــم:* ' + (plan.size ? formatBytes(plan.size) : 'يُحسب أثناء التحميل');
    const capInfo = `${DECOR}\n*${isAudio ? '🎧 جاري تحميل الصوت' : '🎬 جاري تحميل الفيديو'} ⏱️⏳*\n*الاســم:* ${title}\n*القنــاة:* ${author}\n*الــمــدة:* ${duration}\n*الــجــودة:* ${isAudio ? 'MP3 🎵' : plan.label}${sizeTxt}\n${SIGN}\n${DECOR}`;
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
    const base = 'yt_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    let tmpFile = null;
    try {
        if (isAudio) {
            // ─────────── الصوت ───────────
            if (!an.audio) throw new Error('لا توجد صيغة صوت متاحة لهذا الفيديو');
            const res = await downloadAudio(ytInfo, an.audio, base);
            tmpFile = res.file;
            const buf = fs.readFileSync(tmpFile);
            const sentAudio = await conn.sendMessage(m.chat, {
                audio: buf,
                mimetype: res.mime,
                fileName: `${title}.${res.ext}`,
                contextInfo: { mentionedJid: [m.sender] }
            }, { quoted: m });
            await conn.sendMessage(m.chat, { react: { text: '🎧', key: sentAudio?.key || m.key } });

        } else {
            // ─────────── الفيديو ───────────
            if (plan.type === 'merge') {
                tmpFile = await downloadAndMerge(ytInfo, plan, base);
            } else {
                tmpFile = path.join(tmpDir(), base + '.mp4');
                await downloadFormat(ytInfo, plan.format, tmpFile);
            }

            const buf = fs.readFileSync(tmpFile);
            const asDocument = buf.length > DOC_THRESHOLD;
            let sent;
            try {
                sent = await conn.sendFile(m.chat, buf, `${title}.mp4`,
`${DECOR}
*تم تحميل الفيديو بنجاح ✅*
*الاســم:* ${title}
*الــجــودة:* ${plan.label}
*الــحــجــم:* ${formatBytes(buf.length)}
${SIGN}
${DECOR}`, m, null, { mimetype: 'video/mp4', asDocument });
            } catch (err) {
                // المحاولة الأخيرة: الجودة المدموجة 360p مباشرة
                const fallback = an.direct.find(f => fmtHeight(f) <= 360) || an.direct[an.direct.length - 1];
                if (fallback && plan.format?.itag !== fallback.itag) {
                    await m.reply(`${DECOR}\n*الجودة ${plan.label} فشلت ⟶ جاري جودة أقل تلقائياً 🔄*\n${DECOR}`);
                    tmpFile = path.join(tmpDir(), base + '_fb.mp4');
                    await downloadFormat(ytInfo, fallback, tmpFile);
                    const fb = fs.readFileSync(tmpFile);
                    sent = await conn.sendFile(m.chat, fb, `${title}.mp4`,
`${DECOR}
*تم تحميل الفيديو بنجاح ✅*
*الاســم:* ${title}
*الــجــودة:* ${fmtHeight(fallback)}p (تلقائي)
*الــحــجــم:* ${formatBytes(fb.length)}
${SIGN}
${DECOR}`, m, null, { mimetype: 'video/mp4' });
                } else throw err;
            }
            await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        }
    } catch (err) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply(`${DECOR}\n*❌ حصل خطأ أثناء التحميل*\n> السبب: ${err.message}\n${DECOR}`);
    } finally {
        // ═ تنظيف الملفات المؤقتة ═
        if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch { } }
        const dir = tmpDir();
        try {
            for (const f of fs.readdirSync(dir)) {
                if (f.startsWith('yt_') && Date.now() - fs.statSync(path.join(dir, f)).mtimeMs > 30 * 60 * 1000) {
                    try { fs.unlinkSync(path.join(dir, f)); } catch { }
                }
            }
        } catch { }
    }
};

handler.help = ['فيديو <رابط|اسم>', 'فيد <رابط>', 'صوتوي <رابط>', 'موسيقى <اسم>'];
handler.tags = ['downloader', 'التنزيل'];
handler.command = /^(فيديو|فيد|تحميل-فيديو|ytmp4|ytvid|video|mp4|صوتوي|موسيقى|ytmp3|music)$/i;
handler.register = false;
handler.premium = false;
export default handler;
