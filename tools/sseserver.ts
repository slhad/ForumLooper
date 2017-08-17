import * as events from "events";
import * as http from "http";
import SSEClientReplier from "./sseclientreplier";

type client = {
    id: string;
    client: SSEClientReplier
}

export default class SSEServer extends events.EventEmitter {
    clients: client[];
    cpt: number;

    constructor() {
        super();
        this.cpt = 0;
        this.clients = [];
    }

    getId(req: http.IncomingMessage): string {
        let addr = req.connection;
        return addr.remoteFamily + "-" + addr.remoteAddress + "-" + addr.remotePort;
    }

    handleRequest(req: http.IncomingMessage, res: http.ServerResponse, query) {
        let client: client = this.clients.find(function (client) {
            return this.getId(req) === client.id;
        }, this);
        if (!client) {
            let id = this.getId(req);
            client = {id: id, client: new SSEClientReplier(req, res, this, id)};
            this.clients.push(client);
        }
    }

    sendAllBut(event?, data?, notThisId?) {
        if (arguments.length === 0) {
            return;
        }

        this.cpt++;

        let self = this;

        if (event === "close" && data) {
            this.clients = this.clients.filter(client => {
                return client.id !== data;
            });
        }

        this.clients.forEach(function (client: client) {
            if (client.id !== notThisId) {
                if (event === "whoami") {
                    data = client.id;
                }
                client.client.send(event, data, self.cpt);
            }
        });
    }

    sendAll = (event?, data?) => {
        this.sendAllBut(event, data)
    }
}