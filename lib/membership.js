'use strict';
/**
 * ───────────────────────────────────────────────────────────────────────────
 *  lib/membership.js — نظام المستخدمين والعضويات ولوحة تحكم الويب
 * ───────────────────────────────────────────────────────────────────────────
 *  مسؤول عن:
 *    • تخزين المستخدمين المرتبطين (data/web_users.json)
 *    • الرمز السري (توليد + تشفير scrypt + تحقق) لتسجيل الدخول للموقع
 *    • جلسات تسجيل الدخول (توكنز Bearer — data/web_sessions.json)
 *    • العضويات: عادية / مميزة 💎 / مالك 👑
 *    • إعدادات الموقع: حد التسجيل (افتراضي 20) + السماح بالربط + الإعلانات
 *    • حماية بسيطة: تحديد محاولات الدخول الفاشلة
 * ───────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'web_users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'web_sessions.json');
const SITE_FILE = path.join(DATA_DIR, 'site_settings.json');

// ── أدوات مساعدة ─────────────────────────────────────────────────────────────

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`[membership] تعذر قراءة ${path.basename(file)}:`, err.message);
        return fallback;
    }
}

function writeJson(file, data) {
    try {
        ensureDataDir();
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmp, file); // كتابة ذرية — لا تلف البيانات عند الانقطاع
        return true;
    } catch (err) {
        console.error(`[membership] تعذر حفظ ${path.basename(file)}:`, err.message);
        return false;
    }
}

/** تنظيف الرقم: أرقام فقط */
function normalizePhone(input) {
    return String(input || '').replace(/[^\d]/g, '');
}

/** تحقق أساسي من صيغة الرقم الدولي (10-15 رقماً) */
function isValidPhone(input) {
    const n = normalizePhone(input);
    return n.length >= 10 && n.length <= 15;
}

// ── الرمز السري ──────────────────────────────────────────────────────────────

// حروف بدون ملتبسات (بدون I, L, O, U, 0, 1)
const SECRET_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SECRET_LENGTH = 8;

/** توليد رمز سري عشوائي آمن (8 أحرف) */
function generateSecretCode() {
    const bytes = crypto.randomBytes(SECRET_LENGTH);
    let code = '';
    for (let i = 0; i < SECRET_LENGTH; i++) {
        code += SECRET_ALPHABET[bytes[i] % SECRET_ALPHABET.length];
    }
    return code;
}

/** تشفير الرمز السري بـ scrypt + ملح عشوائي */
function hashSecret(secret) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(secret), salt, 32).toString('hex');
    return `${salt}:${hash}`;
}

/** التحقق من الرمز السري مقابل الهاش المخزن (مقاوم لهجمات التوقيت) */
function verifySecret(secret, stored) {
    try {
        if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
        const [salt, hash] = stored.split(':');
        const candidate = crypto.scryptSync(String(secret), salt, 32);
        const expected = Buffer.from(hash, 'hex');
        if (candidate.length !== expected.length) return false;
        return crypto.timingSafeEqual(candidate, expected);
    } catch (_) {
        return false;
    }
}

// ── إعدادات الموقع ───────────────────────────────────────────────────────────

const DEFAULT_SITE_SETTINGS = {
    // الحد الأقصى لعدد المسجلين في سيرفر البوت
    registrationLimit: 20,
    // السماح بروابط جديدة
    allowNewLinks: true,
    // إعلان يظهر أعلى الموقع (فارغ = مخفي)
    announcement: '',
    updatedAt: null,
};

function getSiteSettings() {
    const saved = readJson(SITE_FILE, {});
    return Object.assign({}, DEFAULT_SITE_SETTINGS, saved);
}

function saveSiteSettings(updates) {
    const current = getSiteSettings();
    const next = Object.assign({}, current, updates, { updatedAt: new Date().toISOString() });
    if (updates.registrationLimit !== undefined) {
        const n = parseInt(updates.registrationLimit, 10);
        if (!Number.isFinite(n) || n < 1 || n > 500) {
            return { ok: false, error: 'حد التسجيل يجب أن يكون رقماً بين 1 و 500' };
        }
        next.registrationLimit = n;
    }
    if (updates.allowNewLinks !== undefined) {
        next.allowNewLinks = !!updates.allowNewLinks;
    }
    if (updates.announcement !== undefined) {
        next.announcement = String(updates.announcement || '').slice(0, 300);
    }
    return { ok: writeJson(SITE_FILE, next), settings: next };
}

