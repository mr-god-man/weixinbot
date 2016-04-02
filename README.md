# Robot for Wechat personal chat (fork from feit's weixinbot)

## Install

```bash
$ npm install weixinbot2 --save
```

**Require Nodejs v4+**


## Usage
```javascript
const Weixinbot = require('weixinbot2')

const bot = new Weixinbot()

bot.on('qrcode', (qrcodeUrl) => {
  console.log(qrcodeUrl)
});

bot.on('friend', (msg) => {
  console.log(msg.Member.NickName + ': ' + msg.Content)
  bot.sendText(msg.FromUserName, 'Got it')
});
// group: 群组消息
// system: 系统消息

bot.run()
```


## Run
```bash
# We recommend show debug message under development
$ DEBUG=weixinbot2 node index.js
```


## License
The MIT license.
