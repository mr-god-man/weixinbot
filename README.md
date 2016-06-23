##启动

```
npm install;

node test/index.js

```

##增加特性

在middlewares中增加中间件,然后在test/index.js中添加 

```
bot.use('friend',require('./../lib/middlewares/dataReport'));
```
中间件写法可以参考已经存在的