'use strict';
/**
 * ───────────────────────────────────────────────────────────────────────────
 *  web/server.js — خادم موقع ولوحة تحكم Queen Riam
 * ───────────────────────────────────────────────────────────────────────────
 *  • يخدم صفحات الموقع الثابتة من web/public
 *  • API كامل: الربط (كود RIAMBOOT المخصص) + تسجيل الدخول (رقم + رمز سري)
 *    + تحكم كامل بإعدادات البوت + لوحة المالك (المستخدمون/العضويات/حد التسجيل)
 *  • يعمل في نفس عملية البوت — منفذ واحد لكل شيء (مثالي لـ Railway)
 * ───────────────────────────────────────────────────────────────────────────
 */

const path = require('path');
const express = require('express');

const settings = require('../settings');
const membership = require('../lib/membership');
const sessionManager = require('../lib/sessionManager');
const { loadConfig, saveConfig } = require('../lib/config');

const CUSTOM_PAIRING_CODE = settings.customPairingCode || 'RIAMBOOT'; // 8 أحرف بالضبط — شرط واتساب

// ── تطبيق Express ───────────────────────────────────────────────────────────

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// رؤوس أمان أساسية
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// سجل الطلبات المختصر (API فقط)
app.use('/api', (req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => {
        console.log(`[web] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - t0}ms)`);
    });
    next();
});

// ── الملفات الثابتة ─────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

// ── أدوات مساعدة ────────────────────────────────────────────────────────────

const startedAt = Date.now();

function fail(res, status, message, extra) {
    return res.status(status).json(Object.assign({ ok: false, error: message }, extra || {}));
}

/** استخراج المستخدم من توكن Bearer */
function getAuthUser(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    const session = membership.validateWebSession(token);
    if (!session) return null;
    const user = membership.getUser(session.number);
    if (!user) return null;
    return { token, session, user };
}

/** حماية المسارات المصادَق عليها */
function requireAuth(req, res, next) {
    const auth = getAuthUser(req);
    if (!auth) return fail(res, 401, 'جلسة غير صالحة — سجّل الدخول من جديد.');
    req.auth = auth;
    next();
}

/** حماية مسارات المالك فقط */
function requireOwner(req, res, next) {
    const isOwnerNum = membership.isOwnerNumber(req.auth.user.number, settings.ownerNumber);
    const roleIsOwner = req.auth.user.role === 'owner';
    if (!isOwnerNum && !roleIsOwner) {
        return fail(res, 403, 'هذه الصفحة للمالك فقط 👑');
    }
    next();
}

/** حد معدل بسيط في الذاكرة لكل مسار حساس */
const rateBuckets = new Map();
function rateLimit(bucketName, maxPerMinute) {
    return (req, res, next) => {
        const key = bucketName + ':' + (membership.normalizePhone(req.body?.phone || req.query?.phone) || req.ip || 'anon');
        const now = Date.now();
        const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + 60000 };
        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + 60000;
        }
        bucket.count += 1;
        rateBuckets.set(key, bucket);
        if (bucket.count > maxPerMinute) {
            return fail(res, 429, 'طلبات كثيرة جداً — انتظر دقيقة وحاول مرة أخرى.');
        }
        next();
    };
}

// تنظيف دوري لعدادات المعدل
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateBuckets.entries()) {
        if (now > v.resetAt) rateBuckets.delete(k);
    }
}, 5 * 60 * 1000).unref();

/** حالة اتصال رقم معين */
function phoneConnectionState(phone) {
    const n = membership.normalizePhone(phone);
    const live = sessionManager.getSessionInfo(n);
    if (live.connected) return 'connected';
    if (sessionManager.hasRegisteredSession(n)) return 'registered';
    const main = sessionManager.getMainSessionInfo();
    if (main.exists && main.registered && main.number === n) return 'registered';
    return 'none';
}

