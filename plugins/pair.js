// plugins/pair.js — ربط/إلغاء ربط/قائمة المستخدمين المرتبطين
// الاستخدام:
//   .pair <number> [name]    — ربط رقم جديد (مع اسم اختياري للمراقبة)
//   .pair list               — عرض كل المستخدمين المرتبطين بأسمائهم
//   .pair unpair <name|number> — إزالة ربط مستخدم
//   .pair status             — عرض حالة كل الجلسات النشطة
//
// مثال:
//   .pair 201270221257 احمد   ← يربط رقم أحمد ويخزن الاسم "احمد"
//   .pair list               ← يعرض: [1] احمد - +201270221257 - ✅ متصل
//   .pair unpair احمد         ← يزيل ربط أحمد

const fs = require('fs');
const path = require('path');
const { hasOwnerPrivileges } = require('./sudo');
const { getLang } = require('../lib/lang');
const { generatePairingCode, getActiveSessions } = require('../lib/sessionManager');
const { isButtonModeOn } = require('../lib/buttonHelper');

let sendButtons;
try {
    sendButtons = require('kango-wa').sendButtons;
} catch (_) {
    sendButtons = null;
}

// ── تخزين المستخدمين المرتبطين (مع الأسماء) ────────────────────────────────────
const USERS_FILE = path.join(__dirname, '..', 'data', 'paired_users.json');

function loadPairedUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (err) {
        console.error('[pair] loadPairedUsers error:', err.message);
        return {};
    }
}

function savePairedUsers(users) {
    try {
        const dir = path.dirname(USERS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('[pair] savePairedUsers error:', err.message);
    }
}

function addPairedUser(number, name) {
    const users = loadPairedUsers();
    users[number] = {
        name: name || `مستخدم ${number.slice(-4)}`,
        number,
        addedAt: new Date().toISOString(),
    };
    savePairedUsers(users);
}

function removePairedUser(identifier) {
    const users = loadPairedUsers();
    // ابحث بالرقم أو بالاسم
    let removedKey = null;
    if (users[identifier]) {
        removedKey = identifier;
        delete users[identifier];
    } else {
        // ابحث بالاسم (case insensitive)
        for (const [num, info] of Object.entries(users)) {
            if (info.name && info.name.toLowerCase() === identifier.toLowerCase()) {
                removedKey = num;
                delete users[num];
                break;
            }
        }
    }
    if (removedKey) {
        savePairedUsers(users);
        return removedKey;
    }
    return null;
}

function findPairedUser(identifier) {
    const users = loadPairedUsers();
    if (users[identifier]) return { ...users[identifier] };
    for (const [num, info] of Object.entries(users)) {
        if (info.name && info.name.toLowerCase() === identifier.toLowerCase()) {
            return { ...info };
        }
    }
    return null;
}

// ── إزالة مجلد الجلسة من السيرفر ──────────────────────────────────────────────
function deleteSessionDir(number) {
    try {
        const sessionDir = path.join(__dirname, '..', 'session', number);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            return true;
        }
    } catch (err) {
        console.error('[pair] deleteSessionDir error:', err.message);
    }
    return false;
}

// ── الأمر الرئيسي ──────────────────────────────────────────────────────────────
async function pairCommand(sock, chatId, message, args, query, ctx) {
    const t = getLang(sock);
    const senderJid = ctx?.sender || message.key.participant || message.key.remoteJid;
    const sessionNumber = ctx?.sessionNumber || sock._sessionNumber;

    // التحقق من صلاحيات المالك
    if (!hasOwnerPrivileges(senderJid, message, sock.user?.id, sessionNumber)) {
        await sock.sendMessage(chatId, { text: t.pair_owner_only }, { quoted: message });
        return;
    }

    const sub = (args[0] || '').toLowerCase();
    const arg1 = args[1] || '';
    const arg2 = args[2] || '';

    // ── .pair list — عرض كل المستخدمين المرتبطين ───────────────────────────
    if (sub === 'list' || sub === 'ls') {
        await showPairedUsersList(sock, chatId, message);
        return;
    }

    // ── .pair status — حالة الجلسات النشطة ──────────────────────────────────
    if (sub === 'status' || sub === 'state') {
        await showSessionsStatus(sock, chatId, message);
        return;
    }

    // ── .pair unpair <name|number> — إزالة ربط ─────────────────────────────
    if (sub === 'unpair' || sub === 'remove' || sub === 'rm' || sub === 'del') {
        await unpairUser(sock, chatId, message, arg1);
        return;
    }

    // ── .pair <number> [name] — ربط جديد ──────────────────────────────────────
    const raw = (args[0] || '').replace(/\D/g, '');
    const name = args.slice(1).join(' ').trim();

    if (!raw || raw.length < 7 || raw.length > 15) {
        await sock.sendMessage(chatId, {
            text:
                `🔗 *أمر ربط Queen Riam*\n\n` +
                `*طريقة الاستخدام:*\n` +
                `• *.pair <number> [name]* — ربط رقم جديد مع اسم\n` +
                `• *.pair list* — عرض كل المستخدمين المرتبطين\n` +
                `• *.pair status* — عرض حالة الجلسات النشطة\n` +
                `• *.pair unpair <name|number>* — إزالة ربط مستخدم\n\n` +
                `*مثال:*\n` +
                `• *.pair 201270221257 احمد*\n` +
                `• *.pair unpair احمد*`,
        }, { quoted: message });
        return;
    }

    await pairNewUser(sock, chatId, message, raw, name);
}

