// plugins/xo2.js — XO متعدد اللاعبين (لاعب ضد لاعب)
// الاستخدام:
//   .xo2 @target          — بدء لعبة جديدة ضد شخص معين
//   .xo2 (مع رد على رسالة الهدف) — بدء لعبة جديدة ضد الشخص المردود عليه
//   .xo2 <1-9>            — وضع علامة في الخانة المختارة (خلال لعبة قائمة)
//   .xo2 end              — إنهاء اللعبة الحالية (استسلام)
//   .xo2 status           — عرض حالة اللعبة الحالية
// القواعد:
//   - فقط اللاعب اللي بدأ اللعبة والمنافس المختار يقدروا يلعبوا
//   - اللاعب اللي بدأ هو X، والمنافس هو O
//   - تناوب الأدوار تلقائياً

'use strict';

// خريطة: chatId → Game
const games = new Map();

const WIN_PATTERNS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // الصفوف
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // الأعمدة
    [0, 4, 8], [2, 4, 6],             // الأقطار
];

const CELL_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

class XoGame {
    constructor(player1Jid, player2Jid, player1Name, player2Name, chatId) {
        this.player1 = player1Jid; // X
        this.player2 = player2Jid; // O
        this.player1Name = player1Name || 'لاعب 1';
        this.player2Name = player2Name || 'لاعب 2';
        this.chatId = chatId;
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X'; // 'X' or 'O'
        this.winner = null;
        this.draw = false;
        this.moveCount = 0;
        this.createdAt = Date.now();
    }

    whoseTurn() {
        return this.currentPlayer === 'X' ? this.player1 : this.player2;
    }

    whoseTurnName() {
        return this.currentPlayer === 'X' ? this.player1Name : this.player2Name;
    }

    canPlay(playerJid) {
        if (this.winner || this.draw) return false;
        return playerJid === this.player1 || playerJid === this.player2;
    }

    isPlayerTurn(playerJid) {
        if (this.winner || this.draw) return false;
        return playerJid === this.whoseTurn();
    }

    play(cellIndex, playerJid) {
        // إرجاع: 'ok' | 'not_your_turn' | 'cell_taken' | 'not_player' | 'game_over' | 'invalid_cell'
        if (this.winner || this.draw) return 'game_over';
        if (playerJid !== this.player1 && playerJid !== this.player2) return 'not_player';
        if (playerJid !== this.whoseTurn()) return 'not_your_turn';

        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) return 'invalid_cell';
        if (this.board[cellIndex] !== null) return 'cell_taken';

        this.board[cellIndex] = this.currentPlayer;
        this.moveCount++;

        // تحقق من الفوز
        if (this.checkWin(this.currentPlayer)) {
            this.winner = this.currentPlayer;
            return 'win';
        }
        // تحقق من التعادل
        if (this.moveCount >= 9) {
            this.draw = true;
            return 'draw';
        }
        // تبديل الدور
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        return 'ok';
    }

    checkWin(player) {
        return WIN_PATTERNS.some(pattern => pattern.every(i => this.board[i] === player));
    }

    getWinnerName() {
        if (!this.winner) return '';
        return this.winner === 'X' ? this.player1Name : this.player2Name;
    }

    getWinnerJid() {
        if (!this.winner) return '';
        return this.winner === 'X' ? this.player1 : this.player2;
    }

    render() {
        let text = '';
        for (let i = 0; i < 9; i++) {
            const cell = this.board[i];
            if (cell === 'X') text += '❌';
            else if (cell === 'O') text += '⭕';
            else text += CELL_EMOJI[i];

            if ((i + 1) % 3 === 0 && i !== 8) text += '\n';
            else if (i !== 8) text += ' | ';
        }
        return text;
    }
}

function getSenderJid(message, sock) {
    const participant = message.key?.participant ||
                        message.message?.extendedTextMessage?.contextInfo?.participant;
    if (participant) return participant;
    if (message.key?.fromMe && sock?.user?.id) return sock.user.id;
    return message.key?.remoteJid || '';
}

function extractTargetJid(message, query) {
    // 1. mention في النص
    const text = message.message?.extendedTextMessage?.text ||
                 message.message?.conversation || '';
    const mentionMatches = [...text.matchAll(/@(\d+)/g)];
    if (mentionMatches.length > 0) {
        return mentionMatches[0][1] + '@s.whatsapp.net';
    }
    // 2. mention في contextInfo
    const ctxMentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJidList;
    if (Array.isArray(ctxMentionedJidList) && ctxMentionedJidList.length > 0) {
        return ctxMentionedJidList[0];
    }
    // 3. participant في رسالة مقتبسة (reply)
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;
    return null;
}

function getPushName(message, sock) {
    return message.pushName || 'لاعب';
}

