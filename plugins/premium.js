// plugins/premium.js — فحص العضوية المميزة 💎
// الاستخدام:
//   .premium          — عرض حالة عضويتك
//   .premium info     — شرح العضوية المميزة
//
// المالك يدير الترقيات من لوحة تحكم الويب (قسم المستخدمين).

const settings = require('../settings');
const membership = require('../lib/membership');

async function premiumCommand(sock, chatId, message, args, query, ctx) {
    const sender = ctx?.sender || message.key.participant || message.key.remoteJid || '';
    const senderNum = membership.normalizePhone(sender);
    const isOwner = membership.isOwnerNumber(senderNum, settings.ownerNumber);
    const user = membership.getUser(senderNum);
    const role = isOwner ? 'owner' : ((user && user.role) || 'user');

    const sub = (args[0] || '').toLowerCase();

    if (sub === 'info') {
        await sock.sendMessage(chatId, {
            text:
                `💎 *العضوية المميزة — Queen Riam*\n\n` +
                `*ماذا تفتح لك؟*\n` +
                `• كل أوامر المالك المتعلقة بالإعدادات والسلوك:\n` +
                `  (القراءة التلقائية، رفض المكالمات، وضع الأزرار، البادئة، اللغة...)\n` +
                `• التحكم في بوتك من لوحة تحكم الويب بالرقم والرمز السري\n` +
                `• أولوية الدعم من الإدارة\n\n` +
                `*ما لا تفتحه:*\n` +
                `• أوامر التحكم الكامل: sudo · pair · reloadplugins · update · clearsession\n` +
                `  (هذه للمالك فقط 👑)\n\n` +
                `*كيف تحصل عليها؟*\n` +
                `تواصل مع مالك الموقع لترقية رقمك 💎`,
        }, { quoted: message });
        return;
    }

    let text;
    if (isOwner || role === 'owner') {
        text =
            `👑 *حسابك: مالك النظام*\n\n` +
            `أنت المالك — لديك كل الصلاحيات بدون استثناء:\n` +
            `• كل الأوامر بما فيها أوامر التحكم الكامل\n` +
            `• لوحة تحكم الموقع الكاملة\n` +
            `• إدارة المستخدمين والعضويات وحد التسجيل\n\n` +
            `🌐 ادخل الموقع برقمك ورمزك السري للوصول للوحة المالك.`;
    } else if (role === 'premium') {
        text =
            `💎 *عضويتك: مميزة VIP*\n\n` +
            `رقمك: +${senderNum}\n\n` +
            `✅ كل أوامر الإعدادات والسلوك متاحة لك\n` +
            `✅ لوحة تحكم الويب الكاملة لبوتك\n` +
            `❌ أوامر التحكم الكامل (للمالك فقط)\n\n` +
            `أرسل *.premium info* لتفاصيل أكثر.`;
    } else {
        text =
            `👤 *عضويتك: عادية*\n\n` +
            `رقمك: +${senderNum}\n\n` +
            `الأوامر العامة متاحة لك بالكامل (ألعاب، تحميل، أدوات...).\n\n` +
            `💎 *تريد العضوية المميزة؟*\n` +
            `تفتح لك أوامر المالك للإعدادات + لوحة تحكم الويب.\n` +
            `تواصل مع مالك الموقع للترقية.\n\n` +
            `أرسل *.premium info* لتفاصيل أكثر.`;
    }

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

const { bot } = require('../lib/pluginLoader');

bot({
    command: ['premium', 'عضويتي', 'membership'],
    description: 'عرض حالة عضويتك المميزة 💎',
    category: 'general',
}, async (sock, chatId, message, args, query, ctx) => {
    await premiumCommand(sock, chatId, message, args, query, ctx);
});
