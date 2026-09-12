'use strict';
/**
 * lib/paths.js — الجذر المركزي للتخزين الدائم في Queen Riam
 *
 * لماذا؟ على Railway نظام الملفات مؤقت (يُمسح عند كل نشر) — الحل هو Volume.
 * كانت الجلسات وبيانات المستخدمين داخل مجلدات المشروع (data/ و session/)،
 * وتركيب Volume على /app/data كان يحجب ملفات المشروع الثابتة (مثل quizQuestions.js)
 * ويسبب أخطاء حمراء عند الإقلاع.
 *
 * الحل الجديد: ملفات التشغيل الدائمة تُكتب في جذر منفصل تماماً:
 *   1) متغير البيئة DATA_DIR        (تحكم كامل — للأماكن الخاصة)
 *   2) /data                        (الافتراضي على Railway — ركّب الـ Volume هنا)
 *   3) <المشروع>/data               (محلياً بدون Volume — سلوك قديم آمن)
 *
 * ملفات المشروع الثابتة (quizQuestions.js …) تبقى في data/ ولا تتأثر أبداً.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PROJECT_DATA = path.join(PROJECT_ROOT, 'data');            // أصول ثابتة + احتياط محلي
const LEGACY_SESSION_DIR = path.join(PROJECT_ROOT, 'session');   // جلسات الإصدارات القديمة

/** فحص أن المسار قابل للإنشاء والكتابة (بدون ترك أثر) */
function _probeWritable(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, `.qr-write-test-${Date.now()}`);
        fs.writeFileSync(f, '1');
        fs.unlinkSync(f);
        return true;
    } catch (_) {
        return false;
    }
}

const ENV_DATA = String(process.env.DATA_DIR || '').trim();

/** اختيار الجذر: DATA_DIR ← /data ← data/ المشروع */
let PERSIST_ROOT;
if (ENV_DATA && _probeWritable(ENV_DATA)) {
    PERSIST_ROOT = ENV_DATA;
    console.log(`[paths] التخزين الدائم: ${PERSIST_ROOT} (من DATA_DIR)`);
} else if (!ENV_DATA && _probeWritable('/data')) {
    PERSIST_ROOT = '/data';
    console.log('[paths] التخزين الدائم: /data (Railway Volume)');
} else {
    PERSIST_ROOT = PROJECT_DATA;
    if (ENV_DATA) console.warn(`[paths] ⚠️ DATA_DIR=${ENV_DATA} غير قابل للكتابة — التراجع إلى ${PERSIST_ROOT}`);
    else console.log(`[paths] التخزين الدائم: ${PERSIST_ROOT} (محلي)`);
}

const DATA_DIR = PERSIST_ROOT;
const SESSIONS_DIR = path.join(PERSIST_ROOT, 'sessions');

/** مسار ملف بيانات داخل الجذر الدائم */
function dataFile(name) {
    return path.join(DATA_DIR, name);
}

/** مسار مجلد جلسة رقم معين داخل الجذر الدائم */
function sessionDirFor(number) {
    const clean = String(number || '').replace(/\D/g, '');
    return path.join(SESSIONS_DIR, clean || 'main');
}

function ensurePersistentDirs() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    } catch (err) {
        console.error('[paths] تعذر إنشاء مجلدات التخزين:', err.message);
    }
}

/** هل نعمل على Volume منفصل (وليس data/ المشروع)؟ */
function isUsingVolume() {
    return path.resolve(PERSIST_ROOT) !== path.resolve(PROJECT_DATA);
}

/**
 * ترحيل لمرة واحدة: انسخ ملفات التشغيل *.json من data/ القديمة إلى الجذر الجديد
 * (مثلاً عند الترقية من إصدار قديم — لا يفقد المستخدم إعداداته أو مستخدميه).
 */
function migrateLegacyData() {
    if (!isUsingVolume()) return;
    try {
        ensurePersistentDirs();
        const files = fs.readdirSync(PROJECT_DATA).filter(f => f.endsWith('.json'));
        let copied = 0;
        for (const f of files) {
            const src = path.join(PROJECT_DATA, f);
            const dst = dataFile(f);
            if (!fs.existsSync(dst)) {
                try { fs.copyFileSync(src, dst); copied++; } catch (_) {}
            }
        }
        if (copied > 0) console.log(`[paths] 📦 تم ترحيل ${copied} ملف بيانات من data/ القديمة إلى ${DATA_DIR}`);
    } catch (err) {
        console.error('[paths] ترحيل البيانات القديمة فشل (غير حرج):', err.message);
    }
}

module.exports = {
    PERSIST_ROOT,
    DATA_DIR,
    SESSIONS_DIR,
    PROJECT_ROOT,
    PROJECT_DATA,
    LEGACY_SESSION_DIR,
    dataFile,
    sessionDirFor,
    ensurePersistentDirs,
    isUsingVolume,
    migrateLegacyData,
};
