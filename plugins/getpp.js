// plugins/getpp.js — استخراج صورة البروفايل
// الاستخدام:
//   .getpp              (رد على رسالة الشخص) — يجلب صورة الشخص المردود عليه
//   .getpp @target      (mention) — يجلب صورة الشخص المذكور
//   .getpp 201270221253 (رقم) — يجلب صورة الشخص صاحب الرقم
//   .getpp 201270221253@s.whatsapp.net — نفس الشيء

'use strict';

const { getLang } = require('../lib/lang');
const { bot } = require('../lib/pluginLoader');

// تحويل رقم إلى JID صالح لواتساب
function normalizeToJid(input) {
    if (!input) return null;
    let s = String(input).trim();

    // لو JID كامل
    if (s.includes('@s.whatsapp.net') || s.includes('@lid')) {
        return s.split(':')[0]; // اشيل :device لو موجود
    }

    // لو رقم فقط — نظّفه من أي رموز
    const digits = s.replace(/[^0-9]/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    return digits + '@s.whatsapp.net';
}

async function getppCommand(sock, chatId, message, args, query, ctx) {
    const t = getLang(sock);
    const msgCtx = message.message?.extendedTextMessage?.contextInfo;

    // 1) mention أولاً
    let target = msgCtx?.mentionedJid?.[0];

    // 2) رد على رسالة شخص
    if (!target) {
        target = msgCtx?.participant;
    }

    // 3) رقم كـ argument
    if (!target && args[0]) {
        const jid = normalizeToJid(args[0]);
        if (jid) {
            target = jid;
        } else {
            await sock.sendMessage(chatId, {
                text:
                    `❌ رقم غير صالح.\n\n` +
                    `*طريقة الاستخدام:*\n` +
                    `• *.getpp* (رد على رسالة الشخص)\n` +
                    `• *.getpp @target* (mention)\n` +
                    `• *.getpp 201270221253* (رقم دولي بدون +)\n\n` +
                    `📝 مثال: *.getpp 201270221253*`,
            }, { quoted: message });
            return;
        }
    }

    if (!target) {
        await sock.sendMessage(chatId, {
            text:
                `⚠️ من فضلك حدد المستخدم:\n\n` +
                `*طريقة الاستخدام:*\n` +
                `• *.getpp* (رد على رسالة الشخص)\n` +
                `• *.getpp @target* (mention)\n` +
                `• *.getpp 201270221253* (رقم دولي بدون +)\n\n` +
                `📝 مثال: *.getpp 201270221253*`,
        }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const picUrl = await sock.profilePictureUrl(target, 'image');

        const cleanNum = target.split('@')[0];
        const caption =
            `🖼️ *صورة البروفايل*\n\n` +
            `👤 المستخدم: @${cleanNum}\n` +
            `🔗 JID: ${target}\n\n` +
            `> *Queen Riam*`;

        await sock.sendMessage(chatId, {
            image: { url: picUrl },
            caption,
            mentions: [target],
        });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error('[getpp] error:', err.message);
        await sock.sendMessage(chatId, {
            text:
                `❌ *تعذر جلب صورة البروفايل*\n\n` +
                `> السبب: ${err.message || 'غير معروف'}\n\n` +
                `💡 الأسباب المحتملة:\n` +
                `• المستخدم ليس لديه صورة بروفايل\n` +
                `• المستخدم أخفى صورته من الإعدادات\n` +
                `• الرقم غير مسجل على واتساب`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}


bot({
    command: ['getpp', 'pp', 'profilepic'],
    description: 'استخراج صورة البروفايل (رد/mention/رقم)',
    category: 'general',
}, async (sock, chatId, message, args, query, ctx) => {
    await getppCommand(sock, chatId, message, args, query, ctx);
});
