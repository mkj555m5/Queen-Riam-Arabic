export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

// 1. REGISTRASI GAME KE ENGINE
games.register('tebakhp', {
    // === METADATA ===
    alias: ['thp', 'merekhp', 'brandhp'], 
    emoji: '📱',                          
    title: 'خمّن ماركة الهاتف',
    description: 'خمّن ماركة الهاتف من وصف ملامحها المميزة أو طرازها',
    
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
    dataFile: 'tebakhp.json',             // تم تقصيره
    questionField: 'soal',                
    answerField: 'jawaban',               
    
    // === IMAGE CONFIGURATION ===
    hasImage: false,                      // Murni teks
    
    // === EKSTRA ===
    hintCount: 3                          
})

// 2. EXPORT INSTANCE HANDLER (WAJIB STANDAR V2)
const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakhp')
export { pluginConfig as config, handler, answerHandler }
