// ★ محرك يوتيوب — نقل أصلي من نظام بوت Rimuru MD v4.6 (النسخة العربية)
// المالك: ShowyWharf27322
// ثلاثة مستويات للتحميل مثل Rimuru تماماً:
//   1) nexray API   — يدعم اختيار الجودة (360p/720p ...)
//   2) izuka API    — أفضل جودة متاحة تلقائياً
//   3) y2mate scraper (d.ymcdn.org) — مع متابعة تقدم التحويل
'use strict';

const axios = require('axios');

const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

function extractVideoId(url) {
    return String(url || '').match(YOUTUBE_ID_REGEX)?.[1] || null;
}

function isYouTubeUrl(str) {
    return /(?:youtube\.com|youtu\.be)/i.test(String(str || ''));
}

/** المستوى 1: nexray API — جودة محددة (نفس نظام أمر playvid في Rimuru) */
async function nexrayYtmp4(url, resolution = '360') {
    const api = `https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}&resolusi=${resolution}`;
    const res = await axios.get(api, { timeout: 60000 });
    const json = res.data;
    if (!json?.status || !json?.result?.url) {
        throw new Error('nexray: لا توجد نتيجة');
    }
    return {
        url: json.result.url,
        title: json.result.title || '',
        duration: json.result.duration || '',
        resolution: json.result.resolusi || resolution,
    };
}

/** المستوى 2: izuka API — أفضل جودة mp4 متاحة (نفس نظام أمر ytmp4 في Rimuru) */
async function izukaYtmp4(url) {
    const { data } = await axios.get(
        `https://my.izuka-api.xyz/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        { timeout: 60000 }
    );

    if (data?.status && data?.result?.video_normal) {
        const videos = data.result.video_normal.filter(v => v.ext === 'mp4' && v.url);
        if (videos.length > 0) {
            videos.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
            return {
                url: videos[0].url,
                title: data.result.title || '',
                resolution: videos[0].quality ? `${videos[0].quality}p` : '',
            };
        }
    }
    throw new Error('izuka: لا توجد نتيجة');
}

/** المستوى 3: سكرابر y2mate مع متابعة تقدم التحويل (نظام Rimuru الأصلي) */
async function ytdlScraper(url, format = 'mp4') {
    const videoId = extractVideoId(url);
    if (!videoId) {
        return { status: false, mess: 'رابط يوتيوب غير صالح.' };
    }

    const normalizedFormat =
        String(format || 'mp4').toLowerCase() === 'mp4' ? 'mp4' : 'mp3';

    const client = axios.create({
        timeout: 60000,
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36',
            Referer: 'https://id.ytmp3.mobi/',
        },
    });

    const { data: init } = await client.get('https://d.ymcdn.org/api/v1/init', {
        params: { p: 'y', 23: '1llum1n471', _: Math.random() },
    });

    if (!init?.convertURL) {
        return { status: false, mess: 'فشل تهيئة سيرفر التحويل.' };
    }

    const { data: convert } = await client.get(init.convertURL, {
        params: { v: videoId, f: normalizedFormat, _: Math.random() },
    });

    if (!convert?.progressURL || !convert?.downloadURL) {
        return { status: false, mess: 'فشل الحصول على بيانات التحويل.' };
    }

    let progress = 0;
    let title = convert.title || '';
    let attempts = 0;
    const maxAttempts = 20;

    while (progress < 3 && attempts < maxAttempts) {
        const { data } = await client.get(convert.progressURL);

        if ((data?.error || 0) > 0) {
            return { status: false, mess: `خطأ من السيرفر: ${data.error}` };
        }

        progress = Number(data?.progress || 0);
        title = data?.title || title;

        if (progress < 3) {
            attempts += 1;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    if (attempts >= maxAttempts && progress < 3) {
        return { status: false, mess: 'انتهت مهلة التحويل (العملية طويلة جداً).' };
    }

    return { status: true, title, dl: convert.downloadURL };
}

/**
 * الحصول على رابط تحميل الفيديو — نفس الترتيب الثلاثي لنظام Rimuru:
 * nexray (بالجودة المطلوبة) ← izuka (أفضل جودة) ← سكرابر y2mate
 */
async function getVideoDownloadUrl(url, resolution = '360') {
    // المستوى 1: nexray بالجودة المطلوبة
    try {
        const r = await nexrayYtmp4(url, resolution);
        if (r.url) return r;
    } catch (e) {
        console.error('[VIDEO nexray]', e.message);
    }

    // المستوى 2: izuka بأفضل جودة
    try {
        const r = await izukaYtmp4(url);
        if (r.url) return r;
    } catch (e) {
        console.error('[VIDEO izuka]', e.message);
    }

    // المستوى 3: سكرابر y2mate
    const fallback = await ytdlScraper(url, 'mp4');
    if (fallback?.status && fallback?.dl) {
        return { url: fallback.dl, title: fallback.title || '', resolution: '' };
    }

    throw new Error(fallback?.mess || 'فشل الحصول على رابط الفيديو');
}

module.exports = {
    extractVideoId,
    isYouTubeUrl,
    nexrayYtmp4,
    izukaYtmp4,
    ytdlScraper,
    getVideoDownloadUrl,
};
