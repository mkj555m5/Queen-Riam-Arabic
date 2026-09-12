/**
 * ───────────────────────────────────────────────────────────────────────────
 *  Queen Riam — Arabic Edition  •  index.js  (العملية الرئيسية — Master)
 * ───────────────────────────────────────────────────────────────────────────
 *  نقطة الدخول الرئيسية للبوت (جاهزة لـ Railway).
 *
 *  • لا ربط تلقائي نهائياً — الربط يتم من موقع الويب فقط:
 *      صفحة الربط ← إدخال الرقم ← كود مخصص (RIAMBOOT) ← يتم الربط
 *  • خادم الويب (الموقع + لوحة التحكم) يعمل في هذه العملية.
 *  • كل جلسة واتساب تعمل في عملية منفصلة (worker.js) — عزل تام:
 *      لو علق بوت مستخدم، البقية والخادم يعملون طبيعياً.
 *  • الجلسات المحفوظة تُستعاد تلقائياً عند الإقلاع.
 *  • التخزين الدائم: DATA_DIR ← /data (Railway Volume) ← data/ المحلية
 *  • المالك الافتراضي: 201270221253 (يمكن تغييره عبر OWNER_NUMBER في .env)
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ override: true });

const chalk = require('chalk');
const settings = require('./settings');
const paths = require('./lib/paths');
const sessionManager = require('./lib/sessionManager');

// ── أدوات الإقلاع ───────────────────────────────────────────────────────────

function banner() {
    console.log(chalk.magenta('\n'));
    console.log(chalk.bgMagenta.black('   👑 Queen Riam — Arabic Edition   '));
    console.log(chalk.magenta('   نظام الربط عبر الموقع + لوحة تحكم ويب متكاملة'));
    console.log(chalk.magenta(`   ${chalk.yellow('عزل العمليات:')} كل جلسة في عملية مستقلة — لن يعلق بوت مع الآخر\n`));
}

// ── بدء التشغيل ─────────────────────────────────────────────────────────────

async function startBot() {
    banner();

    // ── 1) تهيئة التخزين الدائم (Volume على Railway) ─────────────────────────
    paths.migrateLegacyData();
    paths.ensurePersistentDirs();

    // ── 2) تشغيل خادم الويب أولاً (حتى ينجح فحص صحة Railway فوراً) ────────────
    const WEB_PORT = parseInt(process.env.PORT || process.env.WEB_PORT || settings.webPort || '3000', 10);
    try {
        const { startWebServer } = require('./web/server');
        await startWebServer(WEB_PORT);
        console.log(chalk.green(`[web] ✅ الموقع ولوحة التحكم يعملان على المنفذ ${WEB_PORT}`));
    } catch (err) {
        console.error(chalk.red('[web] ❌ فشل تشغيل خادم الويب:'), err);
        // لا نوقف النظام — الجلسات قد تعمل بدون الموقع
    }

    // ── 3) استعادة الجلسات المحفوظة (عامل مستقل لكل جلسة — بدون أي ربط تلقائي) ─
    console.log(chalk.cyan('[boot] جاري استعادة الجلسات المحفوظة...'));
    await sessionManager.rehydrateSessions();

    const summary = sessionManager.getSessionsSummary();
    if (summary.total === 0) {
        console.log(chalk.yellow('\n═══════════════════════════════════════════════════════'));
        console.log(chalk.yellow('  🌐 لا توجد جلسات مرتبطة بعد.'));
        console.log(chalk.green(`  👉 افتح الموقع: http://localhost:${WEB_PORT}`));
        console.log(chalk.green('  📱 اذهب إلى صفحة (ربط البوت) وأدخل رقمك'));
        console.log(chalk.green(`  🔑 أدخل الكود المخصص: ${settings.customPairingCode} في واتساب`));
        console.log(chalk.yellow('═══════════════════════════════════════════════════════\n'));
    } else {
        console.log(chalk.green(`[boot] ✅ ${summary.total} جلسة تعمل في عمليات مستقلة (${summary.connected} متصلة الآن)`));
        console.log(chalk.green('[boot] ✅ البوت يعمل العادة — جاهز للأوامر'));
    }

    // ملاحظة: البوت لا يطلب أي رمز ربط من الطرفية نهائياً.
    // كل عمليات الربط تأتي من الموقع عبر web/server.js → sessionManager → worker.
}

// ── معالجة الأخطاء غير المعالجة (العملية الرئيسية لا تموت أبداً) ─────────────
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[unhandledRejection]'), reason);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('[uncaughtException]'), err);
});

// ── إيقاف نظيف (Railway يرسل SIGTERM عند النشر الجديد) ─────────────────────
let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(chalk.yellow(`[shutdown] ${signal} — إيقاف نظيف لكل جلسات البوت...`));
    try { sessionManager.shutdownAll(); } catch (_) {}
    setTimeout(() => process.exit(0), 1200);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── بدء التشغيل ──────────────────────────────────────────────────────────────
startBot().catch((err) => {
    console.error(chalk.red('[boot] فشل بدء التشغيل:'), err);
    process.exit(1);
});
