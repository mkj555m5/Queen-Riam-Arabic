import { randomUUID } from 'crypto'

const CHESS_HTML = `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;min-height:100%;background:#071538;color:#eaf2ff}
body{padding:8px;overflow-y:auto}
#chess-app{max-width:420px;margin:0 auto;padding:4px}
.chess-title{font:900 20px Arial;text-align:center;color:#58c7ff;text-shadow:0 0 12px rgba(88,199,255,.45);margin:4px 0 2px}
.chess-subtitle{font:700 9px Arial;text-align:center;letter-spacing:2px;color:#7a9cc8;margin-bottom:10px}
.chess-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(8,minmax(0,1fr));width:min(92vw,360px);max-width:360px;aspect-ratio:1/1;height:auto;margin:0 auto 12px;border:3px solid #00d9ff;border-radius:14px;overflow:hidden;box-shadow:0 0 12px rgba(0,217,255,.75),0 0 24px rgba(0,217,255,.35);background:#000;flex-shrink:0;}
.chess-cell{display:flex;align-items:center;justify-content:center;width:100%;height:100%;aspect-ratio:1/1;font-size:clamp(24px,8vw,38px);user-select:none;cursor:pointer;border:0;padding:0;font-family:"Times New Roman",serif;line-height:1;-webkit-tap-highlight-color:transparent;text-shadow:0 1px 2px rgba(0,0,0,.8),0 0 5px rgba(0,217,255,.35);}
.chess-cell.light{background:#f4f4f4;color:#111;}
.chess-cell.dark{background:#050505;color:#f8f8f8;}
.chess-cell.light:nth-child(n){box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);}
.chess-cell.dark:nth-child(n){box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);}
.chess-cell.sel{outline:3px solid #00d9ff;outline-offset:-3px;background:#0b5f73!important;}
.chess-cell.hint{box-shadow:inset 0 0 0 4px rgba(34,197,94,.85),0 0 12px rgba(34,197,94,.35)!important;}
.chess-cell.check{background:#7f1d1d!important;box-shadow:inset 0 0 0 4px #ef4444,0 0 16px rgba(239,68,68,.8)!important;}
.chess-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:min(92vw,360px);margin:0 auto 10px;}
.chess-controls select{padding:9px;border-radius:10px;background:var(--bg3);border:1px solid var(--border);color:#fff;font-size:12px;font-weight:700;outline:none;}
.chess-cell.white-piece{color:#ffffff;text-shadow:0 0 2px #000,0 0 5px #000,0 0 10px rgba(0,217,255,.55);}
.chess-cell.black-piece{color:#111;text-shadow:0 0 2px #fff,0 0 5px rgba(0,217,255,.55);}
.chess-cell.dark.black-piece{color:#101010;text-shadow:0 0 2px #fff,0 0 6px #fff,0 0 10px rgba(0,217,255,.65);}
.chess-cell.light.white-piece{color:#fff;text-shadow:0 0 2px #000,0 0 6px #000,0 0 10px rgba(0,217,255,.5);}
.chess-info,.subway-info{font-size:12px;color:var(--muted);text-align:center;line-height:1.6;margin-bottom:10px;}
.game-btn{padding:9px 12px;border-radius:10px;background:rgba(124,58,237,.12);border:1px solid var(--border);color:#fff;font-family:Sora,sans-serif;font-size:12px;font-weight:700;cursor:pointer;}
</style>
<div id="chess-app">
  <div class="chess-title">♟️ CHESS</div>
  <div class="chess-subtitle">PLAY • THINK • CHECKMATE</div>
  <div class="chess-info" id="chess-info">اختر نمط اللعب.</div>
  <div class="chess-controls">
    <select id="chess-mode" onchange="resetChessGame()">
      <option value="bot">Lawan Bot</option>
      <option value="two">لاعبان</option>
          </select>
    <select id="chess-side" onchange="resetChessGame()">
      <option value="w">أنت الأبيض</option>
      <option value="b">أنت الأسود</option>
    </select>
  </div>
  <div class="chess-board" id="chess-board"></div>
  <div style="text-align:center"><button class="game-btn" onclick="resetChessGame()">↻ Ulang Catur</button></div>
</div>
<script>
(function(){
  function id(x){return document.getElementById(x)}
var chessSelected=null;
  var chessBoard=[];
  var chessTurn='w';
  var chessGameOver=false;
  var chessHumanSide='w';
  var chessMode='bot';
  var chessHints=[];
  var chessAudio=null;
  var chessWinPlayed=false;
  var pieces={r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',R:'♖',N:'♘',B:'♗',Q:'♛',P:'♙'};
  function cloneBoard(b){return b.map(function(row){return row.slice()});}
  function chessAC(){try{if(!chessAudio){var C=window.AudioContext||window.webkitAudioContext;if(!C)return null;chessAudio=new C()}if(chessAudio.state==='suspended')chessAudio.resume();return chessAudio}catch(e){return null}}
  function chessTone(freq,dur,type,gain,start,slide){var a=chessAC();if(!a)return;try{var t=a.currentTime+(start||0),o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);g.gain.setValueAtTime(gain||.06,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.02)}catch(e){}}
  function chessNoise(dur,gain,cutoff){var a=chessAC();if(!a)return;try{var len=Math.max(1,Math.floor(a.sampleRate*dur)),b=a.createBuffer(1,len,a.sampleRate),c=b.getChannelData(0);for(var i=0;i<len;i++)c[i]=Math.random()*2-1;var src=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();src.buffer=b;f.type='lowpass';f.frequency.value=cutoff||1200;g.gain.setValueAtTime(gain||.05,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);src.connect(f);f.connect(g);g.connect(a.destination);src.start();src.stop(a.currentTime+dur+.02)}catch(e){}}
  function sChessSelect(){chessTone(540,.05,'triangle',.045);}
  function sChessMove(){chessTone(420,.08,'sine',.07,0,620);chessTone(620,.045,'triangle',.03,.03);}
  function sChessCapture(){chessNoise(.09,.11,1800);chessTone(240,.11,'square',.08,0,110);chessTone(720,.06,'triangle',.05,.025,400);}
  function sChessCheck(){chessTone(880,.10,'sine',.08);chessTone(1175,.14,'sine',.06,.11);}
  function sChessWin(){[523,659,784,1047,1319].forEach(function(f,i){chessTone(f,.14,'triangle',.075,i*.085)});chessTone(1568,.3,'sine',.045,.42);}
  function sChessDraw(){chessTone(392,.12,'triangle',.06);chessTone(330,.18,'triangle',.05,.13);}
  function sChessIllegal(){chessTone(180,.06,'square',.055,0,120);}
  function inBoard(r,c){return r>=0&&r<8&&c>=0&&c<8;}
  function sideOf(p){if(!p||p==='.')return null; return p===p.toUpperCase()?'w':'b';}
  function enemy(a,b){return a&&b&&a!==b;}
  function getChessOpt(){
    var m=id('chess-mode'), s=id('chess-side');
    chessMode=m?m.value:'bot'; chessHumanSide=s?s.value:'w';
    if(chessMode==='two' && s) s.disabled=true; else if(s) s.disabled=false;
  }
  function initChess(){
    getChessOpt();
    chessBoard=['rnbqkbnr','pppppppp','........','........','........','........','PPPPPPPP','RNBQKBNR'].map(function(r){return r.split('')});
    chessSelected=null; chessHints=[]; chessTurn='w'; chessGameOver=false; chessWinPlayed=false; renderChess(); updateChessInfo();
    if(chessMode==='bot' && chessHumanSide==='b') setTimeout(botChessMove,350);
  }
  function renderChess(){
    var b=id('chess-board'); if(!b)return;
    var checkSide=isCheck(chessBoard,'w')?'w':(isCheck(chessBoard,'b')?'b':null);
    var html='';
    for(var r=0;r<8;r++)for(var c=0;c<8;c++){
      var p=chessBoard[r][c];
      var hint=chessHints.some(function(x){return x.r===r&&x.c===c});
      var isK=(p==='K'&&checkSide==='w')||(p==='k'&&checkSide==='b');
      var cls=((r+c)%2?'dark':'light')+(chessSelected&&chessSelected.r===r&&chessSelected.c===c?' sel':'')+(hint?' hint':'')+(isK?' check':'')+(p!=='.'?(sideOf(p)==='w'?' white-piece':' black-piece'):'');
      html+='<div class="chess-cell '+cls+'" onclick="chessTap('+r+','+c+')">'+(p!=='.'?pieces[p]:'')+'</div>';
    }
    b.innerHTML=html;
  }
  function rawMoves(board,r,c){
    var p=board[r][c], sde=sideOf(p), lower=p.toLowerCase(), moves=[];
    if(!sde)return moves;
    function add(nr,nc){if(inBoard(nr,nc) && sideOf(board[nr][nc])!==sde) moves.push({r:nr,c:nc});}
    function slide(dirs){dirs.forEach(function(d){var nr=r+d[0],nc=c+d[1]; while(inBoard(nr,nc)){ if(board[nr][nc]==='.') moves.push({r:nr,c:nc}); else { if(enemy(sde,sideOf(board[nr][nc]))) moves.push({r:nr,c:nc}); break; } nr+=d[0]; nc+=d[1]; }});}
    if(lower==='p'){
      var dir=sde==='w'?-1:1, start=sde==='w'?6:1;
      if(inBoard(r+dir,c)&&board[r+dir][c]==='.') moves.push({r:r+dir,c:c});
      if(r===start&&board[r+dir][c]==='.'&&board[r+2*dir][c]==='.') moves.push({r:r+2*dir,c:c});
      [-1,1].forEach(function(dc){var nr=r+dir,nc=c+dc; if(inBoard(nr,nc)&&enemy(sde,sideOf(board[nr][nc]))) moves.push({r:nr,c:nc});});
    } else if(lower==='n') [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(function(d){add(r+d[0],c+d[1]);});
    else if(lower==='b') slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
    else if(lower==='r') slide([[1,0],[-1,0],[0,1],[0,-1]]);
    else if(lower==='q') slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
    else if(lower==='k') [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(d){add(r+d[0],c+d[1]);});
    return moves;
  }
  function findKing(board,sde){var target=sde==='w'?'K':'k'; for(var r=0;r<8;r++)for(var c=0;c<8;c++)if(board[r][c]===target)return {r:r,c:c}; return null;}
  function isSquareAttacked(board,r,c,bySide){
    for(var rr=0;rr<8;rr++)for(var cc=0;cc<8;cc++){var p=board[rr][cc]; if(sideOf(p)!==bySide)continue; if(rawMoves(board,rr,cc).some(function(m){return m.r===r&&m.c===c}))return true;}
    return false;
  }
  function isCheck(board,sde){var k=findKing(board,sde); if(!k)return true; return isSquareAttacked(board,k.r,k.c,sde==='w'?'b':'w');}
  function moveBoard(board,from,to){var nb=cloneBoard(board), p=nb[from.r][from.c], captured=nb[to.r][to.c]; if(captured==='K'||captured==='k') return null; nb[to.r][to.c]=p; nb[from.r][from.c]='.'; if(p==='P'&&to.r===0)nb[to.r][to.c]='Q'; if(p==='p'&&to.r===7)nb[to.r][to.c]='q'; return nb;}
  function legalMovesFrom(board,r,c){var p=board[r][c], sde=sideOf(p); if(!sde)return []; return rawMoves(board,r,c).filter(function(m){var target=board[m.r][m.c]; if(target==='K'||target==='k')return false; var nb=moveBoard(board,{r:r,c:c},m); return nb && !isCheck(nb,sde);});}
  function allLegalMoves(sde){var arr=[]; for(var r=0;r<8;r++)for(var c=0;c<8;c++)if(sideOf(chessBoard[r][c])===sde)legalMovesFrom(chessBoard,r,c).forEach(function(m){arr.push({from:{r:r,c:c},to:m});}); return arr;}
  function canControlTurn(sde){return chessMode==='two'||sde===chessHumanSide;}
  window.chessTap=function(r,c){
    if(chessGameOver)return;
    getChessOpt();
    var p=chessBoard[r][c];
    if(!canControlTurn(chessTurn)){return;}
    if(!chessSelected){
      if(sideOf(p)===chessTurn){chessSelected={r:r,c:c}; chessHints=legalMovesFrom(chessBoard,r,c); sChessSelect(); renderChess();}
      return;
    }
    var from=chessSelected, fp=chessBoard[from.r][from.c];
    if(from.r===r&&from.c===c){chessSelected=null; chessHints=[]; renderChess(); return;}
    if(sideOf(p)===chessTurn){chessSelected={r:r,c:c}; chessHints=legalMovesFrom(chessBoard,r,c); sChessSelect(); renderChess(); return;}
    var legal=legalMovesFrom(chessBoard,from.r,from.c).some(function(m){return m.r===r&&m.c===c});
    if(!legal){sChessIllegal(); var info=id('chess-info'); if(info)info.textContent='حركة غير مسموحة. التزم بقواعد القطع ولا تترك ملكك في وضع كش.'; return;}
    var wasCapture=chessBoard[r][c]!=='.'; chessBoard=moveBoard(chessBoard,from,{r:r,c:c}); chessSelected=null; chessHints=[]; sChessMove(); if(wasCapture)sChessCapture(); chessTurn=chessTurn==='w'?'b':'w'; renderChess(); updateChessInfo();
    if(!chessGameOver && chessMode==='bot' && chessTurn!==chessHumanSide) setTimeout(botChessMove,450);
  };
  function updateChessInfo(){
    var info=id('chess-info'); if(!info)return;
    var moves=allLegalMoves(chessTurn), check=isCheck(chessBoard,chessTurn);
    if(!moves.length){if(!chessGameOver&&!chessWinPlayed){if(check)sChessWin();else sChessDraw();chessWinPlayed=true;} chessGameOver=true; info.textContent=check?('كش مات! '+(chessTurn==='w'?'الأسود':'الأبيض')+' فاز.'):('Seri! Tidak ada langkah aman.'); renderChess(); return;}
    if(check)sChessCheck();
    var modeText=chessMode==='two'?'نمط لاعبَين.':'نمط ضد البوت.';
    info.textContent=modeText+' دور '+(chessTurn==='w'?'الأبيض':'الأسود')+(check?' · الملك في وضع كش!':'');
  }
  function botChessMove(){
    getChessOpt(); if(chessGameOver||chessMode!=='bot')return;
    var moves=allLegalMoves(chessTurn); if(!moves.length){updateChessInfo(); return;}
    var captures=moves.filter(function(m){return chessBoard[m.to.r][m.to.c]!=='.'});
    var pool=captures.length?captures:moves;
    var mv=pool[Math.floor(Math.random()*pool.length)];
    var wasCapture=chessBoard[mv.to.r][mv.to.c]!=='.'; chessBoard=moveBoard(chessBoard,mv.from,mv.to); chessSelected=null; chessHints=[]; sChessMove(); if(wasCapture)sChessCapture(); chessTurn=chessTurn==='w'?'b':'w'; renderChess(); updateChessInfo();
  }
  window.resetChessGame=initChess;
  window.switchGame=function(g){
    ['chess','subway'].forEach(function(x){var t=id('game-tab-'+x),p=id('game-'+x); if(t)t.classList.toggle('active',x===g); if(p)p.classList.toggle('active',x===g);});
    if(g==='chess'&&!chessBoard.length)initChess();
  };
  initChess();
})();
</script>`

