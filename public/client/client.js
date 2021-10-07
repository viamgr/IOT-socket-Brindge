var ws;
var deviceId;
var chunkedFileReader;
var reader;

var fileSize = 0;
var receivedChunkSize = 0;
var firstFile;

function cancelSendingFile() {
    if (chunkedFileReader) {
        chunkedFileReader.cancel();
    }
}

function sendSlice(start, end) {
    console.log('file:request:slice', start, end);
    if (firstFile.size > start) {
        reader.readAsArrayBuffer(firstFile.slice(start, end));
    }
}

function connect() {
    let url = `ws://192.168.4.1:4200/`;
    // let url = `ws://${location.host}`;
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    console.log(url);

    ws.onopen = function () {
        // subscribe to some channels
        ws.send(JSON.stringify({key: "client:subscribe"}));
        requestPair();
    };
    ws.onmessage = function (e) {
        if (typeof e.data == 'string') {
            console.log('Message:', e.data);
            var json = JSON.parse(e.data);
            switch (json.key) {
                case "server:text":
                case "device:text":
                    switch (json.message.key) {
                        case "file:send:slice":
                            sendSlice(json.message.start, json.message.end);
                            break;
                        case "file:detail:callback":
                            fileSize = json.message.length;
                            ws.send(JSON.stringify({
                                key: "client:text",
                                message: {key: 'file:request:slice', start: 0}
                            }));
                            break;
                    }
                    $("#setResult").text(JSON.stringify(json));
                    break;
                case "server:unpaired":
                    console.log("server:unpaired");
                    cancelSendingFile();
                    break;
                case "device:time":
                    ws.send(JSON.stringify({key: "client:time", value: Math.floor(new Date().getTime() / 1000)}));
                    break;
                case "device:subscribe":
                    ws.send(JSON.stringify({key: "client:paired", message: deviceId}))
                    break;
            }
        } else {
            // console.log('Binary Data', e.data);
            receivedChunkSize += e.data.byteLength;

            if (receivedChunkSize < fileSize) {
                ws.send(JSON.stringify({
                    key: "client:text",
                    message: {key: 'file:request:slice', start: receivedChunkSize}
                }));
            } else {
                ws.send(JSON.stringify({
                    key: "client:text",
                    message: {key: 'file:request:finished'}
                }));
            }
            // let $fileResult = $("#fileResult");
            // $fileResult.text($fileResult.text() + new TextDecoder().decode(e.data));
        }

    };

    ws.onclose = function (e) {
        cancelSendingFile();
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(function () {
            connect();
        }, 1000);
    };

    ws.onerror = function (err) {
        cancelSendingFile();
        console.error('Socket encountered error: ', err.message, 'Closing socket');
        ws.close();
    };
}

function requestPair() {
    if (deviceId) {
        let body = JSON.stringify({key: "client:pair", message: deviceId});
        console.log(body)

        ws.send(body);
    }
}

$(function () {
    connect();
    $("#form").submit(function (ev) {
        ev.preventDefault();
        var message = $("#message").val();
        let body = JSON.stringify({key: "client:text", message: JSON.parse(message)});
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
                message: {key: 'set', name: name, value: value}
            });
            $("#setResult").text("Loading");
            console.log(body);
            ws.send(body);
        }

    });

    $("#fileForm").submit(function (ev) {
        ev.preventDefault();
        firstFile = $("#file")[0].files[0];
        reader = new FileReader(firstFile);


        reader.onloadend = function (evt) {
            console.log("onLoad");
            console.log(evt.target.result);
            ws.send(evt.target.result);
        };

        ws.send(JSON.stringify({
            key: 'client:text', message: {
                key: 'file:send:start',
                name: firstFile.name,
                size: firstFile.size,
                type: firstFile.type,
            }
        }));
    });

    $("#requestFile").submit(function (ev) {
        receivedChunkSize = 0;
        fileSize = 0;
        ev.preventDefault();
        $("#fileResult").text('');
        ws.send(JSON.stringify({
            key: 'client:text', message: {
                key: 'file:detail:request',
                name: $('#fileName').val()
            }
        }));
    });
});
