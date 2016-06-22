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

// bot.on('offline', () => {
//     // account offline
// });
//
// bot.on('online', () => {
//     //  account online
// });

// bot.on('friend', msg => {
//     console.log(msg.Member.NickName + ': ' + msg.Content)
//     bot.sendText(msg.FromUserName, 'Got it')
// });

bot.use('friend',require('./../lib/middlewares/calculator'));
bot.use('friend',require('./../lib/middlewares/reply'));
// group: group message
// system: system message

// start run loop
bot.run()