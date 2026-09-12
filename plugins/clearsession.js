// Migrated from commands/clearsession.js
const { hasOwnerPrivileges } = require('./sudo');

const fs = require('fs');
const path = require('path');
const paths = require('../lib/paths');

const { getLang } = require('../lib/lang');

async function clearSessionCommand(sock, chatId, msg) {
    try {
        // Check if sender is owner
        if (!hasOwnerPrivileges((msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid), msg, sock.user?.id, sock._sessionNumber)) {
            await sock.sendMessage(chatId, { 
                text: getLang(sock).clearsession_owner_only
            });
            return;
        }

        // جلسة هذا العامل نفسها (عزل العمليات — كل جلسة تنظف ملفاتها فقط)
        const sessionDir = process.env.QR_WORKER_SESSION_DIR
            || paths.sessionDirFor(sock._sessionNumber || '');

        if (!fs.existsSync(sessionDir)) {
            await sock.sendMessage(chatId, { 
                text: getLang(sock).clearsession_not_found
            });
            return;
        }

        let filesCleared = 0;
        let errors = 0;
        let errorDetails = [];

        // Send initial status
        await sock.sendMessage(chatId, { 
            text: `🔍 جاري تحسين ملفات الجلسة (+${sock._sessionNumber || 'الرئيسية'}) لأداء أفضل...`
        });

        const files = fs.readdirSync(sessionDir);
        
        // Count files by type for optimization
        let appStateSyncCount = 0;
        let preKeyCount = 0;

        for (const file of files) {
            if (file.startsWith('app-state-sync-')) appStateSyncCount++;
            if (file.startsWith('pre-key-')) preKeyCount++;
        }

        // Delete files
        for (const file of files) {
            if (file === 'creds.json') {
                // Skip creds.json file
                continue;
            }
            try {
                const filePath = path.join(sessionDir, file);
                fs.unlinkSync(filePath);
                filesCleared++;
            } catch (error) {
                errors++;
                errorDetails.push(`Failed to delete ${file}: ${error.message}`);
            }
        }

        // Send completion message
        const message = `✅ تم تنظيف ملفات الجلسة بنجاح!\n\n` +
                       `📊 الإحصائيات:\n` +
                       `• إجمالي الملفات الممسوحة: ${filesCleared}\n` +
                       `• ملفات مزامنة الحالة: ${appStateSyncCount}\n` +
                       `• ملفات Pre-key: ${preKeyCount}\n` +
                       (errors > 0 ? `\n⚠️ أخطاء: ${errors}\n${errorDetails.join('\n')}` : '');

        await sock.sendMessage(chatId, { 
            text: message
        });

    } catch (error) {
        console.error('Error in clearsession command:', error);
        await sock.sendMessage(chatId, { 
            text: getLang(sock).clearsession_failed
        });
    }
}



const { bot } = require('../lib/pluginLoader');

bot({
  command: ['clearsession'],
  description: 'مسح بيانات جلسة واتساب',
  category: 'owner',
}, async (sock, chatId, message) => {
  await clearSessionCommand(sock, chatId, message);
});