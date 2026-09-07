// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.resolve(__dirname, '../plugins')

let handler = async (m, { conn, text, usedPrefix, command }) => {
   if (!text && ['حفظ', 'حذف', 'عرض', 'عدل', 'تحقق', 'تسمية', 'ابحث', 'معلومات'].includes(command)) {
      throw `‣ مثال: ${usedPrefix + command} اسم_الملف أو الكلمة المراد البحث عنها`
   }

   let filePath = path.join(pluginsDir, `${text}.js`)

   try {
      switch (command) {
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 1. حفظ ملف جديد
         case 'حفظ':
         case 'sp':
         case 'saveplugin':
            if (!m.quoted || !m.quoted.text) throw `⚠️ يرجى الرد على الكود الذي تريد حفظه.`
            fs.writeFileSync(filePath, m.quoted.text)
            m.reply(`✅ تم حفظ الملف بنجاح.`)
            // إرسال نسخة من الملف الجديد كتوثيق
            await conn.sendMessage(m.chat, { document: fs.readFileSync(filePath), mimetype: 'text/plain', fileName: `${text}.js`, caption: `📄 نسخة من الملف الجديد: ${text}.js` }, { quoted: m })
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 2. حذف ملف أو عدة ملفات (مع إرسال نسخة احتياطية قبل الحذف)
         case 'حذف':
         case 'dp':
         case 'deleteplugin':
            let filesToDelete = text.split(/[,\s]+/).map(v => v.trim().replace('.js', ''))
            let deleted = []
            let notFound = []

            for (let name of filesToDelete) {
               let p = path.join(pluginsDir, `${name}.js`)
               if (fs.existsSync(p)) {
                  // إرسال النسخة قبل الحذف
                  await conn.sendMessage(m.chat, { document: fs.readFileSync(p), mimetype: 'text/plain', fileName: `${name}.js`, caption: `📦 نسخة احتياطية قبل الحذف: ${name}.js` }, { quoted: m })
                  fs.unlinkSync(p)
                  deleted.push(name)
               } else {
                  notFound.push(name)
               }
            }
            let dReport = (deleted.length > 0 ? `🗑️ تم حذف: ${deleted.join(', ')}` : '') + (notFound.length > 0 ? `\n⚠️ لم يتم العثور على: ${notFound.join(', ')}` : '')
            m.reply(dReport)
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 3. عرض كود ملف
         case 'عرض':
         case 'gp':
         case 'getplugin':
            if (fs.existsSync(filePath)) {
               let content = fs.readFileSync(filePath, 'utf-8')
               if (content.length > 4000) {
                  await conn.sendMessage(m.chat, { document: { url: filePath }, mimetype: 'text/plain', fileName: `${text}.js` }, { quoted: m })
               } else {
                  m.reply(`// By Yato Bot - Anas Adel\n\n${content}`)
               }
            } else throw `⚠️ الملف غير موجود.`
            break

         // 4. تعديل ملف (إرسال النسخة القديمة والجديدة)
         case 'عدل':
         case 'ep':
         case 'ufp':
         case 'editplugin':
            if (!m.quoted || !m.quoted.text) throw `⚠️ لازم ترد على الكود الجديد.`
            if (fs.existsSync(filePath)) {
               // 1. إرسال النسخة القديمة
               await conn.sendMessage(m.chat, { document: fs.readFileSync(filePath), mimetype: 'text/plain', fileName: `${text}_old.js`, caption: `⬇️ النسخة القديمة قبل التعديل: ${text}.js` }, { quoted: m })
               
               // 2. التعديل
               fs.writeFileSync(filePath, m.quoted.text)
               
               // 3. إرسال النسخة الجديدة
               await conn.sendMessage(m.chat, { document: fs.readFileSync(filePath), mimetype: 'text/plain', fileName: `${text}_new.js`, caption: `⬆️ النسخة الجديدة بعد التعديل: ${text}.js` }, { quoted: m })
               
               m.reply(`✅ تم التحديث بنجاح وارسال النسختين.`)
            } else throw `⚠️ الملف غير موجود لتعديله.`
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 5. التحقق من وجود ملف
         case 'تحقق':
         case 'كشف':
         case 'searchplugin':
            let files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))
            let matches = files.filter(f => f.toLowerCase().includes(text.toLowerCase()))
            if (matches.length === 0) throw `⚠️ لا توجد نتائج.`
            m.reply(`🔍 النتائج:\n${matches.map(f => `- ${path.basename(f, '.js')}`).join('\n')}`)
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 6. البحث عن نص داخل الملفات
         case 'ابحث':
         case 'grep':
            let allFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))
            let results = []
            for (let file of allFiles) {
               if (fs.readFileSync(path.join(pluginsDir, file), 'utf-8').toLowerCase().includes(text.toLowerCase())) results.push(file.replace('.js', ''))
            }
            if (results.length === 0) throw `⚠️ لا توجد نتائج للكلمة.`
            m.reply(`🔍 موجودة في:\n${results.map(r => `- ${r}`).join('\n')}`)
            break

         // 7. تغيير اسم ملف
         case 'تسمية':
         case 'rp':
         case 'renameplugin':
            let [oldN, newN] = text.split('|').map(v => v.trim())
            let oldP = path.join(pluginsDir, `${oldN}.js`), newP = path.join(pluginsDir, `${newN}.js`)
            if (!fs.existsSync(oldP)) throw `⚠️ الملف غير موجود.`
            fs.renameSync(oldP, newP)
            m.reply(`✅ تم تغيير الاسم إلى ${newN}`)
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 8. قائمة الملفات
         case 'قائمة':
         case 'lp':
         case 'listplugins':
            let lFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))
            m.reply(`📂 الملفات (${lFiles.length}):\n${lFiles.map(f => `- ${path.basename(f, '.js')}`).join('\n')}`)
            break
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
         // 9. معلومات الملف
         case 'معلومات':
         case 'infop':
            if (fs.existsSync(filePath)) {
               let s = fs.statSync(filePath)
               m.reply(`📄 *${text}.js*\n📏 الحجم: ${(s.size / 1024).toFixed(2)} KB\n📝 التعديل: ${s.mtime.toLocaleString()}`)
            } else throw `⚠️ غير موجود.`
            break
      }
   } catch (error) {
      console.error(error)
      m.reply(`❌ خطأ: ${error.message}`)
   }
}

handler.help = ['pm', 'مدير']
handler.tags = ['owner']
handler.description = 'مدير إضافات Queen Riam (حفظ/حذف/عرض/تعديل)'
handler.command = ['pm', 'مدير', 'pluginmanager', 'حفظ', 'sp', 'حذف', 'dp', 'عرض', 'gp', 'عدل', 'ufp', 'ep', 'تحقق', 'ابحث', 'grep', 'تسمية', 'rp', 'قائمة', 'lp', 'معلومات', 'infop']
handler.rowner = true

export default handler
