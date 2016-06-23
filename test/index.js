'use strict';
const child_process = require('child_process');
const Weixinbot = require('./../index.js');

const bot = new Weixinbot({
    dataPath: './',  // data path, will store contacts data to improve experience
    updateContactInterval: 1000 * 600,
})

bot.on('qrcode', qrcodeUrl => {
    // get the login qrcode url
    // open this url on browser and scan on your Wechat
    console.log(qrcodeUrl)
    child_process.exec('open -a Safari '+qrcodeUrl);
});

bot.on('offline', () => {
    console.log('offline');
});

bot.on('online', () => {
    console.log('online');
});

bot.use('friend',require('./../lib/middlewares/calculator'));
bot.use('friend',require('./../lib/middlewares/reply'));
// bot.use('friend',require('./../lib/middlewares/dataReport'));


//计算器,触发:"计算 1+1"
// bot.use('group',require('./../lib/middlewares/calculator'));
//关键字回复
bot.use('group',require('./../lib/middlewares/reply'));
//数据触发器,例如:"日活"
// bot.use('group',require('./../lib/middlewares/dataReport'));

// start run loop
bot.run()