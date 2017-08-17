import * as express from "express";
import * as exphbs from "express-handlebars";
import SSEServer from "./tools/sseserver";
import * as bodyParser from "body-parser";
import {baseconnector} from "./connector/baseconnector";

let app = express();
let sseserver = new SSEServer();

let watched: any = {};

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
    res.render('home', {connectors: ["monchval"]});
});

app.use("/static", express.static("static"));

app.get("/stream", function (req, res) {
    sseserver.handleRequest(req, res, "ok");
});

app.post("/alive/:topic", function (req, res) {

    let forum: baseconnector = watched[req.params.topic];
    if (forum) {
        forum.Alive();
    }
    res.send("ok");
});

app.post("/stop/:topic", function (req, res) {

    let forum: baseconnector = watched[req.params.topic];
    if (forum) {
        forum.Stop();
    }
    res.send("ok");
});

app.post("/watch", bodyParser.json(), function (req, res) {
    if (req.body.user
        && req.body.pass
        && req.body.time
        && req.body.forum
        && req.body.topic
        && req.body.pos) {

        let forum = require("./connector/" + req.body.forum);
        let watcher = new forum[req.body.forum];
        let castedWatcher: baseconnector = watcher;
        castedWatcher
            .Connect(req.body.user, req.body.pass)
            .then((res)=> {
                return castedWatcher.Watch(req.body.topic, parseInt(req.body.pos), parseInt(req.body.time), sseserver.sendAll);
            })
            .then((topicNumber: string)=> {
                res.send(topicNumber);
                watched[topicNumber] = castedWatcher;
            })
            .catch((err)=> {
                console.log(err);
            });
    } else {
        res.send("ko");
    }

});

let port = 3000;
app.listen(port, (t)=> {
    console.log("Server started on:" + port)
});

function ping() {
    sseserver.sendAll("system", "ping");
    setTimeout(ping, 1000);
}

function autoclean() {

    let stillAlive = {};
    watched = Object.keys(watched).forEach((watcherid: string)=> {

        let watcher: baseconnector = watched[watcherid];

        if (!watcher.IsAlive()) {
            watcher.Stop();
            console.log("Watcher for " + watcher.Forum() + "/" + watcher.Topic() + " cleanup");
        } else {
            stillAlive[watcherid] = watcher;
        }
    });

    watched = stillAlive;

    setTimeout(autoclean, 60 * 1000);
}

ping();
autoclean();