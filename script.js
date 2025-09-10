var board = null;
var game = new Chess();
var $status = $('#status');
var $fen = $('#fen');
var $pgn = $('#pgn');
var whiteSquareGrey = '#a9a9a9'
var blackSquareGrey = '#696969'


let c_player = null;
let currentmatchtime = null;
let timerinstance = null;


function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
  }
  
  function greySquare (square) {
    var $square = $('#myBoard .square-' + square)
  
    var background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
      background = blackSquareGrey
    }
  
    $square.css('background', background)
  }

  

function onMouseoverSquare (square, piece) {
    // get list of possible moves for this square
    var moves = game.moves({
      square: square,
      verbose: true
    })
  
    // exit if there are no moves available for this square
    if (moves.length === 0) return
  
    // highlight the square they moused over
    greySquare(square)
  
    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
      greySquare(moves[i].to)
    }
  }
  
  function onMouseoutSquare (square, piece) {
    removeGreySquares()
  }
  




function startTimer(seconds, container, oncomplete) {
    let startTime, timer, obj, ms = seconds * 1000,
        display = document.getElementById(container);
    obj = {};
    obj.resume = function() {
        startTime = new Date().getTime();
        timer = setInterval(obj.step, 250);
    };
    obj.pause = function() {
        if (timer) {
            ms = obj.step();
            clearInterval(timer);
        }
    };
    obj.step = function() {
        let now = Math.max(0, ms - (new Date().getTime() - startTime)),
            m = Math.floor(now / 60000),
            s = Math.floor(now / 1000) % 60;
        s = (s < 10 ? "0" : "") + s;
        if (display) {
            display.innerHTML = m + ":" + s;
        }
        if (now == 0) {
            clearInterval(timer);
            obj.resume = function() {};
            if (oncomplete) oncomplete();
        }
        return now;
    };
    obj.resume();
    return obj;
}

function onDragStart(source, piece, position, orientation) {
    if (game.turn() !== c_player || game.game_over()) {
        return false;
    }
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    if (move === null) return 'snapback';

    // Manually call onMoveEnd to sync the state after a drag-and-drop move
    onMoveEnd();
}

