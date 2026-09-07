'use strict';

/**
 * lib/media.js — Queen Riam Arabic Edition (نظيف بدون تعمية)
 *
 * يدعم تحميل الفيديو والصوت من يوتيوب عبر:
 *   1. Hector Worker API (https://yt-dl.officialhectormanuel.workers.dev)
 *   2. cnv.cx (https://cnv.cx/v2)
 *   3. ytdown.to (fallback)
 *
 * يدعم أيضاً snapchat / twitter / facebook.
 */

const { Buffer } = require('buffer');
const axios = require('axios');
const path = require('path');

const HECTOR_WORKER_URL = 'https://yt-dl.officialhectormanuel.workers.dev';
const CNV_CX_URL = 'https://cnv.cx/v2';
const YTDOWN_URL = 'https://fbdown.to';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': '*/*',
};

const CNV_HEADERS = {
    'origin': 'https://cnv.cx',
    'referer': 'https://cnv.cx/',
    'user-agent': DEFAULT_HEADERS['User-Agent'],
};

// ── استخراج YouTube video ID ─────────────────────────────────────────────────
function extractVideoId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

// ── 1) Hector Worker API (الـ API الأساسي من النسخة الأصلية) ─────────────────────
// يجيب JSON فيه {status, title, thumbnail, audio, videos: {144, 240, 360, 480, 720, 1080}}
async function fetchFromHectorWorker(videoUrl) {
    try {
        const res = await axios.get(HECTOR_WORKER_URL + '/?url=' + encodeURIComponent(videoUrl), {
            timeout: 90000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
            maxRedirects: 5,
        });
        const data = res.data;
        if (!data || data.status !== true) {
            throw new Error('Hector worker status: ' + (data?.status || 'no status'));
        }
        return {
            title: data.title || '',
            thumbnail: data.thumbnail || '',
            audioUrl: data.audio || null,
            videos: data.videos || {}, // {144: url, 240: url, 360: url, ...}
        };
    } catch (err) {
        throw new Error('Hector worker failed: ' + err.message);
    }
}

// يحول من JSON Hector إلى URL مباشر للجودة المطلوبة
async function getVideoFromHectorWorker(url, quality = '360p') {
    const info = await fetchFromHectorWorker(url);
    const qualityNum = String(quality).replace('p', '');
    const videoUrl = info.videos[qualityNum] || info.videos['360'] || info.videos['720'] || Object.values(info.videos)[0];
    if (!videoUrl) {
        throw new Error('Hector worker: no video URL for quality ' + quality);
    }
    return {
        fileUrl: videoUrl,
        title: info.title,
        thumbnail: info.thumbnail,
        quality: qualityNum + 'p',
    };
}

async function getAudioFromHectorWorker(url) {
    const info = await fetchFromHectorWorker(url);
    if (!info.audioUrl) {
        throw new Error('Hector worker: no audio URL');
    }
    return {
        fileUrl: info.audioUrl,
        title: info.title,
        thumbnail: info.thumbnail,
        quality: '128kbps',
    };
}

// ── 2) cnv.cx API (Fallback رئيسي للتحويل) ─────────────────────────────────────
async function convertViaCnvCx(url, { mediaType = 'mp4', videoQuality = '360', audioBitrate = '128', vCodec = 'h264' } = {}) {
    const params = new URLSearchParams();
    params.append('link', url);
    params.append('imeStyl', 'pretty');
    if (mediaType === 'mp4') {
        params.append('mediaType', 'mp4');
        params.append('videoQuality', videoQuality);
        params.append('audioBitrate', audioBitrate);
        params.append('vCodec', vCodec);
    } else if (mediaType === 'mp3') {
        params.append('mediaType', 'mp3');
        params.append('audioBitrate', audioBitrate);
    }

    const res = await axios.post(`${CNV_CX_URL}/converter`, params.toString(), {
        headers: {
            ...CNV_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 90000,
    });

    if (!res.data || !res.data.status) {
        throw new Error('cnv.cx: ' + (res.data?.message || 'no status field'));
    }
    if (res.data.status !== 'ok' && res.data.status !== 'completed') {
        // لو فيه jobId، ننتظر النتيجة
        if (res.data.jobId || res.data.id) {
            return await waitForCnvCxJob(res.data.jobId || res.data.id);
        }
        throw new Error('cnv.cx: ' + (res.data.message || 'status: ' + res.data.status));
    }
    if (!res.data.fileUrl && !res.data.url) {
        throw new Error('cnv.cx: no download URL in response');
    }
    return res.data.fileUrl || res.data.url;
}

async function waitForCnvCxJob(jobId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
            const res = await axios.post(`${CNV_CX_URL}/status`, { jobId }, {
                headers: CNV_HEADERS,
                timeout: 30000,
            });
            if (res.data?.status === 'completed' || res.data?.status === 'ok') {
                if (res.data.fileUrl || res.data.url) {
                    return res.data.fileUrl || res.data.url;
                }
            }
            if (res.data?.status === 'failed' || res.data?.status === 'error') {
                throw new Error('cnv.cx job failed: ' + (res.data.message || ''));
            }
        } catch (err) {
            // استمر في المحاولة
        }
    }
    throw new Error('cnv.cx: timed out waiting for file');
}

// ── 3) ytdown.to (Fallback ثانٍ) ──────────────────────────────────────────────
async function convertViaYtDown(url, quality = '360') {
    // ytdown.to API
    const params = new URLSearchParams();
    params.append('url', url);
    params.append('q', quality);

    const res = await axios.post(`${YTDOWN_URL}/api/ajaxSearch`, params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
            'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 60000,
    });

    if (!res.data || res.data.status !== 'ok') {
        throw new Error('ytdown.to: ' + (res.data?.message || 'failed'));
    }

    // ابحث عن الرابط في النتيجة
    const links = res.data.links?.mp4 || res.data.links?.mp3 || {};
    const firstKey = Object.keys(links)[0];
    if (!firstKey || !links[firstKey]) {
        throw new Error('ytdown.to: no download links');
    }

    return {
        url: links[firstKey],
        title: res.data.title || '',
        thumbnail: res.data.thumbnail || '',
        quality: links[firstKey].q || quality,
    };
}

// ── الجودات المدعومة ──────────────────────────────────────────────────────────
const VIDEO_QUALITIES = ['144p', '240p', '360p', '480p', '720p', '1080p'];

// ── الواجهة الأصلية: getVideo(url, quality) ──────────────────────────────────
async function getVideo(url, quality = '360p') {
    // 1) جرّب Hector Worker (الـ API الأساسي - الأسرع والأكثر استقراراً)
    try {
        const result = await getVideoFromHectorWorker(url, quality);
        return result;
    } catch (err) {
        console.error('[media] Hector worker video failed:', err.message);
        // نكمل للـ fallbacks
    }

    const qualityNum = String(quality).replace('p', '');
    let lastErr;

    // 2) جرّب cnv.cx
    try {
        const fileUrl = await convertViaCnvCx(url, { mediaType: 'mp4', videoQuality: qualityNum });
        return {
            fileUrl,
            title: '',
            thumbnail: '',
            quality,
        };
    } catch (err) {
        console.error('[media] cnv.cx failed:', err.message);
        lastErr = err;
    }

    // 3) جرّب ytdown.to
    try {
        const result = await convertViaYtDown(url, qualityNum);
        return {
            fileUrl: result.url,
            title: result.title,
            thumbnail: result.thumbnail,
            quality: result.quality || quality,
        };
    } catch (err) {
        console.error('[media] ytdown.to failed:', err.message);
        lastErr = err;
    }

    throw new Error('فشل تحميل الفيديو من كل المصادر: ' + (lastErr?.message || 'خطأ غير معروف'));
}

// ── تحميل الصوت ──────────────────────────────────────────────────────────────
async function getAudio(url, quality = '128kbps') {
    // 1) جرّب Hector Worker
    try {
        const result = await getAudioFromHectorWorker(url);
        return result;
    } catch (err) {
        console.error('[media] Hector worker audio failed:', err.message);
    }

    const bitrate = String(quality).replace('kbps', '');
    let lastErr;

    // 2) cnv.cx
    try {
        const fileUrl = await convertViaCnvCx(url, { mediaType: 'mp3', audioBitrate: bitrate });
        return { fileUrl, title: '', thumbnail: '', quality };
    } catch (err) {
        console.error('[media] cnv.cx audio failed:', err.message);
        lastErr = err;
    }

    // 3) ytdown.to
    try {
        const result = await convertViaYtDown(url, bitrate);
        return {
            fileUrl: result.url,
            title: result.title,
            thumbnail: result.thumbnail,
            quality,
        };
    } catch (err) {
        console.error('[media] ytdown.to audio failed:', err.message);
        lastErr = err;
    }

    throw new Error('فشل تحميل الصوت: ' + (lastErr?.message || 'خطأ غير معروف'));
}

// ── جلب الجودات المتاحة من Hector Worker ─────────────────────────────────────
async function getAvailableQualities(url) {
    const available = [];
    try {
        const info = await fetchFromHectorWorker(url);
        for (const q of VIDEO_QUALITIES) {
            const qNum = q.replace('p', '');
            if (info.videos[qNum]) {
                available.push({ quality: q, url: info.videos[qNum] });
            }
        }
    } catch (err) {
        console.error('[media] getAvailableQualities failed:', err.message);
    }
    return available;
}

// ── Stubs لـ Snapchat / Twitter / Facebook ────────────────────────────────────
async function downloadSnapchat(url) {
    // snapmate.io API
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': DEFAULT_HEADERS['User-Agent'] },
            timeout: 30000,
            maxRedirects: 5,
        });
        const html = res.data;
        // ابحث عن رابط الفيديو في الـ HTML
        const match = html.match(/https?:\/\/[a-zA-Z0-9.-]+snapcdn[a-zA-Z0-9./-]+/i);
        if (match) return { url: match[0], title: 'Snapchat Video' };
        throw new Error('Snapchat: لم يتم العثور على رابط الفيديو');
    } catch (err) {
        throw new Error('Snapchat downloader غير مُفعّل بشكل كامل: ' + err.message);
    }
}

async function downloadTwitter(url) {
    // ssstwitter.com API
    try {
        const apiUrl = 'https://ssstwitter.com';
        const params = new URLSearchParams();
        params.append('url', url);
        params.append('lang', 'en');
        const res = await axios.post(apiUrl, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
                'HX-Request': 'true',
                'HX-Target': 'main',
                'HX-Current-URL': apiUrl,
                'hx-trigger': 'search-form',
            },
            timeout: 30000,
        });
        if (!res.data || res.data.status !== 'success') {
            throw new Error('ssstwitter: ' + (res.data?.message || 'no result'));
        }
        const videoUrl = res.data.url || res.data.videoUrl;
        if (!videoUrl) throw new Error('ssstwitter: no download link');
        return { url: videoUrl, title: 'Twitter Video' };
    } catch (err) {
        throw new Error('Twitter downloader: ' + err.message);
    }
}

async function downloadFacebook(url) {
    // fbdown.to API
    try {
        const params = new URLSearchParams();
        params.append('url', url);
        params.append('q', 'hd');
        const res = await axios.post(`${YTDOWN_URL}/api/ajaxSearch`, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': DEFAULT_HEADERS['User-Agent'],
                'X-Requested-With': 'XMLHttpRequest',
            },
            timeout: 60000,
        });
        if (!res.data || res.data.status !== 'ok') {
            throw new Error('fbdown: ' + (res.data?.message || 'failed'));
        }
        const links = res.data.links || {};
        const hdUrl = links.hd?.[0]?.url || links.sd?.[0]?.url;
        if (!hdUrl) throw new Error('fbdown: no video link');
        return { url: hdUrl, title: res.data.title || 'Facebook Video' };
    } catch (err) {
        throw new Error('Facebook downloader: ' + err.message);
    }
}

module.exports = {
    getVideo,
    getAudio,
    getAvailableQualities,
    VIDEO_QUALITIES,
    fetchFromHectorWorker,
    getVideoFromHectorWorker,
    getAudioFromHectorWorker,
    convertViaCnvCx,
    downloadSnapchat,
    downloadTwitter,
    downloadFacebook,
};