// ── ربط مستخدم جديد ────────────────────────────────────────────────────────────
async function pairNewUser(sock, chatId, message, number, name) {
    const t = getLang(sock);

    await sock.sendMessage(chatId, {
        text: `⏳ *جاري توليد رمز الربط للرقم:* +${number}\n${name ? `📝 الاسم: *${name}*\n` : ''}من فضلك انتظر لحظة...`,
    }, { quoted: message });

    try {
        const code = await generatePairingCode(number);

        if (!code) {
            // الرقم مسجل بالفعل
            const userInfo = findPairedUser(number) || {};
            const displayName = userInfo.name || name || `مستخدم ${number.slice(-4)}`;
            await sock.sendMessage(chatId, {
                text: `✅ الرقم *+${number}* (${displayName}) مرتبط بالفعل بالبوت!`,
            }, { quoted: message });
            return;
        }

        // احفظ المستخدم في القائمة (مع الاسم)
        const finalName = name || `مستخدم ${number.slice(-4)}`;
        addPairedUser(number, finalName);

        const response = t.pair_success
            .replace(/\{number\}/g, number)
            .replace('{code}', code);

        // أضف الاسم للرسالة
        const fullResponse =
            `🔗 *رمز ربط جديد*\n\n` +
            `👤 الاسم: *${finalName}*\n` +
            `📱 الرقم: +${number}\n\n` +
            `🔑 *الرمز:* \`${code}\`\n\n` +
            `📋 *الخطوات:*\n` +
            `1. افتح واتساب على موبايلك +${number}\n` +
            `2. اذهب إلى ⋮ ← الأجهزة المرتبطة ← ربط جهاز\n` +
            `3. اضغط *الربط برقم الهاتف بدلاً من ذلك*\n` +
            `4. أدخل الرمز بالأعلى\n\n` +
            `⏰ ينتهي الرمز خلال *3 دقائق*.\n\n` +
            `👑 Queen Riam`;

        if (isButtonModeOn() && sendButtons) {
            try {
                await sendButtons(sock, chatId, {
                    text: fullResponse,
                    footer: '© Queen Riam',
                    buttons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 نسخ الرمز',
                                copy_code: code,
                            }),
                        },
                    ],
                });
            } catch (_) {
                await sock.sendMessage(chatId, { text: fullResponse }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: fullResponse }, { quoted: message });
        }
    } catch (err) {
        if (err.message === 'ALREADY_ACTIVE') {
            await sock.sendMessage(chatId, {
                text: t.pair_already_active.replace('{number}', number),
            }, { quoted: message });
        } else {
            console.error('[pair] error:', err);
            await sock.sendMessage(chatId, {
                text: `❌ *فشل توليد رمز الربط*\n\n> السبب: ${err.message}`,
            }, { quoted: message });
        }
    }
}

