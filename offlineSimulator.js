/**
 * Simulator abstraction layer
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This file abstracts away Pokemon Showdown's multi-process simulator
 * model. You can basically include this file, use its API, and pretend
 * Pokemon Showdown is just one big happy process.
 *
 * For the actual simulation, see battle-engine.js
 *
 * @license MIT license
 */

// This has been modified from Zarel's original code (in simulator.js) to work purely offline.

'use strict';

global.Config = require('./zarel/config/config');

const BattleEngine = require('./zarel/battle-engine').Battle;

class Battle {
    constructor(room, format) {
        this.id = room.id;
        this.room = room;
        this.title = Tools.getFormat(format).name;
        if (!this.title.endsWith(" Battle")) this.title += " Battle";

        this.format = toId(format);
        this.started = false;
        this.ended = false;
        this.active = false;

        this.players = Object.create(null);
        this.playerCount = 0;
        this.playerCap = 2;
        this.p1 = room.p1;
        this.p2 = room.p2;
        this.p1.interface.cLayer = this;
        this.p2.interface.cLayer = this;
        this.p1.interface.processLine('|player|p1|' + this.p1.interface.uname + '|0');
        this.p2.interface.processLine('|player|p2|' + this.p2.interface.uname + '|0');

        this.playerNames = [this.p1.name, this.p2.name];
        this.requests = {};

        // log information
        this.logData = null;
        this.endType = 'normal';

        this.rqid = '';
        this.inactiveQueued = false;
        
        // SCOTT: What I do here is a sin against humanity.  Nobody should ever do this
        function battleSend(type, data) {
            if (Array.isArray(data)) data = data.join("\n");
            this.upRoom.receive(this.upRoom.id + "\n" + type + "\n" + data);
        }

        this.battle = BattleEngine.construct(this.id, this.format, '', battleSend);
        this.battle.upRoom = this;
        this.joinGame(this.p1);
        this.joinGame(this.p2);
        this.battle.sendUpdates(0, false);

        this.gameOver = false;
    }

    startGame() {
        this.joinGame(this.p1);
        
        this.joinGame(this.p2);
       // this.battle.sendUpdates(0, false);
    }
    
    sendFor(user, action) {
        let player = this.players[user];
        if (!player) return;

        this.send.apply(this, [action, player.slot].concat(slice.call(arguments, 2)));
    }
    choose(user, data) {
        this.sendFor(user, 'choose', data);
    }
    undo(user, data) {
        this.sendFor(user, 'undo', data);
    }
    joinGame(user) {
        this.battle.join('', user.name, 0, user.team);
        return true;
    }

