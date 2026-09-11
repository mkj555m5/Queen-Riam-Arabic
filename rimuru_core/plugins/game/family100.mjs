export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import {
  getRandomItem,
  createSession,
  getSession,
  endSession,
  hasActiveSession,
  setSessionTimer,
  getRemainingTime,
  formatRemainingTime,
  isSurrender,
  isReplyToGame,
  getRandomReward,
} from "../../src/lib/rimuru-game-data.mjs";
import { getDatabase } from "../../src/lib/rimuru-database.mjs";
import { addExpWithLevelCheck } from "../../src/lib/rimuru-level.mjs";

const pluginConfig = {
  name: "family100",
  alias: ["f100", "survei"],
  category: "game",
  description: "استطلاع الرأي! خمّن الإجابات الأكثر شعبية",
  usage: ".family100",
  example: ".family100",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const chatId = m.chat;

  if (hasActiveSession(chatId)) {
    const session = getSession(chatId);
    if (session && session.gameType === "family100") {
      const remaining = getRemainingTime(chatId);
      const answered = session.answered || [];
      const total = session.question.jawaban.length;

      let text = `Wah, sesi Family 100 masih jalan nih kak! 😱✨\n\n`;
      text += `*${session.question.soal}*\n\n`;
      text += `Terjawab: *${answered.length} dari ${total}*\n`;
      answered.forEach((ans, i) => {
        text += `${i + 1}. ✅ ${ans}\n`;
      });
      for (let i = answered.length; i < total; i++) {
        text += `${i + 1}. ❓ ???\n`;
      }
      text += `\nالوقت المتبقي: *${formatRemainingTime(remaining)}* ⏳\n`;
      text += `سارع بالرد على الرسالة للإجابة! 🔥`;
      await m.reply(text);
      return;
    }
  }

  const question = getRandomItem("family100.json");
  if (!question) {
    await m.reply("عذراً يا عزيزي، لا توجد أسئلة للعبة الآن 😭💔");
    return;
  }

  const total = question.jawaban.length;

  let text = `حان وقت لعب *FAMILY 100*! 🎉✨\n\n`;
  text += `*السؤال:* ${question.soal}\n\n`;
  text += `Total الجواب: *${total}* 📝\n`;
  for (let i = 0; i < total; i++) {
    text += `${i + 1}. ❓ ???\n`;
  }
  text += `\nلديك *120 ثانية* فقط! ⏱️\n`;
  text += `الجائزة؟ *خبرة* و*عملات* عشوائية لكل إجابة صحيحة! 🎁💸\n\n`;
  text += `طريقة اللعب: *رُدّ على هذه الرسالة* مباشرة بإجابتك، أو رُدّ بكلمة *nyerah* إذا استسلمت 🏳️😂`;

  const sentMsg = await m.reply(text);

  const session = createSession(
    chatId,
    "family100",
    question,
    sentMsg.key,
    120000,
  );
  session.answered = [];
  session.answeredBy = {};

  setSessionTimer(chatId, async () => {
    const sess = getSession(chatId);
    const answered = sess?.answered || [];
    const remaining = question.jawaban.filter(
      (j) => !answered.includes(j.toLowerCase()),
    );

    let timeoutText = `يا للأسف انتهى الوقت يا عزيزي! 😭😭⏱️\n\n`;
    timeoutText += `نجحتم في تخمين *${answered.length}* من *${question.jawaban.length}* إجابة! ✨\n\n`;
    if (remaining.length > 0) {
      timeoutText += `وهذه الإجابات التي أفلتت منكم:\n`;
      remaining.forEach((ans) => {
        timeoutText += `• ${ans}\n`;
      });
    }
    timeoutText += `\nMakasih udah main ya, ditunggu sesi berikutnya! 💖🎉`;

    endSession(chatId);
    await sock.sendMessage(chatId, { text: timeoutText }, { quoted: sentMsg });
  });
}

