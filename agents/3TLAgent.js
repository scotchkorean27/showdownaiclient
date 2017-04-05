'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
// Note that the model (battle) contains a LOT of circular references.  So you can manually resolve them or use a deepcopy library as happens here.
var deepcopy = require('deepcopy');

// Sometimes you want to simulate things in the game that are more complicated than just damage.  For these things, we can advance our fun little forward model.
// This agent shows a way to advance the forward model.
class MultiTLAgent {
    constructor() { }

    fetch_random_key(obj) {
        var temp_key, keys = [];
        for (temp_key in obj) {
            if (obj.hasOwnProperty(temp_key)) {
                keys.push(temp_key);
            }
        }
        return keys[Math.floor(Math.random() * keys.length)];
    }

    teachSplash(pokemon) {
        var move = {
            num: 150,
            accuracy: true,
            basePower: 0,
            category: "Status",
            desc: "Nothing happens...",
            shortDesc: "Does nothing (but we still love it).",
            id: "splash",
            name: "Splash",
            pp: 40,
            priority: 0,
            flags: { gravity: 1 },
            onTryHit: function (target, source) {
                this.add('-nothing');
                return null;
            },
            secondary: false,
            target: "self",
            type: "Normal",
            contestType: "Cute",
        };
        if (move.id && pokemon.moves.indexOf(move) == -1) {
            pokemon.moves.push('splash');
            var nMove = {
                move: move.name,
                id: move.id,
                pp: (move.noPPBoosts ? move.pp : move.pp * 8 / 5),
                maxpp: (move.noPPBoosts ? move.pp : move.pp * 8 / 5),
                target: move.target,
                disabled: false,
                disabledSource: '',
                used: false,
            };
            pokemon.baseMoveset.push(nMove);
            pokemon.moveset.push(nMove);
        }
    }

    decide(gameState, options, mySide) {
        // It is important to start by making a deep copy of gameState.  We want to avoid accidentally modifying the gamestate.
        var nstate = deepcopy(gameState);
        var mySID = mySide.n;
        var choices = Object.keys(options);

        console.log("*(**+**()#$)$");

        function battleSend(type, data) {
            if (Array.isArray(data)) data = data.join("\n");
            this.upRoom.receive(this.upRoom.id + "\n" + type + "\n" + data);
        }

        nstate.upRoom = this;
        nstate.send = battleSend;
        
        nstate.sides[0].clearChoice();
        nstate.sides[1].clearChoice();
        nstate.start();
        // The pokemon equivalent of pass is a move called splash.  It is wonderful.
        this.teachSplash(nstate.sides[1 - mySID].active[0]);
        nstate.receive(['', 'choose', 'p' + (1 - mySID + 1), 'move splash']);
        nstate.receive(['', 'choose', 'p' + (mySID + 1), choices[0]]);
        console.log(choices[0]);
        console.log(nstate.log);
    }

    receive(data) {
        console.log(data);
    }

    assumePokemon(pname, plevel, pgender, side) {
        var nSet = {
            species: pname,
            name: pname,
            level: plevel,
            gender: pgender,
            evs: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 0 },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            nature: "Hardy"
        };
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

exports.Agent = MultiTLAgent;