export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/* JANGAN HAPUS INI 
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037)
•• instagram: @vynaa_valerie 
•• (github.com/VynaaValerie) 
*/
let handler = async (m, { conn, command, text, args }) => {
    let koinBenar = 100;
    let taruhanMin = 50;
    let koinSalah = 0;
    switch(command) {
        case 'togel':
            if (global.db.data.users[m.sender].angka) return conn.reply(m.chat, 'لا يزال لديك لعبة توغل جارية. يرجى إنهاؤها أولاً.', m);
            if (args.length === 0) return conn.reply(m.chat, `لوضع رهان، استخدم الصيغة: *.togel [المبلغ]*`, m);
            if (isNaN(args[0])) return conn.reply(m.chat, `يجب أن يكون الرهان رقماً.`, m);
            let taruhan = parseInt(args[0]);
            if (taruhan < taruhanMin) return conn.reply(m.chat, `عذراً، الحد الأدنى للرهان هو ${taruhanMin} عملة.`, m);
            if (global.db.data.users[m.sender].koin < taruhan) return conn.reply(m.chat, `عذراً، عملاتك لا تكفي لوضع رهان بمقدار ${taruhan} عملة.`, m);
            global.db.data.users[m.sender].koin -= taruhan;
            let angka = Math.floor(Math.random() * 10000); // Mendapatkan angka acak empat digit
            m.reply(`رقمك: ${angka}\nيرجى إدخال الرقم أعلاه، وسيقوم البوت بخلط أرقامه.`);
            m.reply('*أدخل رقمك باستخدام الأمر* .angka [الرقم]');
            m.reply(`إعلان: سيحصل الفائز على جائزة 100 عملة`);
            global.db.data.users[m.sender].angka = angka;
            break;
        case 'angka':
            if (!global.db.data.users[m.sender].angka) return conn.reply(m.chat, 'لم تستخدم أمر .togel بعد', m);
            if (args.length === 0 || args[0].length !== 4 || isNaN(args[0])) return conn.reply(m.chat, 'أدخل رقماً من أربعة خانات!', m);
            let angkaKamu = args[0];
            let angkaBot;
            let digitKamu = angkaKamu.split('').map(Number); // Mendapatkan digit dari angka pengguna
            do {
                angkaBot = parseInt(digitKamu.sort(() => Math.random() - 0.5).join('')); // Mengacak digit tetapi tetap mempertahankan digit yang sama dengan angka pengguna
            } while (angkaBot === parseInt(angkaKamu) || angkaBot.toString().length !== 4); // Memastikan angka bot tidak sama dengan angka pengguna dan tetap memiliki empat digit
            let pesan, hadiah;
            if (angkaKamu == angkaBot) {
                pesan = `
*「 JUDI TOGEL 」*

رقمك: ${angkaKamu}
رقم البوت: ${angkaBot}

صحيح 🪙
الجائزة: ${koinBenar} عملة
`.trim();
                hadiah = koinBenar;
                global.db.data.users[m.sender].koin += koinBenar;
            } else {
                pesan = `
*「 JUDI TOGEL 」*

رقمك: ${angkaKamu}
رقم البوت: ${angkaBot}

خطأ 🙄
`.trim();
                hadiah = 0; // tidak ada hadiah jika salah tebak
            }
            conn.reply(m.chat, pesan, m);
            delete global.db.data.users[m.sender].angka; // Menghapus data permainan setelah hasil tebakan diberikan
            break;
        case 'stoptogel':
            if (!global.db.data.users[m.sender].angka) return conn.reply(m.chat, 'لم تستخدم أمر .togel بعد', m);
            let angkaBotStop = global.db.data.users[m.sender].angka;
            m.reply(`Angka Bot: ${angkaBotStop}`);
            delete global.db.data.users[m.sender].angka;
            break;
    }
}

handler.help = ['togel', 'angka', 'stoptogel'];
handler.tags = ['game'];
handler.command = /^(togel|angka|stoptogel)$/i;
handler.limit = false;
handler.fail = null;
handler.private = true;

export default handler;
/* JANGAN HAPUS INI 
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037)
•• instagram: @vynaa_valerie 
•• (github.com/VynaaValerie) 
*/
