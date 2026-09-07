'use strict';

/**
 * lib/yatoAdapter.js — يخلي إضافات Yato (ESM) تشتغل داخل Queen Riam
 *
 * الفكرة:
 *   كل ملف ESM بـ `export default handler` حيث:
 *     handler = async (m, { conn, text, usedPrefix, command, ... }) => {...}
 *
 *   - handler.command يمكن أن يكون RegExp أو array of strings
 *   - handler.help = array of strings (للقائمة)
 *   - handler.tags = array of strings (للفئة)
 *   - handler.rowner / handler.owner = boolean (للصلاحيات)
 *   - handler.limit = number/boolean
 *
 *   نحوّل sock/chatId/message إلى:
 *     - conn: له نفس sock.sendMessage + relayMessage
 *     - m: له reply(text), react(emoji), chat (الـ jid), sender, pushName, quoted
 *
 *   ومن m نصنع m.quoted إن وجد.
 */

const fs = require('fs');
const path = require('path');

// خريطة: اسم الأمر (lowercase) → { handler, command, meta }
const yatoCommands = new Map();

// خريطة: regex / مصفوفة أوامر → { handler, meta }
const yatoRegexCommands = []; // { regex, handler, meta }

/**
 * تسجيل أمر Yato
 * @param {object} handler — function(m, ctx)
 * @param {object} meta — { command, help, tags, rowner, owner, limit }
 */
function registerYato(handler, meta) {
    if (!handler || typeof handler !== 'function') return;

    const cmds = meta.command;
    if (cmds instanceof RegExp) {
        yatoRegexCommands.push({ regex: cmds, handler, meta });
        // سجل كل help strings أيضاً عشان يظهروا في القائمة
        const helpList = Array.isArray(meta.help) ? meta.help : (meta.help ? [meta.help] : []);
        for (const h of helpList) {
            if (!yatoCommands.has(String(h).toLowerCase())) {
                yatoCommands.set(String(h).toLowerCase(), { handler, meta, isRegex: true });
            }
        }
        return;
    }

    const list = Array.isArray(cmds) ? cmds : (cmds ? [cmds] : []);
    for (const c of list) {
        const key = String(c).toLowerCase();
        yatoCommands.set(key, { handler, meta, isRegex: false });
    }

    // أضف help strings كأسماء أوامر إضافية
    const helpList = Array.isArray(meta.help) ? meta.help : (meta.help ? [meta.help] : []);
    for (const h of helpList) {
        const k = String(h).toLowerCase();
        if (!yatoCommands.has(k)) {
            yatoCommands.set(k, { handler, meta, isRegex: false });
        }
    }
}

/**
 * تبحث عن handler لأمر معين
 * @param {string} commandText — نص الأمر كما كتبه المستخدم
 * @returns {handler|null}
 */
function findYatoHandler(commandText) {
    if (!commandText) return null;
    const lower = commandText.toLowerCase();

    // 1. بحث مباشر في خريطة الأسماء
    if (yatoCommands.has(lower)) {
        return yatoCommands.get(lower);
    }

    // 2. بحث بالـ regex
    for (const entry of yatoRegexCommands) {
        if (entry.regex.test(commandText)) {
            return { handler: entry.handler, meta: entry.meta, isRegex: true };
        }
    }

    return null;
}

/**
 * بناء كائن `m` (message) متوافق مع Baileys/mhandler
 * @param {object} sock
 * @param {string} chatId
 * @param {object} message — Baileys raw message
 */
