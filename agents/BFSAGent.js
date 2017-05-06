'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone')
var BattleSide = require('../zarel/battle-engine').BattleSide;

// Sometimes you want to simulate things in the game that are more complicated than just damage.  For these things, we can advance our fun little forward model.
// This agent shows a way to advance the forward model.
class MultiTLAgent {
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
        if (state.sides[player].currentRequest == 'switch') {
            return this.parseRequestData({side: state.sides[player].getData()});
        }
        return this.parseRequestData( { active: activeData, side: state.sides[player].getData(), rqid: state.rqid } );
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
            else if (this.sides[1 - this.me].currentRequest == 'switch') {
                this.badTerminal = true;
            }
        }
        
        nstate.send = battleSend;
        var states = [];
        // Next we simulate the outcome of all our possible actions, while assuming our opponent does nothing each turn (uses splash, but it's kind of the same thing).
        // The gamestate receives choice data as an array with 4 items
        // battle id (we can ignore this), type (we use 'choose' to indicate a choice is made), player (formatted as p1 or p2), choice
        console.time('bfstest');

        for (var choice in options) {
            var cstate = this.cloneBattle(nstate);
            var starthp = cstate.sides[1 - cstate.me].active[0].hp;
            var moveid = options[choice].id;
            cstate.isTerminal = false;
            cstate.baseMove = choice;
            cstate.choose('p' + (1 - this.mySID + 1), 'forceskip');
            cstate.choose('p' + (this.mySID + 1), choice);
            // A variable to track if the state is an end state (an end state here is defined as an event wherein the opponent is forced to switch).
            if (cstate.isTerminal) {
                //return cstate.baseMove;
            }
            if (!cstate.badTerminal) {
                states.push(cstate);
            }
        }

        // console.log(nothing);
        
        var i = 0;
        
        //console.log(gameState);
        
        while (i < 200) {
            var cState = states.shift();
            if (!cState) {
                console.log('FAILURE!');
                return this.fetch_random_key(options);
            }
            var myTurnOptions = this.getOptions(cState, mySide.id);
            for (var choice in myTurnOptions) {
                var nstate = this.cloneBattle(cState);
                nstate.choose('p' + (1 - this.mySID + 1), 'forceskip');
                nstate.choose('p' + (this.mySID + 1), choice);
                i++;
                if (nstate.isTerminal) {
                    //return nstate.baseMove;
                }
                if (!nstate.badTerminal) {
                    states.push(nstate);
                }
            }            
        }
        console.timeEnd('bfstest');
        console.log(killme);
        console.log('oops I timed out!');
        return this.fetch_random_key(options);
    }

    assumePokemon(pname, plevel, pgender, side) {
        var nSet = {
            species: pname,
            name: pname,
            level: plevel,
            gender: pgender,
            evs: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 0 },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            nature: "Hardy",
            ability: "Honey Gather"
        };
        // If the species only has one ability, then the pokemon's ability can only have the one ability.
        // Barring zoroark, skill swap, and role play nonsense.
        // This will be pretty much how we digest abilities as well
        if (Object.keys(Tools.getTemplate(pname).abilities).length == 1) {
            nSet.ability = Tools.getTemplate(pname).abilities['0'];
        }
        var basePokemon = new Pokemon(nSet, side);
        
        return basePokemon;
    }

    digest(line) {
    }
}

exports.Agent = MultiTLAgent;