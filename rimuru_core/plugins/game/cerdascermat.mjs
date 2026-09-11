export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/*
- Name : Cerdas Cermat Anak SD
- الميزة بواسطة: ShowyWharf27322
- سورس بوت Rimuru MD 👑
*/
import axios from 'axios'

const subjects = [
  'bindo', 'tik', 'pkn', 'bing', 'penjas',
  'pai', 'matematika', 'jawa', 'ips', 'ipa'
]

const motivationalPhrases = {
  0: 'واو، عليك أن تدرس بجد أكبر!',
  1: 'ما زلت بحاجة للمزيد من الدراسة!',
  2: 'لا بأس، لكن يمكنك الأفضل!',
  3: 'جيد، حافظ على هذا المستوى!',
  4: 'على وشك النصف، واصل المحاولة!',
  5: 'أنجزت النصف! حسّن أداءك!',
  6: 'جيد إلى حد ما!',
  7: 'جيد جداً!',
  8: 'شبه مثالي!',
  9: 'شبه مثالي! بقي القليل!',
  10: 'مثالي! لقد أتقنت هذا الدرس تماماً!'
}

let handler = async (m, { conn, args, command }) => {
  conn.cerdasCermat = conn.cerdasCermat || {}
  
  if (conn.cerdasCermat[m.sender]) return m.reply('أنت تلعب مسابقة الذكاء الآن، أنهِ أسئلتها أولاً')
  
  const [matapelajaran, jumlahSoal] = args.map(arg => arg.toLowerCase())
  
  if (!subjects.includes(matapelajaran)) return m.reply(`حدد المادة وعدد الأسئلة\n\n*المواد المتاحة*\n- ips\n- ipa\n- bindo\n- pai\n- jawa\n- bing\n- penjas\n- matematika\n- tik\n- pkn\n\n*عدد الأسئلة من 5 إلى 10*\n\n*مثال:* .cc ipa 5`)
  
  const soalCount = parseInt(jumlahSoal)
  if (isNaN(soalCount)) return m.reply('عدد الأسئلة يجب أن يكون رقماً!')
  if (soalCount < 5 || soalCount > 10) return m.reply('عدد الأسئلة يجب أن يكون بين 5 و10!')
  
  try {
    const { data } = await axios.get(`https://api.siputzx.my.id/api/games/cc-sd?matapelajaran=${matapelajaran}&jumlahsoal=${soalCount}`)
    
    conn.cerdasCermat[m.sender] = {
      questions: data.data.soal,
      currentQuestion: 0,
      correctAnswers: 0,
      startTime: Date.now(),
      answered: false
    }
    
    await sendQuestion(conn, m)
    
  } catch (error) {
    console.error(error)
    m.reply('Error :>')
  }
}

handler.command = ['cerdascermat', 'cc']
handler.tags = ['game']
handler.help = ['cerdascermat']
handler.example = ['cerdascermat matematika 5', 'cc ipa 7']

handler.before = async (m, { conn }) => {
  if (!m.text || m.isBaileys || m.fromMe) return
  
  conn.cerdasCermat = conn.cerdasCermat || {}
  const session = conn.cerdasCermat[m.sender]
  if (!session) return
  
  const isReply = m.quoted && m.quoted.id === session.lastQuestionId
  
  if (!isReply && !session.answered) return m.reply('يرجى الإجابة عن السؤال السابق بالرد على رسالة البوت!')
  
  session.answered = true
  
  const userAnswer = m.text.trim().toLowerCase()
  const currentQuestion = session.questions[session.currentQuestion]
  const correctAnswer = currentQuestion.jawaban_benar.toLowerCase()
  
  const options = currentQuestion.semua_jawaban.map(j => Object.keys(j)[0].toLowerCase())
  if (!options.includes(userAnswer)) return m.reply(`إجابة غير صالحة. اختر واحدة من: ${options.join(', ')}`)
  
  if (userAnswer === correctAnswer) {
    session.correctAnswers++
    await m.reply('إجابة صحيحة!')
  } else {
    await m.reply(`إجابة خاطئة! الصحيح هو ${correctAnswer.toUpperCase()}`)
  }
  
  session.currentQuestion++
  
  if (session.currentQuestion < session.questions.length) {
    await sendQuestion(conn, m)
    session.answered = false
  } else {
    const totalQuestions = session.questions.length
    const score = session.correctAnswers
    const percentage = Math.round((score / totalQuestions) * 100)
    const phraseKey = Math.min(score, 10)
    
    await m.reply(`
Hasil Cerdas Cermat
    
الإجابات الصحيحة: ${score}/${totalQuestions}
Nilai: ${percentage}%
    
${motivationalPhrases[phraseKey]}
    `.trim())
    
    delete conn.cerdasCermat[m.sender]
  }
}

async function sendQuestion(conn, m) {
  const session = conn.cerdasCermat[m.sender]
  const questionData = session.questions[session.currentQuestion]
  
  let questionText = `السؤال ${session.currentQuestion + 1}/${session.questions.length}\n\n${questionData.pertanyaan}\n\n`
  questionData.semua_jawaban.forEach(option => {
    const [key, value] = Object.entries(option)[0]
    questionText += `${key.toUpperCase()}. ${value}\n`
  })
  
  const sentMsg = await conn.sendMessage(m.chat, {
    text: questionText + '\nرُدّ على هذه الرسالة واختر أحد الخيارات [ A,B,C,D ]',
    replyTo: m.id
  })
  
  session.lastQuestionId = sentMsg.key.id
}

export default handler
