var replyKV = [
    {
        key:/车牛日活/,
        reply:require('./serverAdapters/cheniu_daily_active')
    }
];

var whiteListGroup = [
    '搜车前端 & NodeJS',
    '车牛新世纪项目组'
]


module.exports = function(msg,bot,next){
    if(typeof(msg.Content)=='string'){
        var groupName = msg.Group?msg.Group.NickName:'';
        if(whiteListGroup.indexOf(groupName)==-1){
            return next();
        }
        replyKV.forEach(function(kv){
            if(kv.key.test(msg.Content)){
                kv.reply().then(function(data){
                    bot.sendText(msg.FromUserName,data);
                });
            }
        })
        next();
    }else{
        next();
    }
}