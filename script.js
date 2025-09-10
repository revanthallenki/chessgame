var board1=Chessboard('myBoard', 'start')

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')

let c_player=null;
let currentmatchtime=null;



function startTimer(seconds, container, oncomplete) {
    let startTime, timer, obj, ms = seconds*1000,
        display = document.getElementById(container);
    obj = {};
    obj.resume = function() {
        startTime = new Date().getTime();
        timer = setInterval(obj.step,250); // adjust this number to affect granularity
                            // lower numbers are more accurate, but more CPU-expensive
    };
    obj.pause = function() {
        ms = obj.step();
        clearInterval(timer);
    };
    obj.step = function() {
        let now = Math.max(0,ms-(new Date().getTime()-startTime)),
            m = Math.floor(now/60000), s = Math.floor(now/1000)%60;
        s = (s < 10 ? "0" : "")+s;
        display.innerHTML = m+":"+s;
        if( now == 0) {
            clearInterval(timer);
            obj.resume = function() {};
            if( oncomplete) oncomplete();
        }
        return now;
    };
    obj.resume();
    return obj;
}




function onDragStart (source, piece, position, orientation) {

    if(game.turn() != c_player){
        return false;
    }
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onMoveEnd(sorce,target){

}


function onDrop (source, target) {
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    })

    // illegal move
    if (move === null) return 'snapback'

    socket.emit('sync_state',game.fen(),game.turn());
        if(timerinstance){
            timerinstance.pause();
        }else{
            timerinstance = startTimer(Number(currentmatchtime)*60, "timerdisplay", function() {alert("Done!");});
            
        }
    updateStatus()
}


function onChange(){
    console.log("hi");
    if(game.game_over()){
        if(game.in_checkmate()){
            const winner = game.turn() === 'b' ? 'White' : 'Black';
            socket.emit('game_over',winner);
        }
    }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }

  $status.html(status)
  $fen.html(game.fen())
  $pgn.html(game.pgn())
}



var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onChange: onChange,
  onSnapEnd: onSnapEnd,
  onMoveEnd: onMoveEnd

}
board = Chessboard('myBoard', config)

updateStatus()



function handleButtonClick(event) {
    // alert("clicked")
    const timer= Number(event.target.getAttribute('data-time'));
    // alert(timer);
    socket.emit('want_to_play',timer);
    $('#main-element').hide();
    $('#waiting_text_p').show();
}

let timerinstance=null;

function handleMove(event){
    game.move('e2-e4');
    board.move('e2-e4');
    updateStatus()
    socket.emit('sync_state',game.fen(),game.turn());
        if(timerinstance){
            timerinstance.pause();
        }else{
            timerinstance = startTimer(Number(currentmatchtime)*60, "timerdisplay", function() {alert("Done!");});
            
        }
    updateStatus()
}

document.addEventListener('DOMContentLoaded',function(){
   const buttons=document.getElementsByClassName('timer-button');
   for (let index = 0; index < buttons.length; index++) {
    const button = buttons[index];
    button.addEventListener('click',handleButtonClick);
    // button.onclick(function(event){
    //     handleButtonClick(event);
    // })
    const btn=document.getElementById('movebutton');
    btn.addEventListener('click',handleMove);

    
   } 
});

const socket = io('http://localhost:3000');


socket.on('total_players_cnt_change',function(totalplayers){
    $('#total_players').html('Total player : ' + totalplayers);
})

// socket.on('i_am_connected',function(){
//     alert("u r connected to backend");
// })


socket.on("match_made",(color,time)=>{
    // alert("u are playing as " + color) 
    c_player=color;
    
    $('#main-element').show();
    $('#room-controls').show();
    $('#waiting_text_p').hide();
    const currentplayer=color === 'b' ? 'Black' : 'White';
    $('#buttonsparent').html("<p id='youareplayingas' >You are playing as " + currentplayer + "</p><p id= 'timerdisplay' ></p>");
    // $('#buttonsparent').html("<p id You are playing as " + currentplayer );
    game.reset();
    board.clear();
    board.start();
    board.orientation(currentplayer.toLowerCase());
    currentmatchtime=time;
    if(game.turn()===c_player){
        timerinstance = startTimer(Number(time)*60, "timerdisplay", function() {alert("Done!");});
    }else{
        timerinstance=null;
    }
    // pause:
    timer.pause();
    // resume:
    timer.resume();

})

socket.on('sync_state_fromserver',function(fen,turn){
    game.load(fen);
    game.setTurn(turn);
    board.position(fen);
    if(timerinstance){
        timerinstance.resume();
    }else{
        timerinstance = startTimer(Number(currentmatchtime)*60, "timerdisplay", function() {alert("Done!");});
        
    }
})

socket.on('game_over_fromserver',function(winner){
    // const msg=winner
    alert(winner + " won the match");
    window.location.reload();
})