    receive(lines) {
        //console.log(lines);
        lines = lines.split('\n');
        //console.log(lines);
        // console.log('Receive Start!\n' + lines);
        if (!this.gameOver) {
            switch (lines[1]) {
                case 'update':
                    /*
                    this.checkActive();
                    this.room.push(lines.slice(2));
                    this.room.update();
                    if (this.inactiveQueued) {
                        this.room.nextInactive();
                        this.inactiveQueued = false;
                    }
                    */
                    //console.log(lines);
                    // This is temporary.  We need to figure out how to best process the splits and whatnot.
                    for (var i = 2; i < lines.length; i++) {
                        if (lines[i] == '|split') {
                            i++;
                            i++;
                            this.p1.interface.processLine(lines[i]);
                            i++;
                            this.p2.interface.processLine(lines[i]);
                            i++;
                        }
                        else {
                            this.p1.interface.processLine(lines[i]);
                            this.p2.interface.processLine(lines[i]);
                        }
                    }
                    break;

                case 'winupdate':
                    /*
                    console.log(lines);
                    this.room.push(lines.slice(3));
                    this.started = true;
                    this.inactiveSide = -1;
                    if (!this.ended) {
                        this.ended = true;
                        this.room.win(lines[2]);
                        this.removeAllPlayers();
                    }
                    this.checkActive();*/
                    for (var i = 3; i < lines.length; i++) {
                        if (lines[i] == '|split') {
                            i++;
                            i++;
                            this.p1.interface.processLine(lines[i]);
                            i++;
                            this.p2.interface.processLine(lines[i]);
                            i++;
                        }
                        else {
                            this.p1.interface.processLine(lines[i]);
                            this.p2.interface.processLine(lines[i]);
                        }
                    }
                    this.gameOver = true;
                    // console.log(this.battle.log);
                    for (var i = 0; i < this.battle.log.length; i++) {
                        if (this.battle.log[i] == '|split') {
                            i += 4;
                        }
                        console.log(this.battle.log[i]);
                    }
                    break;

                case 'sideupdate': {
                    let player = this[lines[2]];
                    if (player) {
                        player.interface.processLine(lines[3]);
                    }
                    break;
                }

                case 'request': {
                    //console.log(lines);
                    let player = this[lines[2]];
                    //console.log(player);
                    let rqid = lines[3];

                    if (rqid !== this.rqid) {
                        this.rqid = rqid;
                        this.inactiveQueued = true;
                    }
                    if (player) {
                        const isNewRequest = !this.requests[player.slot] || +this.requests[player.slot][0] < +rqid;
                        if (isNewRequest) {
                            player.choiceIndex = 0;
                        }
                        this.requests[player.slot] = [rqid, lines[4]];
                        // console.log('|request|' + (player.choiceIndex ? player.choiceIndex + '|' + player.choiceData + '\n' : '') + lines[4]); 
                        // console.log(player);
                        player.interface.processLine('|request|' + lines[4]);
                        // player.sendRoom('|request|' + (player.choiceIndex ? player.choiceIndex + '|' + player.choiceData + '\n' : '') + lines[4]);
                    }
                    break;
                }

                case 'choice': {
                    let player = this[lines[2]];
                    let rqid = lines[3];
                    let choiceIndex = +lines[4];
                    let choiceData = lines[5];
                    if (rqid === this.rqid && player) {
                        player.choiceIndex = choiceIndex;
                        player.choiceData = choiceData;
                    }
                    break;
                }

                case 'log':
                    this.logData = JSON.parse(lines[2]);
                    break;

                case 'inactiveside':
                    this.inactiveSide = parseInt(lines[2]);
                    break;

                case 'score':
                    this.score = [parseInt(lines[2]), parseInt(lines[3])];
                    break;
            }
        }
    }
    win(user) {
        if (!user) {
            this.tie();
            return true;
        }
        let player = this.players[user];
        if (!player) return false;
        player.simSend('win');
    }
    tie() {
        this.send('tie');
    }
    forfeit(user, message, side) {
        if (this.ended || !this.started) return false;

        if (!message) message = ' forfeited.';

        if (side === undefined) {
            if (user in this.players) side = this.players[user].slotNum;
        }
        if (side === undefined) return false;

        let ids = ['p1', 'p2'];
        let otherids = ['p2', 'p1'];

        let name = 'Player ' + (side + 1);
        if (this[ids[side]]) {
            name = this[ids[side]].name;
        }
        
        this.endType = 'forfeit';
        this.send('win', otherids[side]);
        return true;
    }
    send(data, player) {
        data = data.split('|');
        var roomname = data[0];
        var choice = data[1].split(' ');
        var ndata = [];
        ndata[0] = roomname;
        ndata[1] = 'choose';
        ndata[2] = player;
        ndata[3] = choice[1] + ' ' + choice[2];
        this.battle.receive(ndata);
    }

    destroy() {
        this.send('dealloc');
        if (this.active) {
            this.active = false;
        }

        for (let i in this.players) {
            this.players[i].destroy();
        }
        this.players = null;
        this.room = null;
    }
}

exports.Battle = Battle;

let cBattle = null;

exports.create = function (format, room) {
    cBattle = new Battle(room, format);
    return cBattle;
};

// Messages sent by this function are received and handled in
// Battle.prototype.receive in simulator.js (in another process).
function sendBattleMessage(type, data) {
    console.log(type + ': ' + data);
    /*
    if (Array.isArray(data)) data = data.join("\n");
    process.send(this.id + "\n" + type + "\n" + data);
    */
}
