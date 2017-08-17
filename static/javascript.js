let topicId = "";
let cookieName = "settings";
let ping = Date.now();

function watchingStatus(active) {
    $("#topicTime").prop("disabled", active);
    $("#user").prop("disabled", active);
    $("#pass").prop("disabled", active);
    $("#forumId").prop("disabled", active);
    $("#topicUrl").prop("disabled", active);
    $("#topicPos").prop("disabled", active);
}

function updateStatus() {
    let statusRender = $("#status");
    statusRender.removeClass();
    if ((ping + 5000 ) < Date.now()) {
        statusRender.addClass("btn").addClass("btn-danger");
    } else {
        statusRender.addClass("btn").addClass("btn-success");
    }
    setTimeout(updateStatus, 1000);
}

function createCookie(name, value, days) {
    var expires;

    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }
    document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function loadCookie() {
    let cookie = readCookie(cookieName);

    if (cookie) {
        cookie = JSON.parse(cookie);
        let time = $("#topicTime").val(cookie.time);
        let user = $("#user").val(cookie.user);
        let pass = $("#pass").val(cookie.pass);
        let forum = $("#forumId").val(cookie.forum);
        let topic = $("#topicUrl").val(cookie.topic);
        let pos = $("#topicPos").val(cookie.pos);
    }
}

function saveCookie() {
    createCookie(cookieName, JSON.stringify(getInfo()), 360);
}

function getInfo() {
    let time = $("#topicTime").val();
    let user = $("#user").val();
    let pass = $("#pass").val();
    let forum = $("#forumId").val();
    let topic = $("#topicUrl").val();
    let pos = $("#topicPos").val();
    return {user: user, pass: pass, time: time, forum: forum, topic: topic, pos: pos}
}

function changeWatching(active) {
    $("#topicOk").removeClass().addClass("btn");

    if (active === 1) {
        $("#topicOk").addClass("btn-success").text("Stop");
    } else if (active === 0) {
        $("#topicOk").addClass("btn-primary").text("Watch");
    } else if (active === -1) {
        $("#topicOk").addClass("btn-danger").text("Error");
    }
}

$("#topicOk").click(function (e) {
    if (!$("#topicOk").hasClass("btn-success")) {
        saveCookie();
        $.ajax({
            method: "post",
            url: "watch",
            data: JSON.stringify(getInfo()),
            headers: {"content-type": "application/json"},
            success: function (data, textStatus, jqXHR) {
                topicId = data;
                changeWatching(1);
                watchingStatus(true);
                postAlive();
            },
            error: function (jqXHR, textStatus, errorThrown) {
                changeWatching(-1);
                watchingStatus(false);
            }
        });

        let table = $("#datatable");
        table.empty();
    } else {
        $.ajax({
            method: "post",
            url: "stop/" + topicId,
            success: function (data, textStatus, jqXHR) {
                changeWatching(0);
                watchingStatus(false);
                topicId = "";
            },
            error: function (jqXHR, textStatus, errorThrown) {
                changeWatching(-1);
                watchingStatus(false);
                topicId = "";
            }
        });
    }
});

function postAlive() {
    if (topicId && topicId !== "") {
        $.ajax({
            method: "post",
            url: "alive/" + topicId,
        });

        setTimeout(postAlive, 15 * 1000);
    }
}

let evt = new EventSource("stream");

evt.addEventListener("message", function (e) {
    let dataEvent = JSON.parse(e.data);

    if (dataEvent.topic !== topicId) {
        return
    }

    console.log("new message received");

    let table = $("#datatable");

    if (table.length <= 0) {
        let data = $("#data");
        let newTable = document.createElement("table");
        newTable.id = "datatable";
        newTable.style = "margin:5px";
        newTable.className = "table table-bordered";
        data.append(newTable);
        table = $("#datatable");
    }

    let newElement = document.createElement("tr");
    newElement.innerHTML = dataEvent["tr"];
    table.prepend(newElement);
});

evt.addEventListener("system", function (e) {
    if (e.data === "ping") {
        ping = Date.now();
    }
});

loadCookie();
updateStatus();