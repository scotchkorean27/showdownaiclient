var InterfaceLayer = require('./InterfaceLayer').InterfaceLayer;

class OfflineLayer {
    constructor() { }

    playGames(agent1, agent2, numgames, format) {
        var p1wins = 0;
        var p2wins = 0;
        for (var i = 0; i < numgames; i++) {
            var p1 = { name: 'player1', userid: 'player1', interface: new InterfaceLayer('test game', 'test', null, agent1) };
            var p2 = { name: 'player2', userid: 'player2', interface: new InterfaceLayer('test game', 'test2', null, agent2) };
            var roomData = { id: 'test room' }
            roomData.p1 = p1;
            roomData.p2 = p2;
            var Simulator = require('./offlineSimulator');
            var battle = Simulator.create(format, roomData);
            // p1.interface = new room.Room('test game', 'test', battle);
            battle.startGame();
            if (battle.battle.winner == p1.userid) {
                p1wins++;
            }
            else {
                p2wins++;
            }
            console.log(battle.battle.winner + ' is the winner!');
        }
        console.log('p1 wins: ' + p1wins);
        console.log('p2 wins: ' + p2wins);
    }
    //console.log(battle);
}

exports.OfflineGame = OfflineLayer;