function buildM(sock, chatId, message) {
    const m = {
        chat: chatId,
        sender: message.key?.participant || message.key?.remoteJid,
        from: chatId,
        fromMe: message.key?.fromMe || false,
        key: message.key,
        pushName: message.pushName || '',
        user: message.key?.participant || message.key?.remoteJid,
        message: message.message || {},

        // helpers
        reply: async (text, options = {}) => {
            return sock.sendMessage(chatId, { text, ...options }, { quoted: message });
        },

        react: async (emoji) => {
            try {
                await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
            } catch (e) { console.error('[yatoAdapter] react error:', e.message); }
        },

        // m.quoted: لو فيه رسالة مقتبسة، نبني لها m مبسط
        quoted: null,
    };

    // بناء m.quoted لو الرسالة الأصلية quoted حد
    try {
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo ||
                        message.message?.imageMessage?.contextInfo ||
                        message.message?.videoMessage?.contextInfo;
        if (ctxInfo?.quotedMessage) {
            m.quoted = {
                chat: ctxInfo.participant || chatId,
                sender: ctxInfo.participant || chatId,
                text: ctxInfo.quotedMessage.conversation ||
                      ctxInfo.quotedMessage.extendedTextMessage?.text ||
                      '',
                message: ctxInfo.quotedMessage,
                reply: async (text, options = {}) => {
                    // ما نقدرش quote الـ quoted نفسه بسهولة، فنبعت في الشات
                    return sock.sendMessage(chatId, { text, ...options });
                },
            };
        }
    } catch (e) { /* ignore */ }

    return m;
}

/**
 * بناء كائن `conn` متوافق — مشتق من sock
 */
function buildConn(sock) {
    return {
        // sendMessage نفسه
        sendMessage: sock.sendMessage.bind(sock),

        // relayMessage نفسه
        relayMessage: sock.relayMessage ? sock.relayMessage.bind(sock) : async () => {},

        // user
        user: sock.user,

        // decodeJid helper
        decodeJid: (jid) => jid,

        // getName helper
        getName: (jid) => {
            try {
                const num = String(jid).split('@')[0];
                return num;
            } catch { return 'مستخدم'; }
        },
    };
}

/**
 * استخراج النص من message (للأمر)
 */
function getFullText(message) {
    if (!message?.message) return '';
    return (
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption ||
        ''
    ).toString();
}

/**
 * قراءة الخصائص المرفقة على function (handler.command, handler.help, ...)
 * لأن الإضافات بتعمل `handler.command = [...]` وده مش بيظهر مع spread على الـ function.
 */
function readFunctionProps(fn) {
    if (typeof fn !== 'function') return {};
    const props = {};
    const KEYS = ['command', 'help', 'tags', 'rowner', 'owner', 'limit', 'premium', 'admin', 'group', 'private', 'description'];
    for (const k of KEYS) {
        if (fn[k] !== undefined) props[k] = fn[k];
    }
    // اقرأ كل الخصائص المخصصة (own enumerable) كمان
    try {
        const allKeys = Object.getOwnPropertyNames(fn).concat(Object.keys(fn));
        for (const k of allKeys) {
            if (k === 'length' || k === 'name' || k === 'prototype' || k === 'caller' || k === 'arguments') continue;
            if (props[k] === undefined && fn[k] !== undefined) {
                props[k] = fn[k];
            }
        }
    } catch (_) {}
    return props;
}

/**
 * تحميل كل إضافات Yato من eplugins/yato/
 * كل ملف لازم يكون CommonJS مع `module.exports = { handler, ...meta }`
 * أو ESM مع `export default handler` + `handler.command = ...`
 *
 * هذا الـ loader يدعم ESM ديناميكياً عبر import().
 */
