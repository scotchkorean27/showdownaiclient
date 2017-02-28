'use strict';

var simulator = require('./zarel/battle-engine').Battle;
var fs = require('fs');


class InterfaceLayer {
    constructor(id, username, cLayer, agent) {
        this.id = id;
        this.uname = username;
        this.battle = simulator.construct(this.id, 'ou', false, null);
        this.mySide = "";
        this.mySID = 0;
        this.firstTurn = false;
        this.cTurnOptions = {};
        this.cLayer = cLayer;
        this.agent = agent;
        this.format = '';
    }

    convertTeamToSet(pokemon) {
        var nTeam = [];
        for (var i = 0; i < pokemon.length; i++) {
            var cpoke = pokemon[i];
            var nSet = {
                species: cpoke.details.split(',')[0],
                name: cpoke.details.split(',')[0],
                level: 100,
                gender: "", 
                ability: cpoke.baseAbility,
                item: cpoke.item,
                moves: cpoke.moves,
                stats: cpoke.stats
            };
            if (cpoke.details.split(',')[1]) {
                if (cpoke.details.split(',')[1].startsWith(' L')) {
                    nSet.level = parseInt(cpoke.details.split(',')[1].split('L')[1]);
                }
                if (cpoke.details.split(',')[2]) {
                    nSet.gender = cpoke.details.split(',')[2].trim();
                }
                else if (cpoke.details.split(',').length == 2 && !cpoke.details.split(',')[1].startsWith(' L')) {
                    nSet.gender = cpoke.details.split(',')[1].trim();
                }
            }
            nTeam[i] = nSet;
        }
        return nTeam;
    }

    // It's all fine and good for the forward model to do switchin, but we shouldn't be invoking switch events when reflecting server state
    // Specifically, we need to avoid setting off beforeSwitch events
    // Those events will be sent over too, and we will handle those separately
    // This is pretty much the same thing as this.battle.switchin except it doesnt push anything to the event queue
    runExternalSwitch(pokemon, pos) {
        let side = pokemon.side;
        if (pos >= side.active.length) {
            throw new Error("Invalid switch position!");
        }
        if (side.active[pos]) {
            let oldActive = side.active[pos];
            if (this.battle.cancelMove(oldActive)) {
                for (let i = 0; i < side.foe.active.length; i++) {
                    if (side.foe.active[i].isStale >= 2) {
                        oldActive.isStaleCon++;
                        oldActive.isStaleSource = 'drag';
                        break;
                    }
                }
            }
            if (oldActive.switchCopyFlag === 'copyvolatile') {
                delete oldActive.switchCopyFlag;
                pokemon.copyVolatileFrom(oldActive);
            }
        }
        pokemon.isActive = true;
        if (side.active[pos]) {
            let oldActive = side.active[pos];
            oldActive.isActive = false;
            oldActive.isStarted = false;
            oldActive.usedItemThisTurn = false;
            oldActive.position = pokemon.position;
            pokemon.position = pos;
            side.pokemon[pokemon.position] = pokemon;
            side.pokemon[oldActive.position] = oldActive;
            this.battle.cancelMove(oldActive);
            oldActive.clearVolatile();
        }
        side.active[pos] = pokemon;
        pokemon.activeTurns = 0;
        pokemon.statusData.stage = 0;
        for (let m in pokemon.moveset) {
            pokemon.moveset[m].used = false;
        }
    }

    // Once again, setstatus sets off a bunch of events, the data of which is sent later.
    // To avoid duplication, we only execute a small part of setStatus
    runExternalStatus(pokemon, status) {
        status = this.battle.getEffect(status);
    
        if (status == 'fnt') {
            pokemon.status = status.id;
            pokemon.fainted = true;
            pokemon.isActive = false;
            pokemon.isStarted = false;
            pokemon.side.pokemonLeft--;
        }
        else if (pokemon.status != status.id) {
            pokemon.status = status.id;
            pokemon.statusData = { id: status.id, target: pokemon };
            if (status.duration) {
                pokemon.statusData.duration = status.duration;
            }
            if (status.durationCallback) {
                pokemon.statusData.duration = status.durationCallback.call(this.battle, pokemon);
            }
            // Modify the way sleep interacts with time, to Monty Hall framing
            pokemon.statusData.time = 0;
            pokemon.statusData.stage = 0;
        }
    }

