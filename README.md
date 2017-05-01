Pokemon Showdown AI Client

This program requires Node.js to run.  Please install the lastest version before attempting to run this program.
The code can be executing from command line by entering 'node app.js'

# What is this?

The Pokemon Showdown AI Client is a framework that allows users to write AI agents for Pokemon Showdown (https://github.com/Zarel/Pokemon-Showdown).  As of right now, it supports up to gen 6 rules and can be set to connect to an online server or run offline for simulations.

# What is this code?

## app.js

This is the entry point where you would begin running your AI or simulations.  

The "online" variable is a boolean that determines whether this program will be connecting to a server or running games locally.

### Online mode

For online mode, you must designate a server to connect to by changing the argument being sent in to the websocket initialization. 
If you want to log into an account, set "attemptLogin" to true, and set the "username" and "password" variables to the appropriate values.

### Offline mode

For offline mode, games can be executing using the "OfflineGame" class.  
OfflineGame.playGames takes 4 arguments:
  Agent1: the agent the first player will be using.
  Agent2: the agent the second player will be using.
  num_games: the number of games being played.
  format: the format of game being played.  Note that this should be sent in as a string.
  
## OfflineGame.js and OfflineSimulator.js

These are abstraction layers over Zarel's battle-engine.js that emulate an online server's communications.  An agent should never have to interface directly with either class.

## InterfaceLayer.js

The interface layer receives communications from the either the websocket or the OfflineGame and parses it into relevant gamestate information.  It maintains a local instance of Battle, which it modifies as information is received.  For more information on the format of this data, refer to Protocol.md in the zarel folder.

Note that InterfaceLayer's local copy of the game state will often be incomplete.  This is by design, as Pokemon Showdown is a game with a great deal of hidden information, and as such there is a great deal of information that cannot be filled in.  In a sense, InterfaceLayer's local copy of the game state is an approximation constructed using the information available to it.

# So how do I write AI agents?

## Things an agent class needs

### decide(gameState, options, mySide)

The decide function takes in the client's approximation of the gamestate, a set of options, and information about their side, and returns the option corresponding to the desired move.

gameState is an instance of the Battle class as outlined in zarel/battle-engine.js.

options is an associative array keyed by options that can be returned with values containing more detailed formation about these choices.  The decide function should return one of the keys in options.

mySide is an instance of the BattleSide class as outlined in zarel/battle-engine.js.  It contains information pertaining to the agent's side.  Of particular interest are mySide.id and mySide.n, as they are necessary in sending decisions to the forward model.

### assumePokemon(pname, plevel, pgender, side)

Many details about an opponent's pokemon are hidden.  However, a game state cannot be constructed without pokemon.  To compensate for this, agents must attempt to fill in the blanks in this information.  Of particular interest are a pokemon's ivs, evs, ability, and held item.  A sample generic implementation of this function is used for the agents in the agents folder.

## Tools

### Single-Turn damage simulation

The Battle class comes with a handy function to simulate damage done by a certain pokemon using a certian move on another certain pokemon.  This can be called with gameState.getDamage(attacker, defender, moveid, messages).

attacker is an instance of the BattlePokemon class
defender is an instance of the BattlePokemon class
moveid is a string representing the move used.  For a set of move ids, see zarel/data/moves.
messages is a boolean that doesn't necessarily impact the result.

This function will return a number representing the projected damage.  Note that this function does perform standard RNG rolls, meaning that multiple calls to this function may yield different values.

### Forward model

Tree-search type methods will need a way to simulate more than just damage.  In order to simulate a turn, a choice must be supplied for both players, at which point the Battle object will automatically advance the turn.  

Start by calling both side's "clearChoice" function to ensure that choice data is properly formatted and empty.

A choice is supplied by invoking the Battle object's "receive" function.  Receive takes an array of strings which must be formatted as:

['', 'choose', player ('p1' or 'p2'), choice (switch X or move Y)]

Note that Pokemon does not always advance full turns, but may also advance a "half turn" of sorts.  This is signaled by a side's currentRequest variable being equal to 'switch'.  In this case, the side's player will need to make an additional move (switching to another Pokemon) before the game can advance.  This occurs when a Pokemon faints, uses a switching move (Baton Pass, Volt Switch, U-Turn), or is dragged out (Roar, Whirlwind, Dragon Tail).  If you want to advance entire turns at a time, it is recommended that after simulating a turn, you perform a check to see if either party has to switch.

For an example of this, refer to agents/3TLAgent.js.

### I need information about X!  Where can I find it?

zarel/tools.js has a set of functions that return information about moves, pokemon, abilities, and so on.  When querying for information, be sure to send in the item's id, which can be generated by passing it through toId() first.  For example, if I want to get information about the move Fire Blast, I call:

Tools.getMove(toId("Fire Blast")) or Tools.getMove("fireblast")

This will return an object with data about Fire Blast.

{
		num: 126,
		accuracy: 85,
		basePower: 110,
		category: "Special",
		desc: "Has a 10% chance to burn the target.",
		shortDesc: "10% chance to burn the target.",
		id: "fireblast",
		isViable: true,
		name: "Fire Blast",
		pp: 5,
		priority: 0,
		flags: {protect: 1, mirror: 1},
		secondary: {
			chance: 10,
			status: 'brn',
		},
		target: "normal",
		type: "Fire",
		contestType: "Beautiful",
	}
  
  This class has a number of useful reference functions which may be very helpful in writing heuristic-centric agents.
  
  Tools.getImmunity(source, target) will return true if the target BattlePokemon is immune to the source move or status.
  source can be a string representing a type or status such as 'fire' or 'par'.
  target can be an array of types, an object with a types variable, or an object with a function getTypes() that returns the types
  This function returns true if the target is vulnerable, and false if the target is immune.
  
  Tools.getEffectiveness(source, target)
  source and target are formatted the same way as in getImmunity.
  Positive numbers represent super-effectiveness, while negative numbers represent resistance.
  
  Tools.getTemplate(template) returns information about an input pokemon.
  template should be a string name of a pokemon.
  The return is an object formatted as:
  {
		num: 1,
		species: "Bulbasaur",
		types: ["Grass", "Poison"],
		genderRatio: {M: 0.875, F: 0.125},
		baseStats: {hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45},
		abilities: {0: "Overgrow", H: "Chlorophyll"},
		heightm: 0.7,
		weightkg: 6.9,
		color: "Green",
		evos: ["ivysaur"],
		eggGroups: ["Monster", "Grass"],
	}
  
  Tools.getMove(name) returns information about a move.
  Returns information formatted as:
  {
		num: 126,
		accuracy: 85,
		basePower: 110,
		category: "Special",
		desc: "Has a 10% chance to burn the target.",
		shortDesc: "10% chance to burn the target.",
		id: "fireblast",
		isViable: true,
		name: "Fire Blast",
		pp: 5,
		priority: 0,
		flags: {protect: 1, mirror: 1},
		secondary: {
			chance: 10,
			status: 'brn',
		},
		target: "normal",
		type: "Fire",
		contestType: "Beautiful",
	}
  
  Note that some moves are more complicated than others, and will have onX event listeners on them too.  These are functions, as can be seen in the case of Fire Pledge.
  
  {
		num: 519,
		accuracy: 100,
		basePower: 80,
		basePowerCallback: function (target, source, move) {
			if (move.sourceEffect in {grasspledge:1, waterpledge:1}) {
				this.add('-combine');
				return 150;
			}
			return 80;
		},
		category: "Special",
		desc: "If one of the user's allies chose to use Grass Pledge or Water Pledge this turn and has not moved yet, it takes its turn immediately after the user and the user's move does nothing. If combined with Grass Pledge, the ally uses Fire Pledge with 150 Base Power and a sea of fire appears on the target's side for 4 turns, which causes damage to non-Fire types equal to 1/8 of their maximum HP, rounded down, at the end of each turn during effect. If combined with Water Pledge, the ally uses Water Pledge with 150 Base Power and a rainbow appears on the user's side for 4 turns, which doubles secondary effect chances but does not stack with the Ability Serene Grace. When used as a combined move, this move gains STAB no matter what the user's type is. This move does not consume the user's Fire Gem.",
		shortDesc: "Use with Grass or Water Pledge for added effect.",
		id: "firepledge",
		name: "Fire Pledge",
		pp: 10,
		priority: 0,
		flags: {protect: 1, mirror: 1, nonsky: 1},
		onPrepareHit: function (target, source, move) {
			for (let i = 0; i < this.queue.length; i++) {
				let decision = this.queue[i];
				if (!decision.move || !decision.pokemon || !decision.pokemon.isActive || decision.pokemon.fainted) continue;
				if (decision.pokemon.side === source.side && decision.move.id in {grasspledge:1, waterpledge:1}) {
					this.prioritizeQueue(decision);
					this.add('-waiting', source, decision.pokemon);
					return null;
				}
			}
		},
		onModifyMove: function (move) {
			if (move.sourceEffect === 'waterpledge') {
				move.type = 'Water';
				move.hasSTAB = true;
			}
			if (move.sourceEffect === 'grasspledge') {
				move.type = 'Fire';
				move.hasSTAB = true;
			}
		},
		onHit: function (target, source, move) {
			if (move.sourceEffect === 'grasspledge') {
				target.side.addSideCondition('firepledge');
			}
			if (move.sourceEffect === 'waterpledge') {
				source.side.addSideCondition('waterpledge');
			}
		},
		effect: {
			duration: 4,
			onStart: function (targetSide) {
				this.add('-sidestart', targetSide, 'Fire Pledge');
			},
			onEnd: function (targetSide) {
				this.add('-sideend', targetSide, 'Fire Pledge');
			},
			onResidual: function (side) {
				for (let i = 0; i < side.active.length; i++) {
					let pokemon = side.active[i];
					if (pokemon && !pokemon.hasType('Fire')) {
						this.damage(pokemon.maxhp / 8, pokemon);
					}
				}
			},
		},
		secondary: false,
		target: "normal",
		type: "Fire",
		contestType: "Beautiful",
	}
  
  Tools.getEffect(status) returns information about statuses, volatiles, weather effects, etc.  The format varies somewhat wildly on this, and most of the fields are functions, which aren't trivial for an AI to parse out.
  
  