async function loadYatoPlugins(dir) {
    const targetDir = dir || path.join(__dirname, '../eplugins');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log('[yatoAdapter] مجلد eplugins/ غير موجود — تم إنشاؤه');
        return;
    }

    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.js'));
    console.log(`[yatoAdapter] محاولة تحميل ${files.length} إضافة Yato من ${targetDir}`);

    let loaded = 0;
    for (const file of files) {
        const fullPath = path.join(targetDir, file);
        try {
            // جرّب CommonJS أولاً
            let handler = null;
            let meta = null;

            try {
                delete require.cache[require.resolve(fullPath)];
                const mod = require(fullPath);
                if (typeof mod === 'function') {
                    handler = mod;
                    // اقرأ الخصائص المرفقة على الـ function نفسها (handler.command, handler.help, ...)
                    meta = readFunctionProps(mod);
                } else if (typeof mod?.default === 'function') {
                    handler = mod.default;
                    meta = readFunctionProps(mod.default);
                } else if (typeof mod?.handler === 'function') {
                    handler = mod.handler;
                    meta = { ...readFunctionProps(mod.handler), ...mod };
                    delete meta.handler;
                }
            } catch (requireErr) {
                // مش CommonJS — جرّب ESM
                if (requireErr.code === 'ERR_REQUIRE_ESM' || String(requireErr.message).includes('Cannot use import statement')) {
                    const mod = await import('file://' + fullPath);
                    if (typeof mod?.default === 'function') {
                        handler = mod.default;
                        meta = readFunctionProps(mod.default);
                    } else if (typeof mod?.default?.handler === 'function') {
                        handler = mod.default.handler;
                        meta = { ...readFunctionProps(mod.default.handler), ...mod.default };
                        delete meta.handler;
                    }
                } else {
                    throw requireErr;
                }
            }

            if (!handler) {
                console.warn(`[yatoAdapter] تعذّر إيجاد handler في ${file}`);
                continue;
            }

            // meta.command إلزامي — لو مش موجود، نستخدم help أو اسم الملف
            if (!meta.command) {
                const helpList = Array.isArray(meta.help) ? meta.help : (meta.help ? [meta.help] : []);
                if (helpList.length > 0) {
                    meta.command = helpList;
                } else {
                    meta.command = [path.basename(file, '.js')];
                }
            }

            registerYato(handler, meta);
            loaded++;
            console.log(`[yatoAdapter] ✅ ${file} (${describeCommands(meta)})`);
        } catch (err) {
            console.error(`[yatoAdapter] ❌ فشل تحميل ${file}:`, err.message);
        }
    }

    console.log(`[yatoAdapter] تم تحميل ${loaded}/${files.length} إضافة Yato بنجاح`);
}

function describeCommands(meta) {
    if (meta.command instanceof RegExp) return `regex: ${meta.command}`;
    if (Array.isArray(meta.command)) return meta.command.join(', ');
    return String(meta.command || '');
}

/**
 * إرجاع قائمة بكل أوامر Yato لعرضها في القائمة
 */
function getYatoCommandList() {
    const result = [];
    const seen = new Set();
    for (const [cmd, { meta }] of yatoCommands.entries()) {
        // تجنّب التكرار — خذ أول اسم من كل meta
        let displayName;
        if (Array.isArray(meta.command) && meta.command.length > 0) {
            displayName = meta.command[0];
        } else if (meta.command instanceof RegExp) {
            // خذ أول help بدل regex
            displayName = Array.isArray(meta.help) ? meta.help[0] : (meta.help || cmd);
        } else {
            displayName = cmd;
        }

        const key = String(displayName).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const tags = Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : ['general']);
        const category = mapTagToCategory(tags[0] || 'general');

        result.push({
            command: String(displayName).toLowerCase(),
            description: meta.description || meta.help || 'إضافة Yato',
            category,
            hidden: false,
        });
    }
    return result;
}

function mapTagToCategory(tag) {
    const t = String(tag || '').toLowerCase();
    if (['game', 'games', 'ألعاب', 'لعبة'].includes(t)) return 'games';
    if (['downloader', 'download', 'تحميل'].includes(t)) return 'download';
    if (['tools', 'أدوات', 'أداة'].includes(t)) return 'tools';
    if (['owner', 'مالك'].includes(t)) return 'owner';
    if (['group', 'مجموعة'].includes(t)) return 'group';
    if (['fun', 'تسلية'].includes(t)) return 'fun';
    if (['ai', 'ذكاء'].includes(t)) return 'ai';
    if (['religion', 'دين'].includes(t)) return 'religion';
    if (['photo', 'صور'].includes(t)) return 'photo';
    if (['text', 'نص'].includes(t)) return 'text';
    if (['general', 'عام'].includes(t)) return 'general';
    return 'general';
}

module.exports = {
    loadYatoPlugins,
    findYatoHandler,
    buildM,
    buildConn,
    getFullText,
    getYatoCommandList,
    yatoCommands,
};
