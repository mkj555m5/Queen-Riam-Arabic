export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


const handler = async (m, { conn, usedPrefix, args }) => {
  conn.todRooms = conn.todRooms || {};

  const truthQuestions = [
    "ما أكبر سرّ أبقيتَه لنفسك؟",
    "من أُعجبت به في سرّية هنا من قبل؟",
    "متى كانت آخر مرة بكيت ولماذا؟",
    "ما أكثر موقف محرج حدث لك؟",
    "اختر أحد أعضاء هذه المجموعة الذي تريد التعامل معه عن قرب أكثر."
  ];

  const dareChallenges = [
    "أرسل رسالة حب لأحد أعضاء هذه المجموعة.",
    "سجّل نفسك وأنت تغنّي أغنيتك المفضلة وأرسلها للمجموعة.",
    "استخدم لقباً طريفاً في المجموعة لمدة 24 ساعة.",
    "امدح 3 أعضاء من المجموعة مدحاً صادقاً.",
    "غيّر صورتك الشخصية إلى صورة طريفة ليوم واحد."
  ];

  switch (args[0]?.toLowerCase()) {
    case "create":
      if (conn.todRooms[m.chat]) {
        return m.reply('غرفة الصدق أو الجرأة موجودة بالفعل.');
      }
      conn.todRooms[m.chat] = {
        players: [],
        currentTurn: 0
      };
      m.reply('تم إنشاء غرفة الصدق أو الجرأة. يمكن للاعبين الانضمام الآن (5 لاعبين كحد أقصى).');
      break;

    case "join":
      if (!conn.todRooms[m.chat]) {
        return m.reply('لا توجد غرفة بعد. استخدم .tod create لإنشاء غرفة.');
      }
      const room = conn.todRooms[m.chat];
      if (room.players.length >= 5) {
        return m.reply('الغرفة ممتلئة. 5 لاعبين كحد أقصى.');
      }
      if (room.players.find(p => p.id === m.sender)) {
        return m.reply('أنت منضم إلى الغرفة بالفعل.');
      }
      const playerName = m.pushName || conn.getName(m.sender);
      room.players.push({ id: m.sender, name: playerName });
      m.reply(`تم انضمامك إلى الغرفة. (${room.players.length}/5 لاعبين)`);
      break;

    case "start":
      if (!conn.todRooms[m.chat]) {
        return m.reply('لا توجد غرفة بعد. استخدم .tod create لإنشاء غرفة.');
      }
      const startRoom = conn.todRooms[m.chat];
      if (startRoom.players.length < 2) {
        return m.reply('يلزم لاعبان على الأقل لبدء اللعبة.');
      }
      m.reply('بدأت لعبة الصدق أو الجرأة! استعد!');
      startRoom.currentTurn = Math.floor(Math.random() * startRoom.players.length);
      const currentPlayer = startRoom.players[startRoom.currentTurn];
      m.reply(`الآن دور ${currentPlayer.name}. اكتب .tod truth أو .tod dare.`);
      break;

/* JANGAN HAPUS INI 
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037)
•• instagram: @vynaa_valerie 
•• (github.com/VynaaValerie) 
*/
    case "truth":
    case "dare":
      if (!conn.todRooms[m.chat]) {
        return m.reply('لا توجد غرفة بعد. استخدم .tod create لإنشاء غرفة.');
      }
      const todRoom = conn.todRooms[m.chat];
      if (todRoom.players[todRoom.currentTurn].id !== m.sender) {
        return m.reply('ليس دورك الآن.');
      }

      if (args[0].toLowerCase() === "truth") {
        const randomTruth = truthQuestions[Math.floor(Math.random() * truthQuestions.length)];
        m.reply(`*Truth:* ${randomTruth}`);
      } else {
        const randomDare = dareChallenges[Math.floor(Math.random() * dareChallenges.length)];
        m.reply(`*Dare:* ${randomDare}`);
      }

      todRoom.currentTurn = (todRoom.currentTurn + 1) % todRoom.players.length;
      const nextPlayer = todRoom.players[todRoom.currentTurn];
      m.reply(`Sekarang giliran ${nextPlayer.name}. Ketik .tod truth atau .tod dare.`);
      break;

    case "players":
      if (!conn.todRooms[m.chat]) {
        return m.reply('لا توجد غرفة بعد. استخدم .tod create لإنشاء غرفة.');
      }
      const playersList = conn.todRooms[m.chat].players;
      m.reply(`اللاعبون المنضمون (${playersList.length}/5):\n${playersList.map(p => p.name).join('\n')}`);
      break;

    case "delete":
      if (!conn.todRooms[m.chat]) {
        return m.reply('Belum ada room yang dibuat.');
      }
      delete conn.todRooms[m.chat];
      m.reply('تم حذف الغرفة.');
      break;

    default:
      m.reply(`*❏ TRUTH OR DARE 🎭*

• ${usedPrefix}tod create (أنشئ غرفة)
• ${usedPrefix}tod join (انضم للغرفة، 5 لاعبين كحد أقصى)
• ${usedPrefix}tod start (ابدأ اللعبة، لاعبان على الأقل)
• ${usedPrefix}tod truth (اختر سؤال صدق)
• ${usedPrefix}tod dare (اختر تحدي جرأة)
• ${usedPrefix}tod players (اعرض قائمة اللاعبين)
• ${usedPrefix}tod delete (احذف غرفة اللعب)

هيا نلعب الصدق أو الجرأة!`);
  }
};

handler.help = ['truthordare', 'tod']
handler.tags = ['game']
handler.command = /^(truthordare|tod)$/i
handler.group = true
export default handler;
