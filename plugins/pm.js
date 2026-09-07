// plugins/pm.js — Plugin Manager (نظيف، CommonJS، عربي)
// الأوامر:
//   .pm save <name>      — حفظ إضافة (رد على الكود)
//   .pm delete <name>    — حذف إضافة
//   .pm view <name>      — عرض كود إضافة
//   .pm edit <name>      — تعديل إضافة (رد على الكود الجديد)
//   .pm search <word>    — البحث عن ملف بالاسم
//   .pm grep <word>      — البحث داخل الملفات
//   .pm rename <old|new> — إعادة تسمية
//   .pm list             — عرض كل الإضافات
//   .pm info <name>      — معلومات الملف
// المالك فقط (owner only)

'use strict';

const fs = require('fs');
const path = require('path');
const { hasOwnerPrivileges } = require('./sudo');
const { getLang } = require('../lib/lang');

const PLUGINS_DIR = __dirname;
const EPLUGINS_DIR = path.join(__dirname, '..', 'eplugins');

// تأكد إن مجلد eplugins/ موجود
if (!fs.existsSync(EPLUGINS_DIR)) {
    fs.mkdirSync(EPLUGINS_DIR, { recursive: true });
}

function getAllPluginFiles() {
    const out = [];
    for (const dir of [PLUGINS_DIR, EPLUGINS_DIR]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.js')) continue;
            const fullPath = path.join(dir, f);
            const stat = fs.statSync(fullPath);
            out.push({
                name: path.basename(f, '.js'),
                path: fullPath,
                dir: path.basename(path.dirname(dir)) === 'eplugins' ? 'eplugins' : 'plugins',
                size: stat.size,
                mtime: stat.mtime,
            });
        }
    }
    return out;
}

function resolvePluginPath(name) {
    if (!name) return null;
    const clean = path.basename(name.replace(/\.js$/i, ''));
    if (!clean) return null;
    // ابحث في plugins/ أولاً، ثم eplugins/
    const p1 = path.join(PLUGINS_DIR, `${clean}.js`);
    if (fs.existsSync(p1)) return { path: p1, name: clean, dir: 'plugins' };
    const p2 = path.join(EPLUGINS_DIR, `${clean}.js`);
    if (fs.existsSync(p2)) return { path: p2, name: clean, dir: 'eplugins' };
    return { path: p1, name: clean, dir: 'plugins', notFound: true };
}

