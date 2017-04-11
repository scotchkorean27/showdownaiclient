'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;


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

    parseRequestData(request) {
        var requestData = JSON.parse(arr[2]);
        var cTurnOptions = {};
        if (requestData['active']) {
            for (var i = 0; i < requestData['active'][0]['moves'].length; i++) {
                if (requestData['active'][0]['moves'][i]['disabled'] == false && requestData['active'][0]['moves'][i].pp > 0) {
                    this.cTurnOptions['move ' + requestData['active'][0]['moves'][i].id] = requestData['active'][0]['moves'][i];
                }
            }
        }
        if (requestData['side'] && !(requestData['active'] && requestData['active'][0]['trapped'])) {
            // Basically, if we switch to zoroark, the request data will reflect it, but the switch event data will not.
            // Therefore, if a switch event happens on this turn, we override the swapped pokemon with zoroark
            this.zoroarkActive = requestData['side']['pokemon'][0].details.startsWith('Zoroark');
            for (var i = 1; i < requestData['side']['pokemon'].length; i++) {
                if (requestData['side']['pokemon'][i].condition.indexOf('fnt') == -1) {
                    this.cTurnOptions['switch ' + (i + 1)] = requestData['side']['pokemon'][i];
                }
            }
        }
        for (var option in this.cTurnOptions) {
            this.cTurnOptions[option].choice = option;
        }
        return cTurnOptions;
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
        var nState = gameState.copy();

        nState.weather = "sun";
        console.log(nState.weather);
        console.log(gameState.weather);
        nState.sides[0].n = 3;
        console.log(nState.p1.n);
        console.log(gameState.p1.n);
        console.log(gameState.sides[mySide.n].active[0]);
    }

    receive(data) {
        var lines = data.split('\n');
        if (lines[1] == 'request') {
            if (lines[2] == 'p' + (this.mySID + 1)) {
            }
            else {
                console.log(lines[3]);
            }
        }
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