async function xo2Command(sock, chatId, message, args, query, ctx) {
    const senderJid = ctx?.sender || getSenderJid(message, sock);
    const arg = (args[0] || '').toLowerCase().trim();

    // ── .xo2 end — إنهاء اللعبة ───────────────────────────────────────────────
    if (arg === 'end' || arg === 'stop' || arg === 'surrender' || arg === 'استسلام') {
        const game = games.get(chatId);
        if (!game) {
            await sock.sendMessage(chatId, { text: '⚠️ لا توجد لعبة قائمة في هذه المجموعة.' }, { quoted: message });
            return;
        }
        if (!game.canPlay(senderJid) && senderJid !== game.player1 && senderJid !== game.player2) {
            await sock.sendMessage(chatId, { text: '❌ هذه اللعبة ليست لك. فقط اللاعبان يقدران إنهاءها.' }, { quoted: message });
            return;
        }
        games.delete(chatId);
        await sock.sendMessage(chatId, {
            text:
                `🏳️ *انتهت اللعبة*\n\n` +
                `تم إنهاء لعبة XO بين:\n` +
                `❌ ${game.player1Name}\n` +
                `⭕ ${game.player2Name}`,
        }, { quoted: message });
        return;
    }

    // ── .xo2 status — حالة اللعبة ─────────────────────────────────────────────
    if (arg === 'status' || arg === 'state' || arg === 'info') {
        const game = games.get(chatId);
        if (!game) {
            await sock.sendMessage(chatId, { text: '⚠️ لا توجد لعبة قائمة.' }, { quoted: message });
            return;
        }
        let text =
            `🎮 *حالة لعبة XO*\n\n` +
            `❌ اللاعب الأول: ${game.player1Name}\n` +
            `⭕ اللاعب الثاني: ${game.player2Name}\n\n` +
            `دور الآن: ${game.whoseTurn() === 'X' ? '❌' : '⭕'} ${game.whoseTurnName()}\n\n` +
            `📊 عدد الحركات: ${game.moveCount}/9\n\n`;
        if (game.winner) {
            text = `🏆 *فاز ${game.getWinnerName()}!*\n\n` + text;
        } else if (game.draw) {
            text = `🤝 *تعادل!*\n\n` + text;
        }
        text += `📋 اللوحة:\n${game.render()}`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        return;
    }

    // ── .xo2 <1-9> — وضع علامة ────────────────────────────────────────────────
    if (/^[1-9]$/.test(arg)) {
        const game = games.get(chatId);
        if (!game) {
            await sock.sendMessage(chatId, {
                text: '⚠️ لا توجد لعبة قائمة. ابدأ لعبة جديدة:\n• *.xo2 @target* — لبدء لعبة ضد شخص\n• *.xo2* (مع رد على رسالة الهدف)',
            }, { quoted: message });
            return;
        }
        const cellIndex = parseInt(arg, 10) - 1; // 0-8
        const result = game.play(cellIndex, senderJid);

        if (result === 'not_player') {
            await sock.sendMessage(chatId, {
                text: '🚫 هذه اللعبة ليست لك!\n\nفقط اللاعبان المحددان يقدران اللعب.\n• ❌ ' + game.player1Name + '\n• ⭕ ' + game.player2Name,
            }, { quoted: message });
            return;
        }
        if (result === 'not_your_turn') {
            const turnName = game.whoseTurnName();
            await sock.sendMessage(chatId, {
                text: `⏳ ليس دورك! الدور الآن لـ *${turnName}* (${game.whoseTurn() === 'X' ? '❌' : '⭕'}).`,
            }, { quoted: message });
            return;
        }
        if (result === 'cell_taken') {
            await sock.sendMessage(chatId, { text: '⚠️ هذه الخانة محجوزة بالفعل. اختر خانة فارغة.' }, { quoted: message });
            return;
        }
        if (result === 'game_over') {
            await sock.sendMessage(chatId, {
                text: '🏁 اللعبة انتهت بالفعل.\n\nاستخدم *.xo2 @target* لبدء لعبة جديدة.',
            }, { quoted: message });
            return;
        }
        if (result === 'invalid_cell') {
            await sock.sendMessage(chatId, { text: '⚠️ خانة غير صحيحة. اختر رقم من 1 إلى 9.' }, { quoted: message });
            return;
        }

        // ── الفوز ──────────────────────────────────────────────────────────────
        if (result === 'win') {
            const winnerName = game.getWinnerName();
            await sock.sendMessage(chatId, {
                text:
                    `🏆 *مبروك ${winnerName}! فاز باللعبة!* 🎉\n\n` +
                    `📋 اللوحة النهائية:\n${game.render()}\n\n` +
                    `📊 عدد الحركات: ${game.moveCount}\n\n` +
                    `استخدم *.xo2 @target* لبدء لعبة جديدة.`,
                mentions: [game.getWinnerJid()],
            }, { quoted: message });
            games.delete(chatId);
            return;
        }

        // ── تعادل ──────────────────────────────────────────────────────────────
        if (result === 'draw') {
            await sock.sendMessage(chatId, {
                text:
                    `🤝 *تعادل!*\n\n` +
                    `📋 اللوحة النهائية:\n${game.render()}\n\n` +
                    `📊 عدد الحركات: ${game.moveCount}\n\n` +
                    `استخدم *.xo2 @target* لبدء لعبة جديدة.`,
            }, { quoted: message });
            games.delete(chatId);
            return;
        }

        // ── استمرار اللعب ─────────────────────────────────────────────────────
        const nextName = game.whoseTurnName();
        const nextMark = game.whoseTurn() === 'X' ? '❌' : '⭕';
        await sock.sendMessage(chatId, {
            text:
                `📋 *لوحة XO*\n\n${game.render()}\n\n` +
                `🎯 الدور الآن لـ: ${nextMark} *${nextName}*\n` +
                `📊 الحركات: ${game.moveCount}/9\n` +
                `💡 أرسل *.xo2 <1-9>* لوضع علامة`,
            mentions: [game.whoseTurn()],
        }, { quoted: message });
        return;
    }

    // ── بدء لعبة جديدة: .xo2 @target أو .xo2 (مع رد) ─────────────────────────
    const targetJid = extractTargetJid(message, query);

    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text:
                `🎮 *XO - لعبة لاعب ضد لاعب*\n\n` +
                `*طريقة الاستخدام:*\n` +
                `• *.xo2 @target* — ابدأ لعبة ضد شخص معين (mention)\n` +
                `• رد على رسالة الشخص واكتب *.xo2* — ابدأ لعبة ضد اللي رديت عليه\n\n` +
                `*أثناء اللعب:*\n` +
                `• *.xo2 <1-9>* — ضع علامة في الخانة المختارة\n` +
                `• *.xo2 end* — إنهاء اللعبة\n` +
                `• *.xo2 status* — عرض حالة اللعبة\n\n` +
                `⚠️ ملاحظة: اللاعب الأول (اللي بدأ) هو ❌، والمنافس هو ⭕\n` +
                `🔒 فقط اللاعبان المحددان يقدرون اللعب.`,
        }, { quoted: message });
        return;
    }

    // منع اللعب ضد نفسك
    if (targetJid === senderJid) {
        await sock.sendMessage(chatId, {
            text: '❌ لا يمكنك اللعب ضد نفسك! منادِ شخصاً آخر.',
        }, { quoted: message });
        return;
    }

    // لو فيه لعبة قائمة
    if (games.has(chatId)) {
        const existing = games.get(chatId);
        await sock.sendMessage(chatId, {
            text:
                `⚠️ توجد لعبة قائمة بالفعل في هذه المجموعة!\n\n` +
                `❌ ${existing.player1Name}\n⭕ ${existing.player2Name}\n\n` +
                `استخدم *.xo2 end* لإنهائها أولاً، ثم ابدأ لعبة جديدة.`,
        }, { quoted: message });
        return;
    }

    // الأسماء
    const senderName = message.pushName || (senderJid.split('@')[0]);
    // محاولة الحصول على اسم الهدف من mentionedJidList أو من participant
    let targetName = targetJid.split('@')[0];
    // لو الـ mention جاي مع pushName للهدف، نستخدمها (محدش بيدينا اسم الهدف مباشرة)

    // إنشاء اللعبة
    const game = new XoGame(senderJid, targetJid, senderName, targetName, chatId);
    games.set(chatId, game);

    await sock.sendMessage(chatId, {
        text:
            `🎮 *بدأت لعبة XO جديدة!* 🎉\n\n` +
            `❌ اللاعب الأول (X): *${senderName}*\n` +
            `⭕ اللاعب الثاني (O): *${targetName}*\n\n` +
            `📋 اللوحة:\n${game.render()}\n\n` +
            `🎯 الدور الأول لـ: ❌ *${senderName}*\n` +
            `💡 أرسل *.xo2 <1-9>* لوضع علامة\n` +
            `💡 أرسل *.xo2 end* لإنهاء اللعبة\n\n` +
            `🔒 فقط اللاعبان يقدران اللعب.`,
        mentions: [senderJid, targetJid],
    }, { quoted: message });
}


const { bot } = require('../lib/pluginLoader');

bot({
    command: ['xo2', 'ttt2', 'xo-2p'],
    description: 'XO (Tic Tac Toe) — لاعب ضد لاعب (vs specific person)',
    category: 'games',
}, async (sock, chatId, message, args, query, ctx) => {
    await xo2Command(sock, chatId, message, args, query, ctx);
});
