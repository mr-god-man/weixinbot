/* eslint-disable no-console */
import rp from 'request-promise';
import conf from './conf';

const UUID_REG = /uuid = "(.+)";$/;
const LOGIN_CODE_REG = /code=(\d{3});$/;
const REDIRECT_URI_REG = /redirect_uri="(.+)";$/;

export default {
  async getUUID() {
    const uuidHtml = await rp(conf.API_jsLogin);
    if (!UUID_REG.test(uuidHtml)) {
      return { err: new Error('get uuid failed') };
    }

    const uuid = UUID_REG.exec(uuidHtml)[1];
    return { uuid };
  },

  async checkLogin(uuid) {
    const options = {
      uri: `${conf.API_login}?loginicon=true&uuid=${uuid}&tip=1&r=${~new Date}`,
      timeout: 35e3,
    };

    const loginHtml = await rp(options);
    if (!LOGIN_CODE_REG.test(loginHtml)) {
      return { err: new Error('check login failed') };
    }

    const loginCode = parseInt(LOGIN_CODE_REG.exec(loginHtml)[1], 10);

    let redirectUri = '';
    if (loginCode === 200) {
      redirectUri = REDIRECT_URI_REG.exec(loginHtml)[1];
    }

    return { loginCode, redirectUri };
  },
};
