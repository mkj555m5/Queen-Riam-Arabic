'use strict';
/**
 * ───────────────────────────────────────────────────────────────────────────
 *  lib/sessionManager.js — مدير جلسات العملية الرئيسية (Master)
 * ───────────────────────────────────────────────────────────────────────────
 *  كل جلسة واتساب تعمل الآن في عملية Node.js منفصلة (worker.js):
 *    • عزل تام — لو علقت أو انهارت جلسة، الباقي يعمل طبيعياً
 *    • العملية الرئيسية تشرف وتعيد التشغيل تلقائياً عند الانهيار (backoff)
 *    • نفس الواجهة البرمجية السابقة بالضبط — الويب والإضافات لا تتأثر
 * ───────────────────────────────────────────────────────────────────────────
 */

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const settings = require('../settings');
const paths = require('./paths');
const membership = require('./membership');

const WORKER_FILE = path.join(__dirname, '..', 'worker.js');
const MAX_RESTARTS = 15;          // حد إعادة التشغيل قبل الاستسلام
const RESTART_BASE_MS = 5000;     // أساس التأجيل التصاعدي
const RESTART_MAX_MS = 60000;     // سقف التأجيل

/**
 * سجل العاملين: number → {
 *   child, number, mode, connected, pending, restarts,
 *   intentionalKill, exitTimer, lastSeenAt
 * }
 */
const _workers = {};

// طلبات الإرسال المعلقة: reqId → { resolve, timer }
const _sendWaiters = new Map();
// طلبات أكواد الربط المعلقة: number → { resolve, timer }
const _pairWaiters = new Map();
// طلبات pair-request الواردة من العاملين: reqId → { child, number }
const _pairRequestsFromWorkers = new Map();

// ── أدوات ───────────────────────────────────────────────────────────────────

function cleanNumber(n) {
    return String(n || '').replace(/\D/g, '');
}

function backoffMs(restarts) {
    return Math.min(RESTART_BASE_MS * Math.pow(2, Math.max(0, restarts - 1)), RESTART_MAX_MS);
}

// ── تشغيل عامل جديد ─────────────────────────────────────────────────────────

function _spawnWorker(number, mode, pairCode) {
    const clean = cleanNumber(number);
    if (!clean) throw new Error('رقم غير صالح');

    const existing = _workers[clean];
    if (existing && existing.child && !existing.child.killed) {
        return existing;
    }

    const sessionDir = paths.sessionDirFor(clean);
    try { fs.mkdirSync(sessionDir, { recursive: true }); } catch (_) {}

    const child = fork(WORKER_FILE, [], {
        env: {
            ...process.env,
            QR_WORKER_NUMBER: clean,
            QR_WORKER_MODE: mode,
            QR_WORKER_PAIR_CODE: pairCode || '',
            QR_WORKER_SESSION_DIR: sessionDir,
        },
        stdio: 'inherit',
    });

    const entry = {
        child,
        number: clean,
        mode,
        connected: false,
        pending: mode === 'pair',
        restarts: (existing && existing.mode === 'session' ? existing.restarts : 0),
        intentionalKill: false,
        exitTimer: null,
        lastSeenAt: Date.now(),
    };
    _workers[clean] = entry;

    console.log(`[master] 🚀 تشغيل عامل جلسة ${clean} (وضع: ${mode === 'pair' ? 'ربط' : 'جلسة'}) pid=${child.pid}`);

    child.on('message', (m) => _onWorkerMessage(entry, m));

    child.on('exit', (code, signal) => {
        console.log(`[master] ⚠️ عامل ${clean} انتهى (code=${code}, signal=${signal})`);
        _sendWaiters.forEach((w, reqId) => {
            if (w.number === clean) {
                clearTimeout(w.timer);
                _sendWaiters.delete(reqId);
                w.resolve(false);
            }
        });
        if (_pairWaiters.has(clean)) {
            const w = _pairWaiters.get(clean);
            clearTimeout(w.timer);
            _pairWaiters.delete(clean);
            w.resolve(null);
        }

        entry.connected = false;
        entry.pending = false;

        // قرار إعادة التشغيل: جلسات فقط + غير مقصود + ضمن الحد
        if (entry.intentionalKill || entry.mode !== 'session') {
            // عمال الربط المنتهيون (فشل/مهلة/إحلال) — أزلهم من السجل دائماً
            delete _workers[clean];
            return;
        }
        if (entry.restarts >= MAX_RESTARTS) {
            console.error(`[master] ❌ عامل ${clean} تجاوز حد إعادة التشغيل (${MAX_RESTARTS}) — متوقف`);
            return;
        }
        entry.restarts += 1;
        const wait = backoffMs(entry.restarts);
        console.log(`[master] 🔄 إعادة تشغيل عامل ${clean} بعد ${(wait / 1000).toFixed(0)} ثانية (محاولة ${entry.restarts}/${MAX_RESTARTS})`);
        entry.exitTimer = setTimeout(() => {
            if (_workers[clean] === entry && entry.intentionalKill) return;
            _spawnWorker(clean, 'session');
        }, wait);
    });

    return entry;
}