/** إرسال رسالة واتساب لأي رقم عبر أفضل جلسة متاحة (جلسة المالك ثم جلسة المستخدم) */
async function sendViaAnySession(targetNumber, content) {
    const toJid = membership.normalizePhone(targetNumber) + '@s.whatsapp.net';
    const ownerNum = membership.normalizePhone(settings.ownerNumber);
    // جرّب جلسة المالك أولاً (الأكثر استقراراً) ثم جلسة المستخدم نفسه
    for (const from of [ownerNum, membership.normalizePhone(targetNumber)]) {
        const ok = await sessionManager.sendFromSession(from, toJid, content);
        if (ok) return true;
    }
    return false;
}

// ════════════════════════════════════════════════════════════════════════════
//  API — عام
// ════════════════════════════════════════════════════════════════════════════

/** حالة النظام العامة (تظهر في التذييل وصفحة الربط) */
app.get('/api/status', (req, res) => {
    const site = membership.getSiteSettings();
    const sessions = sessionManager.getSessionsSummary();
    res.json({
        ok: true,
        botName: settings.botName,
        version: settings.version,
        owner: settings.botOwner,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        sessions: { total: sessions.total, connected: sessions.connected },
        announcement: site.announcement || '',
        registration: {
            limit: site.registrationLimit,
            registered: membership.countRegisteredUsers(settings.ownerNumber),
            open: !!site.allowNewLinks,
        },
    });
});

/**
 * طلب ربط: إدخال الرقم ← توليد الكود المخصص RIAMBOOT
 */
app.post('/api/link/request', rateLimit('link', 6), async (req, res) => {
    try {
        const phone = membership.normalizePhone(req.body?.phone);
        if (!membership.isValidPhone(phone)) {
            return fail(res, 400, 'رقم غير صالح — اكتب الرقم بالصيغة الدولية بدون + (مثال: 201270221253)');
        }

        const isOwnerNum = membership.isOwnerNumber(phone, settings.ownerNumber);

        // هل الرقم مرتبط بالفعل؟
        const connState = phoneConnectionState(phone);
        const existing = membership.getUser(phone);
        if (connState !== 'none' || (existing && existing.secretHash)) {
            return res.json({
                ok: true,
                alreadyLinked: true,
                phone,
                message: 'هذا الرقم مرتبط بالبوت بالفعل ✅ يمكنك إعادة إرسال الرمز السري أو تسجيل الدخول مباشرة.',
            });
        }

        // فحص حد التسجيل (المالك مستثنى دائماً)
        if (!isOwnerNum) {
            const gate = membership.canRegisterNew(settings.ownerNumber);
            if (!gate.ok) {
                return fail(res, 403, gate.message, { reason: gate.reason });
            }
        }

        // سجّل المستخدم كـ pending
        membership.upsertUser(phone, {
            status: 'pending',
            role: isOwnerNum ? 'owner' : ((existing && existing.role) || 'user'),
            name: (existing && existing.name) || (isOwnerNum ? 'المالك 👑' : `مستخدم ${phone.slice(-4)}`),
        });

        // توليد كود الربط المخصص
        let code;
        try {
            code = await sessionManager.generatePairingCode(phone, CUSTOM_PAIRING_CODE);
        } catch (err) {
            if (String(err.message).includes('ALREADY_ACTIVE')) {
                return fail(res, 409, 'هناك عملية ربط جارية بالفعل لهذا الرقم — انتظر دقيقة ثم أعد المحاولة.');
            }
            console.error('[web] pairing error:', err.message);
            return fail(res, 502, 'تعذر التواصل مع واتساب لتوليد الكود — تأكد من صحة الرقم وأعد المحاولة بعد لحظات.');
        }

        res.json({
            ok: true,
            phone,
            code: code || CUSTOM_PAIRING_CODE,
            customUsed: (code || CUSTOM_PAIRING_CODE).replace(/-/g, '').toUpperCase() === CUSTOM_PAIRING_CODE,
            expiresIn: 180,
            steps: [
                'افتح واتساب على الموبايل المراد ربطه',
                'الإعدادات ← الأجهزة المرتبطة ← ربط جهاز',
                'اضغط «الربط برقم الهاتف بدلاً من ذلك»',
                'أدخل الكود الظاهر أعلاه',
            ],
        });
    } catch (err) {
        console.error('[web] link/request error:', err);
        fail(res, 500, 'خطأ غير متوقع — أعد المحاولة.');
    }
});

