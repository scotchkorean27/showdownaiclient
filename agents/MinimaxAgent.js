'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone')
var BattleSide = require('../zarel/battle-engine').BattleSide;
var PriorityQueue = require('priorityqueuejs');

// Sometimes you want to simulate things in the game that are more complicated than just damage.  For these things, we can advance our fun little forward model.
// This agent shows a way to advance the forward model.
class VGreedyAgent {
    constructor() { }

    cloneBattle(state) {
        var nBattle = clone(state);
        nBattle.p1.getChoice = BattleSide.getChoice.bind(nBattle.p1);
        nBattle.p2.getChoice = BattleSide.getChoice.bind(nBattle.p2);
        nBattle.p1.clearChoice();
        nBattle.p2.clearChoice();
        return nBattle;
    }

    getOptions(state, player) {
        if (typeof (player) == 'string' && player.startsWith('p')) {
            player = parseInt(player.substring(1)) - 1;
        }
        let activeData = state.sides[player].active.map(pokemon => pokemon && pokemon.getRequestData());
        if (!state.sides[player].currentRequest) {
            return {
                forceskip: 'skip'
            };
        }
        if (state.sides[player].currentRequest == 'switch') {
            return this.parseRequestData({ side: state.sides[player].getData() });
        }
        return this.parseRequestData({ active: activeData, side: state.sides[player].getData(), rqid: state.rqid });
    }

    fetch_random_key(obj) {
        var temp_key, keys = [];
        for (temp_key in obj) {
            if (obj.hasOwnProperty(temp_key)) {
                keys.push(temp_key);
            }
        }
        return keys[Math.floor(Math.random() * keys.length)];
    }

    parseRequestData(requestData) {
        if (typeof (requestData) == 'string') { requestData = JSON.parse(request); }
        var cTurnOptions = {};
        if (requestData['active']) {
            for (var i = 0; i < requestData['active'][0]['moves'].length; i++) {
                if (requestData['active'][0]['moves'][i]['disabled'] == false && requestData['active'][0]['moves'][i].pp > 0) {
                    cTurnOptions['move ' + requestData['active'][0]['moves'][i].id] = requestData['active'][0]['moves'][i];
                }
            }
        }
        if (requestData['side'] && !(requestData['active'] && requestData['active'][0]['trapped'])) {
            // Basically, if we switch to zoroark, the request data will reflect it, but the switch event data will not.
            // Therefore, if a switch event happens on this turn, we override the swapped pokemon with zoroark
            for (var i = 1; i < requestData['side']['pokemon'].length; i++) {
                if (requestData['side']['pokemon'][i].condition.indexOf('fnt') == -1) {
                    cTurnOptions['switch ' + (i + 1)] = requestData['side']['pokemon'][i];
                }
            }
        }
        for (var option in cTurnOptions) {
            cTurnOptions[option].choice = option;
        }
        return cTurnOptions;
    }

    evaluateState(state) {
        var myp = state.sides[state.me].active[0].hp / state.sides[state.me].active[0].maxhp;
        var thp = state.sides[1 - state.me].active[0].hp / state.sides[1 - -state.me].active[0].maxhp;
        return myp - 3 * thp - 0.3 * state.turn;
    }

    getWorstOutcome(state, playerChoice, player) {
        var nstate = this.cloneBattle(state);
        var oppChoices = this.getOptions(nstate, 1 - player);
        var worststate = null;
        for (var choice in oppChoices) {
            var cstate = this.cloneBattle(nstate);
            cstate.choose('p' + (player + 1), playerChoice);
            cstate.choose('p' + (1 - player + 1), choice);
            if (worststate == null || this.evaluateState(cstate, player) < this.evaluateState(worststate, player)) {
                worststate = cstate;
            }
        }
        return worststate;
    }

