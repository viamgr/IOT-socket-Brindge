var ws;
var deviceId;

function connect() {
    ws = new WebSocket(`ws://${location.host}`);
    console.log(`ws://${location.host}`);

    ws.onopen = function () {
        // subscribe to some channels
        ws.send(JSON.stringify({key: "client:subscribe"}));
        requestPair();
    };

    ws.onmessage = function (e) {
        console.log('Message:', e.data);
        var message = JSON.parse(e.data);
        switch (message.key) {
            case "server:text":
                $("#setResult").text(JSON.stringify(message));
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

function requestPair() {
    if (deviceId) {
        let body = JSON.stringify({key: "client:pair", message: deviceId});
        ws.send(body);
    }
}

$(function () {
    connect();
    $("#form").submit(function (ev) {
        ev.preventDefault();
        var message = $("#message").val();
        let body = JSON.stringify({key: "client:text", message: message});
        ws.send(body);
    });

    $("#pair").submit(function (ev) {
        deviceId = $("#deviceId").val();
        ev.preventDefault();
        requestPair();
    });
    $("#setForm").submit(function (ev) {
        ev.preventDefault();
        if (deviceId) {
            let name = $("#setKey").val();
            let value = $("#setValue").val();
            let body = JSON.stringify({
                key: "client:text",
                message: {name: name, value: value}
            });
            $("#setResult").text("Loading");
            console.log(body);
            ws.send(body);
        }

    });

});
