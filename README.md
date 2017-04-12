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

Note that Pokemon does not always advance full turns, but may also advance a "half turn" of sorts.  In this case, the game state will require additional input from one of the players before the next turn can start.  This is signaled by an invocation of Battle's send function.  It is recommended that an agent that steps forward multiple turns overrides Battle's send function to process additional choice requests.

For an example of this, refer to agents/3TLAgent.js.




