```
__    __       _        _           ___         _
/ / /\ \ \ ___ (_)__  __(_) _ __    / __\  ___  | |_
\ \/  \/ // _ \| |\ \/ /| || '_ \  /__\// / _ \ | __|
 \  /\  /|  __/| | >  < | || | | |/ \/  \| (_) || |_
  \/  \/  \___||_|/_/\_\|_||_| |_|\_____/ \___/  \__|
                                 微信Nodejs版 by feit
```

## Nodejs 封装网页版微信的接口，可编程控制微信消息

[![NPM version](https://badge.fury.io/js/weixinbot.png)](http://badge.fury.io/js/weixinbot)
[![Dependencies Status](https://david-dm.org/feit/weixinbot.png)](https://david-dm.org/feit/weixinbot)


### Install

```
npm install weixinbot --save
```

**Require Nodejs v4+**


### Usage
```javascript
const Weixinbot = require('weixinbot2')

const bot = new Weixinbot()

// will emit when bot fetch a new qrcodeUrl
bot.on('qrcode', (qrcodeUrl) => {
  console.log(qrcodeUrl)
});

bot.on('friend', (msg) => {
  console.log(msg.Member.NickName + ': ' + msg.Content)
  bot.sendText(msg.FromUserName, 'Got it')
});

bot.run()
```


### Run
```bash
# We recommend show debug message under development
$ DEBUG=weixinbot node index.js
```


### License
The MIT license.
