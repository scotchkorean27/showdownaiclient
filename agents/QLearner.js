'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone');
var BattleSide = require('../zarel/battle-engine').BattleSide;

class Neuron {
    constructor(weights) {
        this.saveWeights = false;
        this.weights = {};
        if (weights) {
            this.weights = weights;
        }
    }
    forward(input) {
        var total = 0;
        for (var item in input) {
            if (typeof (input[item]) == 'object') {
                if (!this.weights[item]) {
                    this.weights[item] = {};
                }
                total += this.subforward(input[item], this.weights[item]);
            }
            else {
                if (!this.weights[item]) {
                    this.weights[item] = Math.random() * 2 - 1;
                } 
                total += this.weights[item] * input[item];
            }
        }
        return total;
    }
    subforward(input, subneuron) {
        var total = 0;
        for (var item in input) {
            if (typeof (input[item]) == 'object') {
                if (!subneuron[item]) {
                    subneuron[item] = {};
                }
                total += this.subforward(input[item], subneuron[item]);
            }
            else {
                if (!subneuron[item]) {
                    subneuron[item] = Math.random() * 2 - 1;
                }
                total += subneuron[item] * input[item];
            }
        }
        return total;
    }
    backward(input, gradient, learningrate) {
        for (var item in input) {
            if (typeof (input[item]) == 'object') {
                if (!this.weights[item]) {
                    this.weights[item] = {};
                }
                this.subbackward(input[item], this.weights[item], gradient, learningrate);
            }
            else {
                if (!this.weights[item]) {
                    this.weights[item] = Math.random() * 2 - 1;
                }
                this.weights[item] -= 2 * learningrate * gradient * input[item];
            }
        }
    }
    subbackward(input, subneuron, gradient, learningrate) {
        for (var item in input) {
            if (typeof (input[item]) == 'object') {
                if (!subneuron[item]) {
                    subneuron[item] = {};
                }
                this.subbackward(input[item], subneuron[item], gradient, learningrate);
            }
            else {
                if (!subneuron[item]) {
                    subneuron[item] = Math.random() * 2 - 1;
                }
                subneuron[item] -= 2 * learningrate * gradient * input[item];
            }
        }
    }
}

class QLearning {
    constructor() {
        this.name = 'QLearner';
        var fs = require('fs');
        this.filename = 'perceptron.json';
        if (fs.existsSync(this.filename)) {
            this.perceptron = new Neuron(JSON.parse(fs.readFileSync(this.filename)));
        }
        else {
            this.perceptron = new Neuron();
            fs.writeFileSync(this.filename, JSON.stringify(this.perceptron.weights));
        }
        this.learningRate = 0.05;
        this.bias = 0;
        this.lastencodings = [];
        this.memory = 3;
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

    encodeswitch(choice) {
        var template = Tools.getTemplate(toId(choice.details.split(',')[0]));
        var encoded = { species: {}, hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, status: {}, types: {}, ability: {}, item: {}, moves: {} };
        for (var type of template.types) {
            encoded.types[type] = 1;
        }
        encoded.ability[choice.baseAbility] = 1;
        encoded.item[choice.item] = 1;
        encoded.hp = parseInt(choice.condition.split('/')[0]) / parseInt(choice.condition.split('/')[1].split(' ')[0]);
        if (choice.condition.split(' ')[1]) {
            encoded.status[choice.condition.split(' ')[1]] = 1;
        }
        for (var stat in choice.stats) {
            encoded[stat] = choice.stats[stat] / 1000;
        }
        encoded.species[template.species] = 1;
        for (var index in choice.moves) {
            encoded.moves[choice.moves[index]] = 1;
        }
        return encoded;
    }

    encodemove(choice) {
        var encoded = { id: {}, type: {}, category: {}, damage: 0, status: {}, volatile: [], sideeffect: {}, fieldeffect: {}, accuracy: 0, target: {}};
        var move = Tools.getMove(toId(choice.id));
        encoded.id[move.id] = 1;
        encoded.type[move.type] = 1;
        encoded.category[toId(move.category)] = 1;
        if (move.basePower) {
            encoded.damage = move.basePower / 300;
        }
        if (move.status) {
            encoded.status[move.status] = 1;
        }
        if (move.volatileStatus) {
            encoded.volatile[move.volatileStatus] = 1;
        }
        if (move.sideCondition) {
            encoded.sideeffect[move.sideCondition] = 1;
        }
        if (move.weather) {
            encoded.fieldeffect[move.weather] = 1;
        }
        if (move.pseudoWeather) {
            encoded.fieldeffect[move.pseudoWeather] = 1;
        }
        encoded.accuracy = move.accuracy / 100;
        if (move.target) {
            encoded.target[move.target] = 1;
        }
        return encoded;
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
                pokemon: { species: {}, hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, status: {}, volatiles: {}, types: {}, ability: {} }
            },
            theirside: {
                sideeffects: {},
                pokemon: { species: {}, hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, status: {}, volatiles: {}, types: {}, ability: {} }
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
        encoded.myside.pokemon.species[myPoke.species] = 1;

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
        encoded.theirside.pokemon.species[theirPoke.species] = 1;
        return encoded;
    }

    encode(state, action) {
        var encodedTuple = { state: this.encodestate(state), action: this.encodeaction(action) };
        return encodedTuple;
    }

    updateWeights(input) {

    }

    decide(gameState, options, mySide) {
        this.uname = mySide.name;
        this.mySide = mySide.id;
        var nState = this.cloneBattle(gameState);
        nState.me = mySide.n;

        if (Math.random() < 0.1) {
            return this.fetch_random_key(options);
        }

        var bestscore = -1;
        var bestchoice = '';
        var bestencoding = {};

        for (var choice in options) {
            var encoding = this.encode(nState, options[choice]);
            var forward = this.perceptron.forward(encoding);
            forward = 1 / (1 + Math.pow(Math.E, -forward));
            if (forward > bestscore) {
                bestscore = forward;
                bestchoice = choice;
                bestencoding = encoding;
            }
        }
        if (this.lastencodings.length >= this.memory) {
            this.lastencodings.shift();
        }
        this.lastencodings.push({ encoding: bestencoding, score: bestscore });
        return bestchoice;
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
        var arr = line.split("|");
        var tag = arr[1];
        if (tag == 'win') {
            if (this.saveWeights) {
                var fs = require('fs');
                fs.writeFileSync(this.filename, JSON.stringify(this.perceptron.weights));
            }
        }
        else if (tag == 'faint') {
            if (arr[2].startsWith(this.mySide)) {
                this.lockEvaluation = true;
                for (var index in this.lastencodings) {
                    this.perceptron.backward(this.lastencodings[index].encoding, this.lastencodings[index].score + 1, this.learningRate);
                }
                this.lastencodings = [];
            }
            else {
                this.lockEvaluation = true;
                for (var index in this.lastencodings) {
                    this.perceptron.backward(this.lastencodings[index].encoding, this.lastencodings[index].score - 1, this.learningRate);
                }
            }
        }
        else if (tag == 'status') {

        }
    }
}

exports.Agent = QLearning;