/** متابعة حالة الربط (polling من صفحة الربط) */
app.get('/api/link/status', rateLimit('linkstatus', 120), (req, res) => {
    const phone = membership.normalizePhone(req.query.phone || '');
    if (!membership.isValidPhone(phone)) return fail(res, 400, 'رقم غير صالح');
    const user = membership.getUser(phone);
    const state = phoneConnectionState(phone);
    res.json({
        ok: true,
        phone,
        state, // none | registered | connected
        hasSecret: !!(user && user.secretHash),
        role: (user && user.role) || null,
    });
});

/** إعادة إرسال رمز سري جديد (إثبات الملكية عبر استلامه على واتساب) */
app.post('/api/link/resend-secret', rateLimit('resend', 4), async (req, res) => {
    try {
        const phone = membership.normalizePhone(req.body?.phone);
        if (!membership.isValidPhone(phone)) return fail(res, 400, 'رقم غير صالح');

        const connState = phoneConnectionState(phone);
        if (connState === 'none') {
            return fail(res, 404, 'هذا الرقم غير مرتبط بالبوت — ابدأ بعملية الربط أولاً.');
        }

        const cooldown = membership.canResendSecret(phone);
        if (!cooldown.ok) {
            return fail(res, 429, `انتظر ${cooldown.secondsLeft} ثانية قبل طلب رمز جديد.`);
        }

        const code = membership.resetSecretCode(phone);
        if (!code) return fail(res, 500, 'تعذر توليد الرمز — أعد المحاولة.');

        membership.markResendSecret(phone);

        const sent = await sendViaAnySession(phone, {
            text:
                `🔐 *رمز سري جديد — Queen Riam*\n\n` +
                `تم طلب رمز دخول جديد للرقم *+${phone}*\n\n` +
                `🔑 رمزك: *${code}*\n\n` +
                `⚠️ لا تشارك هذا الرمز مع أي شخص.\n` +
                `👑 _Queen Riam_`,
        });

        if (!sent) {
            return fail(res, 503, 'البوت غير متصل حالياً — لا يمكن إرسال الرمز الآن. حاول بعد لحظات.');
        }

        // سجّل أن الرمز وصل فعلاً (يمنع إعادة الإرسال التلقائية عند إعادة الاتصال)
        try { membership.markCodeDelivered(phone); } catch (_) {}

        res.json({ ok: true, message: 'تم إرسال رمز سري جديد إلى واتسابك ✅' });
    } catch (err) {
        console.error('[web] resend-secret error:', err);
        fail(res, 500, 'خطأ غير متوقع.');
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  API — المصادقة
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', rateLimit('login-ip', 20), async (req, res) => {
    try {
        const phone = membership.normalizePhone(req.body?.phone);
        const secret = String(req.body?.secret || '').trim().toUpperCase();

        if (!membership.isValidPhone(phone)) {
            return fail(res, 400, 'رقم غير صالح');
        }
        if (!secret || secret.length < 6) {
            return fail(res, 400, 'أدخل الرمز السري (8 أحرف)');
        }

        // قفل بعد محاولات فاشلة متكررة
        const lock = membership.isLocked(phone);
        if (lock && lock.locked) {
            return fail(res, 429, `تم قفل الحساب مؤقتاً بسبب المحاولات الفاشلة — حاول بعد ${lock.minutesLeft} دقيقة.`);
        }

        const user = membership.getUser(phone);
        const isOwnerNum = membership.isOwnerNumber(phone, settings.ownerNumber);
        const connState = phoneConnectionState(phone);

        // لا يوجد رمز محفوظ لهذا الرقم بعد
        if (!user || !user.secretHash) {
            membership.recordFailedAttempt(phone);
            return fail(res, 401, 'لا يوجد رمز سري لهذا الرقم — اربط البوت أولاً من صفحة الربط.');
        }

        if (!membership.verifySecret(secret, user.secretHash)) {
            membership.recordFailedAttempt(phone);
            return fail(res, 401, 'الرمز السري غير صحيح ❌');
        }

        membership.clearAttempts(phone);
        membership.upsertUser(phone, { lastLogin: new Date().toISOString() });

        const role = isOwnerNum ? 'owner' : (user.role || 'user');
        const token = membership.createWebSession(phone, role);

        res.json({
            ok: true,
            token,
            role,
            user: {
                number: phone,
                name: user.name,
                role,
                botConnected: connState === 'connected',
            },
        });
    } catch (err) {
        console.error('[web] login error:', err);
        fail(res, 500, 'خطأ غير متوقع.');
    }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    membership.destroyWebSession(req.auth.token);
    res.json({ ok: true, message: 'تم تسجيل الخروج بنجاح.' });
});

// ════════════════════════════════════════════════════════════════════════════
//  API — لوحة التحكم (مصادَق)
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/me', requireAuth, (req, res) => {
    const { user } = req.auth;
    const connState = phoneConnectionState(user.number);
    const sessionInfo = sessionManager.getSessionInfo(user.number);
    res.json({
        ok: true,
        user: {
            number: user.number,
            name: user.name,
            role: membership.isOwnerNumber(user.number, settings.ownerNumber) ? 'owner' : (user.role || 'user'),
            linkedAt: user.linkedAt,
            lastLogin: user.lastLogin,
            isPremium: user.role === 'premium' || user.role === 'owner',
        },
        bot: {
            connection: connState,
            live: sessionInfo,
            botName: settings.botName,
            version: settings.version,
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        },
    });
});