// ── المستخدمون ───────────────────────────────────────────────────────────────

/**
 * شكل المستخدم:
 * {
 *   "201270221253": {
 *     number: "201270221253",
 *     name: "المالك",
 *     role: "owner" | "premium" | "user",
 *     secretHash: "salt:hash",
 *     linkedAt: ISO, lastLogin: ISO|null,
 *     status: "pending" | "linked"
 *   }
 * }
 */
function loadUsers() {
    return readJson(USERS_FILE, {});
}

function saveUsers(users) {
    return writeJson(USERS_FILE, users);
}

function getUser(number) {
    const users = loadUsers();
    return users[normalizePhone(number)] || null;
}

function getRole(number) {
    const user = getUser(number);
    return user ? user.role : null;
}

function isOwnerNumber(number, ownerNumber) {
    return normalizePhone(number) === normalizePhone(ownerNumber);
}

/** هل الرقم عضو مميز 💎؟ (المالك يعتبر مميزاً تلقائياً) */
function isPremiumUser(number, ownerNumber) {
    const n = normalizePhone(number);
    if (ownerNumber && n === normalizePhone(ownerNumber)) return true;
    const user = getUser(n);
    return !!user && (user.role === 'premium' || user.role === 'owner');
}

/** إنشاء أو تحديث مستخدم (دون مسح بياناته القديمة) */
function upsertUser(number, updates) {
    const n = normalizePhone(number);
    if (!n) return null;
    const users = loadUsers();
    const existing = users[n] || {
        number: n,
        name: `مستخدم ${n.slice(-4)}`,
        role: 'user',
        secretHash: null,
        linkedAt: null,
        lastLogin: null,
        status: 'pending',
    };
    users[n] = Object.assign({}, existing, updates, { number: n });
    saveUsers(users);
    return users[n];
}

/** تعيين رمز سري جديد وإرجاعه (نصاً صريحاً — يُرسل مرة واحدة عبر واتساب) */
function resetSecretCode(number) {
    const code = generateSecretCode();
    const user = upsertUser(number, { secretHash: hashSecret(code), codeDelivered: false });
    return user ? code : null;
}

/** تعليم أن الرمز السري وصل فعلاً للمستخدم عبر واتساب (يُستخدم للتعافي الذاتي) */
function markCodeDelivered(number) {
    return upsertUser(number, { codeDelivered: true, codeDeliveredAt: new Date().toISOString() });
}

/** هل الرمز السري وصل للمستخدم من قبل؟ */
function wasCodeDelivered(number) {
    const user = getUser(number);
    return !!(user && user.codeDelivered);
}

/** تحديث دور المستخدم (ترقية/تخفيض) */
function setUserRole(number, role) {
    const allowed = ['user', 'premium', 'owner'];
    if (!allowed.includes(role)) return null;
    return upsertUser(number, { role });
}

function removeUser(number) {
    const n = normalizePhone(number);
    const users = loadUsers();
    if (users[n]) {
        delete users[n];
        saveUsers(users);
        return true;
    }
    return false;
}

/** عدد المسجلين الفعليين (بدون المالك وبدون المعلقين) */
function countRegisteredUsers(ownerNumber) {
    const users = loadUsers();
    const owner = normalizePhone(ownerNumber || '');
    return Object.values(users).filter(u => {
        if (u.number === owner) return false;
        return u.status === 'linked' || u.secretHash;
    }).length;
}

/** هل يمكن ربط رقم جديد؟ (يفحص الحد + السماح) */
function canRegisterNew(ownerNumber) {
    const site = getSiteSettings();
    if (!site.allowNewLinks) {
        return { ok: false, reason: 'closed', message: 'الربط مغلق حالياً من إدارة الموقع.' };
    }
    const count = countRegisteredUsers(ownerNumber);
    if (count >= site.registrationLimit) {
        return {
            ok: false,
            reason: 'limit',
            message: `تم الوصول للحد الأقصى للمسجلين (${count}/${site.registrationLimit}). تواصل مع المالك.`,
        };
    }
    return { ok: true, count, limit: site.registrationLimit };
}

