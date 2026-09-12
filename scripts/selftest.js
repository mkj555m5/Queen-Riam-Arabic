#!/usr/bin/env node
'use strict';
/**
 * scripts/selftest.js — اختبار ذاتي شامل لمشروع Queen Riam
 * يشغّل: فحص الصياغة + تحميل الوحدات + منطق العضويات + الخادم + API كامل
 * بدون اتصال واتساب حقيقي (بيئة آمنة).
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        const r = fn();
        if (r === false) throw new Error('أعاد false');
        passed++;
        console.log(`  ✅ ${name}`);
        return true;
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name} — ${err.message}`);
        return false;
    }
}

(async () => {
    console.log('\n🧪 الاختبار الذاتي — Queen Riam v1.2.0\n');

    // ═══════════ 1) فحص صياغة كل ملفات JS ═══════════
    console.log('── 1) فحص صياغة ملفات JS الأساسية ──');
    const coreFiles = [
        'index.js', 'main.js', 'settings.js',
        'lib/membership.js', 'lib/sessionManager.js', 'lib/config.js',
        'lib/buttonHelper.js', 'web/server.js',
        'plugins/premium.js', 'plugins/help.js', 'plugins/pair.js',
    ];
    for (const f of coreFiles) {
        check(`syntax: ${f}`, () => {
            execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' });
            return true;
        });
    }

    // ═══════════ 2) تحميل الوحدات ═══════════
    console.log('\n── 2) تحميل الوحدات ──');
    const settings = require(path.join(ROOT, 'settings.js'));
    check('settings يحمّل', () => settings.version === '1.2.0-ar');
    check('ownerNumber صحيح', () => settings.ownerNumber === '201270221253');

    const membership = require(path.join(ROOT, 'lib/membership.js'));
    check('membership يحمّل', () => typeof membership.verifySecret === 'function');

    // ═══════════ 3) منطق الرمز السري ═══════════
    console.log('\n── 3) الرمز السري والتشفير ──');
    const code = membership.generateSecretCode();
    check('رمز 8 أحرف', () => code.length === 8);
    check('رمز من الحروف الآمنة فقط', () => /^[A-HJ-KM-NP-Z2-9]+$/.test(code));
    const hash = membership.hashSecret(code);
    check('التحقق بالرمز الصحيح', () => membership.verifySecret(code, hash) === true);
    check('رفض رمز خاطئ', () => membership.verifySecret('XXXXXXXX', hash) === false);
    check('رفض قيمة تالفة', () => membership.verifySecret(code, 'broken') === false);
    check('الرموز فريدة', () => {
        const set = new Set(Array.from({ length: 50 }, () => membership.generateSecretCode()));
        return set.size === 50;
    });

    // ═══════════ 4) المستخدمون والعضويات ═══════════
    console.log('\n── 4) المستخدمون والعضويات ──');
    const TEST_NUM = '201111111111';
    membership.removeUser(TEST_NUM);
    membership.removeUser('201222222222');

    check('تطبيع الأرقام', () => membership.normalizePhone('+20 127 022 1253') === '201270221253');
    check('رقم صالح', () => membership.isValidPhone('201270221253') === true);
    check('رقم قصير مرفوض', () => membership.isValidPhone('12345') === false);

    membership.upsertUser(TEST_NUM, { status: 'linked', linkedAt: new Date().toISOString() });
    check('إنشاء مستخدم', () => membership.getUser(TEST_NUM) !== null);
    check('دور افتراضي عادي', () => membership.getRole(TEST_NUM) === 'user');
    check('ليس مميزاً', () => membership.isPremiumUser(TEST_NUM, settings.ownerNumber) === false);

    membership.setUserRole(TEST_NUM, 'premium');
    check('ترقية لمميز 💎', () => membership.isPremiumUser(TEST_NUM, settings.ownerNumber) === true);

    const secret2 = membership.resetSecretCode(TEST_NUM);
    check('توليد رمز سري للمستخدم', () => secret2 && secret2.length === 8);
    check('الرمز محفوظ مشفراً', () => {
        const u = membership.getUser(TEST_NUM);
        return u.secretHash && u.secretHash.includes(':') && !u.secretHash.includes(secret2);
    });

    check('المالك دائماً مميز', () => membership.isPremiumUser(settings.ownerNumber, settings.ownerNumber) === true);
    check('count يستثني المالك', () => membership.countRegisteredUsers(settings.ownerNumber) >= 0);

    membership.removeUser(TEST_NUM);
    check('حذف مستخدم', () => membership.getUser(TEST_NUM) === null);

    // ═══════════ 5) حد التسجيل ═══════════
    console.log('\n── 5) حد التسجيل وإعدادات الموقع ──');
    const site = membership.getSiteSettings();
    check('حد افتراضي 20', () => site.registrationLimit === 20);
    check('الربط مفتوح افتراضياً', () => site.allowNewLinks === true);

    const saveRes = membership.saveSiteSettings({ registrationLimit: 5, announcement: 'اختبار' });
    check('حفظ حد جديد', () => saveRes.ok && membership.getSiteSettings().registrationLimit === 5);
    check('رفض حد غير صالح', () => membership.saveSiteSettings({ registrationLimit: 9999 }).ok === false);
    check('رفض حد سالب', () => membership.saveSiteSettings({ registrationLimit: -1 }).ok === false);

    membership.upsertUser('201222222222', { status: 'linked', linkedAt: new Date().toISOString() });
    membership.resetSecretCode('201222222222');
    check('الرفع داخل الحد مسموح', () => membership.canRegisterNew(settings.ownerNumber).ok === true);

    const extra = [];
    for (let i = 0; i < 10; i++) {
        const n = `2090000000${String(i).padStart(2, '0')}`;
        membership.upsertUser(n, { status: 'linked', linkedAt: new Date().toISOString() });
        membership.resetSecretCode(n);
        extra.push(n);
    }
    check('الرفض عند تجاوز الحد', () => membership.canRegisterNew(settings.ownerNumber).ok === false);
    check('سبب الرفض = limit', () => membership.canRegisterNew(settings.ownerNumber).reason === 'limit');

    membership.saveSiteSettings({ allowNewLinks: false });
    check('إغلاق الربط يمنع الجدد', () => membership.canRegisterNew(settings.ownerNumber).reason === 'closed');
    membership.saveSiteSettings({ allowNewLinks: true });

    membership.removeUser('201222222222');
    for (const n of extra) membership.removeUser(n);
    membership.saveSiteSettings({ registrationLimit: 20, announcement: '' });
    check('تنظيف بيانات الاختبار', () => membership.countRegisteredUsers(settings.ownerNumber) === 0);

    // ═══════════ 6) الجلسات (توكنز الويب) ═══════════
    console.log('\n── 6) جلسات الويب ──');
    const token = membership.createWebSession('201270221253', 'owner');
    check('توكن طويل عشوائي', () => token.length === 64);
    const valid = membership.validateWebSession(token);
    check('توكن صالح', () => valid && valid.number === '201270221253' && valid.role === 'owner');
    check('توكن مزور مرفوض', () => membership.validateWebSession('a'.repeat(64)) === null);
    membership.destroyWebSession(token);
    check('توكن ملغى بعد الخروج', () => membership.validateWebSession(token) === null);

    // ═══════════ 7) الحماية من التخمين ═══════════
    console.log('\n── 7) الحماية من التخمين ──');
    membership.removeUser('203333333333');
    for (let i = 0; i < 5; i++) membership.recordFailedAttempt('203333333333');
    const lock = membership.isLocked('203333333333');
    check('قفل بعد 5 محاولات', () => lock && lock.locked === true);
    membership.clearAttempts('203333333333');
    check('فك القفل', () => membership.isLocked('203333333333') === false);

    // ═══════════ 8) طبقة العضوية في main.js ═══════════
    console.log('\n── 8) بوابة أوامر المالك 💎 ──');
    const { checkOwnerCommandAccess, FULL_CONTROL_COMMANDS } = require(path.join(ROOT, 'main.js'));
    const fakeMsg = { key: { fromMe: false, remoteJid: 'x@s.whatsapp.net' } };

    const r1 = checkOwnerCommandAccess('sudo', '201270221253@s.whatsapp.net', fakeMsg, null, null);
    check('المالك يدخل sudo', () => r1.allowed);

    membership.upsertUser(TEST_NUM, { status: 'linked', role: 'premium', secretHash: 'a:b' });
    const r2 = checkOwnerCommandAccess('autoread', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز يدخل autoread 💎', () => r2.allowed && r2.reason === 'premium');

    const r3 = checkOwnerCommandAccess('sudo', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز ممنوع من sudo', () => !r3.allowed && r3.reason === 'premium-restricted');
    const r4 = checkOwnerCommandAccess('pair', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز ممنوع من pair', () => !r4.allowed);
    const r5 = checkOwnerCommandAccess('reloadplugins', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز ممنوع من reloadplugins', () => !r5.allowed);
    const r6 = checkOwnerCommandAccess('update', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز ممنوع من update', () => !r6.allowed);
    const r7 = checkOwnerCommandAccess('clearsession', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('مميز ممنوع من clearsession', () => !r7.allowed);

    membership.setUserRole(TEST_NUM, 'user');
    const r8 = checkOwnerCommandAccess('autoread', `${TEST_NUM}@s.whatsapp.net`, fakeMsg, null, null);
    check('عادي ممنوع من أوامر المالك', () => !r8.allowed && r8.reason === 'not-owner');

    membership.removeUser(TEST_NUM);
    check(`قائمة التحكم الكامل = ${FULL_CONTROL_COMMANDS.size} أوامر`, () => FULL_CONTROL_COMMANDS.size === 5);

    // ═══════════ 9) الخادم + API كامل ═══════════
    console.log('\n── 9) الخادم و API ──');
    const { startWebServer } = require(path.join(ROOT, 'web/server.js'));
    const server = await startWebServer(3777);
    check('الخادم يبدأ على 3777', () => server.listening);

    const base = 'http://127.0.0.1:3777';
    const j = async (p, opts = {}) => {
        const res = await fetch(base + p, Object.assign({}, opts, {
            headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
        }));
        let body = {};
        try { body = await res.json(); } catch (_) {}
        return { status: res.status, body };
    };

    for (const p of ['/', '/link', '/login', '/dashboard', '/assets/css/style.css', '/assets/js/app.js', '/assets/img/riam-avatar.webp']) {
        const res = await fetch(base + p);
        check(`صفحة ${p} → 200`, () => res.status === 200);
    }
    const notFound = await fetch(base + '/xyz-not-exist');
    check('404 لصفحة غير موجودة', () => notFound.status === 404);

    const st = await j('/api/status');
    check('GET /api/status', () => st.status === 200 && st.body.ok && st.body.registration.limit === 20);

    const badLink = await j('/api/link/request', { method: 'POST', body: JSON.stringify({ phone: '123' }) });
    check('رفض رقم قصير', () => badLink.status === 400);

    const linkRes = await j('/api/link/request', { method: 'POST', body: JSON.stringify({ phone: '201270221253' }) });
    check('طلب ربط المالك يُعالج (كود أو رسالة شبكة راقية)',
        () => (linkRes.body.ok && linkRes.body.code) || (linkRes.status >= 400 && linkRes.body.error));
    if (linkRes.body.ok && linkRes.body.code) {
        check('الكود = RIAM-BOOT المخصص', () => linkRes.body.code === 'RIAM-BOOT' || linkRes.body.customUsed === true);
    }

    const ls = await j('/api/link/status?phone=201270221253');
    check('GET /api/link/status', () => ls.status === 200 && ls.body.ok && ['none', 'registered', 'connected'].includes(ls.body.state));

    const noAuth = await j('/api/me');
    check('GET /api/me بدون توكن → 401', () => noAuth.status === 401);
    const noAdmin = await j('/api/admin/users', { headers: { Authorization: 'Bearer ' + 'f'.repeat(64) } });
    check('GET /api/admin/users بتوكن مزور → 401', () => noAdmin.status === 401);

    membership.removeUser('204444444444');
    const loginNoUser = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '204444444444', secret: 'ABCD2345' }) });
    check('دخول برقم غير مرتبط → 401', () => loginNoUser.status === 401);

    membership.removeUser('205555555555');
    membership.upsertUser('205555555555', { status: 'linked', linkedAt: new Date().toISOString() });
    const knownSecret = 'TEST2345';
    membership.upsertUser('205555555555', { secretHash: membership.hashSecret(knownSecret) });

    const loginBad = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '205555555555', secret: 'WRONG123' }) });
    check('رمز خاطئ → 401', () => loginBad.status === 401);

    const loginOk = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '205555555555', secret: 'test2345' }) });
    check('دخول صحيح → توكن', () => loginOk.status === 200 && loginOk.body.ok && loginOk.body.token);
    const userToken = loginOk.body.token;

    const me = await j('/api/me', { headers: { Authorization: 'Bearer ' + userToken } });
    check('GET /api/me بالتوكن', () => me.status === 200 && me.body.ok && me.body.user.number === '205555555555');

    const userSettings = await j('/api/settings', { headers: { Authorization: 'Bearer ' + userToken } });
    check('GET /api/settings لجلستي', () => userSettings.status === 200 && userSettings.body.settings);

    const saveSet = await j('/api/settings', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + userToken },
        body: JSON.stringify({ settings: { AUTOREAD: true, ANTICALL: 'decline', PREFIX: '!' } }),
    });
    check('POST /api/settings حفظ', () => saveSet.status === 200 && saveSet.body.applied.AUTOREAD === 'true');
    const badSet = await j('/api/settings', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + userToken },
        body: JSON.stringify({ settings: { ANTICALL: 'nuke-everything', HACK: 'yes' } }),
    });
    check('رفض قيم غير مسموحة', () => badSet.body.ok === false && badSet.body.rejected.ANTICALL && badSet.body.rejected.HACK);

    const adminDenied = await j('/api/admin/users', { headers: { Authorization: 'Bearer ' + userToken } });
    check('مستخدم عادي → 403 من لوحة المالك', () => adminDenied.status === 403);

    membership.removeUser('201270221253');
    membership.upsertUser('201270221253', { status: 'linked', linkedAt: new Date().toISOString(), name: 'المالك 👑' });
    const ownerSecret = 'OWNER123';
    membership.upsertUser('201270221253', { secretHash: membership.hashSecret(ownerSecret) });

    const ownerLogin = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '201270221253', secret: ownerSecret }) });
    check('دخول المالك', () => ownerLogin.status === 200 && ownerLogin.body.role === 'owner');
    const ownerToken = ownerLogin.body.token;

    const overview = await j('/api/admin/overview', { headers: { Authorization: 'Bearer ' + ownerToken } });
    check('لوحة المالك: نظرة عامة', () => overview.status === 200 && overview.body.stats && overview.body.users);

    const promote = await j('/api/admin/users/role', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ownerToken },
        body: JSON.stringify({ number: '205555555555', role: 'premium' }),
    });
    check('ترقية عضوية 💎', () => promote.status === 200 && membership.getRole('205555555555') === 'premium');

    const demote = await j('/api/admin/users/role', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ownerToken },
        body: JSON.stringify({ number: '205555555555', role: 'user' }),
    });
    check('إرجاع للعادية', () => demote.status === 200 && membership.getRole('205555555555') === 'user');

    const promoteOwner = await j('/api/admin/users/role', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ownerToken },
        body: JSON.stringify({ number: '201270221253', role: 'user' }),
    });
    check('منع تغيير دور المالك', () => promoteOwner.status === 403);

    const siteSave = await j('/api/admin/site-settings', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ownerToken },
        body: JSON.stringify({ registrationLimit: 20, allowNewLinks: true, announcement: 'أهلاً بالملوك 👑' }),
    });
    check('حفظ إعدادات الموقع', () => siteSave.status === 200 && siteSave.body.settings.registrationLimit === 20);

    const siteRead = await j('/api/status');
    check('الإعلان يظهر في /api/status', () => siteRead.body.announcement === 'أهلاً بالملوك 👑');

    const limitSave = await j('/api/admin/site-settings', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ownerToken },
        body: JSON.stringify({ registrationLimit: 3 }),
    });
    check('تغيير حد التسجيل إلى 3', () => limitSave.status === 200);
    membership.saveSiteSettings({ registrationLimit: 20, announcement: '' });

    const logout = await j('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + userToken } });
    check('تسجيل خروج', () => logout.status === 200);
    const afterLogout = await j('/api/me', { headers: { Authorization: 'Bearer ' + userToken } });
    check('التوكن ميت بعد الخروج', () => afterLogout.status === 401);

    membership.removeUser('205555555555');
    membership.removeUser('201270221253');
    membership.removeUser('204444444444');
    membership.clearAttempts('205555555555');

    server.close();
    console.log('\n════════════════════════════════════');
    console.log(`✅ نجح: ${passed}   ❌ فشل: ${failed}`);
    console.log('════════════════════════════════════\n');
    process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
    console.error('💥 خطأ في الاختبار:', err);
    process.exit(1);
});