function _onWorkerMessage(entry, m) {
    if (!m || !m.t) return;
    entry.lastSeenAt = Date.now();

    switch (m.t) {
        case 'status': {
            entry.connected = !!m.connected;
            entry.pending = !!m.pending;
            // بعد نجاح الربط يتحول العامل لجلسة دائمة داخلياً — حدّث الوضع
            // حتى تحميه سياسة إعادة التشغيل عند الانهيار
            if (entry.mode === 'pair' && entry.connected) entry.mode = 'session';
            break;
        }

        case 'pair-code': {
            entry.pending = false;
            entry.lastCode = m.code || null;
            const waiter = _pairWaiters.get(entry.number);
            if (waiter) {
                clearTimeout(waiter.timer);
                _pairWaiters.delete(entry.number);
                waiter.resolve(m.code || null);
            }
            break;
        }

        case 'pair-failed': {
            const waiter = _pairWaiters.get(entry.number);
            if (waiter) {
                clearTimeout(waiter.timer);
                _pairWaiters.delete(entry.number);
                waiter.resolve(null);
            }
            break;
        }

        case 'send-result': {
            const w = _sendWaiters.get(m.reqId);
            if (w) {
                clearTimeout(w.timer);
                _sendWaiters.delete(m.reqId);
                w.resolve(!!m.ok);
            }
            break;
        }

        case 'logged-out': {
            console.log(`[master] 🗑️ جلسة ${m.number} خرجت من واتساب — إزالة من السجل`);
            entry.intentionalKill = true;
            delete _workers[m.number];
            break;
        }

        case 'mem-op': {
            // عمليات كتابة العضويات تُنفذ هنا فقط (عملية واحدة → لا تضارب ملفات)
            const ALLOWED = ['upsertUser', 'resetSecretCode', 'markCodeDelivered', 'getUser'];
            let result = null;
            if (ALLOWED.includes(m.op)) {
                try { result = membership[m.op](...(m.args || [])); } catch (e) {
                    console.error(`[master] mem-op ${m.op} فشل:`, e.message);
                }
            }
            try { entry.child.send({ t: 'mem-result', reqId: m.reqId, result }); } catch (_) {}
            break;
        }

        case 'pair-request': {
            // أمر .pair من داخل عامل — توليد كود لرقم آخر عبر الرئيسية
            (async () => {
                let code = null;
                let error = null;
                try {
                    code = await generatePairingCode(m.number, settings.customPairingCode);
                } catch (e) {
                    error = e.message;
                }
                try {
                    entry.child.send({
                        t: 'pair-code-result',
                        reqId: m.reqId,
                        code,
                        error,
                    });
                } catch (_) {}
            })();
            break;
        }

        case 'sessions-summary-req': {
            try {
                entry.child.send({ t: 'sessions-summary', reqId: m.reqId, summary: getSessionsSummary() });
            } catch (_) {}
            break;
        }

        case 'destroy-session': {
            // أمر .pair unpair من داخل عامل — افصل جلسة رقم آخر بالكامل
            let ok = false;
            try { ok = destroySession(m.number); } catch (e) {
                console.error('[master] destroy-session فشل:', e.message);
            }
            try {
                entry.child.send({ t: 'destroy-session-result', reqId: m.reqId, ok });
            } catch (_) {}
            break;
        }

        default:
            break;
    }
}

// ── الواجهة العامة (نفس واجهة الإصدار السابق) ───────────────────────────────

/**
 * توليد رمز ربط لرقم معين (يشغّل عامل وضع «ربط»)
 * @returns {string|null} الكود منسقاً XXXX-XXXX أو null إذا كان الرقم مسجلاً
 */
