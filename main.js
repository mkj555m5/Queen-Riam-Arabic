/**
 * ───────────────────────────────────────────────────────────────────────────
 *  Queen Riam — Arabic Edition  •  main.js  (نظيف بدون تعمية)
 * ───────────────────────────────────────────────────────────────────────────
 *  هذا الملف يحتوي على معالج الرسائل الرئيسي للبوت.
 *  تمت إزالة كل الميزات التلقائية (auto-join, auto-newsletter, auto-status post)
 *  بناءً على طلب المالك. البوت الآن يعمل فقط بالأوامر اليدوية.
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

const settings = require('./settings');
const { pluginMap, dispatchEvent, loadPlugins } = require('./lib/pluginLoader');
const { getLang } = require('./lib/lang');
const { loadConfig } = require('./lib/config');
const { isButtonModeOn, sendButtonMessage } = require('./lib/buttonHelper');
const isAdmin = require('./lib/isAdmin');
const { isBanned } = require('./lib/isBanned');
const { hasOwnerPrivileges } = require('./plugins/sudo');

// ── أدوات مساعدة ──────────────────────────────────────────────────────────

function getContentType(message) {
    if (!message || typeof message !== 'object') return null;
    return Object.keys(message)[0] || null;
}

function parseMention(text = '') {
    return [...text.matchAll(/@(\d+)/g)].map(m => m[1] + '@s.whatsapp.net');
}

/**
 * استخراج نص الرسالة من أي نوع محتوى
 */
function getMessageText(message) {
    if (!message) return '';
    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.imageMessage?.contextInfo?.quotedMessage?.conversation ||
        ''
    ).toString();
}

/**
 * استخراج رقم المرسل
 */
function getSender(message, sock) {
    const participant = message.key?.participant ||
                        message.message?.extendedTextMessage?.contextInfo?.participant;
    const remoteJid = message.key?.remoteJid;
    if (participant) return participant;
    if (remoteJid && !remoteJid.endsWith('@g.us')) return remoteJid;
    if (message.key?.fromMe && sock?.user?.id) return sock.user.id;
    return remoteJid || '';
}

/**
 * تقسيم الأمر إلى: prefix, command, args, query
 */
function parseCommand(body, prefix) {
    if (!body || !body.startsWith(prefix)) return null;
    const stripped = body.slice(prefix.length).trim();
    if (!stripped) return null;
    const parts = stripped.split(/\s+/);
    const command = (parts.shift() || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const args = parts;
    const query = parts.join(' ');
    return { command, args, query };
}

// ── المعالج الرئيسي للرسائل ────────────────────────────────────────────────

async function handleMessages(sock) {
    const sessionNumber = sock._sessionNumber || null;
    const t = getLang(sessionNumber);

    // ── معالجة الرسائل الواردة ──────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;
            for (const message of messages) {
                if (!message?.message) continue;
                // ملاحظة مهمة: لا نتخطى fromMe=true لأن البوت متصل برقم المالك،
                // فكل رسائله من نفسه ستظهر بـ fromMe=true. هذا هو السلوك الصحيح.
                await processMessage(sock, message, sessionNumber);
            }
        } catch (err) {
            console.error('[main] خطأ في معالجة الرسائل:', err.message);
        }
    });

    // ── معالجة مكالمات الرد التلقائي ───────────────────────────────────────────
    sock.ev.on('call', async (callEvent) => {
        try {
            // لا توجد مكالمات تلقائية — فقط السماح للمستخدم بضبط ANTICALL عبر الأمر
            // تم إزالة كل الردود التلقائية هنا حسب طلب المالك
        } catch (err) {
            console.error('[main] خطأ في معالجة المكالمة:', err.message);
        }
    });

    // ── معالجة تحديثات المجموعة ────────────────────────────────────────────
    sock.ev.on('groups.update', async (updates) => {
        try {
            await dispatchEvent('groups.update', { updates, sock });
        } catch (err) {
            console.error('[main] خطأ في تحديثات المجموعة:', err.message);
        }
    });

    // ── معالجة انضمام/مغادرة الأعضاء ───────────────────────────────────────
    sock.ev.on('group-participants.update', async (update) => {
        try {
            await dispatchEvent('group-participants.update', { update, sock });
        } catch (err) {
            console.error('[main] خطأ في تحديثات الأعضاء:', err.message);
        }
    });

    // ── معالجة حذف الرسائل (anti-delete) ───────────────────────────────────
    sock.ev.on('messages.update', async (updates) => {
        try {
            await dispatchEvent('messages.update', { updates, sock });
        } catch (err) {
            console.error('[main] خطأ في تحديثات الرسائل:', err.message);
        }
    });

    console.log(`[main] ✅ تم تحميل معالج الرسائل للجلسة: ${sessionNumber || 'الرئيسية'}`);
}

// ── معالجة رسالة واحدة ────────────────────────────────────────────────────

async function processMessage(sock, message, sessionNumber) {
    const chatId = message.key.remoteJid;
    if (!chatId) return;

    const sender = getSender(message, sock);
    const body = getMessageText(message.message);
    const t = getLang(sessionNumber);
    const cfg = loadConfig(sessionNumber);
    const prefix = cfg.PREFIX || settings.prefix || '.';

    // سجل تشخيصي: طباعة كل رسالة واردة (للتأكد من وصولها)
    console.log(`[msg] from=${sender} chat=${chatId} fromMe=${message.key?.fromMe} body="${body.slice(0, 80)}"`);

    // ── التحقق من الحظر ──────────────────────────────────────────────────────
    if (isBanned(sender, sessionNumber)) {
        return; // المستخدم محظور — تجاهل الرسالة
    }

    // ── إذا كانت الرسالة ليست أمر، تجاهلها ──────────────────────────────────
    const parsed = parseCommand(body, prefix);
    if (!parsed) return;

    const { command, args, query } = parsed;
    console.log(`[cmd] أمر مستلم: "${command}" بوسائط: ${JSON.stringify(args)}`);

    // ── البحث عن الأمر في الـ pluginMap ──────────────────────────────────────
    const pluginEntry = pluginMap.get(command);
    if (!pluginEntry) {
        console.log(`[cmd] الأمر "${command}" غير موجود في pluginMap`);
        return;
    }

    const { handler, meta } = pluginEntry;
    console.log(`[cmd] تنفيذ الأمر "${command}" من plugin: ${meta?.category || 'general'}`);

    // ── التحقق من صلاحيات المشرف للأوامر الخاصة بالمجموعة ──────────────────────
    if (meta?.category === 'group' && chatId.endsWith('@g.us')) {
        const adminCheck = await isAdmin(sock, chatId, sender);
        if (!adminCheck.isSenderAdmin && !hasOwnerPrivileges(sender, message, sock.user?.id, sessionNumber)) {
            await sock.sendMessage(chatId, { text: t.common_user_not_admin }, { quoted: message });
            return;
        }
    }

    // ── تنفيذ الأمر ──────────────────────────────────────────────────────────
    try {
        const ctx = {
            sessionNumber,
            sender,
            chatId,
            message,
            args,
            query,
        };
        await handler(sock, chatId, message, args, query, ctx);
    } catch (err) {
        console.error(`[main] خطأ في تنفيذ الأمر "${command}":`, err.message);
        try {
            await sock.sendMessage(chatId, { text: t.common_error }, { quoted: message });
        } catch (_) {}
    }
}

module.exports = { handleMessages, processMessage, parseCommand, getMessageText, getSender };
