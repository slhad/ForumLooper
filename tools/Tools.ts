export namespace Tools {

    export function extractRegex(regex, data) {
        let regexClone = new RegExp(regex.source, regex.flags);

        let m, matchs = [];
        if (regexClone.global) {
            while ((m = regexClone.exec(data)) !== null) {
                if (m.index === regexClone.lastIndex) {
                    regexClone.lastIndex++;
                }
                if (m.length > 2) {
                    m.shift();
                    matchs.push(m);
                } else {
                    matchs.push(m[1]);
                }
            }
        } else {
            if (m = regexClone.exec(data)) {
                if (m.length > 2) {
                    m.shift();
                    matchs.push(m);
                } else {
                    matchs.push(m[1]);
                }
            }
        }

        return matchs;
    }

    export function getRandomInterval(time, min, max) {
        let sub = max - min;
        let random = Math.random() * sub + min;
        return time * random / 100;
    }

}

export default Tools;