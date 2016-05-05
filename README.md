# Robot for Wechat personal chat
# (fork from [feit's weixinbot](https://github.com/feit/Weixinbot))

## Install

```bash
$ npm install weixinbot2 --save
```

**Require Nodejs v4+**


## Usage

```javascript
'use strict';

const Weixinbot = require('weixinbot2')

const bot = new Weixinbot()

bot.on('qrcode', qrcodeUrl => {
  // get the login qrcode url
  // open this url on browser and scan on your Wechat
  console.log(qrcodeUrl)
});

bot.on('offline', () => {
  // account offline
});

bot.on('online', () => {
  //  account online
});

bot.on('friend', msg => {
  console.log(msg.Member.NickName + ': ' + msg.Content)
  bot.sendText(msg.FromUserName, 'Got it')
});
// group: group message
// system: system message

// start run loop
bot.run()
```


## Run

```bash
# We recommend show debug message under development
$ DEBUG=weixinbot2 node index.js
```


## License

```
Copyright (c) 2016 Zongmin Lei(雷宗民) <leizongmin@gmail.com>
http://ucdok.com

The MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
