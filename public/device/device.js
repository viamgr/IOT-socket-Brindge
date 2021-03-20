let deviceId = Math.random();
var ws;

function connect() {
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = function () {
        console.log("connect");
        // subscribe to some channels
        ws.send(JSON.stringify({key: "device:subscribe", message: deviceId.toString()}))
    };
    ws.onmessage = function (e) {
        console.log('Message:', e.data);
        var message = JSON.parse(e.data);
        switch (message.key) {
            case "server:pair":
                console.log(`on Paired ${message.message}`);
                console.log("Sending Paired Signal");
                ws.send(JSON.stringify({key: "device:paired"}));
                break;
            case "server:text":
                console.log("On Set Received");
                if (typeof message.message == "object")
                    ws.send(JSON.stringify({
                        key: "device:text",
                        message: {status: false, errorCode: 400, errorMessage: "An Error Happened", time: new Date()}
                    }));
                break;
        }
    };

    ws.onclose = function (e) {
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(function () {
            connect();
        }, 1000);
    };

    ws.onerror = function (err) {
        console.error('Socket encountered error: ', err.message, 'Closing socket');
        ws.close();
    };
}


$(function () {
    $("#id").text(deviceId);
    connect(deviceId);
    $("#form").submit(function (ev) {
        ev.preventDefault();
        var message = $("#message").val();
        let body = JSON.stringify({key: "device:text", message: message});
        ws.send(body);
    });

});