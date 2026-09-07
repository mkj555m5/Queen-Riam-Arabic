// Migrated from commands/language.js
// Language is locked to Arabic only.
const { getLang } = require('../lib/lang');
const { LANG_NAMES } = require('../lib/lang');

async function languageCommand(sock, chatId, message, args, sessionNumber) {
  const t = getLang(sessionNumber);

  // Always Arabic now — show info message
  const currentName = LANG_NAMES['ar'];
  const text = `🌍 *إعدادات اللغة*

اللغة الحالية: *${currentName}* (ar)

ℹ️ هذه النسخة من البوت تدعم *العربية فقط* ولا يمكن تبديل اللغة.

👑 Queen Riam`;
  await sock.sendMessage(chatId, { text });
}



const { bot } = require('../lib/pluginLoader');

bot({
  command: ['language', 'lang'],
  description: 'عرض إعدادات اللغة',
  category: 'owner',
}, async (sock, chatId, message, args, query, ctx) => {
  await languageCommand(sock, chatId, message, args, ctx.sessionNumber);
});
