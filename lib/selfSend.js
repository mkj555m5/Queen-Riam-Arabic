'use strict';
/**
 * lib/selfSend.js — إرسال رسالة إلى محادثة الجلسة نفسها («Message yourself»)
 *
 * sock.user.id يحمل لاحقة الجهاز (‎:54@s.whatsapp.net) — الإرسال إليها غير موثوق.
 * الصحيح: الرقم النظيف @s.whatsapp.net، مع بدائل (lid) وإعادة محاولات متعددة
 * حتى لا يضيع الرمز السري بعد الربط بسبب أي تعثر عابر في واجهة واتساب.
 */

let _delay = (ms) => new Promise(r => setTimeout(r, ms));
try {
    // استخدم delay من Baileys إن توفرت (نفس السلوك)
    _delay = require('@whiskeysockets/baileys').delay || _delay;
} catch (_) {}

/**
 * قائمة عناوين JID المرشحة للإرسال الذاتي (مرتبة من الأصلم للأقل)
 */
function selfJidCandidates(sock, cleanNumber) {
    const candidates = [];
    const push = (jid) => {
        if (!jid) return;
        let j = String(jid).split(':')[0].trim();
        if (!j) return;
        if (!j.includes('@')) j = j + '@s.whatsapp.net';
        if (!candidates.includes(j)) candidates.push(j);
    };
    push(cleanNumber + '@s.whatsapp.net');   // الأصح والأسلم (محادثة «رسالة لنفسك»)
    push(sock.user?.id);                     // احتياط: منزوع لاحقة الجهاز
    push(sock.user?.lid);                    // احتياط: حسابات LID الجديدة
    return candidates;
}

/**
 * إرسال نص إلى محادثة الجلسة نفسها مع إعادة محاولات (4 محاولات × تباعد 3 ثوان).
 * @returns {Promise<boolean>} نجاح الإرسال
 */
async function sendSelfMessage(sock, cleanNumber, text) {
    const jids = selfJidCandidates(sock, cleanNumber);
    const MAX_TRIES = 4;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        for (const jid of jids) {
            try {
                await sock.sendMessage(jid, { text });
                console.log(`[pair] ✉️ تم الإرسال إلى ${jid} (المحاولة ${attempt})`);
                return true;
            } catch (err) {
                console.error(`[pair] محاولة إرسال ${attempt}/${MAX_TRIES} إلى ${jid} فشلت:`, err.message);
            }
        }
        if (attempt < MAX_TRIES) await _delay(3000);
    }
    return false;
}

module.exports = { selfJidCandidates, sendSelfMessage };
