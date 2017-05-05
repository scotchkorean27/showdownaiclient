'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone');
var BattleSide = require('../zarel/battle-engine').BattleSide;

// All Showdown AI Agents need 4 methods.

// decide takes in an approximation of the current gamestate, an associative array keyed by choices with choice details as value, and a string to remind you what side you are
// decide should return one of the keys in the array of choices.

// assumepokemon takes a name, level, gender, and the side of the pokemon in order to generate a best-guess estimate of the opponent's stats (which is hidden information)

// digest(line) is a way for you to customize how your agent deals with incoming information.  It doesn't have to do anything, but it can

// getTeam(format) should return the team that the agent plans on using.  This is only relevant if playing in a non-random format.

// All agents should also come with an assumptions object, which will guide how the InterfaceLayer deals with various aspects of hidden information.

class RandomAgent {
    constructor() {
        var fs = require('fs');
        var filename = 'perceptron.json';
        fs.open(filename, 'r', function (err, fd) {
            if (err) {
                fs.writeFile(filename, JSON.stringify({}), function (err, data) {
                    if (err) {
                        console.log(err);
                    }
                    console.log("Perceptron load failed!  Initializing new perceptron!");
                });
                this.perceptron = {};
            } else {
                this.perceptron = JSON.parse(data);
            }
        });
        this.learningRate = 0.05;
        this.bias = 0;
    }

    cloneBattle(state) {
        var nBattle = clone(state);
        nBattle.p1.getChoice = BattleSide.getChoice.bind(nBattle.p1);
        nBattle.p2.getChoice = BattleSide.getChoice.bind(nBattle.p2);
        nBattle.p1.clearChoice();
        nBattle.p2.clearChoice();
        return nBattle;
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

    encodeswitch(index) {
        return {};
    }

    encodemove(moveid) {
        return {};
    }

    encodeaction(choice) {
        var args = choice.choice.split(' ');
        if (args[0] == 'move') {
            return { move: this.encodemove(choice) };
        }
        return { switch: this.encodeswitch(choice) };
    }

    encodestate(state) {
        var encoded = {
            weather: {},
            pseudoweather: {},
            myside: {
                sideeffects: {},
                pokemon: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, status: {}, volatiles: {}, types: {}, ability: {} }
            },
            theirside: {
                sideeffects: {},
                pokemon: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, status: {}, volatiles: {}, types: {}, ability: {} }
            }
        };
        encoded.weather[state.weather] = 1;
        for (var pseudoweather in state.pseudoweather) {
            encoded.pseudoweather[pseudoweather] = 1;
        }
        for (var sideeffect in state.sides[state.me].sideConditions) {
            encoded.myside.sideeffects[sideeffect] = 1;
        }
        for (var sideeffect in state.sides[1 - state.me].sideConditions) {
            encoded.theirside.sideeffects[sideeffect] = 1;
        }
        var myPoke = state.sides[state.me].active[0];
        encoded.myside.pokemon.hp = myPoke.hp / myPoke.maxhp;
        encoded.myside.pokemon.atk = myPoke.calculateStat('atk', myPoke.boosts['atk']) / 4000;
        encoded.myside.pokemon.def = myPoke.calculateStat('def', myPoke.boosts['def']) / 4000;
        encoded.myside.pokemon.spa = myPoke.calculateStat('spa', myPoke.boosts['spa']) / 4000;
        encoded.myside.pokemon.spd = myPoke.calculateStat('spd', myPoke.boosts['spd']) / 4000;
        encoded.myside.pokemon.spe = myPoke.calculateStat('spe', myPoke.boosts['spe']) / 4000;
        encoded.myside.pokemon.status[myPoke.status] = 1;
        for (var status in myPoke.volatiles) {
            encoded.myside.pokemon.volatiles[status] = 1;
        }
        for (var type of myPoke.types) {
            encoded.myside.pokemon.types[type] = 1;
        }
        encoded.myside.pokemon.ability[myPoke.ability] = 1;

        var theirPoke = state.sides[1 - state.me].active[0];
        encoded.theirside.pokemon.hp = theirPoke.hp / theirPoke.maxhp;
        encoded.theirside.pokemon.atk = theirPoke.calculateStat('atk', theirPoke.boosts['atk']) / 4000;
        encoded.theirside.pokemon.def = theirPoke.calculateStat('def', theirPoke.boosts['def']) / 4000;
        encoded.theirside.pokemon.spa = theirPoke.calculateStat('spa', theirPoke.boosts['spa']) / 4000;
        encoded.theirside.pokemon.spd = theirPoke.calculateStat('spd', theirPoke.boosts['spd']) / 4000;
        encoded.theirside.pokemon.spe = theirPoke.calculateStat('spe', theirPoke.boosts['spe']) / 4000;
        encoded.theirside.pokemon.status[theirPoke.status] = 1;
        for (var status in theirPoke.volatiles) {
            encoded.theirside.pokemon.volatiles[status] = 1;
        }
        for (var type of theirPoke.types) {
            encoded.theirside.pokemon.types[type] = 1;
        }
        encoded.theirside.pokemon.ability[theirPoke.ability] = 1;
        return encoded;
    }

    encode(state, action) {
        var encodedTuple = { state: this.encodeState(state), action: this.encodeAction(action) };
    }

    forward(state, action) {

    }

    updateWeights(input) {

    }

    decide(gameState, options, mySide) {
        var nState = this.cloneBattle(gameState);
        nState.me = mySide.n;
        console.log(this.encodestate(nState, { choice: 'switch 1' }));
        console.log(this.encodestate(nState, { choice: 'switch 1' }).myside.pokemon);
        console.log(killme);
        return choice;
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
        console.log(line);
        var arr = line.split("|");
        var tag = arr[1];
        if (tag == "player") {
            if (arr[3] == this.uname) {
                this.mySide = arr[2];
                this.mySID = parseInt(this.mySide.substring(1)) - 1;
            }
        }
    }
}

exports.Agent = RandomAgent;