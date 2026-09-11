'use strict';
/**
 * جسر توافق Rimuru MD ↔ Queen Riam
 * ينفّذ بلوجنات Rimuru (ESM داخل rimuru_core/) عبر واجهة Queen:
 * - يبني كائن m الكامل المتوقع في بلوجنات Rimuru
 * - يمدّ sock بـ sendMedia/sendButton/sendPreview
 * - يهيئ المتغيرات العامة (global.db, global.APIs, جلسات الألعاب...)
 * - يوجّه إجابات الألعاب (routeAnswer) إلى answerHandler المناسب
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const CORE_ROOT = path.join(__dirname, '..', 'rimuru_core');
const CORE_URL = pathToFileURL(CORE_ROOT + path.sep).href;

const moduleCache = new Map();
const extendedSocks = new WeakSet();
let dbInitPromise = null;
let configPromise = null;
let answerModulesPromise = null;

function loadCoreModule(relPath) {
    const rel = String(relPath).split(path.sep).join('/');
    const url = CORE_URL + rel;
    if (!moduleCache.has(url)) {
        moduleCache.set(url, import(url).catch(err => {
            moduleCache.delete(url);
            throw err;
        }));
    }
    return moduleCache.get(url);
}

function getConfig() {
    if (!configPromise) configPromise = loadCoreModule('config.mjs').then(m => m.default);
    return configPromise;
}

function ensureDatabase() {
    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            try {
                const dbMod = await loadCoreModule('src/lib/rimuru-database.mjs');
                const db = await dbMod.initDatabase(path.join(CORE_ROOT, 'database'));
                global.db = db;
                global.DATABASE = db;
                return db;
            } catch (err) {
                console.error('[rimuru-bridge] تهيئة قاعدة البيانات فشلت:', err.message);
                return null;
            }
        })();
    }
    return dbInitPromise;
}

// ── المتغيرات العامة التي تتوقعها بلوجنات Rimuru بصيغة GataDio ──
const GAME_SESSION_GLOBALS = [
    'tictactoeGames', 'werewolfGames', 'akinatorSessions', 'suitGames',
    'tebakkartun', 'maths', 'tebakwarna', 'tebaksurah',
    'tebakjkt', 'ulartanggaGames', 'fstatus',
];
const GAME_SESSION_MAPS = ['aiPanggung'];  // تُستخدم كـ Map في بلوجنات Rimuru

async function initGlobals(sock) {
    for (const g of GAME_SESSION_GLOBALS) {
        if (global[g] === undefined) global[g] = {};
    }
    for (const g of GAME_SESSION_MAPS) {
        if (global[g] === undefined) global[g] = new Map();
    }
    if (global.APIs === undefined) {
        global.APIs = {
            faa: 'https://api-faa.my.id',
            lol: 'https://api.lolhuman.xyz',
            deline: 'https://api.deline.web.id',
        };
    }
    if (global.APIKeys === undefined) global.APIKeys = {};
    if (global.prems === undefined) global.prems = [];
    if (global.mods === undefined) global.mods = [];
    if (global.conn === undefined || sock) global.conn = sock || global.conn;
    try {
        const config = await getConfig();
        global.config = global.config || config;
        if (config && config.owner) {
            const nums = (config.owner.number || []).map(x => String(x).replace(/\D/g, '')).filter(Boolean);
            global.owner = global.owner || nums.map(n => [n, config.owner.name || 'Owner', true]);
            global.nomorown = global.nomorown || nums[0] || '';
            global.nameown = global.nameown || config.owner.name || 'Owner';
        }
        if (config && config.messages) {
            global.wait = global.wait || config.messages.wait || '⏳ لحظة من فضلك…';
            global.eror = global.eror || config.messages.error || '⚠️ حدث خطأ، حاول مجدداً.';
            global.success = global.success || config.messages.success || '✔ تم بنجاح.';
            global.sukses = global.success;
        }
        if (global.APIKeys[global.APIs.lol] === undefined && config && config.APIkey) {
            global.APIKeys[global.APIs.lol] = config.APIkey.lolhuman || '';
        }
        global.API = global.API || ((name, p = '/', query = {}, keyName) => {
            const base = global.APIs[name] || name;
            const q = query || keyName
                ? `?${new URLSearchParams({ ...(query || {}), ...(keyName ? { [keyName]: global.APIKeys[base] } : {}) })}`
                : '';
            return base + p + q;
        });
    } catch (_) {}
}

function extractText(message) {
    const msg = (message && message.message) || message;
    if (!msg || typeof msg !== 'object') return '';
    const inter = msg.interactiveResponseMessage && msg.interactiveResponseMessage.nativeFlowResponseMessage;
    let interText = '';
    if (inter && inter.paramsJson) {
        try { interText = JSON.parse(inter.paramsJson).easy_encoded_message || ''; } catch (_) {}
    }
    return msg.conversation
        || (msg.extendedTextMessage && msg.extendedTextMessage.text)
        || (msg.imageMessage && msg.imageMessage.caption)
        || (msg.videoMessage && msg.videoMessage.caption)
        || (msg.documentMessage && msg.documentMessage.caption)
        || (msg.documentWithCaptionMessage && msg.documentWithCaptionMessage.message
            && msg.documentWithCaptionMessage.message.documentMessage
            && msg.documentWithCaptionMessage.message.documentMessage.caption)
        || (msg.buttonsResponseMessage && msg.buttonsResponseMessage.selectedDisplayText)
        || (msg.listResponseMessage && msg.listResponseMessage.singleSelectReply
            && msg.listResponseMessage.singleSelectReply.selectedRowId)
        || interText
        || '';
}

function digits(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function ownerDigits(config) {
    const set = new Set();
    for (const own of ((config && config.owner && config.owner.number) || [])) {
        const d = String(own).replace(/[^0-9]/g, '');
        if (d) set.add(d);
    }
    try {
        const qs = require('../settings');
        if (qs.ownerNumber) set.add(String(qs.ownerNumber).replace(/[^0-9]/g, ''));
    } catch (_) {}
    return set;
}

const metaCache = { jid: null, time: 0, data: null };

async function isSenderAdmin(sock, chat, sender) {
    if (!chat || !chat.endsWith('@g.us')) return false;
    if (metaCache.jid === chat && Date.now() - metaCache.time < 60000) {
        var meta = metaCache.data;
    } else {
        try {
            var meta = await sock.groupMetadata(chat);
            metaCache.jid = chat; metaCache.time = Date.now(); metaCache.data = meta;
        } catch (_) { var meta = null; }
    }
    const sd = digits(sender);
    return !!(meta && (meta.participants || []).some(p =>
        digits(p.id) === sd && (p.admin === 'admin' || p.admin === 'superadmin')));
}

function buildM(sock, chatId, message, args, query, commandName, config) {
    const key = (message && message.key) || {};
    const chat = chatId || key.remoteJid || '';
    const fromMe = !!key.fromMe;
    const meId = String((sock.user && sock.user.id) || '').split(':')[0];
    const sender = key.participant || key.participantPty
        || (fromMe ? (meId ? meId + '@s.whatsapp.net' : chat) : chat);

    const owners = ownerDigits(config);
    const isOwner = fromMe
        || owners.has(digits(sender))
        || owners.has(digits(sock.user && sock.user.lid));

    const text = extractText(message);
    const ctx = message && message.message && message.message.extendedTextMessage
        && message.message.extendedTextMessage.contextInfo;
    const qmsg = ctx && ctx.quotedMessage;
    const quoted = qmsg ? {
        key: {
            remoteJid: (ctx.remoteJid && ctx.remoteJid !== chat) ? ctx.remoteJid : chat,
            fromMe: false,
            id: ctx.stanzaId || 'QUOTED',
            participant: ctx.participant,
        },
        message: qmsg,
        chat,
        get text() { return extractText({ message: qmsg }); },
    } : null;

    const m = {
        key,
        chat,
        id: key.id,
        fromMe,
        sender,
        pushName: (message && message.pushName) || '',
        text,
        body: text,
        args: Array.isArray(args) ? args : [],
        query: query || '',
        prefix: '.',
        usedPrefix: '.',
        command: String(commandName || '').toLowerCase()
            || text.replace(/^\./, '').split(/\s+/)[0].toLowerCase(),
        quoted,
        isGroup: chat.endsWith('@g.us'),
        isCommand: true,
        mentionedJid: (ctx && ctx.mentionedJid) || [],
        isOwner,
        isPremium: isOwner,
        reply: (txt, extra) => sock.sendMessage(chat,
            { text: typeof txt === 'string' ? txt : String(txt) },
            Object.assign({ quoted: m }, extra || {})),
        react: (emoji) => sock.sendMessage(chat,
            { react: { text: String(emoji), key } }, {}),
        isAdmin: () => isSenderAdmin(sock, chat, sender),
        isBaileys: true,
    };
    if (message && message.message) m.message = message.message;
    return m;
}

function extendSock(sock) {
    if (!sock || extendedSocks.has(sock)) return;
    extendedSocks.add(sock);

    // sock.sendMedia(jid, مصدر, تعليق, مقتبس, خيارات)
    sock.sendMedia = async function (jid, source, caption, quoted, options) {
        options = options || {};
        caption = caption == null ? '' : caption;
        if (source && typeof source === 'object' && !Buffer.isBuffer(source)
            && (source.image || source.video || source.audio || source.document)) {
            return sock.sendMessage(jid, source, Object.assign({ quoted }, options));
        }
        let data = source;
        if (typeof data === 'string' && !/^https?:\/\//.test(data)) {
            data = fs.existsSync(data) ? fs.readFileSync(data) : { url: data };
        } else if (typeof data === 'string') {
            data = { url: data };
        }
        let mediaKey = options.type || options.mediaType;
        if (!mediaKey) {
            const mime = String(options.mimetype || '');
            mediaKey = /video/.test(mime) ? 'video'
                : /audio/.test(mime) ? 'audio'
                : /image/.test(mime) ? 'image' : 'document';
        }
        const payload = {};
        if (options.mimetype) payload.mimetype = options.mimetype;
        if (options.fileName) payload.fileName = options.fileName;
        payload[mediaKey] = data;
        if (caption && (mediaKey === 'image' || mediaKey === 'video')) payload.caption = caption;
        if (mediaKey === 'audio' && options.ptt != null) payload.ptt = !!options.ptt;
        const { type, mediaType, mimetype, fileName, ptt, ...rest } = options;
        return sock.sendMessage(jid, payload, Object.assign({ quoted }, rest));
    };

    // sock.sendButton(jid, وسائط|نص, تعليق, مقتبس, { type, buttons: [...] })
    sock.sendButton = async function (jid, media, caption, quoted, options) {
        options = options || {};
        const buttons = Array.isArray(options.buttons) ? options.buttons : [];
        let hint = '';
        for (const b of buttons) {
            try {
                const params = JSON.parse(b.buttonParamsJson || '{}');
                const label = params.display_text || params.displayText || 'خيار';
                if (params.id) hint += '\n\u25B8 ' + label + ': ' + params.id;
            } catch (_) {}
        }
        const text = (caption || '') + (hint ? '\n\n*الخيارات المتاحة:*' + hint : '');
        const { type, mediaType, buttons: _b, ...rest } = options;
        const mediaKey = type || mediaType;
        if (media && typeof media === 'string' && /^https?:\/\//.test(media) && mediaKey) {
            return sock.sendMedia(jid, media, text, quoted, Object.assign(rest, { type: mediaKey }));
        }
        if (media && typeof media === 'object'
            && (media.image || media.video || media.audio || media.document)) {
            return sock.sendMessage(jid, Object.assign({}, media, { caption: text }),
                Object.assign({ quoted }, rest));
        }
        return sock.sendMessage(jid, { text }, Object.assign({ quoted }, rest));
    };

    // sock.sendPreview(jid, بطاقة, خيارات) — بطاقة معاينة (تُستخدم في الألعاب)
    sock.sendPreview = async function (jid, card, options) {
        options = options || {};
        card = card || {};
        const ctxMeta = options.contextInfo || {};
        const contextInfo = Object.assign(
            ctxMeta.mentionedJid ? { mentionedJid: ctxMeta.mentionedJid } : {}, {
            externalAdReply: {
                title: card.title || 'Rimuru MD',
                body: card.description || '',
                thumbnail: card.image || undefined,
                mediaType: 0,
                sourceUrl: card.url || undefined,
                renderLargerThumbnail: true,
            },
        });
        return sock.sendMessage(jid,
            { text: card.caption || card.title || '', contextInfo },
            { quoted: options.quoted || null });
    };
}

async function runPlugin(relPath, sock, chatId, message, args, query, commandName) {
    try {
        await ensureDatabase();
        await initGlobals(sock);
        const [config, mod] = await Promise.all([getConfig(), loadCoreModule(relPath)]);
        extendSock(sock);
        const m = buildM(sock, chatId, message, args, query, commandName, config);
        const handler = mod.handler || (mod.default && mod.default.handler) || mod.default;
        if (typeof handler !== 'function') {
            throw new Error('معالج غير موجود: ' + relPath);
        }
        const env = {
            sock, conn: sock,
            text: m.text.replace(/^\./, '').split(/\s+/).slice(1).join(' ') || query || '',
            usedPrefix: '.', prefix: '.',
            command: m.command, args: m.args, query: m.query,
            config, db: global.db || null,
            isOwner: m.isOwner, isPremium: m.isPremium, isGroup: m.isGroup,
        };
        await handler(m, env);
    } catch (err) {
        console.error('[rimuru:' + relPath + ']', err.message);
        try {
            await sock.sendMessage(chatId,
                { text: '⚠️ *حدث خطأ أثناء تنفيذ الأمر، حاول مرة أخرى لاحقاً.*' },
                { quoted: message });
        } catch (_) {}
    }
}

// ── توجيه إجابات الألعاب (رسائل بدون أمر) ──
async function getAnswerModules() {
    if (!answerModulesPromise) {
        answerModulesPromise = (async () => {
            const listPath = path.join(CORE_ROOT, 'answer_modules.json');
            const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
            const mods = [];
            for (const rel of list) {
                try { mods.push(await loadCoreModule(rel)); } catch (err) {
                    console.error('[rimuru-bridge] فشل تحميل معالج إجابة:', rel, err.message);
                }
            }
            return mods;
        })();
    }
    return answerModulesPromise;
}

async function routeAnswer(sock, chatId, message, body) {
    const text = String(body || '').trim();
    if (!text || text.startsWith('.') || text.startsWith('#') || text.startsWith('/')) return false;
    try {
        await ensureDatabase();
        await initGlobals(sock);
        const config = await getConfig();
        extendSock(sock);
        const m = buildM(sock, chatId, message, [], '', '', config);
        const mods = await getAnswerModules();
        for (const mod of mods) {
            const ah = mod.answerHandler || (mod.default && mod.default.answerHandler);
            if (typeof ah !== 'function') continue;
            try {
                const handled = await ah(m, sock);
                if (handled) return true;
            } catch (err) {
                console.error('[rimuru:answer]', err.message);
            }
        }
    } catch (err) {
        console.error('[rimuru-bridge] routeAnswer:', err.message);
    }
    return false;
}

module.exports = { runPlugin, routeAnswer, getConfig, ensureDatabase, buildM, extendSock };
