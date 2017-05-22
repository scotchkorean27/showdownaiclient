'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone')
var BattleSide = require('../zarel/battle-engine').BattleSide;
var PriorityQueue = require('priorityqueuejs');
var OppAgent = require('../agents/OTLAgent').Agent;

// Sometimes you want to simulate things in the game that are more complicated than just damage.  For these things, we can advance our fun little forward model.
// This agent shows a way to advance the forward model.
class PrunedBFSAgent {
    constructor() { this.name = 'pruned BFS' }

    getOptions(state, player) {
        if (typeof (player) == 'string' && player.startsWith('p')) {
            player = parseInt(player.substring(1)) - 1;
        }
        return Tools.parseRequestData(state.sides[player].getRequestData());
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
        var thp = state.sides[1 - state.me].active[0].hp / state.sides[1 - state.me].active[0].maxhp;
        return myp - 3 * thp - 0.3 * state.turn;
    }

    getWorstOutcome(state, playerChoice, player) {
        var opponent = new OppAgent();
        var nstate = state.copy();
        var oppChoices = this.getOptions(nstate, 1 - player);
        var pOppC = {};
        for (var choice in oppChoices) {
            if (choice.startsWith('move')) {
                pOppC[choice] = oppChoices[choice];
            }
        }
        nstate.choose('p' + (player + 1), playerChoice);
        nstate.choose('p' + (1 - player + 1), opponent.decide(nstate, pOppC, nstate.sides[1 - player]));

        return nstate;
    }

    decide(gameState, options, mySide, forceSwitch) {
        var d = new Date();
        var n = d.getTime();
        // It is important to start by making a deep copy of gameState.  We want to avoid accidentally modifying the gamestate.
        var nstate = gameState.copy();
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

        var pQueue = [];
        
        for (var choice in options) {
            var cstate = nstate.copy();
            cstate.baseMove = choice;
            var badstate = this.getWorstOutcome(cstate, choice, nstate.me);
            if (badstate.isTerminal) {
                return badstate.baseMove;
            }
            if (!badstate.badTerminal) {
                pQueue.push(badstate);
            }
        }

        var i = 0;
        while ((new Date()).getTime() - n <= 19000) {
            if (pQueue.length == 0) {
                // console.log('FAILURE!');
                return this.fetch_random_key(options);
            }
            var cState = pQueue.shift();
            var myTurnOptions = this.getOptions(cState, mySide.id);

            var prunedOptions = {};
            var btyping = -3;

            for (var choice in myTurnOptions) {
                if (choice.startsWith('move')) {
                    var move = Tools.getMove(myTurnOptions[choice].id);
                    if (move.category != 'Status') {
                        if (Tools.getEffectiveness(move.type, cState.sides[1 - cState.me].active[0].types) >= btyping) {
                            if (Tools.getEffectiveness(move.type, cState.sides[1 - cState.me].active[0].types) > btyping) {
                                prunedOptions = {};
                            }
                            prunedOptions[choice] = myTurnOptions[choice];
                            btyping = Tools.getEffectiveness(move.type, cState.sides[1 - cState.me].active[0].types);
                        }
                    }
                }
            }

            for (var choice in myTurnOptions) {
                if (choice.startsWith('move')) {
                    var move = Tools.getMove(myTurnOptions[choice].id);
                    if (move.category == 'Status') {
                        prunedOptions[choice] = myTurnOptions[choice];
                    }
                }
            }

            for (var choice in prunedOptions) {
                var nstate = this.getWorstOutcome(cState, choice, cState.me);
                if (nstate && nstate.isTerminal) {
                    return nstate.baseMove;
                }
                if (nstate && !nstate.badTerminal) {
                    pQueue.push(nstate);
                }
            }
            i++;

        }
        // console.log('oops I timed out!');
        if (!(pQueue.length == 0)) {
            return pQueue.shift().baseMove;
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

exports.Agent = PrunedBFSAgent;