'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;

class TypeSelector {
    constructor() { this.name = 'Pessimist' }

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
        var maxDamage = 0;
        var bOption = this.fetch_random_key(options);
        //console.log(options);
        var oppactive = gameState.sides[1 - mySide.n].active[0];
        if (!forceSwitch) {
            var kChance = false;
            for (var option in options) {
                if (option.startsWith('move')) {
                    var cDamage = gameState.getDamage(mySide.active[0], oppactive, options[option].id, false);
                    if (cDamage && cDamage > maxDamage) {
                        // console.log(mySide.active[0].name + "'s " + options[option].move + " is expected to deal " + cDamage + " damage to " + oppactive[0].name);
                        maxDamage = cDamage;
                        bOption = option;
                    }
                    if (maxDamage >= oppactive.hp) {
                        // console.log('KO expected!');
                        maxDamage = cDamage;
                        bOption = option;
                        kChance = true;
                    }
                }
            }
            if (kChance) {
                return bOption;
            }

            var typetotal = 0;
            for (var mtype of mySide.active[0].types) {
                for (var otype of oppactive.types) {
                    typetotal += (Tools.getImmunity(mtype, otype) ? (Tools.getEffectiveness(mtype, otype)) : -2);
                    typetotal -= (Tools.getImmunity(otype, mtype) ? (Tools.getEffectiveness(otype, mtype)) : -2);
                }
            }
            if (typetotal >= 0) {
                if (mySide.active[0].stats.atk + mySide.active[0].stats.spa > mySide.active[0].stats.def + mySide.active[0].stats.spd) {
                    return bOption;
                }
                else {
                    for (var choice in options) {
                        if (choice.startsWith('move')) {
                            var move = Tools.getMove(options[choice].id);
                            if (move.status && move.status != 'slp' && oppactive.status == '') {
                                return choice;
                            }
                        }
                    }
                }
            }
        }



        // Consider Switching
        var btyping = -3;
        for (var option in options) {
            if (option.startsWith('switch')) {   
                var ttotal = 0;     
                var choice = options[option];
                var poke = mySide.pokemon[choice.index];
                for (var mtype of poke.types) {
                    for (var otype of oppactive.types) {
                        ttotal += (Tools.getImmunity(mtype, otype) ? (Tools.getEffectiveness(mtype, otype)) : -2);
                        ttotal -= (Tools.getImmunity(otype, mtype) ? (Tools.getEffectiveness(otype, mtype)) : -2);
                    }
                }
                for (var moveid of poke.moves) {
                    var move = Tools.getMove(moveid);
                    if (move.category != 'Status' && Tools.getEffectiveness(move.type, oppactive) > 0) {
                        ttotal += 0.25 * Tools.getEffectiveness(move.type, oppactive);
                    }
                }
                if (ttotal > btyping) {
                    btyping = ttotal;
                    bOption = option;
                }
            }
        }
        return bOption;
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

exports.Agent = TypeSelector;