async function family100AnswerHandler(m, sock) {
  const chatId = m.chat;
  const session = getSession(chatId);

  if (!session || session.gameType !== "family100") return false;
  if (!m.body || m.isCommand) return false;

  const userAnswer = m.body.toLowerCase().trim();
  if (!userAnswer) return false;

  const isQuotingGame = isReplyToGame(m, session);

  if (isSurrender(userAnswer)) {
    const answered = session.answered || [];
    const remaining = session.question.jawaban.filter(
      (j) => !answered.includes(j.toLowerCase()),
    );

    let text = `وماذا بعد؟ استسلمتم؟ 🥺🏳️\n\n`;
    text += `مع أنكم خمّنتم *${answered.length}* من *${session.question.jawaban.length}* بالفعل! 👏\n\n`;
    if (remaining.length > 0) {
      text += `إليكم الإجابات المتبقية:\n`;
      remaining.forEach((ans) => {
        text += `• ${ans}\n`;
      });
    }
    text += `\nGapapa, next time pasti bisa full senyum! 💖✨`;

    endSession(chatId);
    await m.reply(text);
    return true;
  }

  const correctAnswers = session.question.jawaban.map((j) => j.toLowerCase());
  const answered = session.answered || [];

  if (answered.includes(userAnswer)) {
    if (isQuotingGame) {
      await m.react("⚠️");
      await m.reply(`لحظة! إجابة *${userAnswer}* سبق أن أجاب بها أحدهم يا عزيزي! فكّر في شيء آخر 😂✨`);
      return true;
    }
    return false;
  }

  const matchIndex = correctAnswers.findIndex((ans) => {
    const similarity = getSimilarity(ans, userAnswer);
    return (
      similarity >= 0.8 || ans.includes(userAnswer) || userAnswer.includes(ans)
    );
  });

  if (matchIndex !== -1) {
    const originalAnswer = session.question.jawaban[matchIndex];

    if (!answered.includes(originalAnswer.toLowerCase())) {
      session.answered.push(originalAnswer.toLowerCase());
      session.answeredBy[originalAnswer.toLowerCase()] = m.sender;

      const db = getDatabase();
      const user = db.getUser(m.sender);

      const answerReward = getRandomReward();
      if (!user.rpg) user.rpg = {};
      await addExpWithLevelCheck(sock, m, db, user, answerReward.exp);
      db.updateKoin(m.sender, answerReward.koin);
      db.save();

      if (session.answered.length === correctAnswers.length) {
        endSession(chatId);

        const participants = Object.values(session.answeredBy);
        const uniqueParticipants = [...new Set(participants)];

        let text = `واااو! رائع! خمّنتم كل الإجابات! 🎉🔥✨\n\n`;
        text += `*السؤال:* ${session.question.soal}\n\n`;
        session.question.jawaban.forEach((ans, i) => {
          const who = session.answeredBy[ans.toLowerCase()];
          text += `${i + 1}. ✅ ${ans} - @${who?.split("@")[0] || "?"}\n`;
        });
        text += `\n🎊 مبروك لكل من شارك وفكّر! عقولكم في قمة النشاط! 🧠💯`;

        await m.reply(text, { mentions: uniqueParticipants });
        return true;
      }

      const total = session.question.jawaban.length;
      let text = `إجابة صحيحة تماماً! ✅🎉\n@${m.sender.split("@")[0]} حصلت على *+${answerReward.exp} خبرة* و*+${answerReward.koin} عملة*! 💸✨\n\n`;
      text += `*السؤال:* ${session.question.soal}\n\n`;
      session.question.jawaban.forEach((ans, i) => {
        const isAnswered = session.answered.includes(ans.toLowerCase());
        if (isAnswered) {
          text += `${i + 1}. ✅ ${ans}\n`;
        } else {
          text += `${i + 1}. ❓ ???\n`;
        }
      });
      text += `\nهيا بقي *${total - session.answered.length}* إجابات يا عزيزي! 🔥⏱️`;

      await m.reply(text, { mentions: [m.sender] });
      return true;
    }
  }

  if (isQuotingGame) {
    await m.react("❌");
    await m.reply(`خطأ! ❌ فكّر مرة أخرى يا عزيزي 😂🧠`);
    return true;
  }

  await m.react("❌");
  return false;
}

function getSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  return (longer.length - costs[shorter.length]) / longer.length;
}

export { pluginConfig as config, handler, family100AnswerHandler };
