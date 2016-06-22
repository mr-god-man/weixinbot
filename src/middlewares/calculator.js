import {isStringMatched} from './../utils';
const keyword = '计算';
module.exports = function(msg,bot,next){
    console.log(msg);
    if(typeof(msg.Content)=="string"&&isStringMatched(msg.Content,keyword)){
        var realContent = msg.Content.replace(new RegExp('^'+keyword+'.'),'').replace(/^ *| *$/g,'');
        bot.sendText(msg.FromUserName,eval(realContent));
        next();
    }else{
        next();
    }
}

