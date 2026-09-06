const { bot } = require('../lib/pluginLoader');


bot({
  command: ['getpp'],
  description: 'احصل على الصورة الشخصية لمستخدم',
  category: 'general',
}, async (sock, chatId, message, args, query, ctx) => {
  try {
    const msgCtx    = message.message?.extendedTextMessage?.contextInfo;
    const mentioned = msgCtx?.mentionedJid?.[0];
    const target    = msgCtx?.participant || mentioned;
    if (!target) { await sock.sendMessage(chatId, { text: 'رد على شخص أو انادي مستخدم بـ ' + ctx.effectivePrefix + 'getpp' }); return; }
    try {
      const picUrl = await sock.profilePictureUrl(target, 'image');
      await sock.sendMessage(chatId, { image: { url: picUrl }, caption: '*Profile Picture of* @' + target.split('@')[0], mentions: [target] });
    } catch (_) {
      await sock.sendMessage(chatId, { text: "❌ Couldn't fetch profile picture." });
    }
  } catch (err) { console.error('Error in getpp:', err); }
});
