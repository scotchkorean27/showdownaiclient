var InterfaceLayer = require('./interfaceLayer').InterfaceLayer;
var Scripts = require('./zarel/data/scripts').BattleScripts;

class OfflineLayer {
    constructor() { }

    playGames(agent1, agent2, numgames, format) {
        var p1n = typeof (agent1.name) !== 'undefined' && agent1.name != 'player2' ? agent1.name : 'player1';
        var p2n = typeof (agent2.name) !== 'undefined' && agent2.name != p1n ? agent2.name : 'player2';
        var p1wins = 0;
        var p2wins = 0;
        for (var i = 0; i < numgames; i++) {
            console.log(i);
            var isComp = (toId(format) == 'competitive');
            format = (isComp ? 'randombattle': format);
            var p1 = { name: p1n, userid: p1n, interface: new InterfaceLayer('test game', p1n, null, agent1)};
            var p2 = { name: p2n, userid: p2n, interface: new InterfaceLayer('test game', p2n, null, agent2)};
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
            else if (battle.battle.winner == p2.userid) {
                p2wins++;
            }
            console.log(battle.battle.winner + ' is the winner!');
            if (isComp) {
                var teama = battle.battle.sides[0].team;
                var teamb = battle.battle.sides[1].team;
                p1.team = teama;
                p2.team = teamb;

                format = 'competitive';
                for (var j = 0; j < 2; j++) {
                    console.log(j);
                    p1.interface = new InterfaceLayer('test game', p1n, null, agent1);
                    p2.interface = new InterfaceLayer('test game', p2n, null, agent2);
                    var roomData = { id: 'test room' }
                    roomData.p1 = p1;
                    roomData.p2 = p2;
                    battle = Simulator.create(format, roomData);
                    // p1.interface = new room.Room('test game', 'test', battle);
                    battle.startGame();
                    if (battle.battle.winner == p1.userid) {
                        p1wins++;
                    }
                    else if (battle.battle.winner == p2.userid) {
                        p2wins++;
                    }
                }
                p1.team = teamb;
                p2.team = teama;
                for (var j = 0; j < 3; j++) {
                    console.log(j);
                    p1.interface = new InterfaceLayer('test game', p1n, null, agent1);
                    p2.interface = new InterfaceLayer('test game', p2n, null, agent2);
                    var roomData = { id: 'test room' }
                    roomData.p1 = p1;
                    roomData.p2 = p2;
                    battle = Simulator.create(format, roomData);
                    // p1.interface = new room.Room('test game', 'test', battle);
                    battle.startGame();
                    if (battle.battle.winner == p1.userid) {
                        p1wins++;
                    }
                    else if (battle.battle.winner == p2.userid) {
                        p2wins++;
                    }
                }
            }
        }
        console.log(p1n + ' wins: ' + p1wins);
        console.log(p2n + ' wins: ' + p2wins);
        return [p1wins, p2wins];
    }
    //console.log(battle);
}

exports.OfflineGame = OfflineLayer;