    // See above
    runExternalWeather(status, source) {
        status = this.battle.getEffect(status);
    
        if (this.battle.weather != status.id) {
            let prevWeather = this.battle.weather;
            let prevWeatherData = this.battle.weatherData;
            this.battle.weather = status.id;
            this.battle.weatherData = { id: status.id };
            if (source) {
                this.battle.weatherData.source = source;
                this.battle.weatherData.sourcePosition = source.position;
            }
            if (status.duration) {
                this.battle.weatherData.duration = status.duration;
            }
            if (status.durationCallback) {
                this.battle.weatherData.duration = status.durationCallback.call(this.battle, source);
            }
        }
        
    }

    runExternalAddMove(pokemon, move) {
        move = this.battle.getMove(toId(move));
        if (move.id && pokemon.moves.indexOf(move) == -1) {
            pokemon.moves.push(move.id);
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

    runExternalAddAbility(pokemon, ability) {
        if (toId(ability) != pokemon.ability) {
            ability = this.battle.getAbility(toId(ability));
            pokemon.ability = ability.id;
            pokemon.abilityData = { id: ability.id, target: pokemon };
        }
    }

    runExternalAddItem(pokemon, item) {
        if (toId(item) != pokemon.item) {
            item = this.battle.getItem(toId(item));
            pokemon.item = item.id;
            pokemon.itemData = { id: item.id };
        }
    }

    runExternalBoost(pokemon, stat, amt) {
        if (!amt) {
            amt = 1;
        }
        if (stat) {
            pokemon.boosts[stat] = pokemon.boosts[stat] + amt;
            if (pokemon.boosts[stat] > 6) {
                pokemon.boosts[stat] = 6;
            }
        }
    }

    runExternalUnboost(pokemon, stat, amt) {
        if (!amt) {
            amt = 1;
        }
        if (stat) {
            pokemon.boosts[stat] = pokemon.boosts[stat] - amt;
            if (pokemon.boosts[stat] < -6) {
                pokemon.boosts[stat] = -6;
            }
        }
    }

    // This is fine because no side condition has a problematic onStart
    runExternalSideCondition(side, status) {
        side.addSideCondition(status);
    }

    runExternalRemoveSideCondition(side, status) {
        side.removeSideCondition(status);
    }

    runExternalAddVolatile(pokemon, status) {
        // console.log('Volatile!');
        let result;
        status = this.battle.getEffect(status);
        if (!pokemon.hp && !status.affectsFainted) return false;
        if (pokemon.volatiles[status.id]) {
            if (!status.onRestart) return false;
            return this.battle.singleEvent('Restart', status, pokemon.volatiles[status.id], pokemon);
        }
        pokemon.volatiles[status.id] = { id: status.id };
        pokemon.volatiles[status.id].target = pokemon;
        if (status.duration) {
            pokemon.volatiles[status.id].duration = status.duration;
        }
        if (status.durationCallback) {
            pokemon.volatiles[status.id].duration = status.durationCallback.call(this.battle, pokemon);
        }
        result = this.battle.singleEvent('Start', status, pokemon.volatiles[status.id], pokemon);
        if (!result) {
            // cancel
            delete pokemon.volatiles[status.id];
            return result;
        }
            // console.log(pokemon.volatiles);
    }

    runExternalTypeChange(pokemon, ntype) {
        if (!ntype) throw new Error("Must pass type to setType");
        pokemon.types = (typeof ntype === 'string' ? [ntype] : ntype);
        pokemon.addedType = '';
        pokemon.knownType = true;
    }

    runExternalRemoveVolatile(pokemon, status) {
        console.log(status);
        pokemon.removeVolatile(status);
    }


    processLine(line) {
    
        // right now, super, immune, resist are counted as boring tags.  They do present relevant information in case the information given doesnt line up for whatever reason (see zororark), but in a very niche case, and takes more work to digest
        var boringTags = ["", " ", "init", "title", "j", "gametype", "gen", "seed", "rated", "choice", "-supereffective", "-resisted", "-miss", "-immune", "-crit", "faint", "raw", 'fail', 'cant', '-hitcount'];
        var arr = line.split("|");
        var tag = arr[1];
        if (tag == "player") {
            if (arr[3] == this.uname) {
                this.mySide = arr[2];
                this.mySID = parseInt(this.mySide.substring(1)) - 1;
            }
        }
        else if (tag == 'tier') {
            this.format = arr[2];
        }
        else if (tag == "request") {
            // console.log(line);
            var requestData = JSON.parse(arr[2]);
            if (!this.firstTurn) {
                if (this.mySide == 'p1') {
                    this.battle.join(this.mySide, this.uname, this.mySID, this.convertTeamToSet(requestData['side']['pokemon']));
                    this.battle.join((this.mySide == 'p1' ? 'p2' : 'p1'), 'opponent', 1 - this.mySID, []);
                }
                else {
                    this.battle.join((this.mySide == 'p1' ? 'p2' : 'p1'), 'opponent', 1 - this.mySID, []);
                    this.battle.join(this.mySide, this.uname, this.mySID, this.convertTeamToSet(requestData['side']['pokemon']));
                    
                }
                //console.log(this.battle.sides[0].name);
                this.battle.sides[1 - this.mySID].pokemonLeft = this.battle.sides[this.mySID].pokemonLeft;
            }
            this.cTurnOptions = {};
            this.cTurnMoves = {};
            if (requestData['active']) {
                for (var i = 0; i < requestData['active'][0]['moves'].length; i++) {
                    if (requestData['active'][0]['moves'][i]['disabled'] == false && requestData['active'][0]['moves'][i].pp > 0) {
                        this.cTurnOptions['move ' + (i + 1)] = requestData['active'][0]['moves'][i];
                        this.cTurnMoves['move ' + (i + 1)] = requestData['active'][0]['moves'][i];
                        if (this.battle.sides[this.mySID].active[0]) {
                            for (var j = 0; j < this.battle.sides[this.mySID].active[0].moveset.length; j++) {
                                if (requestData['active'][0]['moves'][i].id == this.battle.sides[this.mySID].active[0].moveset[j].id) {
                                    this.battle.sides[this.mySID].active[0].moveset[j].pp = requestData['active'][0]['moves'][i].pp;
                                }
                            }
                        }
                    }
                }
            }
            if (requestData['side'] && !(requestData['active'] && requestData['active'][0]['trapped'])) {
                for (var i = 1; i < requestData['side']['pokemon'].length; i++) {
                    if (requestData['side']['pokemon'][i].condition.indexOf('fnt') == -1) {
                        this.cTurnOptions['switch ' + (i + 1)] = requestData['side']['pokemon'][i];
                    }
                }
            }
            if (requestData['forceSwitch'] && requestData['forceSwitch'][0]) {
                this.cLayer.send(this.id + '|/choose ' + this.agent.decide(this.battle, this.cTurnOptions, this.battle.sides[this.mySID]), this.mySide);
            }
        }
        else if (tag == 'switch') {
            // console.log(line);
            // As of right now, this only supports single battles. I haven't seen the protocol for doubles yet.
            // I think it has something to do with the letter that comes with the player id (a, b, c)
            if (arr[2].startsWith(this.mySide)) {
                var pName = arr[3].split(',')[0];
                // iterate through pokemon, if name found, then switch using that object and pos 0, else generate a new one, and do shit
                for (var i = 0; i < this.battle.sides[this.mySID].pokemon.length; i++) {
                    if (pName == this.battle.sides[this.mySID].pokemon[i].species) {
                        this.runExternalSwitch(this.battle.sides[this.mySID].pokemon[i], 0);
                        break;
                    }
                }
                    // console.log(line);
            }
            else {
                var found = false;
                var pInfo = arr[3].split(',');
                var pName = pInfo[0];
                for (var i = 0; i < this.battle.sides[1 - this.mySID].pokemon.length; i++) {
                    if (pName == this.battle.sides[1 - this.mySID].pokemon[i].species) {
                        this.runExternalSwitch(this.battle.sides[1 - this.mySID].pokemon[i], 0);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var pLev = 100;
                    var pGen = '';
                    if (pInfo[1]) {
                        if (pInfo[1].startsWith(' L')) {
                            pLev = parseInt(pInfo[1].split('L')[1]);
                        }
                        if (pInfo[2]) {
                            pGen = pInfo[2].trim();
                        }
                        else if (!pInfo[1].startsWith(' L')) {
                            pGen = pInfo[1].trim();
                        }
                    }
                    var npoke = this.agent.assumePokemon(pName, pLev, pGen, this.battle.sides[1 - this.mySID]);
                    npoke.position = this.battle.sides[1 - this.mySID].pokemon.length;
                    this.battle.sides[1 - this.mySID].pokemon.push(npoke);
                    this.runExternalSwitch(npoke, 0);
                }
            }
        }
        else if (tag == 'turn') {
            // NTS process end of turn here too
            
            // console.log(line);
            if (!this.firstTurn) {
                this.firstTurn = true;
            }
            var choice = '';
            // This happens if we locked ourselves into a move (See: Solarbeam, fly, outrage, phantom force).  Resolved by arbitrarily sending a random thing.
            if (Object.keys(this.cTurnOptions).length == 0) {
                choice = 'move 1';
            }
            else {
                choice = this.agent.decide(this.battle, this.cTurnOptions, this.battle.sides[this.mySID]);
            }
            // console.log('options: ' + Object.keys(this.cTurnOptions).length);
            // console.log('choice: ' + choice);
            this.cLayer.send(this.id + '|/choose ' + choice, this.mySide);
                // Add code that processes the end of a turn
        }
        else if (tag == 'callback') {
            if (arr[2] == 'trapped') {
                // NTS: UPDATE THE GAME STATE TO REFLECT THIS
                // So this is where things get complicated.  maybetrapped means that something caused the opponent to be trapped
                // callback can confirm that they are trapped, but this doesnt tell us anything conclusive.
                // Somehow have the assumption engine digest this data
                // There's a specific confluence of events wherein a trapped callback reveals the ability of the opponent.
                this.cLayer.send(this.id + '|/choose ' + this.agent.decide(this.battle, this.cTurnMoves, this.battle.sides[this.mySID]), this.mySide);
                this.agent.digest(line);
            }
        }
                //MOVES HAVE TO CHECK FOR TAG CHANGES
        else if (boringTags.indexOf(tag) > -1) {
                // Tags that don't tell us anything new
        }
        else if (tag == 'win') {
            if (arr[2] == this.uname) {
                console.log('I won!');
            }
            else {
                console.log('I lost!');
            }
            // This is really debug shit.  Has the system initiate another battle right after one ends.
            // With enough battles, we would stumble upon bugs.  Debugging is wonderful.
            // this.cLayer.send('|/search randombattle');
        }
                // move Purely informative.  However, we still need to update PP of the using pokemon.
        else if (tag == 'move') {
            // If I make this move, then I need to update the PP of the move I know I have
            // Actually, it's easier to update PP of moves from the request data
            // Should also update lastmoveused
            // if arr[4] has [from] lockedmove and the user has the volatile twoturnmove, then we have to remove the volatile
            //      fs.appendFile('log.txt', line + '\n', function (err) { });
            if (!arr[2].startsWith(this.mySide)) {
                this.runExternalAddMove(this.battle.sides[1 - this.mySID].active[0], arr[3]);
                this.battle.sides[1 - this.mySID].active[0].lastMove = this.battle.getMove(arr[3]).id;
            }
            else {
                this.battle.sides[this.mySID].active[0].lastMove = this.battle.getMove(arr[3]).id;
            }
        }
                // -damage Update model.  Change only opponent health to the fraction given.  Format: tag, pokemon, status (num/den status), maybe from
        else if (tag == '-damage' || tag == '-heal') {
            if (arr[2].startsWith(this.mySide)) {
                var info = arr[3];
                var infoarr = info.split(' ');
                var chealth = parseInt(infoarr[0].split('/')[0]);
                this.battle.sides[this.mySID].active[0].hp = chealth;
                if (infoarr[1]) {
                    this.runExternalStatus(this.battle.sides[this.mySID].active[0], infoarr[1]);
                }
            }
            else {
                var info = arr[3];
                var infoarr = info.split(' ');
                var chealth = parseInt(infoarr[0].split('/')[0]);
                if (infoarr[0].split('/')[1]) {
                    this.battle.sides[1 - this.mySID].active[0].hp = chealth / parseInt(infoarr[0].split('/')[1]) * this.battle.sides[1 - this.mySID].active[0].maxhp;
                }
                else {
                    this.battle.sides[1 - this.mySID].active[0].hp = chealth;
                }
                if (infoarr[1]) {
                    this.runExternalStatus(this.battle.sides[1 - this.mySID].active[0], infoarr[1]);
                }
            }
        }
                // -weather  Update model.  Can be upkeep (just up the turn counter).  Second value becomes 'none' upon ending
        else if (tag == '-weather') {
            // Currently does not take into account whether the user has damp rock or similar items
            // The weather tag by itself doesn't have that information.  We could conceivably do some voodoo with -move, but that's for another time.
            if (arr[3] && arr[4]) {
                if (arr[4].split(' ')[1].startsWith(this.mySide)) {
                    this.runExternalWeather(arr[2], this.battle.sides[this.mySID].active[0]);
                }
                else {
                    this.runExternalWeather(arr[2], this.battle.sides[1 - this.mySID].active[0]);
                    if (arr[3].split(' ')[1].startsWith('ability')) {
                        this.runExternalAddAbility(this.battle.sides[1 - this.mySID].active[0], toId(arr[3].split(':')[1].trim()));
                    }
                }
            }
            else {
                this.runExternalWeather(arr[2]);
            }
        }
                // -status  Update model.  Almost purely informative.
        else if (tag == '-status') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalStatus(this.battle.sides[sindex].active[0], arr[3]);
        }
        else if (tag == '-curestatus') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalStatus(this.battle.sides[sindex].active[0], '');
        }
                // -ability digest
        else if (tag == '-ability') {
            //  fs.appendFile('log.txt', line + '\n', function (err) { });
            if (!arr[2].startsWith(this.mySide)) {
                this.runExternalAddAbility(this.battle.sides[1 - this.mySID].active[0], arr[3].trim());
            }
        }
                // -item   Update model.  Tells us what item they have
        else if (tag == '-item') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalAddItem(this.battle.sides[sindex].active[0], arr[3]);
        }
                // -enditem  Update model.  Item becomes unusable.
        else if (tag == '-enditem') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalAddItem(this.battle.sides[sindex].active[0], '');
        }
                // -unboost  Goes without saying
        else if (tag == '-unboost') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalUnboost(this.battle.sides[sindex].active[0], arr[3], parseInt(arr[4]));
        }
                // -boost  See Above
        else if (tag == '-boost') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalBoost(this.battle.sides[sindex].active[0], arr[3], parseInt(arr[4]));
        }
                // -sidestart refers to side level volatiles (entry hazards and such)
        else if (tag == '-sidestart') {
            var status = '';
            if (arr[3].startsWith('move')) {
                var move = this.battle.getMove(toId(arr[3].split(': ')[1].trim()));
                if (move.sideCondition) {
                    status = move.sideCondition;
                }
            }
            else {
                status = toId(arr[3]);
            }
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalSideCondition(this.battle.sides[sindex], status);
        }
        else if (tag == '-sideend') {
            var status = '';
            if (arr[3].startsWith('move')) {
                var move = this.battle.getMove(toId(arr[3].split(': ')[1].trim()));
                if (move.sideCondition) {
                    status = move.sideCondition;
                }
            }
            else if (this.battle.getMove(arr[3]).sideCondition) {
                var move = this.battle.getMove(toId(arr[3].trim()));
                if (move.sideCondition) {
                    status = move.sideCondition;
                }
            }
            else {
                status = toId(status);
            }
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.runExternalRemoveSideCondition(this.battle.sides[sindex], status);
        }
                // -prepare is weird.  add the twoturnmove volatile.  Refers to multi turn attacks like solarbeam and fly.  The move name is in the line
                // -start is complicated.  gonna have to figure this out.  Refers to delayed single turn effects like Flash Fire, and volatile effects
        else if (tag == '-start') {
            console.log(line);
            var status = arr[3];
            var sindex = parseInt(arr[2].substring(1)) - 1;
            if (status == 'typechange') {
                var ntype = arr[4];
                this.runExternalTypeChange(this.battle.sides[sindex].active[0], ntype);
                if (arr[5].startsWith('[from]')) {
                    this.runExternalAddAbility(this.battle.sides[sindex].active[0], arr[5].split(' ')[1]);
                }
            }
            else {
                if (status.startsWith('move')) {
                    var move = this.battle.getMove(toId(arr[3].split(': ')[1].trim()));
                    if (move.volatileStatus) {
                        status = move.volatileStatus;
                    }
                }
                if (status.startsWith('ability')) {
                    status = arr[3].split(': ')[1].trim();
                }
                this.runExternalAddVolatile(this.battle.sides[sindex].active[0], toId(status));
            }
        }
        else if (tag == '-end') {
            console.log(line);
            var sindex = parseInt(arr[2].substring(1)) - 1;
            var status = arr[3];
            if (status.startsWith('move: ')) {
                status = status.split(': ')[1].trim();
            }
            this.runExternalRemoveVolatile(this.battle.sides[sindex].active[0], status);
            console.log(this.battle.sides[sindex].active[0].volatiles);
            // in the event the ending effect is illusion, we need to do something different.
        }
        else if (tag == '-formechange') {
            var nForme = arr[3];
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.battle.sides[sindex].active[0].formeChange(nForme);
            console.log('Forme Change! ' + this.battle.sides[sindex].active[0].baseSpecies + ' changed to ' + arr[3]);
        }
                // drag and switch are functionally identical
        else if (tag == 'drag') {
            if (arr[2].startsWith(this.mySide)) {
                var pName = arr[3].split(',')[0];
                // iterate through pokemon, if name found, then switch using that object and pos 0, else generate a new one, and do shit
                for (var i = 0; i < this.battle.sides[this.mySID].pokemon.length; i++) {
                    if (pName == this.battle.sides[this.mySID].pokemon[i].species) {
                        this.runExternalSwitch(this.battle.sides[this.mySID].pokemon[i], 0);
                        break;
                    }
                }
                    // console.log(line);
            }
            else {
                var found = false;
                var pInfo = arr[3].split(',');
                var pName = pInfo[0];
                for (var i = 0; i < this.battle.sides[1 - this.mySID].pokemon.length; i++) {
                    if (pName == this.battle.sides[1 - this.mySID].pokemon[i].species) {
                        this.runExternalSwitch(this.battle.sides[1 - this.mySID].pokemon[i], 0);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var pLev = 100;
                    var pGen = '';
                    if (pInfo[1]) {
                        if (pInfo[1].startsWith(' L')) {
                            pLev = parseInt(pInfo[1].split('L')[1]);
                        }
                        if (pInfo[2]) {
                            pGen = pInfo[2].trim();
                        }
                        else if (!pInfo[1].startsWith(' L')) {
                            pGen = pInfo[1].trim();
                        }
                    }
                    var npoke = this.agent.assumePokemon(pName, pLev, pGen, this.battle.sides[1 - this.mySID]);
                    npoke.position = this.battle.sides[1 - this.mySID].pokemon.length;
                    this.battle.sides[1 - this.mySID].pokemon.push(npoke);
                    this.runExternalSwitch(npoke, 0);
                }
            }
        }
        else if (tag == '-setboost') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            var statname = arr[3];
            var statamt = parseInt(arr[4]);
            var setStat = {};
            setStat[statname] = statamt;
            this.battle.sides[sindex].active[0].setBoost(setStat);
        }
        else if (tag == 'clearboost') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            this.battle.sides[sindex].active[0].clearBoosts();
        }
            // Pretty much white herb, and only white herb
        else if (tag == 'restoreboost') {
            var sindex = parseInt(arr[2].substring(1)) - 1;
            var boosts = {};
            for (let i in this.battle.sides[sindex].active[0].boosts) {
                if (this.battle.sides[sindex].active[0].boosts[i] < 0) {
                    boosts[i] = 0;
                }
            }
            this.battle.sides[sindex].active[0].setBoost(boosts);
        }
                // -detailchange is irrelevant here.  No ubers means no primal means no detailchanges
                // -activate refers to non-weather field effects: pseudoweather, terrain, as well as certain scripted effects, endure, etc.  Seems to be mostly single turn stuff.
                // -fieldstart refers to pseudoweather
                // transform uhhhh, yeahhh, no
                // replace is for zoroark
                // teampreview Standards ou only, requires a response of |/team ######|1 (where ###### is the preferred order of pokemon, which we have to reorder in the model)
                // poke is a part of team preview.  Has roughly the same information as switch. |poke|p1|details|hasitem
        else {
        
            //    fs.appendFile('log.txt', line + '\n', function (err) { });
        
            console.log(line);
        }
    }
    process(text) {
        // console.log(text);
        var arr = text.split("\n");
        for (var i = 0; i < arr.length; i++) {
            this.processLine(arr[i]);
        }
    }
}

exports.InterfaceLayer = InterfaceLayer;