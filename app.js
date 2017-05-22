global.Tools = require('./zarel/tools');
global.toId = Tools.getId;
Tools.includeData();

var OfflineGame = require('./OfflineGame').OfflineGame;
var InterfaceLayer = require('./interfaceLayer').InterfaceLayer;
var OTLAgent = require('./agents/OTLAgent').Agent;
var QLearningAgent = require('./agents/QLearner').Agent;
var MLQAgent = require('./agents/MLQLearner').Agent;
var RandomAgent = require('./agents/RandomAgent').Agent;
var BFSAgent = require('./agents/BFSAgent').Agent;
var MinimaxAgent = require('./agents/MinimaxAgent').Agent;
var SPAgent = require('./agents/TypeSelector').Agent;
var PMMAgent = require('./agents/PBFS').Agent;

try {
    require.resolve('./zarel/config/config');
} catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err; // should never happen
    
    console.log("config.js doesn't exist - creating one with default settings...");
    fs.writeFileSync(path.resolve(__dirname, 'config/config.js'),
        fs.readFileSync(path.resolve(__dirname, 'config/config-example.js'))
    );
} finally {
    global.Config = require('./zarel/config/config');
}

var online = false;

// Online mode operates very very differently from offline.
// Naturally, it needs a place to connect to.
// Logging in is optional, although that makes it easier to check on your status later.
// In this mode, everything you type into stdin is sent to the server.  This is one way to initiate battles.
// For example, if you type in |/search randommirror into stdin, it will place your ai into the queue for a Random Mirrors game.
// You can also do this in your program by adding a line at the end of this conditional block that says ws.send('|/search randommirror');
// Manually challenging a player is achieved by entering '|/challenge USER format', with USER being the name of the user you wish to challengee.
if (online) {
    var hashmap = require('hashmap');
    var querystring = require('querystring');
    var http = require('http');
    var WebSocket = require('ws');

    // Things to be set by the programmer
    var ws = new WebSocket('ws://216.165.115.183:8000/showdown/websocket');
    var attemptLogin = true;
    //  The agent will attempt to initiate this many battles
    var battleCount = 2;
    var username = 'TeamRocketAI';
    var password = 'polyai';
    // This is where you would put the formats that you are interested in having your AI participate in.
    var formats = ['randombattle', 'randommirror'];
    
    // This is pretty much all netcode.  Not a ton to worry about here.
    var battles = new hashmap.HashMap();
    var challstr = '';

    var cuser = '';

    class WSLayer {
        constructor(ws) {
            this.ws = ws;
        }
        send(message, extra) {
            console.log(message);
            ws.send(message);
        }
    }

    ws.on('message', function receive(data, flags) {
        var arr = data.split('|');
        var tag = "" + arr[1];
        if (tag == 'challstr') {
            console.log('Attempting login...');
            challstr = data.substring(10);
            if (attemptLogin) {
                login(username, password, challstr);
            }
        }
        else if (tag == 'updateuser') {
            battles.set("", "");
            cuser = arr[2];
            console.log('Logged in as ' + cuser);
            ws.send('|/join lobby');
            for (var format of formats) {
                ws.send('|/search ' + format);
            }
        }
        else if (tag == 'nametaken') {
            console.log('Login failed.  Logged in as guest.');
        }
        else if (data.startsWith('\>')) {
            var roomid = data.split("\n")[0].substring(1);
            if (battles.has(roomid) == false) {
                battles.set(roomid, new InterfaceLayer(roomid, cuser, new WSLayer(this), new OTLAgent()));
                battleCount--;
                if (battleCount > 0) {
                    for (var format of formats) {
                        ws.send('|/search ' + format);
                    }
                }
            }
            battles.get(roomid).process(data.substring(roomid.length + 2));
        }
        else if (data.startsWith('updatechallenges')) {
            var challengeData = JSON.parse(arr[2]);
            for (var nChallenge in challengeData.challengesFrom) {
                ws.send('|/accept ' + nChallenge);
            }
        }
        else {
            console.log(data);
        }
    });

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    var util = require('util');

    process.stdin.on('data', function (text) {
        ws.send(text);
        if (text === 'quit\n') {
            done();
        }
    });

    function done() {
        console.log('Now that process.stdin is paused, there is nothing more to do.');
        process.exit();
    }

    function login(username, password, challstr) {
        var post_data = 'act=login&name=' + username + '&pass=' + password + '&challstr=' + challstr;

        var post_options = {
            host: 'play.pokemonshowdown.com',
            path: '/action.php',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.95 Safari/537.11',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST'
        };
        var response = '';
        var post_req = http.request(post_options, function (res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                response += chunk;
            });

            res.on('end', function () {
                var contents = JSON.parse(response.substring(1));
                ws.send('|/trn ' + username + ',0,' + contents['assertion']);
            });
        });
        post_req.write(post_data);
        post_req.end();

    }

    // The online version of the interface only really needs message, but the offline version needs to know the name of sender.
    // Seems like it'd be easier to discard the info argument at the communcation layer level rather than do some weird check at the interface layer.
    function send(message, info) {
        ws.send(message);
    }
}
else {
    process.stdin.on('data', function (text) {
        if (text === 'quit\n') {
            done();
        }
    });
    var scores = [];

    console.time('gametime');
    for (var i = 0; i < 15; i++) {
        var game = new OfflineGame();
        scores.push(game.playGames(new BFSAgent(), new RandomAgent(), 1, 'competitive'));
        
    }
    console.timeEnd('gametime');
    console.log(scores);
}