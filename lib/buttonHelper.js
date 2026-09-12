const { loadConfig } = require('./config');
const { sendButtons } = require('kango-wa');

/**
 * هل وضع الأزرار مفعّل؟
 * @param {string|null} [sessionNumber] — رقم الجلسة (بدونه = الجلسة الرئيسية)
 *   كل جلسة (رقم مرتبط) لها إعداد BUTTONMODE خاص بها في config_<رقم>.json
 */
function isButtonModeOn(sessionNumber = null) {
    try {
        const cfg = loadConfig(sessionNumber || null);
        return cfg.BUTTONMODE === 'on';
    } catch (_) {
        return false;
    }
}

/**
 * Send a message. When button mode is ON, attaches interactive quick-reply
 * buttons (kango-wa nativeFlowMessage). When OFF, sends plain text.
 *
 * ملاحظة: يقرأ وضع الأزرار من إعدادات جلسة البوت المرسل تلقائياً
 * (عبر sock._sessionNumber) — فكل بوت مرتبط له إعداداته الخاصة.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts  - { text, footer, buttons: [{ id, text }] }
 * @param {object} quoted - original message to quote (optional)
 */
async function sendButtonMessage(sock, jid, opts, quoted) {
    const { text, footer, buttons } = opts;

    const sessionNumber = sock?._sessionNumber || null;
    const hasQuickReply = (buttons || []).some(b => b.id);

    if (!isButtonModeOn(sessionNumber) || !hasQuickReply) {
        return quoted
            ? sock.sendMessage(jid, { text }, { quoted })
            : sock.sendMessage(jid, { text });
    }

    return sendButtons(sock, jid, { text, footer, buttons });
}

module.exports = { isButtonModeOn, sendButtonMessage };
