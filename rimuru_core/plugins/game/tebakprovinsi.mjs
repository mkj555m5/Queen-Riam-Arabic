export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

// 1. REGISTRASI GAME KE ENGINE
games.register('tebakprovinsi', {
    // === METADATA ===
    alias: ['tprovinsi', 'tebakprov', 'provinsi'], 
    emoji: '🇮🇩',                          
    title: 'خمّن المقاطعة',
    description: 'خمّن اسم المقاطعة من عاصمتها',
    
    // === BEHAVIOR & TIMING ===
    timeout: 60000,                       // 60 ثانية للإجابة
    cooldown: 5,                          // فاصل 5 ثوانٍ بين الأوامر
    
    // === المكافآت ===
    rewards: {
        energi: 3,                        
        koin: 500,                       
        exp: 1000
    },

    // === DATA CONFIGURATION ===
    dataFile: 'tebakprovinsi.json',         
    questionField: 'soal',                
    answerField: 'jawaban',               
    
    // === IMAGE CONFIGURATION ===
    hasImage: false,                      // Game berbasis teks
    
    // === EKSTRA ===
    hintCount: 3                          
})

// 2. EXPORT INSTANCE HANDLER (WAJIB STANDAR V2)
const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakprovinsi')
export { pluginConfig as config, handler, answerHandler }