const SIG = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YcN55YRyad2+ZA=="
const CERT1 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg"
const CERT2 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZlXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYvNBkuLoZnQAq4j8yRekrQ=="

async function kirimCatur(conn, chatId) {
    const data = Buffer.from(JSON.stringify({
        __typename: 'GenAIUnifiedResponse',
        response_id: randomUUID(),
        sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
                __typename: 'GenAISingleLayoutViewModel',
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: CHESS_HTML,
                    trusted_sources: []
                }
            }
        }]
    })).toString('base64')

    return conn.relayMessage(chatId, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: "",
                botResponseId: randomUUID(),
                verificationMetadata: {
                    proofs: [{
                        version: 1,
                        useCase: 1,
                        signature: SIG,
                        certificateChain: [CERT1, CERT2]
                    }]
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{
                        messageType: 2,
                        messageText: '♟️ CHESS'
                    }],
                    unifiedResponse: { data },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: "867051314767696@bot"
                        },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {})
}

const pluginConfig = {
  name: "catur",
  alias: ['chess'],
  category: "game",
  description: "Inline Chess game",
  usage: ".catur",
  example: ".catur",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 1,
  energi: 0,
  isEnabled: true,
}

async function handler(m, { sock }) {
  try {
    await kirimCatur(sock, m.chat)
  } catch (e) {
    console.error('[CATUR]', e?.message || e)
    await m.reply('❌ فشل في إرسال اللعبة: ' + (e?.message || e))
  }
}

export { pluginConfig as config, handler }
