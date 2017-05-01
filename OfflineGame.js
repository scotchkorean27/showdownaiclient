var InterfaceLayer = require('./InterfaceLayer').InterfaceLayer;
var Scripts = require('./zarel/data/scripts').BattleScripts;

class OfflineLayer {
    constructor() { }

    playGames(agent1, agent2, numgames, format) {
        var p1wins = 0;
        var p2wins = 0;
        for (var i = 0; i < numgames; i++) {
            var isComp = (toId(format) == 'competitive');
            format = (isComp ? 'randombattle': format);
            var p1 = { name: 'player1', userid: 'player1', interface: new InterfaceLayer('test game', 'test', null, agent1)};
            var p2 = { name: 'player2', userid: 'player2', interface: new InterfaceLayer('test game', 'test2', null, agent2)};
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
            if (isComp) {
                var teama = battle.battle.sides[0].team;
                var teamb = battle.battle.sides[1].team;
                p1.team = teama;
                p2.team = teamb;

                format = 'competitive';
                for (var i = 0; i < 2; i++) {
                    p1.interface = new InterfaceLayer('test game', 'test', null, agent1);
                    p2.interface = new InterfaceLayer('test game', 'test2', null, agent2);
                    var roomData = { id: 'test room' }
                    roomData.p1 = p1;
                    roomData.p2 = p2;
                    battle = Simulator.create(format, roomData);
                    // p1.interface = new room.Room('test game', 'test', battle);
                    battle.startGame();
                    if (battle.battle.winner == p1.userid) {
                        p1wins++;
                    }
                    else {
                        p2wins++;
                    }
                }
                p1.team = teamb;
                p2.team = teama;
                for (var i = 0; i < 3; i++) {
                    p1.interface = new InterfaceLayer('test game', 'test', null, agent1);
                    p2.interface = new InterfaceLayer('test game', 'test2', null, agent2);
                    var roomData = { id: 'test room' }
                    roomData.p1 = p1;
                    roomData.p2 = p2;
                    battle = Simulator.create(format, roomData);
                    // p1.interface = new room.Room('test game', 'test', battle);
                    battle.startGame();
                    if (battle.battle.winner == p1.userid) {
                        p1wins++;
                    }
                    else {
                        p2wins++;
                    }
                }
            }
        }
        console.log('p1 wins: ' + p1wins);
        console.log('p2 wins: ' + p2wins);
    }
    //console.log(battle);
}

exports.OfflineGame = OfflineLayer;