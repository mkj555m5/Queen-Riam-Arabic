const settings = require('../settings');
const { bot } = require('../lib/pluginLoader');

bot({
  command: ['ownerinfo', 'owner'],
  description: 'احصل على معلومات المالك',
  category: 'general',
}, async (sock, chatId, message) => {
  try {
    await sock.sendMessage(chatId, { react: { text: '👑', key: message.key } });
    const ownerName = settings.botOwner || 'Owner';
    const ownerNumber = settings.ownerNumber || '201270221253';
    const botProject = settings.botName || 'Queen Riam';
    const userJid = message.key.participant || message.key.remoteJid;
    await sock.sendMessage(chatId, {
      text: 'مرحباً @' + userJid.split('@')[0] + ',\n\nأنا *' + botProject + '*، يمتلكني *' + ownerName + '*.\n\nرقم المالك: +' + ownerNumber,
      mentions: [userJid]
    });
    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
  } catch (err) {
    console.error('Error in owner_info command:', err);
  }
});
