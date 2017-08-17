import * as events from "events";
import * as http from "http";
import {IncomingMessage, ServerResponse} from "http";
import SSEServer from "./sseserver";
import {isObject} from "util";

export default class SSEClientReplier extends events.EventEmitter {
    req: http.IncomingMessage;
    res: http.ServerResponse;
    sseServer: SSEServer;
    id: string;

    constructor(req: IncomingMessage, res: ServerResponse, sseServer: SSEServer, id: string) {
        super();
        this.req = req;
        this.res = res;
        this.sseServer = sseServer;
        res.on('close', ()=> {
            this.sseServer.sendAll("close", id);
        });
        res.on('error', ()=> {
            this.sseServer.sendAll("error", id);
        });
        this.initialize();
    }

    initialize() {
        this.req.socket.setNoDelay(true);
        this.res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        this.res.write(':ok\n\n');
    };

    send(event?, data?, id?) {
        if (arguments.length === 0) return;

        var senderObject = {
            event: event || undefined,
            data: data || undefined,
            id: id || undefined,
            retry: undefined
        };

        if (isObject(event)) {
            senderObject.event = event.event || undefined;
            senderObject.data = event.data || undefined;
            senderObject.id = event.id || undefined;
            senderObject.retry = event.retry || undefined;
        }

        if (!isObject(event) && arguments.length === 1) {
            senderObject.event = undefined;
            senderObject.data = event;
        }

        if (senderObject.event) this.res.write('event: ' + senderObject.event + '\n');
        if (senderObject.retry) this.res.write('retry: ' + senderObject.retry + '\n');
        if (senderObject.id) this.res.write('id: ' + senderObject.id + '\n');

        senderObject.data = senderObject.data.replace(/(\r\n|\r|\n)/g, '\n');
        var dataLines = senderObject.data.split(/\n/);

        for (var i = 0, l = dataLines.length; i < l; ++i) {
            var line = dataLines[i];
            if ((i + 1) === l) this.res.write('data: ' + line + '\n\n');
            else this.res.write('data: ' + line + '\n');
        }
    }

    close = function () {
        this.res.end();
    }
}