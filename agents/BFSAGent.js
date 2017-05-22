'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var BattleSide = require('../zarel/battle-engine').BattleSide;

// Sometimes you want to simulate things in the game that are more complicated than just damage.  For these things, we can advance our fun little forward model.
// This agent shows a way to advance the forward model.
class MultiTLAgent {
    constructor() { this.name = 'BFS' }

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

    decide(gameState, options, mySide, forceSwitch) {
        // It is important to start by making a deep copy of gameState.  We want to avoid accidentally modifying the gamestate.
        var nstate = gameState.copy();
        nstate.p1.currentRequest = 'move';
        nstate.p2.currentRequest = 'move';
        nstate.me = mySide.n;
        this.mySID = mySide.n;
        this.mySide = mySide.id;

        var d = new Date();
        var n = d.getTime();

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


        for (var choice in options) {
            var cstate = nstate.copy();
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
        
        while ((new Date()).getTime() - n < 19000) {
            var cState = states.shift();
            if (!cState) {
                console.log('FAILURE!');
                return this.fetch_random_key(options);
            }
            var myTurnOptions = this.getOptions(cState, mySide.id);
            for (var choice in myTurnOptions) {
                var nstate = cState.copy();
                nstate.choose('p' + (1 - this.mySID + 1), 'forceskip');
                nstate.choose('p' + (this.mySID + 1), choice);
                i++;
                if (nstate.isTerminal) {
                    return nstate.baseMove;
                }
                if (!nstate.badTerminal) {
                    states.push(nstate);
                }
            }            
        }
        // console.log('oops I timed out!');
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