    decide(gameState, options, mySide, forceSwitch) {
        // It is important to start by making a deep copy of gameState.  We want to avoid accidentally modifying the gamestate.
        var nstate = this.cloneBattle(gameState);
        nstate.p1.currentRequest = 'move';
        nstate.p2.currentRequest = 'move';
        nstate.me = mySide.n;
        this.mySID = mySide.n;
        this.mySide = mySide.id;

        function battleSend(type, data) {
            if (this.sides[1 - this.me].active[0].hp == 0) {
                this.isTerminal = true;
            }
            else if (this.sides[1 - this.me].currentRequest == 'switch' || this.sides[this.me].active[0].hp == 0) {
                this.badTerminal = true;
            }
        }

        nstate.send = battleSend;

        var pQueue = new PriorityQueue(function (a, b) {
            var myp = a.sides[a.me].active[0].hp / a.sides[a.me].active[0].maxhp;
            var thp = a.sides[1 - a.me].active[0].hp / a.sides[1 - a.me].active[0].maxhp;
            var aeval = myp - 3 * thp - 0.3 * a.turn;

            var mypb = b.sides[b.me].active[0].hp / b.sides[b.me].active[0].maxhp;
            var thpb = b.sides[1 - b.me].active[0].hp / b.sides[1 - b.me].active[0].maxhp;
            var beval = mypb - 3 * thpb - 0.3 * b.turn;

            return aeval - beval;
            }
        );
        
        for (var choice in options) {
            var cstate = this.cloneBattle(nstate);
            cstate.baseMove = choice;
            var badstate = this.getWorstOutcome(cstate, choice, nstate.me);
            if (badstate.isTerminal) {
                return badstate.baseMove;
            }
            if (!badstate.badTerminal) {
                pQueue.enq(badstate);
            }
        }
        console.time("dbsave");
        for (var i = 0; i < 1000; i++) {
            var cstate = this.cloneBattle(nstate);
            cstate.choose('p1', 'move 1');
            cstate.choose('p2', 'move 1');
        }
        console.timeEnd("dbsave");
        console.time("dbsave2");
        for (var i = 0; i < 1000; i++) {
            var cstate = this.cloneBattle(nstate);
            var wstate = this.getWorstOutcome(cstate, 'move 1', cstate.me);
        }
        console.timeEnd("dbsave2");
        console.log(killme);

        var i = 0;
        while (i < 30) {
            
            // console.log(pQueue.size());
            // console.log(this.evaluateState(cState, cState.me) + ", " + (cState.sides[cState.me].active[0].hp / cState.sides[cState.me].active[0].maxhp) + ", " + (cState.sides[1 - cState.me].active[0].hp / cState.sides[1 - cState.me].active[0].maxhp));
            /*
            if (cState.sides[1 - cState.me].active[0].hp == preveval) {
                if (shitcounter >= 5) {
                    console.log(cState.log);
                    console.log(killme);
                }
                shitcounter++;
            }
            else {
                preveval = cState.sides[1 - cState.me].active[0].hp;
                shitcounter = 0;
            }
            */
            if (pQueue.isEmpty()) {
                console.log('FAILURE!');
                return this.fetch_random_key(options);
            }
            var cState = pQueue.deq();
            var myTurnOptions = this.getOptions(cState, mySide.id);
            for (var choice in myTurnOptions) {
                var nstate = this.getWorstOutcome(cState, choice, cState.me);
                if (nstate && nstate.isTerminal) {
                    return nstate.baseMove;
                }
                if (nstate && !nstate.badTerminal) {
                    pQueue.enq(nstate);
                }
            }
            i++;

        }
        console.log('oops I timed out!');
        if (pQueue.deq().baseMove) {
            return pQueue.deq().baseMove;
        }
        return this.fetch_random_key(options);
    }

    assumePokemon(pname, plevel, pgender, side) {
        var template = Tools.getTemplate(pname);
        var nSet = {
            species: pname,
            name: pname,
            level: plevel,
            gender: pgender,
            evs: {
                hp: 85,
                atk: 85,
                def: 85,
                spa: 85,
                spd: 85,
                spe: 85
            },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            nature: "Hardy",
            moves: [],
        };
        for (var moveid in template.randomBattleMoves) {
            nSet.moves.push(toId(template.randomBattleMoves[moveid]));
        }
        var basePokemon = new Pokemon(nSet, side);
        // If the species only has one ability, then the pokemon's ability can only have the one ability.
        // Barring zoroark, skill swap, and role play nonsense.
        // This will be pretty much how we digest abilities as well
        if (Object.keys(basePokemon.template.abilities).length == 1) {
            basePokemon.baseAbility = toId(basePokemon.template.abilities['0']);
            basePokemon.ability = basePokemon.baseAbility;
            basePokemon.abilityData = { id: basePokemon.ability };
        }
        return basePokemon;
    }

    digest(line) {
    }
}

exports.Agent = VGreedyAgent;