async function generatePairingCode(phoneNumber, customPairingCode) {
    const clean = cleanNumber(phoneNumber);
    if (!clean) throw new Error('رقم غير صالح');

    const existing = _workers[clean];
    const alive = !!(existing && existing.child && !existing.child.killed);

    if (alive && existing.mode === 'pair') {
        // كود جاهز من طلب سابق (لا يزال صالحاً ~3 دقائق) — أعد نفسه بدل طلب جديد
        if (!existing.pending && existing.lastCode) return existing.lastCode;
        // كود قيد التوليد الآن
        if (existing.pending) throw new Error('ALREADY_ACTIVE');
        // عامل ربط بلا كود (فشل سابق) — أعد إنشاءه
        existing.intentionalKill = true;
        try { existing.child.send({ t: 'shutdown' }); } catch (_) {}
        setTimeout(() => { try { existing.child.kill('SIGKILL'); } catch (_) {} }, 3000);
        delete _workers[clean];
    } else if (alive && existing.mode === 'session') {
        // جلسة قائمة لرقم غير مسجل؟ حالة شاذة — أعد إنشاءه كعامل ربط
        existing.intentionalKill = true;
        try { existing.child.send({ t: 'shutdown' }); } catch (_) {}
        setTimeout(() => { try { existing.child.kill('SIGKILL'); } catch (_) {} }, 3000);
        delete _workers[clean];
    }

    const registered = hasRegisteredSession(clean);

    if (registered) {
        // مسجل — تأكد فقط أن الجلسة تعمل (بدون كود)
        if (!_workers[clean] || !_workers[clean].child || _workers[clean].child.killed) {
            _spawnWorker(clean, 'session');
        }
        return null;
    }

    // عامل ربط جديد + انتظار الكود
    const entry = _spawnWorker(clean, 'pair', customPairingCode);

    const code = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            _pairWaiters.delete(clean);
            resolve(null);
        }, 75000);
        _pairWaiters.set(clean, { resolve, timer });
    });

    if (!code) {
        // فشل التوليد — أنهِ عامل الربط حتى تسمح محاولة جديدة
        if (_workers[clean] === entry) {
            entry.intentionalKill = true;
            try { entry.child.send({ t: 'shutdown' }); } catch (_) {}
            setTimeout(() => { try { entry.child.kill('SIGKILL'); } catch (_) {} }, 3000);
            delete _workers[clean];
        }
        throw new Error('فشل توليد كود الربط — تأكد من صحة الرقم وأعد المحاولة');
    }

    return code;
}

function getActiveSessions() {
    return Object.keys(_workers);
}

function getSessionInfo(rawNumber) {
    const clean = cleanNumber(rawNumber);
    const entry = _workers[clean];
    return {
        exists: !!(entry && entry.child && !entry.child.killed),
        connected: !!(entry && entry.connected),
        pending: !!(entry && entry.pending),
    };
}

function getSessionsSummary() {
    const sessions = Object.values(_workers).map((e) => ({
        number: e.number,
        connected: !!e.connected,
        pending: !!e.pending,
        restarts: e.restarts,
    }));
    return {
        total: sessions.length,
        connected: sessions.filter((s) => s.connected).length,
        sessions,
    };
}

/** هل يوجد مجلد جلسة مسجل لهذا الرقم؟ (الجذر الدائم أو المسارات القديمة) */
function hasRegisteredSession(rawNumber) {
    const clean = cleanNumber(rawNumber);
    if (!clean) return false;

    const candidates = [
        path.join(paths.SESSIONS_DIR, clean, 'creds.json'),
        path.join(paths.LEGACY_SESSION_DIR, clean, 'creds.json'),
    ];
    for (const credsPath of candidates) {
        try {
            if (!fs.existsSync(credsPath)) continue;
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds.registered) return true;
        } catch (_) {}
    }
    return false;
}

/** الجلسة القديمة جداً (session/ الجذر — من إصدارات ما قبل v1.2.0) */
function getMainSessionInfo() {
    try {
        const credsPath = path.join(paths.LEGACY_SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) return { exists: false };
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        const number = String(creds.me?.id || '').replace(/[^\d]/g, '').split(':')[0];
        return { exists: true, registered: !!creds.registered, number };
    } catch (_) {
        return { exists: false };
    }
}

/**
 * إرسال رسالة عبر جلسة متصلة (IPC إلى العامل) — مع مهلة 20 ثانية
 * @returns {Promise<boolean>} نجاح الإرسال
 */
