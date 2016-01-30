/* eslint-disable no-console */
import EventEmitter from 'events';
import { exec } from 'child_process';
import conf from './conf';

import Login from './login';

class WeixinBot extends EventEmitter {
  constructor() {
    super();
    this.on('loginSuccess', (loginResult) => {
      console.log(loginResult);
    });
  }

  async run() {
    const login = new Login();
    const { uuid } = await login.getUUID();

    async function checkLoginResult(loginResult) {
      let nextLoginResult = null;
      switch (loginResult.loginCode) {
        case 200:
          this.emit('loginSuccess', { loginResult });
          break;

        case 201:
          console.log('qrcode scaned!');
          nextLoginResult = await login.checkLogin(uuid);
          checkLoginResult(nextLoginResult);
          break;

        case 408:
          console.log('check login timeout');
          nextLoginResult = await login.checkLogin(uuid);
          checkLoginResult(nextLoginResult);
          break;

        default:
          console.error('unkonw status process exit');
          process.exit(1);
      }
    }

    const qrcodePath = conf.QRCODE_PATH + uuid;
    exec(`open ${qrcodePath}`, (err) => {
      if (err) {
        console.log(`自动打开浏览器失败，请手动打开下面这个网址并扫描\n ${qrcodePath}`);
      }
    });

    const loginResult = await login.checkLogin(uuid);
    checkLoginResult(loginResult);
  }
}

export default WeixinBot;