// ── إعدادات البوت الخاصة بجلسة المستخدم ─────────────────────────────────────

const TOGGLE_KEYS = [
    'AUTOREAD', 'AUTOTYPE', 'AUTORECORD', 'AUTORECORDTYPE',
    'ALWAYSONLINE', 'AUTO_STATUS_REACT', 'AUTO_STATUS_REPLY', 'BUTTONMODE',
];
const CHOICE_KEYS = {
    ANTICALL: ['off', 'decline', 'block'],
    LANGUAGE: ['ar'],
};
const TEXT_KEYS = {
    AUTO_STATUS_MSG: { max: 100 },
    PREFIX: { max: 3, pattern: /^[\x21-\x7E\u0600-\u06FF]{0,3}$/ },
};

app.get('/api/settings', requireAuth, (req, res) => {
    const sessionNumber = req.auth.user.number;
    const cfg = loadConfig(sessionNumber);
    res.json({
        ok: true,
        sessionNumber,
        settings: cfg,
        meta: {
            toggles: TOGGLE_KEYS,
            choices: CHOICE_KEYS,
            labels: {
                AUTOREAD: 'القراءة التلقائية للرسائل',
                AUTOTYPE: 'الكتابة التلقائية (يكتب...)',
                AUTORECORD: 'التسجيل الصوتي التلقائي',
                AUTORECORDTYPE: 'تسجيل + كتابة تلقائي',
                ALWAYSONLINE: 'متصل دائماً',
                AUTO_STATUS_REACT: 'تفاعل تلقائي مع الحالات',
                AUTO_STATUS_REPLY: 'رد تلقائي على الحالات',
                BUTTONMODE: 'وضع الأزرار التفاعلية',
                ANTICALL: 'سلوك المكالمات',
                LANGUAGE: 'اللغة',
                AUTO_STATUS_MSG: 'نص الرد على الحالات',
                PREFIX: 'بادئة الأوامر',
            },
        },
    });
});

