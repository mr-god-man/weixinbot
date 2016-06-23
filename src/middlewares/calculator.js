const reg = /^[0-9+\-*\/\(\). ]+$/;
module.exports = function (msg, bot, next) {
    if (typeof msg.Content == 'string') {
        var result = msg.Content.match(reg);
        if (result && result.length > 0) {
            bot.sendText(msg.FromUserName, eval(msg.Content));
        }
        next();
    } else {
        next();
    }
};