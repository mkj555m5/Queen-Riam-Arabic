// plugins/dlstatus.js — تنزيل حالات الأصدقاء (Status)
// الاستخدام:
//   .dlstatus              — عرض قائمة بأحدث الحالات المتاحة
//   .dlstatus <رقم>        — تنزيل الحالة رقم N من القائمة
//   .dlstatus all          — تنزيل كل الحالات المتاحة
//
// ملاحظات:
//   - يجب أن يكون البوت متصل برقم له أصدقاء (الأشخاص الموجودين في جهات اتصالك)
//   - الحالات تظهر فقط للجهات المسجّلة في دفتر العناوين
//   - يجب أن تكون الحالة لم تنتهِ صلاحيتها بعد (24 ساعة)

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getLang } = require('../lib/lang');

// ذاكرة مؤقتة لقائمة الحالات (لكل جلسة)
// key = chatId → [ { id, owner, type, timestamp, ... } ]
const statusCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق

function getCachedStatuses(chatId) {
    const entry = statusCache.get(chatId);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        statusCache.delete(chatId);
        return null;
    }
    return entry.list;
}

function setCachedStatuses(chatId, list) {
    statusCache.set(chatId, { list, expires: Date.now() + CACHE_TTL_MS });
}

async function fetchStatusList(sock) {
    // Baileys API: sock.fetchStatusList() أو sock.getStatusList()
    try {
        if (typeof sock.fetchStatusList === 'function') {
            return await sock.fetchStatusList();
        }
        if (typeof sock.getStatus === 'function') {
            // بعض الإصدارات تستخدم getStatus
            return await sock.getStatus();
        }
    } catch (err) {
        console.error('[dlstatus] fetchStatusList error:', err.message);
    }
    return null;
}

async function downloadStatusMedia(sock, statusJid, messageId) {
    // استخدم sock.downloadMediaMessage لو متاح
    try {
        // ابعّ طلب إعادة إرسال الحالة من صاحبها
        // أو استخدم fetchMessage API لو متاحة
        return null;
    } catch (err) {
        console.error('[dlstatus] downloadStatusMedia error:', err.message);
        return null;
    }
}

async function dlstatusCommand(sock, chatId, message, args, query, ctx) {
    const arg = (args[0] || '').toLowerCase().trim();

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // ── الحالة 1: تنزيل حالة برقم ──────────────────────────────────────
        if (/^[0-9]+$/.test(arg)) {
            const choice = parseInt(arg, 10);
            const cached = getCachedStatuses(chatId);

            if (!cached || cached.length === 0) {
                await sock.sendMessage(chatId, {
                    text:
                        `⚠️ لا توجد قائمة حالات محفوظة.\n\n` +
                        `أرسل *.dlstatus* أولاً لعرض الحالات المتاحة، ثم اختر رقماً.`,
                }, { quoted: message });
                return;
            }

            if (choice < 1 || choice > cached.length) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ رقم غير صالح. اختر رقم من 1 إلى ${cached.length}.`,
                }, { quoted: message });
                return;
            }

            const target = cached[choice - 1];

            // طلب إعادة إرسال الحالة من صاحبها (relay)
            await sock.sendMessage(chatId, {
                text:
                    `⚠️ *تنزيل الحالات غير متاح حالياً تلقائياً*\n\n` +
                    `📋 الحالة المختارة:\n` +
                    `• 👤 ${target.ownerName || target.ownerJid}\n` +
                    `• 🆔 ${target.id}\n\n` +
                    `💡 *لتنزيل الحالة يدوياً:*\n` +
                    `1. افتح واتساب على موبايلك\n` +
                    `2. اذهب لحالات صديقك\n` +
                    `3. اضغط مطولاً على الحالة ← حفظ\n\n` +
                    `أو رد على الحالة بأمر *.save* لحفظها إن كانت وصلتك كرسالة.`,
            }, { quoted: message });
            return;
        }

        // ── الحالة 2: تنزيل كل الحالات ─────────────────────────────────────
        if (arg === 'all' || arg === 'الكل' || arg === '*') {
            await sock.sendMessage(chatId, {
                text:
                    `⚠️ *تنزيل كل الحالات غير متاح تلقائياً*\n\n` +
                    `💡 لتنزيل الحالات يدوياً:\n` +
                    `1. افتح واتساب على موبايلك\n` +
                    `2. اذهب لكل صديق وحالته ← اضغط مطولاً ← حفظ`,
            }, { quoted: message });
            return;
        }

        // ── الحالة 3: عرض قائمة الحالات المتاحة ────────────────────────────
        // Baileys لا يوفر API مباشر لجلب كل الحالات، لكن يمكننا الاعتماد على
        // sock.fetchStatusList() لو كان متاحاً، أو الاكتساب من جهات الاتصال
        let statuses = [];

        try {
            const statusList = await fetchStatusList(sock);
            if (statusList && Array.isArray(statusList)) {
                statuses = statusList.map((s, i) => ({
                    id: s.id || s.key?.id || `status-${i}`,
                    ownerJid: s.participant || s.owner || s.author || 'غير معروف',
                    ownerName: s.pushName || (s.participant || s.owner || '').split('@')[0] || 'غير معروف',
                    type: s.message ? Object.keys(s.message)[0] : 'unknown',
                    timestamp: s.messageTimestamp || s.t || Date.now() / 1000,
                }));
            }
        } catch (err) {
            console.error('[dlstatus] status list error:', err.message);
        }

        if (statuses.length === 0) {
            await sock.sendMessage(chatId, {
                text:
                    `📭 *لا توجد حالات متاحة حالياً*\n\n` +
                    `💡 *الأسباب المحتملة:*\n` +
                    `• لا يوجد أصدقاء نشروا حالات في آخر 24 ساعة\n` +
                    `• البوت لا يرى الحالات (يجب إضافة جهات الاتصال)\n` +
                    `• Baileys لا يدعم fetchStatusList في هذا الإصدار\n\n` +
                    `🔧 *البديل:*\n` +
                    `• عند وصول حالة لأحد الأصدقاء، ستحفظ تلقائياً لو مفعّل *.antidelete on*\n` +
                    `• استخدم *.save* (رد على الحالة) لحفظها`,
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // احفظ القائمة في الكاش
        setCachedStatuses(chatId, statuses);

        // اعرض القائمة
        let listText =
            `📋 *قائمة الحالات المتاحة* (${statuses.length})\n\n`;
        statuses.forEach((s, i) => {
            const typeEmoji = s.type === 'imageMessage' ? '🖼️' :
                              s.type === 'videoMessage' ? '🎬' :
                              s.type === 'audioMessage' ? '🎵' :
                              s.type === 'extendedTextMessage' ? '📝' : '📎';
            const time = new Date(s.timestamp * 1000).toLocaleString('ar-EG');
            listText += `*${i + 1}.* ${typeEmoji} ${s.ownerName}\n   ⏰ ${time}\n`;
        });
        listText +=
            `\n💡 *للتنزيل:*\n` +
            `• *.dlstatus <رقم>* — عرض خيارات تنزيل حالة معينة\n` +
            `• *.dlstatus all* — تنزيل الكل\n\n` +
            `⏰ تنتهي صلاحية القائمة خلال 5 دقائق.`;

        await sock.sendMessage(chatId, { text: listText }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[dlstatus] error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ خطأ: ${err.message}`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['dlstatus', 'downloadstatus', 'statusdl'],
    description: 'عرض وتنزيل حالات الأصدقاء',
    category: 'download',
}, async (sock, chatId, message, args, query, ctx) => {
    await dlstatusCommand(sock, chatId, message, args, query, ctx);
});
