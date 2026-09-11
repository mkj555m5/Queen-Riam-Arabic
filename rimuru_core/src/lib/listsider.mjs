import fs from 'fs';
const path = './database/sider.json'

if (!fs.existsSync('./database')) fs.mkdirSync('./database')

if (!fs.existsSync(path)) {
fs.writeFileSync(path, JSON.stringify({ data: {} }, null, 2))
}

function loadDB(){
return JSON.parse(fs.readFileSync(path))
}

function saveDB(db){
fs.writeFileSync(path, JSON.stringify(db, null, 2))
}

// إضافة محادثة
function addChat(chat,user){

let db = loadDB()

if(!db.data[chat]) db.data[chat] = {}
if(!db.data[chat][user]) db.data[chat][user] = 0

db.data[chat][user]++

saveDB(db)

}

// جلب ترتيب الأكثر صمتاً (الأقل نشاطاً)
function getSiderRank(chat, members, limit = 10){

let db = loadDB()

let list = []

for(let m of members){

if(m.admin) continue

let total = db.data[chat]?.[m.id] || 0

list.push({
id: m.id,
chat: total
})

}

// ترتيب من الأقل محادثات
list.sort((a,b) => a.chat - b.chat)

return list.slice(0, limit)

}

// إعادة تعيين لمجموعة معينة
function resetSider(chat){

let db = loadDB()

db.data[chat] = {}

saveDB(db)

}

export { addChat, getSiderRank, resetSider };
