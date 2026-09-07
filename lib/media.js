'use strict';

/**
 * lib/media.js — Queen Riam Arabic Edition
 *
 * تمت إعادة كتابته بدون تعمية.
 * يدعم تحميل الفيديو والصوت من يوتيوب عبر savetube.
 * يدعم أيضاً snapchat و twitter و facebook (stubs).
 */

const { Buffer } = require('buffer');
const { createDecipheriv } = require('crypto');
const axios = require('axios');
const path = require('path');

const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://yt.savetube.me',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
};

// ── استخراج YouTube video ID ─────────────────────────────────────────────────
function extractVideoId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

// ── Savetube Downloader ───────────────────────────────────────────────────────
async function savetubeDownload(url, { downloadType = 'video', quality = '360p' } = {}) {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error('رابط YouTube غير صالح');

    // 1. احصل على CDN
    const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', { headers: HEADERS })
        .then(r => r.data).catch(() => null);
    if (!cdnRes?.cdn) throw new Error('سيرفر التحميل غير متوفر حالياً');
    const cdn = cdnRes.cdn;

    // 2. اجلب معلومات الفيديو
    const info = await axios.post(`https://${cdn}/v2/info`,
        { url: `https://www.youtube.com/watch?v=${videoId}` },
        { headers: HEADERS }
    ).then(r => r.data).catch(() => null);
    if (!info?.data) throw new Error('تعذر جلب بيانات المقطع');

    // 3. فك تشفير الـ metadata
    let metadata;
    try {
        const encrypted = Buffer.from(info.data, 'base64');
        const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
        const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
        metadata = JSON.parse(decrypted.toString('utf8'));
    } catch {
        throw new Error('فشل فك تشفير البيانات');
    }
    if (!metadata?.key) throw new Error('مفتاح التحميل غير موجود');

    // 4. اطلب رابط التحميل
    const dl = await axios.post(`https://${cdn}/download`, {
        id: videoId,
        downloadType,
        quality,
        key: metadata.key,
    }, { headers: HEADERS }).then(r => r.data).catch(() => null);

    if (!dl?.data?.downloadUrl) {
        throw new Error(dl?.message || 'فشل توليد رابط التنزيل — قد تكون الجودة غير متوفرة');
    }

    return {
        title: metadata.title,
        duration: metadata.durationLabel,
        thumbnail: metadata.thumbnail,
        url: dl.data.downloadUrl,
        quality,
    };
}

// ── جودات الفيديو المتاحة (للقائمة) ───────────────────────────────────────────
const VIDEO_QUALITIES = ['144p', '240p', '360p', '480p', '720p', '1080p'];

/**
 * جرب جودات مختلفة وارجع بقائمة بالجودات المتاحة فعلياً
 */
async function getAvailableQualities(url) {
    const available = [];
    for (const q of VIDEO_QUALITIES) {
        try {
            const info = await savetubeDownload(url, { downloadType: 'video', quality: q });
            if (info?.url) {
                available.push({ quality: q, url: info.url });
            }
        } catch (e) {
            // الجودة دي مش متوفرة — نتخطاها
        }
    }
    return available;
}

// ── الواجهة الأصلية: getVideo(url, quality) ──────────────────────────────────
async function getVideo(url, quality = '360p') {
    try {
        const result = await savetubeDownload(url, { downloadType: 'video', quality });
        return {
            fileUrl: result.url,
            title: result.title,
            thumbnail: result.thumbnail,
            quality,
        };
    } catch (err) {
        // Fallback: جرّب 360p لو الجودة المطلوبة فشلت
        if (quality !== '360p') {
            try {
                const fallback = await savetubeDownload(url, { downloadType: 'video', quality: '360p' });
                return {
                    fileUrl: fallback.url,
                    title: fallback.title,
                    thumbnail: fallback.thumbnail,
                    quality: '360p',
                };
            } catch (e) {
                throw new Error('فشل تحميل الفيديو: ' + e.message);
            }
        }
        throw new Error('فشل تحميل الفيديو: ' + err.message);
    }
}

// ── تحميل الصوت ──────────────────────────────────────────────────────────────
async function getAudio(url, quality = '128kbps') {
    try {
        const result = await savetubeDownload(url, { downloadType: 'audio', quality });
        return {
            fileUrl: result.url,
            title: result.title,
            thumbnail: result.thumbnail,
            quality,
        };
    } catch (err) {
        throw new Error('فشل تحميل الصوت: ' + err.message);
    }
}

// ── Stubs لـ Snapchat / Twitter / Facebook ────────────────────────────────────
async function downloadSnapchat(url) {
    throw new Error('Snapchat downloader غير مُفعّل في هذه النسخة. استخدم رابط فيديو مباشر.');
}

async function downloadTwitter(url) {
    throw new Error('Twitter downloader غير مُفعّل في هذه النسخة. استخدم رابط فيديو مباشر.');
}

async function downloadFacebook(url) {
    throw new Error('Facebook downloader غير مُفعّل في هذه النسخة. استخدم رابط فيديو مباشر.');
}

module.exports = {
    getVideo,
    getAudio,
    getAvailableQualities,
    VIDEO_QUALITIES,
    savetubeDownload,
    downloadSnapchat,
    downloadTwitter,
    downloadFacebook,
};
