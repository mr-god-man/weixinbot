var request = require('request');
var TokenManager = require('./../../soucheTokenManager');
var moment = require('moment');

module.exports = function(){
    return new Promise(function(resolve, reject){
        TokenManager.getToken(function(err,token){
            var option = {
                url:'http://data.souche-inc.com/report/config/view/loadDataForCustomReport.do',
                form:{
                    reportCode:'CHENIU_CORE_REPORT',
                    dates:moment(new Date().getTime() - 1000*60*60*48).format('YYYY-MM-DD')+' 到 '+moment().format('YYYY-MM-DD')
                },
                headers:{
                    Cookie:'_security_token_inc='+token
                },
                json:true
            };
            request.post(option,function(e,r,body){
                // console.log('request data',option,body);
                if(body&&body.data&&body.data.length){
                    resolve([
                        '昨日汇总:',
                        '  车牛日活:'+body.data[0].CHENIU_APP_SUM_DAILY_LIVING_pv,
                        '  车牛android日活:'+body.data[0].CHENIU_ANDROID_DAILY_LIVING_pv,
                        '  车牛ios日活:'+body.data[0].CHENIU_APP_STORE_DAILY_LIVING_pv,
                        '昨昨日汇总:',
                        '  车牛日活:'+body.data[1].CHENIU_APP_SUM_DAILY_LIVING_pv,
                        '  车牛android日活:'+body.data[1].CHENIU_ANDROID_DAILY_LIVING_pv,
                        '  车牛ios日活:'+body.data[1].CHENIU_APP_STORE_DAILY_LIVING_pv
                    ].join('\n'));
                }else{
                    reject(new Error('数据错误'));
                }
            });
        })

    });
};