// This function now handles all post-move logic
function onMoveEnd(oldPos, newPos) {
    updateStatus();
    socket.emit('sync_state', game.fen(), game.turn());
    if (timerinstance) {
        timerinstance.pause();
    }
    // Check for game over state here
    if (game.game_over()) {
        if (game.in_checkmate()) {
            const winner = game.turn() === 'b' ? 'White' : 'Black';
            socket.emit('game_over', winner);
        } else if (game.in_draw() || game.in_stalemate() || game.insufficient_material()) {
            socket.emit('game_over', 'draw');
        }
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateStatus() {
    var status = '';
    var moveColor = 'White';
    if (game.turn() === 'b') {
        moveColor = 'Black';
    }

    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
    } else if (game.in_draw()) {
        status = 'Game over, drawn position';
    } else {
        status = moveColor + ' to move';
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }

    // Instead of separate status elements, let's use the game-over-message div
    if (game.game_over()) {
        $('#game-over-message').html(status).show();
    } else {
         $('#game-over-message').html(status).show(); // Show whose turn it is
    }
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onMouseoutSquare: onMouseoutSquare,
  onMouseoverSquare: onMouseoverSquare,
    onMoveEnd: onMoveEnd // Implemented this function
};
board = Chessboard('myBoard', config);

function handlePlayButtonClick(event) {
    const time = Number(event.target.getAttribute('data-time'));
    socket.emit('want_to_play', time);
    $('#main-element').hide();
    $('#waiting_text_p').show();
}

document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.getElementsByClassName('timer-button');
    for (let index = 0; index < buttons.length; index++) {
        const button = buttons[index];
        button.addEventListener('click', handlePlayButtonClick);
    }

    $('#make-move-btn').on('click', function() {
        makeMoveFromInput();
    });

    $('#voice-move-btn').on('click', function() {
        startSpeechRecognition();
    });

    function makeMoveFromInput() {
        if (game.turn() !== c_player) {
            showMoveError("It's not your turn.");
            return;
        }

        const moveStr = $('#move-input').val();
        if (!moveStr) return;
        
        const move = game.move(moveStr, { sloppy: true });

        if (move === null) {
            showMoveError('Illegal move.');
            return;
        }
        
        hideMoveError();
        // Making a move programmatically will trigger onMoveEnd
        board.move(move.from + '-' + move.to);
        $('#move-input').val('');
    }

    // --- Voice Command Logic ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function() {
            $('#voice-status').text('Listening...').show();
        };

        recognition.onspeechend = function() {
            recognition.stop();
            $('#voice-status').hide();
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            handleVoiceCommand(transcript);
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            $('#voice-status').text('Error: ' + event.error).show();
        };
    }

    function startSpeechRecognition() {
        if (!recognition) {
            alert("Sorry, your browser doesn't support voice commands.");
            return;
        }
        if (game.turn() !== c_player) {
            showMoveError("It's not your turn to speak a move.");
            return;
        }
        recognition.start();
    }

    function handleVoiceCommand(command) {
        let processedCommand = command.toLowerCase();

        // Spoken numbers and common misheard words to digits/letters
        const replacements = {
            'one': '1', 'two': '2', 'to': '2', 'three': '3', 'four': '4', 'for': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'ate': '8',
            'see': 'c', 'be': 'b', 'bee': 'b'
        };
        for (const word in replacements) {
            // Use word boundaries to avoid replacing parts of words
            processedCommand = processedCommand.replace(new RegExp('\\b' + word + '\\b', 'g'), replacements[word]);
        }

        // Now, remove all non-alphanumeric characters except for the valid chess notation letters and numbers
        let moveStr = processedCommand.replace(/[^a-h1-8]/g, '');

        // Validate the format
        if (!/^[a-h][1-8][a-h][1-8]$/.test(moveStr)) {
            showMoveError('Could not understand move: "' + command + '". Processed to: "' + moveStr + '"');
            return;
        }
        
        const move = game.move(moveStr, { sloppy: true });

        if (move === null) {
            showMoveError('Illegal move: ' + command);
            return;
        }
        
        hideMoveError();
        board.move(move.from + '-' + move.to);
    }


    function showMoveError(message) {
        $('#move-error').text(message).show();
    }

    function hideMoveError() {
        $('#move-error').hide();
    }
});

const socket = io('http://localhost:3000');

socket.on('total_players_cnt_change', function(totalplayers) {
    $('#total_players').html('Total player : ' + totalplayers);
});

socket.on("match_made", (color, time) => {
    c_player = color;
    $('#main-element').show();
    $('#move-controls').css('display', 'flex');
    $('#waiting_text_p').hide();
    const currentplayer = color === 'b' ? 'Black' : 'White';
    $('#buttonsparent').html("<p id='youareplayingas'>You are playing as " + currentplayer + "</p><p id='timerdisplay'></p>");
    game.reset();
    board.start();
    board.orientation(currentplayer.toLowerCase());
    currentmatchtime = time;
    updateStatus();

    if (game.turn() === c_player) {
        if(timerinstance) timerinstance.pause();
        timerinstance = startTimer(Number(time) * 60, "timerdisplay", function() {
            const winner = game.turn() === 'b' ? 'White' : 'Black';
            socket.emit('game_over', winner);
        });
    } else {
        if(timerinstance) timerinstance.pause();
        timerinstance = null;
        // Display opponent's timer
        $('#timerdisplay').html(time + ":00");
    }
});

socket.on('sync_state_fromserver', function(fen, turn) {
    game.load(fen);
    board.position(fen);
    updateStatus();
    
    if (timerinstance) {
        timerinstance.resume();
    } else {
        timerinstance = startTimer(Number(currentmatchtime) * 60, "timerdisplay", function() {
            const winner = game.turn() === 'b' ? 'White' : 'Black';
            socket.emit('game_over', winner);
        });
    }
});

socket.on('game_over_fromserver', function(winner) {
    const message = winner === 'draw' ? "The game is a draw!" : winner + " won the match!";
    $('#game-over-message').text(message).show();
    if(timerinstance) timerinstance.pause();
});