async function sendFromSession(fromNumber, toJid, content) {
    const clean = cleanNumber(fromNumber);
    const entry = _workers[clean];
    if (!entry || !entry.child || entry.child.killed || !entry.connected) return false;

    const reqId = `send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            _sendWaiters.delete(reqId);
            resolve(false);
        }, 20000);
        _sendWaiters.set(reqId, { resolve, timer, number: clean });
        try {
            entry.child.send({ t: 'send', toJid, content, reqId });
        } catch (e) {
            clearTimeout(timer);
            _sendWaiters.delete(reqId);
            resolve(false);
        }
    });
}

/**
 * فصل جلسة بالكامل (من لوحة التحكم): قتل العامل + حذف مجلدات الجلسة
 */
function destroySession(rawNumber) {
    const clean = cleanNumber(rawNumber);
    const entry = _workers[clean];
    if (entry) {
        entry.intentionalKill = true;
        try { entry.child.send({ t: 'shutdown' }); } catch (_) {}
        setTimeout(() => { try { entry.child.kill('SIGKILL'); } catch (_) {} }, 3000);
        clearTimeout(entry.exitTimer);
        delete _workers[clean];
        console.log(`[master] 🗑️ تم فصل جلسة ${clean}`);
    }
    // حذف مجلدات الجلسة (الجديدة والقديمة)
    for (const dir of [
        paths.sessionDirFor(clean),
        path.join(paths.LEGACY_SESSION_DIR, clean),
    ]) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    }
    return true;
}

// ── استعادة الجلسات عند الإقلاع ─────────────────────────────────────────────

function _copyDir(src, dst) {
    try {
        fs.cpSync(src, dst, { recursive: true, force: false, errorOnExist: true });
        return true;
    } catch (err) {
        if (String(err.message).includes('already exists')) return false;
        console.error(`[master] نسخ جلسة ${src} فشل:`, err.message);
        return false;
    }
}

async function rehydrateSessions() {
    try {
        fs.mkdirSync(paths.SESSIONS_DIR, { recursive: true });
    } catch (_) {}

    // 1) هجرة الجلسات القديمة (session/<رقم> و session/ الجذر) إلى الجذر الدائم
    try {
        const mainInfo = getMainSessionInfo();
        if (mainInfo.exists && mainInfo.registered && mainInfo.number) {
            const dst = paths.sessionDirFor(mainInfo.number);
            if (!fs.existsSync(path.join(dst, 'creds.json'))) {
                if (_copyDir(paths.LEGACY_SESSION_DIR, dst)) {
                    console.log(`[master] 📦 هُجرت الجلسة الرئيسية القديمة (${mainInfo.number}) إلى الجذر الدائم`);
                }
            }
        }
        if (fs.existsSync(paths.LEGACY_SESSION_DIR)) {
            for (const name of fs.readdirSync(paths.LEGACY_SESSION_DIR)) {
                if (!/^\d+$/.test(name)) continue;
                const src = path.join(paths.LEGACY_SESSION_DIR, name);
                const dst = paths.sessionDirFor(name);
                if (!fs.existsSync(path.join(dst, 'creds.json')) && fs.existsSync(path.join(src, 'creds.json'))) {
                    if (_copyDir(src, dst)) console.log(`[master] 📦 هُجرت جلسة قديمة (${name}) إلى الجذر الدائم`);
                }
            }
        }
    } catch (err) {
        console.error('[master] هجرة الجلسات القديمة فشلت (غير حرج):', err.message);
    }

    // 2) تشغيل عامل لكل جلسة مسجلة في الجذر الدائم
    let count = 0;
    try {
        for (const name of fs.readdirSync(paths.SESSIONS_DIR)) {
            if (!/^\d+$/.test(name)) continue;
            const credsPath = path.join(paths.SESSIONS_DIR, name, 'creds.json');
            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                if (!creds.registered) continue;
            } catch (_) { continue; }
            if (_workers[name] && _workers[name].child && !_workers[name].child.killed) continue;
            _spawnWorker(name, 'session');
            count++;
            await new Promise((r) => setTimeout(r, 1500)); // تباعد الإقلاع
        }
    } catch (err) {
        console.error('[master] استعادة الجلسات فشلت:', err.message);
    }
    return count;
}

/** إيقاف كل العاملين نظيفاً (عند SIGTERM من Railway) */
function shutdownAll() {
    for (const entry of Object.values(_workers)) {
        entry.intentionalKill = true;
        clearTimeout(entry.exitTimer);
        try { entry.child.send({ t: 'shutdown' }); } catch (_) {}
    }
    const deadline = Date.now() + 4000;
    const killer = setInterval(() => {
        for (const entry of Object.values(_workers)) {
            try { if (!entry.child.killed) entry.child.kill('SIGKILL'); } catch (_) {}
        }
        if (Date.now() > deadline) clearInterval(killer);
    }, 800);
    if (killer.unref) killer.unref();
}

module.exports = {
    generatePairingCode,
    getActiveSessions,
    getSessionInfo,
    getSessionsSummary,
    hasRegisteredSession,
    getMainSessionInfo,
    destroySession,
    rehydrateSessions,
    sendFromSession,
    shutdownAll,
};