// ── إزالة ربط مستخدم ────────────────────────────────────────────────────────────
async function unpairUser(sock, chatId, message, identifier) {
    const t = getLang(sock);

    if (!identifier) {
        await sock.sendMessage(chatId, {
            text:
                `⚠️ الصيغة: *.pair unpair <name|number>*\n\n` +
                `*مثال:*\n` +
                `• *.pair unpair احمد*\n` +
                `• *.pair unpair 201270221257*`,
        }, { quoted: message });
        return;
    }

    // نظّف الـ identifier (ممكن يكون رقم بنمط مختلف)
    const cleanId = identifier.replace(/[^0-9a-zA-Z\u0600-\u06FF]/g, '');

    // ابحث في القائمة
    const userInfo = findPairedUser(identifier) || findPairedUser(cleanId);
    if (!userInfo) {
        await sock.sendMessage(chatId, {
            text: `❌ لم يتم العثور على مستخدم بالاسم أو الرقم: *${identifier}*`,
        }, { quoted: message });
        return;
    }

    const number = userInfo.number;
    const displayName = userInfo.name || `مستخدم ${number.slice(-4)}`;

    // احذف من قائمة المستخدمين
    const removedKey = removePairedUser(identifier) || removePairedUser(cleanId);

    // احذف مجلد الجلسة
    const sessionDeleted = deleteSessionDir(number);

    await sock.sendMessage(chatId, {
        text:
            `✅ *تم إزالة الربط بنجاح*\n\n` +
            `👤 الاسم: *${displayName}*\n` +
            `📱 الرقم: +${number}\n` +
            `🗑️ الجلسة: ${sessionDeleted ? 'تم حذفها ✅' : 'لم تكن موجودة ⚠️'}\n\n` +
            `> سيحتاج ${displayName} إلى رمز ربط جديد لإعادة الاتصال.`,
    }, { quoted: message });
}

// ── عرض قائمة المستخدمين المرتبطين ────────────────────────────────────────────
async function showPairedUsersList(sock, chatId, message) {
    const users = loadPairedUsers();
    const nums = Object.keys(users);

    if (nums.length === 0) {
        await sock.sendMessage(chatId, {
            text:
                `📭 *لا يوجد مستخدمون مرتبطون بعد*\n\n` +
                `استخدم *.pair <number> [name]* لربط مستخدم جديد.\n` +
                `مثال: *.pair 201270221257 احمد*`,
        }, { quoted: message });
        return;
    }

    const active = getActiveSessions();

    let text = `👥 *المستخدمون المرتبطون* (${nums.length})\n\n`;
    nums.forEach((num, i) => {
        const info = users[num];
        const isActive = active.includes(num);
        const status = isActive ? '✅ متصل' : '❌ غير متصل';
        const addedAt = new Date(info.addedAt).toLocaleDateString('ar-EG');
        text +=
            `*${i + 1}.* ${info.name || 'مستخدم'}\n` +
            `   📱 +${num}\n` +
            `   🟢 ${status}\n` +
            `   📅 ${addedAt}\n\n`;
    });

    text +=
        `💡 *لإزالة ربط:*\n` +
        `• *.pair unpair <name|number>*\n\n` +
        `💡 *لعرض حالة الجلسات:*\n` +
        `• *.pair status*`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ── عرض حالة الجلسات النشطة (مراقبة) ────────────────────────────────────────────
async function showSessionsStatus(sock, chatId, message) {
    const users = loadPairedUsers();
    const active = getActiveSessions();
    const botId = sock.user?.id || '';

    if (active.length === 0) {
        await sock.sendMessage(chatId, {
            text:
                `📭 *لا توجد جلسات نشطة حالياً*\n\n` +
                `> البوت الأساسي متصل برقم: +${botId.split('@')[0].split(':')[0]}`,
        }, { quoted: message });
        return;
    }

    let text = `📊 *حالة الجلسات النشطة* (${active.length})\n\n`;
    active.forEach((num, i) => {
        const info = users[num] || { name: `مستخدم ${num.slice(-4)}` };
        text +=
            `*${i + 1}.* ${info.name}\n` +
            `   📱 +${num}\n` +
            `   🟢 نشط\n\n`;
    });

    // معلومات إضافية عن البوت الأساسي
    text +=
        `━━━━━━━━━━━━━━━━━\n` +
        `🤖 *البوت الأساسي:*\n` +
        `📱 +${botId.split('@')[0].split(':')[0]}\n` +
        `🟢 نشط\n\n` +
        `💡 *لإزالة ربط:*\n` +
        `• *.pair unpair <name|number>*`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['pair'],
    description: 'ربط/إلغاء ربط/قائمة المستخدمين المرتبطين',
    category: 'owner',
}, async (sock, chatId, message, args, query, ctx) => {
    await pairCommand(sock, chatId, message, args, query, ctx);
});
