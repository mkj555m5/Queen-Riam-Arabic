const __qrPaths = require('../lib/paths'); const __qrDataFile = __qrPaths.dataFile;
const { bot } = require('../lib/pluginLoader');
const { hasOwnerPrivileges } = require('./sudo');

const fs = require('fs');

bot({
  command: ['mode'],
  description: 'ضبط البوت على الوضع العام أو الخاص',
  category: 'owner',
}, async (sock, chatId, message, args, query, ctx) => {
  if (!hasOwnerPrivileges(ctx.senderId, message, sock.user?.id, ctx.sessionNumber)) { await sock.sendMessage(chatId, { text: 'للمالك فقط!' }); return; }
  const mcPath = ctx.sessionNumber ? __qrDataFile('messageCount_' + ctx.sessionNumber + '.json') : __qrDataFile('messageCount.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(mcPath)); }
  catch { await sock.sendMessage(chatId, { text: 'فشل في قراءة وضع البوت.' }); return; }
  const action = args[0]?.toLowerCase();
  if (!action) { await sock.sendMessage(chatId, { text: 'Mode: *' + (data.isPublic ? 'public' : 'private') + '*\nUsage: ' + ctx.effectivePrefix + 'mode public|private' }); return; }
  if (!['public','private'].includes(action)) { await sock.sendMessage(chatId, { text: 'Usage: ' + ctx.effectivePrefix + 'mode public|private' }); return; }
  data.isPublic = action === 'public';
  fs.writeFileSync(mcPath, JSON.stringify(data, null, 2));
  await sock.sendMessage(chatId, { text: 'البوت الآن في وضع *' + action + '* mode' });
});