/** إحصائيات لوحة المالك */
function getUsersSummary(ownerNumber) {
    const users = loadUsers();
    const owner = normalizePhone(ownerNumber || '');
    const list = Object.values(users).map(u => ({
        number: u.number,
        name: u.name,
        role: u.number === owner ? 'owner' : (u.role || 'user'),
        linkedAt: u.linkedAt,
        lastLogin: u.lastLogin,
        status: u.status || (u.secretHash ? 'linked' : 'pending'),
        hasSecret: !!u.secretHash,
    }));
    return {
        total: list.length,
        premium: list.filter(u => u.role === 'premium').length,
        regular: list.filter(u => (u.role || 'user') === 'user' && u.number !== owner).length,
        users: list.sort((a, b) => (a.linkedAt || '').localeCompare(b.linkedAt || '')),
    };
}

// ── جلسات تسجيل دخول الويب (توكنز) ──────────────────────────────────────────

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام
const MAX_TOKENS = 500;

function loadSessions() {
    return readJson(SESSIONS_FILE, {});
}

function saveSessions(sessions) {
    return writeJson(SESSIONS_FILE, sessions);
}

function createWebSession(number, role) {
    const token = crypto.randomBytes(32).toString('hex');
    const sessions = loadSessions();
    // نظّف المنتهية
    const now = Date.now();
    for (const k of Object.keys(sessions)) {
        if (!sessions[k] || sessions[k].expiresAt < now) delete sessions[k];
    }
    if (Object.keys(sessions).length >= MAX_TOKENS) {
        const oldest = Object.entries(sessions).sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
        if (oldest) delete sessions[oldest[0]];
    }
    sessions[token] = {
        number: normalizePhone(number),
        role,
        createdAt: now,
        expiresAt: now + TOKEN_TTL_MS,
    };
    saveSessions(sessions);
    return token;
}

function validateWebSession(token) {
    if (!token || typeof token !== 'string' || token.length < 32) return null;
    const sessions = loadSessions();
    const s = sessions[token];
    if (!s || s.expiresAt < Date.now()) return null;
    return { number: s.number, role: s.role };
}

function destroyWebSession(token) {
    const sessions = loadSessions();
    if (sessions[token]) {
        delete sessions[token];
        saveSessions(sessions);
        return true;
    }
    return false;
}

// ── حماية من التخمين (تحديد محاولات الدخول) ─────────────────────────────────

const attempts = new Map(); // number → { count, lockUntil }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 دقيقة

function isLocked(number) {
    const rec = attempts.get(normalizePhone(number));
    if (!rec) return false;
    if (rec.lockUntil && rec.lockUntil > Date.now()) {
        return { locked: true, minutesLeft: Math.ceil((rec.lockUntil - Date.now()) / 60000) };
    }
    return false;
}

function recordFailedAttempt(number) {
    const n = normalizePhone(number);
    const rec = attempts.get(n) || { count: 0, lockUntil: 0 };
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
        rec.lockUntil = Date.now() + LOCK_MS;
        rec.count = 0;
    }
    attempts.set(n, rec);
}

function clearAttempts(number) {
    attempts.delete(normalizePhone(number));
}

/** تحديد معدل طلبات إعادة إرسال الرمز: مرة كل دقيقتين لكل رقم */
const resendCooldowns = new Map();
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function canResendSecret(number) {
    const n = normalizePhone(number);
    const last = resendCooldowns.get(n) || 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
        return { ok: false, secondsLeft: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000) };
    }
    return { ok: true };
}

function markResendSecret(number) {
    resendCooldowns.set(normalizePhone(number), Date.now());
}

module.exports = {
    // أدوات
    normalizePhone,
    isValidPhone,
    // الرمز السري
    generateSecretCode,
    hashSecret,
    verifySecret,
    resetSecretCode,
    markCodeDelivered,
    wasCodeDelivered,
    // إعدادات الموقع
    getSiteSettings,
    saveSiteSettings,
    // المستخدمون
    loadUsers,
    getUser,
    getRole,
    upsertUser,
    setUserRole,
    removeUser,
    isOwnerNumber,
    isPremiumUser,
    countRegisteredUsers,
    canRegisterNew,
    getUsersSummary,
    // الجلسات
    createWebSession,
    validateWebSession,
    destroyWebSession,
    // الحماية
    isLocked,
    recordFailedAttempt,
    clearAttempts,
    canResendSecret,
    markResendSecret,
};
