'use strict';
/**
 * ───────────────────────────────────────────────────────────────────────────
 *  Queen Riam — worker.js
 *  عملية مستقلة لجلسة واتساب واحدة (عزل تام بين بوتات المستخدمين)
 * ───────────────────────────────────────────────────────────────────────────
 *  كل مستخدم مرتبط له عملية Node.js خاصة به:
 *    • لو تعطل أو علق بوت مستخدم (مثلاً فيديو ضخم) — بقية البوتات والخادم
 *      يعملون بشكل طبيعي تماماً، والعملية الرئيسية تعيد تشغيله تلقائياً.
 *
 *  الوضعان:
 *    pair    → يولد كود الربط (RIAMBOOT) ثم يتحول تلقائياً لجلسة دائمة
 *    session → جلسة مسجلة تُستعاد مباشرة (بدون رسائل ترحيب إلا للتعافي)
 *
 *  المتغيرات البيئية (تمررها العملية الرئيسية):
 *    QR_WORKER_NUMBER       الرقم الدولي نظيفاً
 *    QR_WORKER_MODE         'pair' | 'session'
 *    QR_WORKER_PAIR_CODE    كود الربط المخصص (اختياري — مثال RIAMBOOT)
 *    QR_WORKER_SESSION_DIR  مجلد الجلسة (افتراضي: الجذر الدائم/sessions/<رقم>)
 *
 *  الاتصال مع العملية الرئيسية (IPC):
 *    يرسل:  status / pair-code / send-result / mem-op / pair-request /
 *           sessions-summary-req / logged-out
 *    يستقبل: send / shutdown / status-req / mem-result / pair-code-result /
 *            sessions-summary
 * ───────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ override: true });

const fs = require('fs');
const pino = require('pino');
const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    delay,
} = require('@whiskeysockets/baileys');

const settings = require('./settings');
const paths = require('./lib/paths');
const { getAuthState } = require('./lib/authState');
const { patchSocket } = require('./lib/messageQueue');
const { selfJidCandidates, sendSelfMessage } = require('./lib/selfSend');
const membership = require('./lib/membership'); // قراءات محلية فقط — الكتابة عبر IPC

const NUMBER = String(process.env.QR_WORKER_NUMBER || '').replace(/\D/g, '');
const MODE = process.env.QR_WORKER_MODE === 'pair' ? 'pair' : 'session';
const PAIR_CODE = (process.env.QR_WORKER_PAIR_CODE || '').trim() || undefined;
const SESSION_DIR = process.env.QR_WORKER_SESSION_DIR || paths.sessionDirFor(NUMBER);

if (!NUMBER) {
    console.error('[worker] ❌ QR_WORKER_NUMBER مفقود — إنهاء');
    process.exit(1);
}

const TAG = `[worker:${NUMBER}]`;
paths.ensurePersistentDirs();

let sock = null;
let connected = false;
let pending = MODE === 'pair';
let sendWelcome = MODE === 'pair'; // أول اتصال ناجح بعد الربط = رسالة الترحيب + الرمز السري
let pairingDone = false;

// ── مخزن الرسائل لكل جلسة (للرد على طلبات Baileys عند إعادة الإرسال) ────────
const messageStore = new Map();
const MAX_STORE = 200;
function storeMessage(jid, id, message) {
    if (!jid || !id || !message) return;
    messageStore.set(`${jid}:${id}`, message);
    if (messageStore.size > MAX_STORE) {
        messageStore.delete(messageStore.keys().next().value);
    }
}

// ── تقارير الحالة للعملية الرئيسية ──────────────────────────────────────────
function report(extra = {}) {
    try {
        process.send({ t: 'status', connected, pending, number: NUMBER, ...extra });
    } catch (_) {}
}

// ── عمليات العضويات عبر العملية الرئيسية (كتابة آمنة بلا تضارب) ─────────────
function memOp(op, args, timeoutMs = 10000) {
    return new Promise((resolve) => {
        let done = false;
        const reqId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const onMsg = (m) => {
            if (m && m.t === 'mem-result' && m.reqId === reqId) {
                cleanup();
                resolve(m.result);
            }
        };
        const cleanup = () => {
            if (done) return;
            done = true;
            try { process.removeListener('message', onMsg); } catch (_) {}
        };
        process.on('message', onMsg);
        try { process.send({ t: 'mem-op', op, reqId, args }); } catch (_) { cleanup(); return resolve(null); }
        setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    });
}

// ── طلب تلخيص الجلسات من العملية الرئيسية (لأمر .pair list/status) ──────────
function requestSessionsSummary(timeoutMs = 8000) {
    return new Promise((resolve) => {
        let done = false;
        const reqId = `sum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const onMsg = (m) => {
            if (m && m.t === 'sessions-summary' && m.reqId === reqId) {
                cleanup();
                resolve(m.summary);
            }
        };
        const cleanup = () => {
            if (done) return;
            done = true;
            try { process.removeListener('message', onMsg); } catch (_) {}
        };
        process.on('message', onMsg);
        try { process.send({ t: 'sessions-summary-req', reqId }); } catch (_) { cleanup(); return resolve(null); }
        setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    });
}

// ── أوامر العملية الرئيسية ──────────────────────────────────────────────────
process.on('message', async (m) => {
    if (!m || !m.t) return;

    if (m.t === 'send') {
        let ok = false;
        let error = null;
        try {
            if (sock && connected) {
                await sock.sendMessage(m.toJid, m.content);
                ok = true;
            } else {
                error = 'الجلسة غير متصلة حالياً';
            }
        } catch (e) {
            error = e.message;
        }
        try { process.send({ t: 'send-result', reqId: m.reqId, ok, error }); } catch (_) {}
        return;
    }

    if (m.t === 'status-req') {
        report();
        return;
    }

    if (m.t === 'shutdown') {
        console.log(`${TAG} إيقاف بأمر العملية الرئيسية`);
        try { sock?.end(); } catch (_) {}
        setTimeout(() => process.exit(0), 400);
        setTimeout(() => process.exit(1), 3000).unref();
        return;
    }
});

// ── إنشاء سوكت Baileys ──────────────────────────────────────────────────────
function createSocket(version, state, saveCreds) {
    const logger = pino({ level: 'silent' });
    const s = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        markOnlineOnConnect: false,
        browser: Browsers.macOS('Safari'),
        getMessage: async (key) => {
            const stored = messageStore.get(`${key.remoteJid}:${key.id}`);
            if (stored) return stored;
            return { conversation: 'Queen Riam' };
        },
    });
    s.public = true;
    // نفس ترتيب الإصدار السابق: الكاش داخل طابور الإرسال
    const orig = s.sendMessage.bind(s);
    s.sendMessage = async (jid, content, opts) => {
        const result = await orig(jid, content, opts);
        if (result?.key?.id && result?.message) storeMessage(jid, result.key.id, result.message);
        return result;
    };
    patchSocket(s, NUMBER);
    s._sessionNumber = NUMBER;
    return s;
}

function attachHandler(s) {
    try {
        const { handleMessages } = require('./main');
        if (handleMessages) handleMessages(s);
        console.log(`${TAG} ✅ معالج الرسائل مرتبط`);
    } catch (err) {
        console.error(`${TAG} فشل ربط معالج الرسائل:`, err.message);
    }
}

// ── رسالة ما بعد الربط: البوت يعمل العادة + الرمز السري ─────────────────────
async function sendPostPairMessage(s) {
    try {
        await delay(3000); // مهلة استقرار واجهة واتساب بعد فتح الاتصال

        // توليد الرمز السري عبر العملية الرئيسية (كتابة آمنة) — مع محاولة ثانية
        let secretCode = await memOp('resetSecretCode', [NUMBER]);
        if (!secretCode) {
            await delay(1500);
            secretCode = await memOp('resetSecretCode', [NUMBER]);
        }

        const isOwnerNum = membership.isOwnerNumber(NUMBER, settings.ownerNumber);
        const roleText = isOwnerNum
            ? '👑 تم التعرف على حسابك كـ *مالك الموقع* — ستحصل على كل الصلاحيات.'
            : '';

        let welcomeText;
        if (secretCode) {
            welcomeText =
                `✅ *البوت يعمل العادة!* 🎉\n\n` +
                `تم ربط رقمك *+${NUMBER}* بـ *Queen Riam* بنجاح.\n\n` +
                (roleText ? roleText + '\n\n' : '') +
                `🔐 *رمزك السري لتسجيل الدخول للموقع:*\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*${secretCode}*\n` +
                `━━━━━━━━━━━━━━━━\n\n` +
                `⚠️ *مهم:* احفظ هذا الرمز ولا تشاركه مع أحد!\n` +
                `تستخدمه مع رقمك لدخول لوحة التحكم والتحكم الكامل في إعدادات البوت.\n\n` +
                `🌐 رابط الموقع: يظهر في صفحة الربط\n` +
                `أرسل *.menu* للبدء.\n\n` +
                `👑 _Queen Riam_`;
        } else {
            welcomeText =
                `✅ *البوت يعمل العادة!* 🎉\n\n` +
                `تم ربط رقمك *+${NUMBER}* بـ *Queen Riam* بنجاح.\n\n` +
                (roleText ? roleText + '\n\n' : '') +
                `⚠️ تعذر توليد رمزك السري تلقائياً الآن.\n` +
                `افتح صفحة الربط بالموقع واضغط «📨 إعادة إرسال الرمز السري» وسيصلك فوراً.\n\n` +
                `👑 _Queen Riam_`;
        }

        const sent = await sendSelfMessage(s, NUMBER, welcomeText);
        if (sent) {
            await memOp('markCodeDelivered', [NUMBER]);
            console.log(`${TAG} ✉️ رسالة الترحيب + الرمز السري أُرسلت`);
        } else {
            console.error(`${TAG} ❌ فشل إرسال رسالة الترحيب بعد كل المحاولات — سيُعاد تلقائياً عند إعادة الاتصال`);
        }
    } catch (e) {
        console.error(`${TAG} welcome msg failed:`, e.stack || e.message);
    }
}

// ── الجلسة الدائمة ──────────────────────────────────────────────────────────
async function runSession(version) {
    let state, saveCreds;
    try {
        ({ state, saveCreds } = await getAuthState(SESSION_DIR, NUMBER));
        if (!version) ({ version } = await fetchLatestBaileysVersion());
    } catch (err) {
        console.error(`${TAG} session init error:`, err.stack || err.message);
        setTimeout(() => runSession(), 8000);
        return;
    }

    try {
        sock = createSocket(version, state, saveCreds);
    } catch (err) {
        console.error(`${TAG} socket create error:`, err.stack || err.message);
        sock = null;
        setTimeout(() => runSession(version), 8000);
        return;
    }

    sock.ev.on('creds.update', saveCreds);
    attachHandler(sock);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(`${TAG} ✅ متصل`);
            connected = true;
            pending = false;
            report();

            // تحديث سجل المستخدم (عبر العملية الرئيسية) — الدور الحالي يُحفظ إلا للمالك فيُفرض
            const isOwnerNum = membership.isOwnerNumber(NUMBER, settings.ownerNumber);
            const memUpdates = { status: 'linked', linkedAt: new Date().toISOString() };
            if (isOwnerNum) memUpdates.role = 'owner';
            await memOp('upsertUser', [NUMBER, memUpdates]);

            // رسالة الترحيب عند ربط جديد — أو تعافٍ ذاتي لمن لم يصله رمزه أبداً
            let needsHealing = false;
            if (!sendWelcome) {
                const u = await memOp('getUser', [NUMBER]);
                needsHealing = !!(u && !u.codeDelivered);
            }

            if (sendWelcome || needsHealing) {
                sendWelcome = false;
                await sendPostPairMessage(sock);
            }
            report();
            return;
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = code === DisconnectReason.loggedOut || code === 401;

            if (loggedOut) {
                console.log(`${TAG} تم تسجيل الخروج من واتساب — حذف الجلسة والإنهاء`);
                connected = false;
                report();
                try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                await memOp('upsertUser', [NUMBER, { status: 'unlinked' }]);
                try { process.send({ t: 'logged-out', number: NUMBER }); } catch (_) {}
                setTimeout(() => process.exit(0), 300);
                return;
            }

            console.log(`${TAG} انقطع الاتصال (code ${code}) — إعادة المحاولة بعد 5 ثوان`);
            connected = false;
            report();
            setTimeout(() => runSession(version), 5000);
        }
    });

    report();
}

// ── وضع الربط: توليد الكود ثم التحول لجلسة دائمة ────────────────────────────
async function pairingFlow(version) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state, saveCreds } = await getAuthState(SESSION_DIR, NUMBER);
    if (!version) ({ version } = await fetchLatestBaileysVersion());

    if (state.creds.registered) {
        // مسجل أصلاً — تحول مباشر لجلسة
        pairingDone = true;
        sendWelcome = false;
        return runSession(version);
    }

    let currentSock = createSocket(version, state, saveCreds);
    currentSock.ev.on('creds.update', saveCreds);

    let handedOff = false;

    // معالج أحداث زوج الربط (يُعاد ربطه لكل سوكيت جديد عند إعادة المحاولة)
    const attachPairHandlers = (s) => {
        s.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect: ld } = update;

            // بعض تدفقات Baileys تفتح الاتصال مباشرة بعد إدخال الكود دون إغلاق وسيط
            if (connection === 'open' && !handedOff) {
                handedOff = true;
                pairingDone = true;
                _clearPairTimeout();
                connected = true;
                report();
                console.log(`${TAG} 🔀 اكتمل الربط بفتح مباشر — التحول للجلسة الدائمة`);
                setTimeout(() => {
                    try { s.end(); } catch (_) {}
                    if (sock === s) sock = null;
                    connected = false;
                    runSession(version); // sendWelcome لا يزال true → رسالة الترحيب تُرسل
                }, 2000);
                return;
            }

            if (connection === 'close') {
                if (handedOff) return;
                const code = ld?.error?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut || code === 401;
                if (loggedOut) {
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                    try { process.send({ t: 'pair-failed', number: NUMBER, error: 'logged-out' }); } catch (_) {}
                    setTimeout(() => process.exit(0), 300);
                    return;
                }
                // الإغلاق بعد إدخال الكود (restartRequired غالباً) → جلسة دائمة
                if (!pairingDone) {
                    handedOff = true;
                    pairingDone = true;
                    _clearPairTimeout();
                    console.log(`${TAG} 🔀 أُدخل كود الربط — التحول للجلسة الدائمة (${code})`);
                    setTimeout(() => {
                        try { s.end(); } catch (_) {}
                        if (sock === s) sock = null;
                        runSession(version); // sendWelcome = true
                    }, 3000);
                }
            }
        });
    };

    attachPairHandlers(currentSock);

    // منع تعليق عمال الربط المهجورة: إن لم يكتمل الربط خلال 5 دقائق — إنهاء تلقائي
    // (المستخدم طلب كوداً وهجر الصفحة — العامل يحمل سوكت واتساب مفتوحاً بلا فائدة)
    const pairTimeout = setTimeout(() => {
        if (!pairingDone) {
            console.log(`${TAG} ⏰ لم يكتمل الربط خلال 5 دقائق — إنهاء عامل الربط`);
            try { currentSock.end(); } catch (_) {}
            setTimeout(() => process.exit(0), 300);
        }
    }, 5 * 60 * 1000);
    if (pairTimeout.unref) pairTimeout.unref();
    const _clearPairTimeout = () => { try { clearTimeout(pairTimeout); } catch (_) {} };

    // طلب الكود — 3 محاولات بسوكيت جديد عند الفشل + كود مخصص مع بديل عشوائي
    const MAX_ATTEMPTS = 3;
    let lastErr = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) {
            console.log(`${TAG} إعادة محاولة توليد الكود ${attempt}/${MAX_ATTEMPTS}`);
            try { currentSock.end(); } catch (_) {}
            await delay(5000);
            try {
                const fresh = await getAuthState(SESSION_DIR, NUMBER);
                currentSock = createSocket(version, fresh.state, fresh.saveCreds);
                currentSock.ev.on('creds.update', fresh.saveCreds);
                attachPairHandlers(currentSock);
            } catch (e) {
                console.error(`${TAG} سوكيت جديد فشل (محاولة ${attempt}):`, e.message);
                continue;
            }
        }

        await delay(3000); // مهلة تثبيت الاتصال قبل طلب الكود
        try {
            let code;
            const withTimeout = (p) => new Promise((_, reject) =>
                setTimeout(() => reject(new Error('انتهت مهلة طلب كود الربط (30 ثانية)')), 30000));

            try {
                code = await Promise.race([
                    currentSock.requestPairingCode(NUMBER, PAIR_CODE || undefined),
                    withTimeout(),
                ]);
            } catch (customErr) {
                if (PAIR_CODE) {
                    console.warn(`${TAG} الكود المخصص رُفض (${customErr.message}) — توليد كود عشوائي`);
                    code = await Promise.race([
                        currentSock.requestPairingCode(NUMBER),
                        withTimeout(),
                    ]);
                } else {
                    throw customErr;
                }
            }

            const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`${TAG} 🔑 كود الربط: ${formatted}`);
            pending = false;
            report();
            try { process.send({ t: 'pair-code', number: NUMBER, code: formatted }); } catch (_) {}
            return formatted;
        } catch (err) {
            console.error(`${TAG} محاولة توليد الكود ${attempt} فشلت:`, err.message);
            lastErr = err;
        }
    }

    // فشل كل المحاولات
    try { currentSock.end(); } catch (_) {}
    try { process.send({ t: 'pair-failed', number: NUMBER, error: lastErr?.message || 'فشل توليد الكود' }); } catch (_) {}
    setTimeout(() => process.exit(1), 300);
    return null;
}

// ── الإقلاع ─────────────────────────────────────────────────────────────────
async function main() {
    console.log(`${TAG} 🚀 إقلاع (وضع: ${MODE === 'pair' ? 'ربط' : 'جلسة'})`);
    pending = MODE === 'pair';
    report();

    // الإضافات تُحمَّل داخل هذه العملية فقط — عزل كامل
    try {
        const { loadPlugins, loadExternalPlugins } = require('./lib/pluginLoader');
        loadPlugins();
        try { await loadExternalPlugins(); } catch (err) {
            console.error(`${TAG} تعذر تحميل الإضافات الخارجية:`, err.message);
        }
        try {
            const yatoAdapter = require('./lib/yatoAdapter');
            await yatoAdapter.loadYatoPlugins();
        } catch (_) {}
    } catch (err) {
        console.error(`${TAG} فشل تحميل الإضافات:`, err.message);
    }

    const { version } = await fetchLatestBaileysVersion();
    if (MODE === 'pair') await pairingFlow(version);
    else await runSession(version);
}

// ── العزل: أي خطأ فادح يقتل هذه العملية فقط — الرئيسية تعيد تشغيلها ─────────
process.on('uncaughtException', (err) => {
    console.error(`${TAG} 💥 uncaughtException:`, err.stack || err.message);
    setTimeout(() => process.exit(1), 200);
});

process.on('unhandledRejection', (reason) => {
    console.error(`${TAG} unhandledRejection:`, reason);
});

process.on('SIGTERM', () => {
    console.log(`${TAG} SIGTERM — إيقاف نظيف`);
    try { sock?.end(); } catch (_) {}
    setTimeout(() => process.exit(0), 300);
});

process.on('SIGINT', () => process.exit(0));

main().catch((err) => {
    console.error(`${TAG} فشل الإقلاع:`, err.stack || err.message);
    process.exit(1);
});