async function pmCommand(sock, chatId, message, args, query, ctx) {
    const sessionNumber = ctx?.sessionNumber || null;
    const sender = ctx?.sender || message.key.participant || message.key.remoteJid;

    if (!hasOwnerPrivileges(sender, message, sock.user?.id, sessionNumber)) {
        await sock.sendMessage(chatId, { text: '❌ هذا الأمر متاح للمالك فقط.' }, { quoted: message });
        return;
    }

    const action = (args[0] || '').toLowerCase();
    const name = (args[1] || '').trim();

    if (!action) {
        await sock.sendMessage(chatId, {
            text:
                `🛠️ *مدير إضافات Queen Riam*\n\n` +
                `*الأوامر:*\n` +
                `• *.pm save <name>* — حفظ إضافة (رد على الكود)\n` +
                `• *.pm delete <name>* — حذف إضافة\n` +
                `• *.pm view <name>* — عرض كود إضافة\n` +
                `• *.pm edit <name>* — تعديل إضافة (رد على الكود)\n` +
                `• *.pm search <word>* — البحث عن ملف\n` +
                `• *.pm grep <word>* — البحث داخل الملفات\n` +
                `• *.pm rename <old|new>* — إعادة تسمية\n` +
                `• *.pm list* — عرض كل الإضافات\n` +
                `• *.pm info <name>* — معلومات الملف`,
        }, { quoted: message });
        return;
    }

    try {
        switch (action) {
            // ── 1. حفظ ──────────────────────────────────────────────────────────
            case 'save':
            case 'sp': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm save <name>' }, { quoted: message });
                    return;
                }
                const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const code = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
                if (!code) {
                    await sock.sendMessage(chatId, { text: '⚠️ لازم ترد على الكود اللي عايز تحفظه.' }, { quoted: message });
                    return;
                }
                // الإضافات الجديدة بتتحفظ في eplugins/ (أو لو الاسم موجود في plugins/ نعدّل عليه)
                const existing = resolvePluginPath(name);
                const targetPath = existing?.path || path.join(EPLUGINS_DIR, `${name}.js`);
                fs.writeFileSync(targetPath, code, 'utf8');
                await sock.sendMessage(chatId, { text: `✅ تم حفظ الإضافة بنجاح: ${name}.js` }, { quoted: message });
                break;
            }

            // ── 2. حذف ──────────────────────────────────────────────────────────
            case 'delete':
            case 'del':
            case 'rm': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm delete <name>' }, { quoted: message });
                    return;
                }
                const files = name.split(/[,\s]+/).filter(Boolean);
                const deleted = [];
                const notFound = [];
                for (const f of files) {
                    const p = resolvePluginPath(f);
                    if (!p || p.notFound) { notFound.push(f); continue; }
                    try {
                        fs.unlinkSync(p.path);
                        deleted.push(f);
                    } catch (e) { notFound.push(f); }
                }
                let report = '';
                if (deleted.length > 0) report += `🗑️ تم حذف: ${deleted.join(', ')}\n`;
                if (notFound.length > 0) report += `⚠️ لم يتم العثور على: ${notFound.join(', ')}`;
                await sock.sendMessage(chatId, { text: report || 'لا شيء.' }, { quoted: message });
                break;
            }

            // ── 3. عرض ──────────────────────────────────────────────────────────
            case 'view':
            case 'show':
            case 'cat': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm view <name>' }, { quoted: message });
                    return;
                }
                const p = resolvePluginPath(name);
                if (!p || p.notFound) {
                    await sock.sendMessage(chatId, { text: `⚠️ الإضافة "${name}" غير موجودة.` }, { quoted: message });
                    return;
                }
                const content = fs.readFileSync(p.path, 'utf-8');
                if (content.length > 3800) {
                    await sock.sendMessage(chatId, {
                        document: fs.readFileSync(p.path),
                        mimetype: 'text/plain',
                        fileName: `${p.name}.js`,
                        caption: `📄 ملف: ${p.name}.js (${p.dir}/)`,
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `// ${p.dir}/${p.name}.js\n\n${content}`,
                    }, { quoted: message });
                }
                break;
            }

            // ── 4. تعديل ─────────────────────────────────────────────────────────
            case 'edit':
            case 'ed': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm edit <name>' }, { quoted: message });
                    return;
                }
                const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const code = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
                if (!code) {
                    await sock.sendMessage(chatId, { text: '⚠️ لازم ترد على الكود الجديد.' }, { quoted: message });
                    return;
                }
                const p = resolvePluginPath(name);
                if (!p || p.notFound) {
                    await sock.sendMessage(chatId, { text: `⚠️ الإضافة "${name}" غير موجودة.` }, { quoted: message });
                    return;
                }
                // إرسال النسخة القديمة قبل التعديل
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(p.path),
                    mimetype: 'text/plain',
                    fileName: `${p.name}_old.js`,
                    caption: `⬇️ النسخة القديمة: ${p.name}.js`,
                }, { quoted: message });
                fs.writeFileSync(p.path, code, 'utf8');
                await sock.sendMessage(chatId, { text: `✅ تم تحديث ${p.name}.js بنجاح.` }, { quoted: message });
                break;
            }

            // ── 5. بحث بالاسم ────────────────────────────────────────────────────
            case 'search':
            case 'find': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm search <word>' }, { quoted: message });
                    return;
                }
                const all = getAllPluginFiles();
                const matches = all.filter(f => f.name.toLowerCase().includes(name.toLowerCase()));
                if (matches.length === 0) {
                    await sock.sendMessage(chatId, { text: '⚠️ لا توجد نتائج.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, {
                    text: `🔍 النتائج (${matches.length}):\n` +
                          matches.map(f => `• ${f.dir}/${f.name}`).join('\n'),
                }, { quoted: message });
                break;
            }

            // ── 6. بحث داخل الملفات ─────────────────────────────────────────────
            case 'grep': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm grep <word>' }, { quoted: message });
                    return;
                }
                const all = getAllPluginFiles();
                const results = [];
                for (const f of all) {
                    try {
                        const c = fs.readFileSync(f.path, 'utf-8');
                        if (c.toLowerCase().includes(name.toLowerCase())) results.push(`${f.dir}/${f.name}`);
                    } catch (_) {}
                }
                if (results.length === 0) {
                    await sock.sendMessage(chatId, { text: '⚠️ لا توجد نتائج.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, {
                    text: `🔍 موجودة في (${results.length}):\n${results.map(r => `• ${r}`).join('\n')}`,
                }, { quoted: message });
                break;
            }

            // ── 7. إعادة تسمية ──────────────────────────────────────────────────
            case 'rename':
            case 'mv': {
                const parts = name.split('|').map(s => s.trim()).filter(Boolean);
                if (parts.length < 2) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm rename <old|new>' }, { quoted: message });
                    return;
                }
                const [oldN, newN] = parts;
                const p = resolvePluginPath(oldN);
                if (!p || p.notFound) {
                    await sock.sendMessage(chatId, { text: `⚠️ الإضافة "${oldN}" غير موجودة.` }, { quoted: message });
                    return;
                }
                const newPath = path.join(path.dirname(p.path), `${newN}.js`);
                fs.renameSync(p.path, newPath);
                await sock.sendMessage(chatId, { text: `✅ تم تغيير الاسم من ${oldN} إلى ${newN}` }, { quoted: message });
                break;
            }

            // ── 8. قائمة ────────────────────────────────────────────────────────
            case 'list':
            case 'ls': {
                const all = getAllPluginFiles();
                if (all.length === 0) {
                    await sock.sendMessage(chatId, { text: '⚠️ لا توجد إضافات.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, {
                    text: `📂 الإضافات (${all.length}):\n` +
                          all.map(f => `• ${f.dir}/${f.name}.js (${(f.size / 1024).toFixed(1)} KB)`).join('\n'),
                }, { quoted: message });
                break;
            }

            // ── 9. معلومات ───────────────────────────────────────────────────────
            case 'info':
            case 'stat': {
                if (!name) {
                    await sock.sendMessage(chatId, { text: '⚠️ الصيغة: .pm info <name>' }, { quoted: message });
                    return;
                }
                const p = resolvePluginPath(name);
                if (!p || p.notFound) {
                    await sock.sendMessage(chatId, { text: `⚠️ الإضافة "${name}" غير موجودة.` }, { quoted: message });
                    return;
                }
                const s = fs.statSync(p.path);
                await sock.sendMessage(chatId, {
                    text:
                        `📄 *${p.name}.js*\n` +
                        `📂 المجلد: ${p.dir}/\n` +
                        `📏 الحجم: ${(s.size / 1024).toFixed(2)} KB\n` +
                        `📝 آخر تعديل: ${s.mtime.toLocaleString('ar-EG')}`,
                }, { quoted: message });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: `❓ أمر غير معروف: ${action}\n\nأرسل *.pm* لعرض كل الأوامر المتاحة.`,
                }, { quoted: message });
        }
    } catch (err) {
        console.error('[pm] خطأ:', err.message);
        await sock.sendMessage(chatId, { text: `❌ خطأ: ${err.message}` }, { quoted: message });
    }
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['pm', 'pluginmanager', 'plugins'],
    description: 'مدير إضافات Queen Riam',
    category: 'owner',
}, async (sock, chatId, message, args, query, ctx) => {
    await pmCommand(sock, chatId, message, args, query, ctx);
});
