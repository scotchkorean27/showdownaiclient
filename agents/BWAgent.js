/**
 * Created by brkdn on 01/05/2017.
 */

/**********************************************************************
 Making the assumption for all pokemon instead of just the one in front of us
 Retrieving opponent's options for planning (requires perfect knowledge)

 Otherwise planning with the assumption that opponent will not switch(?)
***********************************************************************/

'use strict';

var Pokemon = require('../zarel/battle-engine').BattlePokemon;
var clone = require('../clone')
var BattleSide = require('../zarel/battle-engine').BattleSide;
var MCTree = require('./MCTree').MCTreeNode;
var PriorityQueue = require('priorityqueuejs');

// All Showdown AI Agents need 4 methods.

// decide takes in an approximation of the current gamestate, an associative array keyed by choices with choice details as value, and a string to remind you what side you are
// decide should return one of the keys in the array of choices.

// assumepokemon takes a name, level, gender, and the side of the pokemon in order to generate a best-guess estimate of the opponent's stats (which is hidden information)

// digest(line) is a way for you to customize how your agent deals with incoming information.  It doesn't have to do anything, but it can

// getTeam(format) should return the team that the agent plans on using.  This is only relevant if playing in a non-random format.

// All agents should also come with an assumptions object, which will guide how the InterfaceLayer deals with various aspects of hidden information.

class BWAgent {
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

    cloneBattle(state) {
        var nBattle = clone(state);
        nBattle.p1.getChoice = BattleSide.getChoice.bind(nBattle.p1);
        nBattle.p2.getChoice = BattleSide.getChoice.bind(nBattle.p2);
        nBattle.p1.clearChoice();
        nBattle.p2.clearChoice();
        return nBattle;
    }

    /*myAssume(mySide) {
        for(var i = 0; i < mySide.pokemon.length; i++) {

            var nSet = {
                species: Tools.getSpecies(mySide.pokemon[i].species),
                name: mySide.pokemon[i].name,
                level: mySide.pokemon[i].level,
                gender: mySide.pokemon[i].gender,
                evs: mySide.pokemon[i].evs,
                ivs: mySide.pokemon[i].ivs,
                nature: "Hardy",
                moves: mySide.pokemon[i].moves,
                ability: mySide.pokemon[i].ability
            };

            var basePokemon = new Pokemon(nSet, mySide.foe);

            mySide.foe.pokemon[i] = basePokemon;
            console.log('Set' + i + 'th Pokemon');

        }

    }*/

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

    getOptions(state, player) {
        if (typeof (player) == 'string' && player.startsWith('p')) {
            player = parseInt(player.substring(1)) - 1;
        }
        let activeData = state.sides[player].active.map(pokemon => pokemon && pokemon.getRequestData());
        var p1request = { active: activeData, side: state.sides[player].getData(), rqid: state.rqid };
        return this.parseRequestData(p1request);
    }

    // FOR MONTE CARLO TREE SEARCH
    getQueue(){

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

    }

    selection(gameState,treeNode){
        // Find a node with unexpanded children (less than 4 children)
        var index = 0;
        do{
            index = Math.floor(Math.random() * 4);
        }while(!(treeNode.children[index].children.length < 4))

        return treeNode.children[index];
    }

    expansion(treeNode){

    }



    decide(gameState, options, mySide) {

        //var foe = mySide.foe.n;
        var nstate = this.cloneBattle(gameState);
        var myTurnOptions = this.getOptions(nstate, mySide.id);
        var foeOptions = this.getOptions(nstate, mySide.foe.id);

        var oppactive = gameState.sides[1 - mySide.n].active;


        function battleSend(type, data) {
            if (this.sides[1 - this.me].active[0].hp == 0 || this.sides[1 - this.me].currentRequest == 'switch') {
                this.isTerminal = true;
            }
            if (this.sides[this.me].currentRequest != 'move') {
                this.badTerminal = true;
            }
        }

        nstate.send = battleSend;
        //var states = [];

        var effectiveness = Tools.getEffectiveness(oppactive[0].types, mySide.active[0]);
        //console.log("Opponent's: " + oppactive[0] +  "  Mine: " + mySide.active[0].name);
        //console.log("Opponent's effectiveness: " + effectiveness);

        if(effectiveness > 0) {
            // Opponent is super effective, we should simply switch
            // Switch to the pokemon with greatest health or most effective?

        }
        else {
            // We should plan an attack
            // We are assuming the opponent will not switch


        }











        for (var choice in foeOptions){

            /*if (choice.startsWith('switch')) {
                var pIndex = parseInt(choice.split(" ")[1]) - 1;
                for (var pokeName in nstate.sides[mySide.foe.n].pokemon[pIndex].name) {
                    console.log("Opponen's choice: " + choice + " " + pokeName);
                }
            }
            else{
                console.log("Opponent's choice: " + choice);
            }*/
            console.log("Opponent's choice: " + choice);

        }


        var choice = this.fetch_random_key(options);
        return choice;
    }

    // A function that takes in a pokemon's name as string and level as integer, and returns a BattlePokemon object.
    // Assumption Engine is designed to fill in the blanks associated with partial observability.
    // This engine in particular assumes perfect IVs and 100 EVs across the board except for speed, with 0 moves.
    // Other assumption systems can be used as long as they implement assume(pokemon, level)
    assumePokemon(pname, plevel, pgender, side) {

        var mySide = side.foe;
        /*var oppPokemon = []

        for(var i = 0; i < mySide.pokemon.length; i++) {

            var nSet = {
                species: Tools.getSpecies(mySide.pokemon[i].species),
                name: mySide.pokemon[i].name,
                level: mySide.pokemon[i].level,
                gender: mySide.pokemon[i].gender,
                evs: mySide.pokemon[i].evs,
                ivs: mySide.pokemon[i].ivs,
                nature: "Hardy",
                moves: mySide.pokemon[i].moves,
                ability: mySide.pokemon[i].ability
            };

            var basePokemon = new Pokemon(nSet, side);

            oppPokemon.push(basePokemon)

            //mySide.foe.pokemon[i] = basePokemon;
            console.log('Assume set ' + i + 'th Pokemon: ' +  mySide.pokemon[i].name);

        }
        return oppPokemon;*/

        var index = 0;
        for(var i = 0; i < mySide.pokemon.length; i++) {
            if (mySide.pokemon[i].name == pname){
                index = i;
            }
        }


        var nSet = {
            species: pname,
            name: pname,
            level: plevel,
            gender: pgender,
            evs: mySide.pokemon[index].evs,
            ivs: mySide.pokemon[index].ivs,
            nature: "Hardy",
            moves: mySide.pokemon[index].moves,
            ability: mySide.pokemon[index].ability
        };
        var basePokemon = new Pokemon(nSet, side);
        basePokemon.abilityData = { id: basePokemon.ability };
        // If the species only has one ability, then the pokemon's ability can only have the one ability.
        // Barring zoroark, skill swap, and role play nonsense.
        // This will be pretty much how we digest abilities as well
        /*if (Object.keys(basePokemon.template.abilities).length == 1) {
            basePokemon.baseAbility = toId(basePokemon.template.abilities['0']);
            basePokemon.ability = basePokemon.baseAbility;
            basePokemon.abilityData = { id: basePokemon.ability };
        }*/
        console.log("Assume set opponent's Pokemon: " + basePokemon.name + " as " +  mySide.pokemon[index].name);
        return basePokemon;
    }

    digest(line) {
    }

    getTeam(format) {
    }
}

exports.Agent = BWAgent;
