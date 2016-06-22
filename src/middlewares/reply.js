var replyKV = [
    {
        key:/^老公/,
        reply:"老婆~~~"
    }
]

module.exports = function(msg,bot,next){
    if(typeof(msg.Content)=='string'){
        replyKV.forEach(function(kv){
            if(kv.key.test(msg.Content)){
                bot.sendText(msg.FromUserName,kv.reply);
            }
        })
        next();
    }else{
        next();
    }
}