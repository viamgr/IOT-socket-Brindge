let deviceId = Math.random();
var ws;
var reader;

function cancelSendingFile() {
    if (reader) {
        reader.cancel();
    }
}

function connect() {
    console.log('connecting');

    ws = new WebSocket(`ws://${location.host}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = function () {
        console.log("connect");
        // subscribe to some channels
        ws.send(JSON.stringify({key: "device:subscribe", message: deviceId.toString()}))
    };
    ws.onmessage = function (e) {
        if (typeof e.data == 'string') {
            console.log('Message:', e.data);
            var message = JSON.parse(e.data);
            switch (message.key) {
                case "server:pair":
                    ws.send(JSON.stringify({key: "device:paired"}));
                    console.log(`on Paired ${message.message}`);
                    console.log("Sending Paired Signal");
                    break;
                case "server:unpaired":
                    console.log("server:unpaired");
                    cancelSendingFile();
                    break;
                case "server:text":
                    console.log("On Set Received");
                    if (typeof message.message == "object") {
                        ws.send(JSON.stringify({
                            key: "device:text",
                            message: {
                                status: false,
                                errorCode: 400,
                                errorMessage: "An Error Happened",
                                time: new Date()
                            }
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            key: "device:text",
                            message: {
                                status: false,
                            }
                        }));
                        /*switch (message.key) {
                            case "file:start":
                                console.log('file:start');
                                break;
                            case "file:finish":
                                console.log('file:finish');
                                break;

                        }
                        $("#setResult").text(JSON.stringify(message));
                        break;*/
                    }
                    break;
            }

        } else {
            console.log('Binary Data', e.data);
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


$(function () {
    $("#id").text(deviceId);
    connect(deviceId);
    $("#form").submit(function (ev) {
        ev.preventDefault();
        var message = $("#message").val();
        let body = JSON.stringify({key: "device:text", message: message});
        ws.send(body);
    });

    $("#fileForm").submit(function (ev) {
        ev.preventDefault();
        var firstFile = $("#file")[0].files[0];
        var firstFile1 = $("#file1")[0].files[0];
        reader = new ChunkedFileReader({maxChunkSize: 256 * 1024});

        // Subscribe event listeners
        reader.subscribe('begin', function (evt) {
            console.log('Start reading');

        });
        reader.subscribe('progress', function (evt) {
            if (evt.done === 1) {
                ws.send(JSON.stringify({
                    key: 'client:text', message: {
                        key: 'file:start',
                        name: firstFile1.name,
                        size: firstFile1.size,
                        type: firstFile1.type,
                        isStream: false,
                    }
                }));
            }
            console.log('Progress ' + evt.done + ' / ' + evt.nchunks + ' chunks (' + (evt.done_ratio * 100).toFixed(2) + '%)');
        });
        reader.subscribe('chunk', function (evt) {
            ws.send(evt.chunk);
            // console.log('Read chunk: '+evt.chunk);
        });
        reader.subscribe('end', function (evt) {
            console.log('Done reading');
            ws.send(JSON.stringify({
                key: 'client:text', message: {
                    key: 'file:finish'
                }
            }));
        });

        // Read it!
        reader.readChunks(firstFile);

    });

});