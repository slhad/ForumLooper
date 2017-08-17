import * as request from "request";
import * as querystring from "querystring";
import {baseconnector} from "./baseconnector";
import {Tools} from "../tools/Tools";
import * as cheerio from "cheerio";
import CookieJar = request.CookieJar;
import extractRegex = Tools.extractRegex;

export class monchval implements baseconnector {
    Topic(): string {
        return this.topicNumber;
    }

    Forum(): string {
        return "monchval";
    }

    ISODate(daten: number): string {
        return new Date(daten).toISOString();
    }

    IsAlive = (): boolean => {
        let lastAlive = this.ping;
        let limitPast = Date.now() - (60 * 1000);
        let alive = lastAlive > limitPast;
        console.log(this.Forum() + "/" + this.topicNumber + " alive : " + this.ISODate(lastAlive) + " > " + this.ISODate(limitPast) + " -> " + alive);
        return lastAlive > limitPast;
    };

    Alive(): void {
        this.ping = Date.now();
    }

    Stop(): void {
        this.shouldStop = true;
    }

    regex = {
        "topicNumber": /voir\/.*?([0-9]+)/g,
        "topicPages": /topic\/voir\/id-.*?\/page-([0-9]+)/g,
        "messageid": /id_msg-([0-9]+)/g
    };
    template = {
        "topicURL": "http://www.monchval.com/forum/topic/voir/id-{{topic}}/page-{{page}}"
    };
    replace = {
        smiley: {
            out: "src=\"http://www.monchval.com/smiley/",
            in: /src="\/smiley\//g
        }
    };
    cookies: CookieJar;
    numberPage: number;
    maxPage: number;
    topicNumber: string;
    topic: string;
    orginalTopic: string;
    lastmessageid: string;
    timeInterval: number;
    senderFunc: any;
    shouldStop: boolean;
    ping: number;

    constructor() {
        this.cookies = request.jar();
        this.ping = Date.now();
    }

    Connect(login, password: string): Promise<boolean> {

        let body = {
            "login1": login,
            "pass": password,
            "connexion": "Connection"
        };

        let bodyForm = querystring.stringify(body);

        return new Promise<boolean>((resolve, reject)=> {

            request({
                uri: "http://www.monchval.com/login.php",
                headers: {
                    "Content-Length": bodyForm.length,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                jar: this.cookies,
                body: bodyForm,
                method: "POST"
            }, function (error, response, body) {
                resolve(!error);
            });
        });
    }

    GetPage(url: string, mustNotBeEmpty?: boolean): Promise<String> {
        return new Promise<String>((resolve, reject)=> {
            request({
                uri: url,
                jar: this.cookies,
                method: "GET"
            }, function (error, response, body) {
                if (error || (mustNotBeEmpty && body.trim() === "")) {
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });
    }

    GetPageForTopic(topicId: string, pageNumber: number): Promise<String> {
        let pageUrl = this.template.topicURL.replace("{{topic}}", topicId).replace("{{page}}", "" + pageNumber);
        return this.GetPage(pageUrl, true);
    }

    Watch(url: string, index: number, time: number, senderFunc: any): Promise<string> {
        this.orginalTopic = url;

        let resTopic = Tools.extractRegex(this.regex.topicNumber, url);

        if (resTopic.length > 0) {
            this.topicNumber = resTopic[0];
            this.timeInterval = time;
            let startingPage = 1;
            this.GetPageForTopic(this.topicNumber, 1)
                .then((html)=> {
                    let max = this.extractMaxPage(html);
                    this.maxPage = max;
                    this.numberPage = max;
                    this.numberPage = index <= 0 ? max : (index > max ? max : index);
                })
                .then(()=> {
                    return this.GetPageForTopic(this.topicNumber, this.numberPage);
                })
                .then((htmlLast: string)=> {

                    let data = cheerio.load(htmlLast);
                    let table = data(".topicsList")[0];
                    let tbody = cheerio.load(table)("tbody")[0];
                    let tr = cheerio.load(tbody)("tr").last();

                    let trhtml = tr.html();
                    this.lastmessageid = extractRegex(this.regex.messageid, trhtml)[0];

                    senderFunc("message", this.generateJSON(trhtml));
                    this.senderFunc = senderFunc;
                    this.Looper();
                });
            return new Promise<string>((resolve, reject)=> {
                resolve(this.topicNumber);
            });
        }
    }

    generateJSON(trhtml: string) {
        let tmptrhtml = trhtml.replace(this.replace.smiley.in, this.replace.smiley.out);
        return JSON.stringify({
            tr: tmptrhtml,
            topic: this.topicNumber
        });
    }

    extractMaxPage(html) {
        let pages = Tools.extractRegex(this.regex.topicPages, html);
        let max = 0;
        pages.forEach((page)=> {
            max = max < parseInt(page) ? parseInt(page) : max;
        });
        return max;
    }

    DoPage = (page: number): Promise<void>=> {
        return this.GetPageForTopic(this.topicNumber, page).then((html: string)=> {
                console.log(this.Forum() + "/" + this.topicNumber + " scanning page " + page);

                let data = cheerio.load(html);
                let table = data(".topicsList")[0];
                let tbody = cheerio.load(table)("tbody")[0];
                let trs = cheerio.load(tbody)("tr");

                let ids = trs.map((index: number, tr: CheerioElement)=> {
                    let html = cheerio.load(tr).html();
                    let id = {
                        id: extractRegex(this.regex.messageid, html)[0],
                        index: index
                    };

                    return id;
                });

                let lastSendMessage: any = ids.toArray().find((info: any)=> {
                    return info.id === this.lastmessageid;
                });

                if (!lastSendMessage) {
                    trs.each((index, element)=> {
                        let el = cheerio.load(element);
                        let info: any = ids.toArray()[index];
                        this.lastmessageid = info.id;
                        this.senderFunc("message", this.generateJSON(el.html()));
                    });
                } else if (lastSendMessage.index === (trs.length - 1)) {
                    console.log(this.Forum() + "/" + this.topicNumber + " messages up to date");
                } else {
                    for (let x = lastSendMessage.index + 1; x < trs.length; x++) {

                        let el = cheerio.load(trs.get(x));
                        let info: any = ids.toArray()[x];
                        this.lastmessageid = info.id;
                        this.senderFunc("message", this.generateJSON(el.html()));
                    }
                }


            }
        );
    }
        ;

    Updater = (): void => {

        this.GetPageForTopic(this.topicNumber, this.maxPage).then((htmlLast: string)=> {

            this.maxPage = this.extractMaxPage(htmlLast);

            let promise: Promise<void>;

            for (let x = this.numberPage; x <= this.maxPage; x++) {
                if (!promise) {
                    promise = this.DoPage(x);
                } else {
                    promise = promise.then(()=> {
                        let page = x;
                        return this.DoPage(page);
                    })
                }
            }

            promise.then(()=> {
                this.numberPage = this.maxPage;
                this.Looper();
            }).catch((err: Error)=> {
                console.log("LOOPER ERROR :" + err.name + ":" + err.message + "\n" + err.stack);
                this.Looper();
            })

        });
    };

    Looper = (): void=> {
        if (!this.shouldStop) {
            setTimeout(this.Updater, Tools.getRandomInterval(this.timeInterval * 1000, 85, 115));
        } else {
            console.log("Watching for " + this.Forum() + "/" + this.topicNumber + " stopped")
        }
    }
}
