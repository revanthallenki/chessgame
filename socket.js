const { log } = require("console");
const { createServer } = require("http");
const { Server } = require("socket.io");
const PORT=3000;
const httpServer = createServer();
const io = new Server(httpServer, { /* options */ 
    cors: {
        origin: "*",
        methods: ["*"]
    }

});






let totalplayers=0;
let players={};
let waiting={
    10:[],
    15:[],
    20:[],
};


let matches={
    10:[],
    15:[],
    20:[],
};





function firetotalplayers(){
    io.emit('total_players_cnt_change',totalplayers);
}

function removesocketfromwaitlist(socket){
    const foreachloop = [10,15,20];
    foreachloop.forEach((element)=>{
        const index=waiting[element].indexOf(socket);
        if(index>-1){
            waiting[element].splice(index,1);
        }
    })
    console.log(waiting);    
}

function fireondisconnect(socket){
    // console.log('socket disconnected');
    removesocketfromwaitlist(socket.id);
    totalplayers--;
    firetotalplayers();
}

function initialsetupmatch(opponentid, socketid,time){
    players[opponentid].emit('match_made','w',time);
    players[socketid].emit('match_made','b',time);
    
    players[opponentid].on('sync_state',function(fen ,turn){
        players[socketid].emit('sync_state_fromserver',fen,turn)
    });
    players[socketid].on('sync_state',function(fen,turn){
        players[opponentid].emit('sync_state_fromserver',fen,turn)
    });

    players[opponentid].on('game_over',function(winner){
        players[socketid].emit('game_over_fromserver',winner)
    });
    players[socketid].on('game_over',function(winner){
        players[opponentid].emit('game_over_fromserver',winner)
    });
}

function handleplayrequest(socket,time){

    if(waiting[time].length>0){
        const opponentid=waiting[time].splice(0,1)[0];
        matches[time].push({
            [opponentid] : socket.id
        })
        initialsetupmatch(opponentid,socket.id,time);
        // console.log(matches);
        return;

    }

    if(!waiting[time].includes(socket.id)){
        waiting[time].push(socket.id);
    }
}

function fireonconnect(socket){
    // console.log('socket connected');
    socket.on('want_to_play',function(timer){
        console.log(timer);
        handleplayrequest(socket,timer);
        // console.log(waiting);
    })
    totalplayers++;
    firetotalplayers();
}

io.on("connection", (socket) => {
    // io.emit('i_am_connected');
    players[socket.id]=socket;
    fireonconnect(socket);
    socket.on('disconnect',()=>fireondisconnect(socket))
});





httpServer.listen(PORT);
console.log("ur server is running at port " + PORT);