const WebSocket = require('ws');
const express = require('express');
var lodash = require('lodash');
const {createServer} = require('http');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname, '/node_modules')));
app.use(express.static(path.join(__dirname, '/public')));
const server = createServer(app);
const wss = new WebSocket.Server({server});

let wsClients = [];

function addClient(myId, ws, isDevice) {
    let client = findClientById(myId);
    if (client) {
        console.log(`Client: ` + myId + ` Duplicated`);
        return client;
    } else {
        let me = {id: myId, ws: ws, isDevice: isDevice};
        console.log(`Client Subscribed`, me.id, me.isDevice);
        wsClients.push(me);
        return me;
    }
}

function removeClient(deviceId) {
    lodash.remove(wsClients, function (item) {
        return item.id === deviceId;
    });
    console.log(`Device ` + deviceId + ` Removed, Devices: ` + wsClients.length);
}

function findClientById(deviceId) {
    return lodash.find(wsClients, function (item) {
        console.log(`findClientById ${item.id}  === ${deviceId} `);

        return item.id === deviceId
    });
}

function findClientByConnectedToId(id) {
    return lodash.find(wsClients, function (item) {
        console.log(`findClientByConnectedToId ${item.connectedTo}  === ${id} , id:${item.id}`);
        return item.connectedTo === id
    });
}

function getPairedClient(me) {
    console.log(`Finding paired client: ${me.id} isDevice:${me.isDevice} isConnectedTo:${me.connectedTo}`);
    let paired;
    if (me && me.isDevice) {
        paired = findClientByConnectedToId(me.id);
    } else if (me) {
        paired = findClientById(me.connectedTo);
    }

    return paired;
}

function sendEventToPaired(me, value) {
    console.log(`sendMessage:`, value);
    let paired = getPairedClient(me);
    if (paired && paired.ws) {
        let body = JSON.stringify(value);
		console.log("send message to paired . " , paired.id,body);

        paired.ws.send(body);
    } else {
        let body = JSON.stringify({key: "server:reject", value: 401});
        me.ws.send(body);
        console.log("Can not find paired client. " + paired);
    }
}

function pair(ws, me, deviceId) {
    console.log(`Pairing: ${me.id} to ${deviceId}`);

    if (findClientByConnectedToId(deviceId)) {
        console.log("Failed to find paired")
        ws.send(JSON.stringify({key: "pair:error","value":"duplicated"}));
    } else {

        let myClient = findClientById(me.id);
        myClient.connectedTo = deviceId;
        let paired = findClientById(deviceId);
        if (paired) {
            paired.ws.send(JSON.stringify({key: "pair", value: me.id}));
        }
        else{
            console.log("pair client is offline")
            ws.send(JSON.stringify({key: "pair:error","value":"pair client is offline"}));
        }
    }
}

function unpair(myId) {
    let myClient = findClientById(myId);
    if (myClient) {
        let pairedClient = findClientById(myClient.connectedTo);
        pairedClient.connectedTo = null;
        return true;
    } else return false;
}

function sendSubscribedSignal(ws,myId,isDevice){
	ws.send(JSON.stringify({key: "subscribe:done"}));
	if(isDevice)
	{
		sendPairedSignal(myId)
	}
}
function sendPairedSignal(myId) {
    let pairRequestedClient = findClientByConnectedToId(myId);
    if (pairRequestedClient) {
        pairRequestedClient.ws.send(JSON.stringify({key: "pair:done", value: myId}))
    }

}

function unpairAndRemove(me) {
    console.log("unpairAndRemove");
    sendEventToPaired(me, {key: 'unpair', 'value': me.id});
    removeClient(me.id);
}

function sendBinaryToPaired(me, message) {
    let paired = getPairedClient(me);
    if (paired && paired.ws) {
        paired.ws.send(message);
    }
}

wss.on('connection', function connection(ws, request, client) {
    console.log("device connected");

    ws.isAlive = true;
    ws.on('pong', heartbeat);
    let me;
    ws.on('message', function incoming(message) {
        if (typeof message == 'string') {
            console.log(`Received message ${message}`);
            let json;
            try {
                json = JSON.parse(message);
            } catch (e) {
                console.log(e);
                return;
            }
            if (json == null || !json.hasOwnProperty('key')) {
                console.log('error in json key');
                return;
            }
            switch (json.key) {
                case "subscribe":
					let id = json.value || Math.random();
					let isDevice = json.value?true:false;
                    me = addClient(id, ws, isDevice);
                    sendSubscribedSignal(ws,me.id,isDevice);
                    break;
                case "device:time":
                    ws.send(JSON.stringify({key: "server:time", value: Math.floor(new Date().getTime() / 1000)}));
                    break;
                case "paired":
                    // in ezafe nist ? vase chie?
                    sendPairedSignal(me.id);
                    break;
                case "pair":
                    let deviceId = json.value;
                    pair(ws, me, deviceId);
                    break;
                default:
					if(me)
						sendEventToPaired(me, json);
                    break;
            }
        } else {
            console.log(`Received binary message ${message.length} type: ${typeof message}`);
            sendBinaryToPaired(me, message);
        }

    });

    ws.on('close', function close() {
        console.log('closed a connection');

        if (me) {
            console.log('closed a connection', me.id);
            unpairAndRemove(me);
        }
    });
});

function noop() {
}

function heartbeat() {
    this.isAlive = true;
}

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping(noop);
    });
}, 10000);

wss.on('close', function close() {
    clearInterval(interval);
});

server.listen(4200, function () {
    console.log('Listening on http://localhost:4200');

});