app.post('/api/settings', requireAuth, (req, res) => {
    try {
        const sessionNumber = req.auth.user.number;
        const cfg = loadConfig(sessionNumber);
        const updates = req.body?.settings || {};
        const applied = {};
        const rejected = {};

        for (const [key, rawVal] of Object.entries(updates)) {
            if (TOGGLE_KEYS.includes(key)) {
                cfg[key] = (rawVal === true || rawVal === 'true' || rawVal === 1) ? 'true' : 'false';
                applied[key] = cfg[key];
            } else if (CHOICE_KEYS[key]) {
                const v = String(rawVal || '').toLowerCase();
                if (CHOICE_KEYS[key].includes(v)) {
                    cfg[key] = v;
                    applied[key] = v;
                } else {
                    rejected[key] = 'قيمة غير مسموحة';
                }
            } else if (TEXT_KEYS[key]) {
                const v = String(rawVal || '').slice(0, TEXT_KEYS[key].max);
                if (TEXT_KEYS[key].pattern && v && !TEXT_KEYS[key].pattern.test(v)) {
                    rejected[key] = 'صيغة غير صالحة';
                } else {
                    cfg[key] = v;
                    applied[key] = v;
                }
            } else {
                rejected[key] = 'مفتاح غير معروف';
            }
        }

        saveConfig(cfg, sessionNumber);
        res.json({
            ok: Object.keys(rejected).length === 0,
            applied,
            rejected,
            message: `تم حفظ ${Object.keys(applied).length} إعداداً بنجاح ✅ (يعمل فوراً على جلستك)`,
        });
    } catch (err) {
        console.error('[web] settings save error:', err);
        fail(res, 500, 'تعذر حفظ الإعدادات.');
    }
});

