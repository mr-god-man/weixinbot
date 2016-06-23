var replyKV = [
    {
        key:/^老公/,
        reply:"老婆~~~"
    },
    {
        key:/^芋头/,
        reply:'哈~~~'
    },
    // {
    //     key: /大搜车/,
    //     reply:`
    //     大搜车位于杭州市余杭区五常大道 175 号，独立 2 栋连体办公楼，办公环境一级棒，一楼有很大的健身区 / 台球室 / 瑜伽房，还有大面积的室内停车位。
    //     公司创立于 2013 年，在二手车行业摸打滚爬 3 余载，融资已经 D 轮，投资方碉堡不过还不能透露。
    //     公司业务一路从 B2C，到 B2B，到后来融合大小商家的管理系统，质保金融系统，一直走在同行业的前列，网站 App 已经被抄了 N 次，不过并没有卵用，看着一个个追随者在后面你死我活的，我司笑而不语。
    //     现在公司主营大车商小车商的流通和管理系统，涉及交易，金融，质保，车源流通，人员管理，检测服务各个领域。
    //     公司现招聘各种开发人员(前端,node,java,ios,android等,欢迎简历:sunxinyu@souche.com`
    // }
]

var whiteListGroup = [
    '搜车前端 & NodeJS',
    '敏厨房，修改请发256'
]

module.exports = function(msg,bot,next){
    var groupName = msg.Group?msg.Group.NickName:'';
    if(whiteListGroup.indexOf(groupName)==-1){
        return next();
    }
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