/**
 * ───────────────────────────────────────────────────────────────────────────
 *  Queen Riam — Arabic Edition  •  index.js  (نظيف بدون تعمية)
 * ───────────────────────────────────────────────────────────────────────────
 *  هذا الملف هو نقطة الدخول الرئيسية للبوت.
 *
 *  تمت إزالة كل الميزات التلقائية:
 *    • لا انضمام تلقائي لأي مجموعة (auto-join removed)
 *    • لا اشتراك تلقائي في نشرة (auto-newsletter removed)
 *    • لا نشر تلقائي للحالات (auto-status post removed)
 *    • لا طلب رقم يدوي — الرقم الافتراضي 201270221253
 *
 *  المالك الافتراضي: 201270221253 (يمكن تغييره عبر OWNER_NUMBER في .env)
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const chalk = require('chalk');
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, delay, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const settings = require('./settings');
const { getAuthState } = require('./lib/authState');
const { loadPlugins, loadExternalPlugins } = require('./lib/pluginLoader');
const { patchSocket } = require('./lib/messageQueue');

// ── متغيرات الجلسة ─────────────────────────────────────────────────────────
let sock = null;
let useQR = false;
let lastConnectionStatus = null;

// ── إنشاء socket جديد ───────────────────────────────────────────────────────
function createSocket(version, state, saveCreds) {
    const logger = pino({ level: 'silent' });

    const s = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        markOnlineOnConnect: false,
        getMessage: async () => ({ conversation: 'Queen Riam' }),
        browser: Browsers.macOS('Safari'),
    });

    s.ev.on('creds.update', saveCreds);
    return s;
}

// ── الربط التلقائي مع OWNER_NUMBER ──────────────────────────────────────────
async function startPairing() {
    const ownerNumber = settings.ownerNumber;

    if (!ownerNumber || ownerNumber.length < 7) {
        console.log(chalk.red('❌ رقم المالك غير صالح. تحقق من OWNER_NUMBER في .env'));
        process.exit(1);
    }

    console.log(chalk.cyan(`\n[Auto-pair] جاري توليد رمز الربط للرقم: +${ownerNumber}`));
    console.log(chalk.cyan('[Auto-pair] لا حاجة لإدخال الرقم يدوياً ✅\n'));

    // انتظر 3 ثواني قبل طلب رمز الربط
    await delay(3000);

    try {
        const code = await sock.requestPairingCode(ownerNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

        console.log(chalk.bgGreen.black('\n═══════════════════════════════════════════'));
        console.log(chalk.bgGreen.black('   🔗 رمز الربط الخاص بك: ', formatted, '   '));
        console.log(chalk.bgGreen.black('═══════════════════════════════════════════\n'));

        console.log(chalk.yellow('📋 الخطوات:'));
        console.log(chalk.white('1. افتح واتساب على موبايلك'));
        console.log(chalk.white('2. اذهب إلى: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز'));
        console.log(chalk.white('3. اضغط: الربط برقم الهاتف بدلاً من ذلك'));
        console.log(chalk.white('4. أدخل الرمز بالأعلى\n'));
        console.log(chalk.gray(`⏰ ينتهي الرمز خلال 3 دقائق`));
        console.log(chalk.gray(`👑 Queen Riam — Arabic Edition\n`));
    } catch (err) {
        console.error(chalk.red('[pair] فشل الحصول على رمز الربط:'), err.message);
        console.log(chalk.yellow('[pair] المحاولة مرة أخرى بعد 5 ثوانٍ...'));
        await delay(5000);
        return startPairing();
    }
}

// ── بدء البوت ───────────────────────────────────────────────────────────────
async function startBot() {
    console.log(chalk.cyan('\n'));
    console.log(chalk.bgCyan.black('   👑 Queen Riam — Arabic Edition   '));
    console.log(chalk.cyan('   النسخة العربية الكاملة — بدون ميزات تلقائية\n'));

    // ── تحميل الإضافات ──────────────────────────────────────────────────────
    console.log(chalk.cyan('[boot] جاري تحميل الإضافات...'));
    loadPlugins();
    try {
        await loadExternalPlugins();
    } catch (err) {
        console.error(chalk.yellow('[boot] تعذر تحميل الإضافات الخارجية:', err.message));
    }

    // ── إنشاء مجلد الجلسة ─────────────────────────────────────────────────────
    const sessionDir = path.join(__dirname, 'session');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    // ── تهيئة حالة المصادقة ──────────────────────────────────────────────────
    const { state, saveCreds } = await getAuthState(sessionDir, 'main');
    const { version } = await fetchLatestBaileysVersion();

    // ── إنشاء socket ─────────────────────────────────────────────────────────
    sock = createSocket(version, state, saveCreds);
    sock.public = true;
    patchSocket(sock, 'main');

    // ── تحميل معالج الرسائل ──────────────────────────────────────────────────
    const { handleMessages } = require('./main');
    await handleMessages(sock);

    // ── معالجة اتصال البوت ──────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(chalk.yellow('[boot] تم توليد QR code (لن يتم استخدامه لأننا نستخدم pairing code)'));
        }

        if (connection === 'open') {
            console.log(chalk.bgGreen.black('\n✅ تم اتصال البوت بنجاح!'));
            console.log(chalk.green(`🌿 متصل بـ: ${JSON.stringify(sock.user?.id || 'غير معروف')}\n`));

            // ── رسالة ترحيب للمالك ──────────────────────────────────────────────
            try {
                const ownerJid = settings.ownerNumber + '@s.whatsapp.net';
                await delay(2000);
                await sock.sendMessage(ownerJid, {
                    text:
                        `✅ *Queen Riam Bot — النسخة العربية*\n\n` +
                        `تم ربط الرقم *+${settings.ownerNumber}* بنجاح ✨\n\n` +
                        `أرسل *.alive* أو *.menu* للبدء.\n\n` +
                        `👑 *Queen Riam*`
                });
            } catch (err) {
                console.error(chalk.yellow('[boot] تعذر إرسال رسالة الترحيب:', err.message));
            }
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = code === DisconnectReason.loggedOut || code === 401;

            if (loggedOut) {
                console.log(chalk.red('[sock] تم تسجيل الخروج. امسح مجلد session/ وأعد التشغيل.'));
                process.exit(1);
            } else {
                console.log(chalk.yellow(`[sock] انقطع الاتصال (code: ${code}). إعادة المحاولة بعد 5 ثوانٍ...`));
                setTimeout(() => startBot(), 5000);
            }
        }
    });

    // ── طلب رمز الربط إذا لم تكن الجلسة مسجلة ─────────────────────────────────
    if (!state.creds?.registered) {
        await startPairing();
    } else {
        console.log(chalk.green('[boot] الجلسة مسجلة بالفعل — لا حاجة لرمز الربط'));
    }
}

// ── معالجة الأخطاء غير المعالجة ─────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[unhandledRejection]'), reason);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('[uncaughtException]'), err);
});

// ── بدء التشغيل ──────────────────────────────────────────────────────────────
startBot().catch((err) => {
    console.error(chalk.red('[boot] فشل بدء التشغيل:'), err);
    process.exit(1);
});