/** فصل جلستك بنفسك (حذف الجلسة + السجل) */
app.post('/api/unlink', requireAuth, async (req, res) => {
    try {
        const number = req.auth.user.number;
        if (membership.isOwnerNumber(number, settings.ownerNumber)) {
            return fail(res, 403, 'لا يمكن فصل جلسة المالك من هنا — للمالك صلاحيات كاملة على النظام.');
        }
        sessionManager.destroySession(number);
        membership.removeUser(number);
        membership.destroyWebSession(req.auth.token);
        res.json({ ok: true, message: 'تم فصل البوت وحذف بياناتك. يمكنك الربط من جديد في أي وقت.' });
    } catch (err) {
        console.error('[web] unlink error:', err);
        fail(res, 500, 'تعذر الفصل.');
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  API — لوحة المالك 👑
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/overview', requireAuth, requireOwner, (req, res) => {
    const sessions = sessionManager.getSessionsSummary();
    const mem = process.memoryUsage();
    res.json({
        ok: true,
        stats: {
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            memoryMB: Math.round(mem.rss / 1024 / 1024),
            node: process.version,
            platform: `${process.platform}`,
            sessionsTotal: sessions.total,
            sessionsConnected: sessions.connected,
        },
        users: membership.getUsersSummary(settings.ownerNumber),
        site: membership.getSiteSettings(),
    });
});

app.get('/api/admin/users', requireAuth, requireOwner, (req, res) => {
    res.json(Object.assign({ ok: true }, membership.getUsersSummary(settings.ownerNumber)));
});

/** ترقية/تخفيض عضوية مستخدم */
app.post('/api/admin/users/role', requireAuth, requireOwner, (req, res) => {
    const number = membership.normalizePhone(req.body?.number);
    const role = String(req.body?.role || '');
    if (!membership.isValidPhone(number)) return fail(res, 400, 'رقم غير صالح');
    if (!['user', 'premium'].includes(role)) {
        return fail(res, 400, 'الدور يجب أن يكون user أو premium (مالك الموقع ثابت لا يتغير).');
    }
    if (membership.isOwnerNumber(number, settings.ownerNumber)) {
        return fail(res, 403, 'لا يمكن تغيير دور المالك.');
    }
    const updated = membership.setUserRole(number, role);
    if (!updated) return fail(res, 404, 'المستخدم غير موجود — يجب أن يربط رقمه أولاً.');
    res.json({
        ok: true,
        message: role === 'premium'
            ? `تمت ترقية +${number} إلى العضوية المميزة 💎`
            : `تم إرجاع +${number} إلى العضوية العادية.`,
        user: { number: updated.number, role: updated.role },
    });
});

/** حذف مستخدم + فصل جلسته */
app.post('/api/admin/users/remove', requireAuth, requireOwner, (req, res) => {
    const number = membership.normalizePhone(req.body?.number);
    if (!membership.isValidPhone(number)) return fail(res, 400, 'رقم غير صالح');
    if (membership.isOwnerNumber(number, settings.ownerNumber)) {
        return fail(res, 403, 'لا يمكن حذف حساب المالك.');
    }
    sessionManager.destroySession(number);
    membership.removeUser(number);
    res.json({ ok: true, message: `تم حذف +${number} وفصل جلسته بالكامل.` });
});

/** إعادة تعيين الرمز السري لمستخدم (يُرسل عبر واتساب) */
app.post('/api/admin/users/reset-secret', requireAuth, requireOwner, async (req, res) => {
    const number = membership.normalizePhone(req.body?.number);
    if (!membership.isValidPhone(number)) return fail(res, 400, 'رقم غير صالح');
    const user = membership.getUser(number);
    if (!user) return fail(res, 404, 'المستخدم غير موجود.');
    const connState = phoneConnectionState(number);
    if (connState === 'none') return fail(res, 400, 'جلسته غير موجودة — لا يمكن إرسال رمز لرقم غير مرتبط.');

    const code = membership.resetSecretCode(number);
    const sent = await sendViaAnySession(number, {
        text:
            `🔐 *رمز سري جديد — Queen Riam*\n\n` +
            `قام مالك الموقع بإعادة تعيين رمز الدخول الخاص بك.\n\n` +
            `🔑 رمزك الجديد: *${code}*\n\n` +
            `⚠️ لا تشاركه مع أي شخص.\n👑 _Queen Riam_`,
    });
    if (!sent) return fail(res, 503, 'تم توليد الرمز لكن تعذر الإرسال — البوت غير متصل حالياً.');
    try { membership.markCodeDelivered(number); } catch (_) {}
    res.json({ ok: true, message: `تم إرسال رمز جديد إلى +${number} عبر واتساب ✅` });
});

/** إعدادات الموقع (قراءة) */
app.get('/api/admin/site-settings', requireAuth, requireOwner, (req, res) => {
    res.json({ ok: true, settings: membership.getSiteSettings() });
});

/** إعدادات الموقع (حفظ): حد التسجيل + فتح/غلق الربط + الإعلان */
app.post('/api/admin/site-settings', requireAuth, requireOwner, (req, res) => {
    const result = membership.saveSiteSettings(req.body || {});
    if (!result.ok && result.error) return fail(res, 400, result.error);
    res.json({
        ok: true,
        settings: result.settings,
        message: 'تم حفظ إعدادات الموقع ✅',
    });
});

// ── صفحات HTML (روابط نظيفة) ────────────────────────────────────────────────
const page = (name) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, name));
app.get('/', page('index.html'));
app.get('/link', page('link.html'));
app.get('/login', page('login.html'));
app.get('/dashboard', page('dashboard.html'));

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    if (req.path.startsWith('/api/')) return fail(res, 404, 'المسار غير موجود.');
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// ── معالج أخطاء عام ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[web] server error:', err.message);
    if (res.headersSent) return;
    fail(res, 500, 'خطأ داخلي في الخادم.');
});

// ── التشغيل ─────────────────────────────────────────────────────────────────

function startWebServer(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, '0.0.0.0', () => resolve(server));
        server.on('error', reject);
    });
}

module.exports = { app, startWebServer };
