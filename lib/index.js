/* eslint-disable no-console */
import rp from 'request-promise';
import { exec } from 'child_process';
import conf from './conf';

class Login {
  constructor() {
    this.UUID_REG = /uuid = "(.+)";$/;
    this.LOGIN_CODE_REG = /code=(\d{3});/;
  }

  async getUUID() {
    const uuidHtml = await rp(conf.API_jsLogin);
    if (!this.UUID_REG.test(uuidHtml)) {
      return { err: new Error('get uuid failed') };
    }

    const uuid = this.UUID_REG.exec(uuidHtml)[1];
    return { uuid };
  }

  async checkLogin(uuid) {
    const options = {
      uri: `${conf.API_login}?loginicon=true&uuid=${uuid}&tip=1&r=${~new Date}`,
      timeout: 35e3,
    };

    const loginHtml = await rp(options);
    if (!this.LOGIN_CODE_REG.test(loginHtml)) {
      return { err: new Error('check login failed') };
    }

    const loginCode = parseInt(this.LOGIN_CODE_REG.exec(loginHtml)[1], 10);

    if (loginCode === 200) {
      console.log(loginHtml);
    }
    return { loginCode };
  }
}

(async () => {
  const login = new Login();
  const { uuid } = await login.getUUID();

  async function checkLoginResult(code) {
    let loginResult = null;
    switch (code) {
      case 200:
        console.log('login sueecss!');
        break;

      case 201:
        console.log('qrcode scaned!');
        loginResult = await login.checkLogin(uuid);
        checkLoginResult(loginResult.loginCode);
        break;

      case 408:
        console.log('check login timeout');
        loginResult = await login.checkLogin(uuid);
        checkLoginResult(loginResult.loginCode);
        break;

      default:
        console.error('unkonw status process exit');
        process.exit(1);
    }
  }

  exec(`open ${conf.QRCODE_PATH}${uuid}`);
  const { loginCode } = await login.checkLogin(uuid);
  checkLoginResult(loginCode);
})();

export default Login;
