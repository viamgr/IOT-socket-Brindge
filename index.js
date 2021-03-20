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

wss.on('error', (err) => console.log(err.message));

let wsClients = [];

function addClient(myId, ws, isDevice) {
    let client = findClientById(myId);
    if (client) {
        ws.send(JSON.stringify({key: "server:duplicated"}));
        console.log(`Client: ` + myId + ` Duplicated`);
    } else {
        console.log(`Client: ` + myId + ` Subscribed`);
        wsClients.push({id: myId, ws: ws, isDevice: isDevice});
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
        return item.id === deviceId
    });
}

function findClientByConnectedToId(id) {
    return lodash.find(wsClients, function (item) {
        return item.connectedTo === id
    });
}

function getPairedClient(me) {
    let paired;
    if (me && me.isDevice) {
        paired = findClientByConnectedToId(me.id);
    } else if (me) {
        paired = findClientById(me.connectedTo);
    }
    return paired;
}

function sendEventToPaired(myId, key, value) {
    console.log(`sendMessage:`, key, value);
    let me = findClientById(myId);
    let paired = getPairedClient(me);
    if (paired && paired.ws) {
        console.log(typeof value);
        let body = JSON.stringify({key: key, message: value});
        console.log(`sendMessage body: `, body);
        paired.ws.send(body);
    }
}

function pair(ws, myId, deviceId) {
    if (findClientByConnectedToId(deviceId)) {
        ws.send(JSON.stringify({key: "server:duplicated"}));
    } else {

        console.log(`Pairing: ${myId} to ${deviceId}`);
        let myClient = findClientById(myId);
        myClient.connectedTo = deviceId;
        let paired = findClientById(deviceId);
        if (paired) {
            paired.ws.send(JSON.stringify({key: "server:pair", message: myId}));
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

function sendPairedSignal(myId) {
    let pairRequestedClient = findClientByConnectedToId(myId);
    if (pairRequestedClient) {
        pairRequestedClient.ws.send(JSON.stringify({key: "server:paired", message: myId}))
    }

}

function unpairAndRemove(myId) {
    sendEventToPaired(myId, "server:unpaired", myId);
    removeClient(myId);
}

wss.on('connection', function connection(ws, request, client) {
    var myId;
    console.log("device connected");
    ws.on('message', function incoming(message) {
        console.log(`Received message ${message}`);
        let json = JSON.parse(message);
        switch (json.key) {
            case "device:subscribe":
                myId = json.message;
                addClient(myId, ws, true);
                sendPairedSignal(myId);
                break;
           case "device:paired":
                sendPairedSignal(myId);
                break;
            case "client:subscribe":
                myId = Math.random();
                addClient(myId, ws, false);
                break;
            case "client:pair":
                let deviceId = json.message;
                pair(ws, myId, deviceId);

                break;
            case "device:text":
            case "client:text":
                sendEventToPaired(myId, "server:text", json.message);
                break;

        }
        ws.on('close', function close() {
            unpairAndRemove(myId);
        });
    });

});

server.listen(4200, function () {
    console.log('Listening on http://localhost:4200');

});