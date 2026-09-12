/**
 * ───────────────────────────────────────────────────────────────────────────
 *  Queen Riam — Arabic Edition  •  index.js
 * ───────────────────────────────────────────────────────────────────────────
 *  نقطة الدخول الرئيسية للبوت (جاهزة لـ Railway).
 *
 *  • لا ربط تلقائي نهائياً — الربط يتم من موقع الويب فقط:
 *      صفحة الربط ← إدخال الرقم ← كود مخصص (RIAMBOOT) ← يتم الربط
 *  • خادم الويب (لوحة التحكم + الموقع) يعمل مع البوت في نفس العملية.
 *  • الجلسات المحفوظة تُستعاد تلقائياً عند الإقلاع.
 *  • المالك الافتراضي: 201270221253 (يمكن تغييره عبر OWNER_NUMBER في .env)
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const settings = require('./settings');
const { loadPlugins, loadExternalPlugins } = require('./lib/pluginLoader');
const sessionManager = require('./lib/sessionManager');

// ── أدوات الإقلاع ───────────────────────────────────────────────────────────

function banner() {
    console.log(chalk.magenta('\n'));
    console.log(chalk.bgMagenta.black('   👑 Queen Riam — Arabic Edition   '));
    console.log(chalk.magenta('   نظام الربط عبر الموقع + لوحة تحكم ويب متكاملة\n'));
}

function ensureDirs() {
    for (const dir of ['session', 'data', 'tmp', 'temp']) {
        const p = path.join(__dirname, dir);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }
}

// ── بدء البوت ───────────────────────────────────────────────────────────────

async function startBot() {
    banner();
    ensureDirs();

    // ── 1) تحميل الإضافات ────────────────────────────────────────────────────
    console.log(chalk.cyan('[boot] جاري تحميل الإضافات...'));
    loadPlugins();
    try {
        await loadExternalPlugins();
    } catch (err) {
        console.error(chalk.yellow('[boot] تعذر تحميل الإضافات الخارجية:', err.message));
    }

    try {
        const yatoAdapter = require('./lib/yatoAdapter');
        await yatoAdapter.loadYatoPlugins();
        const yatoList = yatoAdapter.getYatoCommandList();
        console.log(chalk.cyan(`[boot] تم تسجيل ${yatoList.length} أمر Yato في القائمة`));
    } catch (err) {
        console.error(chalk.yellow('[boot] تعذر تحميل إضافات Yato:', err.message));
    }

    // ── 2) تشغيل خادم الويب أولاً (حتى ينجح فحص صحة Railway فوراً) ──────────
    const WEB_PORT = parseInt(process.env.PORT || process.env.WEB_PORT || '3000', 10);
    try {
        const { startWebServer } = require('./web/server');
        await startWebServer(WEB_PORT);
        console.log(chalk.green(`[web] ✅ الموقع ولوحة التحكم يعملان على المنفذ ${WEB_PORT}`));
    } catch (err) {
        console.error(chalk.red('[web] ❌ فشل تشغيل خادم الويب:'), err);
        // لا نوقف البوت — واتساب قد يعمل بدون الموقع
    }

    // ── 3) استعادة الجلسات المحفوظة (بدون أي ربط تلقائي) ────────────────────
    console.log(chalk.cyan('[boot] جاري استعادة الجلسات المحفوظة...'));
    await sessionManager.rehydrateSessions();

    const summary = sessionManager.getSessionsSummary();
    if (summary.total === 0) {
        console.log(chalk.yellow('\n═══════════════════════════════════════════════════════'));
        console.log(chalk.yellow('  🌐 لا توجد جلسات مرتبطة بعد.'));
        console.log(chalk.green(`  👉 افتح الموقع: http://localhost:${WEB_PORT}`));
        console.log(chalk.green('  📱 اذهب إلى صفحة (ربط البوت) وأدخل رقمك'));
        console.log(chalk.green('  🔑 أدخل الكود المخصص: RIAMBOOT في واتساب'));
        console.log(chalk.yellow('═══════════════════════════════════════════════════════\n'));
    } else {
        console.log(chalk.green(`[boot] ✅ ${summary.total} جلسة مستعادة (${summary.connected} متصلة الآن)`));
        console.log(chalk.green('[boot] ✅ البوت يعمل العادة — جاهز للأوامر'));
    }

    // ملاحظة: البوت لا يطلب أي رمز ربط من الطرفية نهائياً.
    // كل عمليات الربط تأتي من الموقع عبر web/server.js → sessionManager.
}

// ── معالجة الأخطاء غير المعالجة ─────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[unhandledRejection]'), reason);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('[uncaughtException]'), err);
});

// ── إيقاف نظيف (Railway يرسل SIGTERM عند النشر الجديد) ─────────────────────
process.on('SIGTERM', () => {
    console.log(chalk.yellow('[shutdown] إيقاف نظيف...'));
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('[shutdown] إيقاف...'));
    process.exit(0);
});

// ── بدء التشغيل ──────────────────────────────────────────────────────────────
startBot().catch((err) => {
    console.error(chalk.red('[boot] فشل بدء التشغيل:'), err);
    process.exit(1);
});
