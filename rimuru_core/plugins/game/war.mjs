export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


let handler = async (m, { conn, usedPrefix, args, command }) => {
  conn.war = conn.war ? conn.war : {}
  conn.war2 = conn.war2 ? conn.war2 : {}

  if (!args[0] || args[0] == "help") return m.reply(`*❏  W A R - Z O N E*

[1] منطقة الحرب لعبة حرب بنظام الهجوم بالتناوب
[2] تبدأ اللعبة من 1 ضد 1 حتى 5 ضد 5
[3] رأس المال الحربي هو الغنيمة إذا فاز فريقك
[4] يحصل كل لاعب على 5000 نقطة صحة
[5] نجاح الهجوم يعتمد على مستواك مقارنة بمستوى العدو
[6] Kesempatan menyerang adalah 40 ثانية, lebih dari itu dianggap AFK (pengurangan 2500 HP)
[7] يفوز الفريق إذا سقط أعضاء الفريق الخصم جميعاً (الصحة <= 0) ويحصل على الغنيمة

*❏  C O M M A N D S*
*${usedPrefix + command} join A/B* = join game
*${usedPrefix + command} left* = left game
*${usedPrefix + command} money 10xx* = مبلغ الرهان
*${usedPrefix + command} player* = player game
*${usedPrefix + command} start* = start game`)


  if (args[0] == "money"){
    if (!(m.chat in conn.war)) return m.reply(`*أنشئ غرفة أولاً (اكتب .war join)*`)
    if(m.sender == conn.war[m.chat][0].user){
      if (args[1] != "undefined" && !isNaN(args[1])){
        args[1] = parseInt(args[1])
        if (args[1] < 1000) return m.reply('*Minimal Rp. 1.000*')
        conn.war2[m.chat].money = args[1]
        return m.reply("*تم تحديد رأس المال الحربي بمقدار " + Number(args[1]).toLocaleString() + "*")
      }else {
        return m.reply("*أدخل رأس المال الحربي كرقم (بدون فواصل)*\n\n.war money 100000")
      }
    }else {
      return conn.reply(m.chat,`*فقط @${conn.war[m.chat][0].user.split('@')[0]} منشئ الغرفة يمكنه تغيير رأس المال الحربي*`,m, {contextInfo : {mentionedJid : [conn.war[m.chat][0].user]}})
    }
  }

  // JOIN
  if (args[0] == "join"){
    
    if (global.db.data.users[m.sender].money < 1000) return m.reply("*يجب أن يكون رصيدك 1000 روبية على الأقل للعب هذه اللعبة.*")
    // FIRST PLAYER
    if (!(m.chat in conn.war)) {
      conn.war2[m.chat] = {"war" : false, "turn" : 0, "time" : 0, "money" : 0}
      conn.war[m.chat] = []
      let exp = global.db.data.users[m.sender].exp
      conn.war[m.chat][0] = {"user": m.sender, "hp": 5000, "lvl": global.db.data.users[m.sender].level, "turn" : false}
      for (let i=1;i<10;i++){
        conn.war[m.chat][i] = {"user": "", "hp" : 0, "lvl" : 0, "turn" : false}
      }
      return m.reply(`*تم انضمامك إلى اللعبة ضمن الفريق A*\n\n*.war join a/b* = انضم للعبة\n*.war start* = ابدأ اللعبة`)
    }else {   // NOT FIRST PLAYER
      // IF FULL
      if (conn.war2[m.chat].war) {
        return m.reply(`*بدأت اللعبة بالفعل، لا يمكن الانضمام.*`)
      }
      // IF YOU ALREADY JOIN THE GAME
      for (let i = 0; i < conn.war[m.chat].length ; i++) {
        if (m.sender == conn.war[m.chat][i].user){
          let total = 0
          for (let i = 0 ; i < 10 ; i++) {
            if (conn.war[m.chat][i].user == ""){
              total += 1
            }
          }
          return m.reply(`*أنت في اللعبة بالفعل*\n\n*.war join a/b* = انضم للعبة\n*.war start* = ابدأ اللعبة`)
        }
      }
      
      // JOIN MILIH TIM
      if (args[1]){
        if (args[1].toLowerCase() == "a"){
          if (conn.war2[m.chat].money == 0) return conn.reply(m.chat,`*Tolong @${conn.war[m.chat][0].user.split('@')[0]} tetapkan modal awal perang (minimal Rp. 1.000.000)*\n\n.war money 1000000`,m, {contextInfo : {mentionedJid : [conn.war[m.chat][0].user]}})
          return m.reply('a')
          if (global.db.data.users[m.sender].money < conn.war2[m.chat].money) return m.reply(`*يجب أن يكون رصيدك ${conn.war2[m.chat].money.toLocaleString()} روبية على الأقل للعب هذه اللعبة.*`)
          for (let i = 1 ; i < 5 ; i++) {
            if (conn.war[m.chat][i].user == ""){
              let exp = global.db.data.users[m.sender].exp
              conn.war[m.chat][i] = {"user" : m.sender, "hp" : 5000, "lvl" : global.db.data.users[m.sender].level, "turn" : false}
              let total = 0
              for (let i = 0 ; i < 10 ; i++) {
                if (conn.war[m.chat][i].user == ""){
                  total += 1
                }
              }
              return m.reply(`*تم انضمامك إلى اللعبة ضمن الفريق A*\n\n*.war join a/b* = انضم للعبة\n*.war start* = ابدأ اللعبة`)
            }
          } 
        }else if (args[1].toLowerCase() == "b"){
          if (conn.war2[m.chat].money == 0) return conn.reply(m.chat,`*Tolong @${conn.war[m.chat][0].user.split('@')[0]} tetapkan modal awal perang (minimal Rp. 1000000)*\n\n.war money 1000000`,m, {contextInfo : {mentionedJid : [conn.war[m.chat][0].user]}})
          if (global.db.data.users[m.sender].money < conn.war2[m.chat].money) return m.reply(`*يجب أن يكون رصيدك ${conn.war2[m.chat].money.toLocaleString()} روبية على الأقل للعب هذه اللعبة.*`)
          for (let i = 5 ; i < 10 ; i++) {
            if (conn.war[m.chat][i].user == ""){
              let exp = global.db.data.users[m.sender].exp
              conn.war[m.chat][i] = {"user" : m.sender, "hp" : 5000, "lvl" : global.db.data.users[m.sender].level, "turn" : false}
              let total = 0
              for (let i = 0 ; i < 10 ; i++) {
                if (conn.war[m.chat][i].user == ""){
                  total += 1
                }
              }
              return m.reply(`*تم انضمامك إلى اللعبة ضمن الفريق B*\n\n*.war join a/b* = انضم للعبة\n*.war start* = ابدأ اللعبة`)
            }
          }
        }else {
          return m.reply(`*اختر الفريق A أو B*\n\n.war join A\n.war join B`)
        }
      }else {
        // JOIN SESUAI URUTAN
        return m.reply(`*اختر الفريق A أو B*\n\n.war join A\n.war join B`)
      }
      

      // CHECK IF ROOM FULL
      for (let i = 0 ; i < conn.war[m.chat].length ; i++) {
        let total = 0
        if (conn.war[m.chat][i].user != ""){
          total += 1
        }
        if (total == 10) conn.war2[m.chat].war = true
      }
    }
  }

  // LEFT GAME
  if (args[0] == "left"){
    // IF GAME START
    if (conn.war2[m.chat].war) {
      m.reply(`*بدأت الحرب، لا يمكنك الخروج*`)
    }else {   // IF NOT
      for (let i = 0 ; i < 10 ; i++) {
        if (m.sender == conn.war[m.chat][i].user){
          return m.reply(`*خرجت من اللعبة*`)
        }
      }
      return m.reply(`*أنت لست في اللعبة*`)
    }
  }

  // CEK PLAYER
  if (args[0] == "player"){ 
    if (!(m.chat in conn.war)) return m.reply(`*لا يوجد لاعبون في غرفة War Zone*`)
    var teamA = []
    var teamB = []
    var teamAB = []
    for (let i = 0 ; i < conn.war[m.chat].length ; i++){
      if (i < 5){
        if (conn.war[m.chat][i].user != "") teamA.push(conn.war[m.chat][i].user)
      }else {
        if (conn.war[m.chat][i].user != "") teamB.push(conn.war[m.chat][i].user)
      }
      teamAB.push(conn.war[m.chat][i].user)
    }
    // return m.reply(teamA[0])
    conn.reply(m.chat, `${conn.war2[m.chat].war ? '*الدور: ' + '@' + conn.war[m.chat][conn.war2[m.chat].turn].user.split('@')[0] + '*\n*Taruhan : Rp. ' + Number(conn.war2[m.chat].money).toLocaleString() + '*\n\n' : '*الرهان: ' + Number(conn.war2[m.chat].money).toLocaleString() + '*\n\n' }*TEAM A :*\n` + teamA.map((v, i )=> `${conn.war[m.chat][i].hp > 0 ? '❤️ ' : '☠️ ' }@${v.split('@')[0]} (Lv.${conn.war[m.chat][i].lvl} HP: ${conn.war[m.chat][i].hp})`).join`\n` + "\n\n*TEAM B :*\n" + teamB.map((v, i) => `${conn.war[m.chat][i+5].hp > 0 ? '❤️ ' : '☠️ ' }@${v.split('@')[0]} (Lv.${conn.war[m.chat][i+5].lvl} HP: ${conn.war[m.chat][i+5].hp})`).join`\n`,m, {contextInfo: {
      mentionedJid: teamAB
    }})
  }

  // START GAME
  if (args[0] == "start"){
    if (conn.war2[m.chat].war) return m.reply(`*بدأت الحرب، لا يمكن الانضمام.*`)
    teamA = 0
    teamB = 0
    for (let i=0;i<10;i++){
      if(i<5){
        if (conn.war[m.chat][i].user != "") teamA += 1
      }else{
        if (conn.war[m.chat][i].user != "") teamB += 1
      }
    }

    if (teamA == teamB && teamA > 0){
      conn.war2[m.chat].war = true
      for (let i=0;i<5;i++){
        if (conn.war[m.chat][i].user != ""){
          let user = conn.war[m.chat][i].user
          return conn.reply(m.chat,`*بدأت اللعبة بنجاح*\n*على @${user.split('@')[0]} مهاجمة العدو*\n\n.war player = إحصائيات اللاعب\n.attack @tag = هاجم الخصم`, m, {contextInfo: { mentionedJid: [user] }})
        }
      }
    }else {
      if (teamA > teamB){
        m.reply(`*الفريق B يحتاج ${teamA-teamB} أعضاء آخرين لموازنة اللعبة.*`)
      }else {
        m.reply(`*الفريق A يحتاج ${teamB-teamA} أعضاء آخرين لموازنة اللعبة.*`)
      }
    }
  } else {
  throw 'Join Dulu'
  }

}
handler.help = ['war']
handler.tags = ['game']
handler.command = /^(war)$/i
handler.group = true
export default handler
