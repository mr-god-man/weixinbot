/* eslint-disable no-console,quote-props,no-constant-condition */
import path from 'path';
import zlib from 'zlib';
import RequestPromise from 'request-promise';
import FileCookieStore from 'tough-cookie-filestore';
import EventEmitter from 'events';
import { exec } from 'child_process';
import touch from 'touch';

import conf from './conf';

// persistent cookie
const cookiePath = path.join(process.cwd(), '.cookie.json');
touch(cookiePath);
const rp = RequestPromise.defaults({
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Host': 'wx2.qq.com',
    'Pragma': 'no-cache',
    'Referer': 'https://wx2.qq.com/?&lang=zh_CN',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2652.0 Safari/537.36',
  },

  encoding: null,
  jar: new FileCookieStore(cookiePath),
  transform(buf, response) {
    if (response.headers['content-encoding'] === 'deflate') {
      return zlib.inflateRawSync(buf).toString();
    }

    return buf.toString();
  },
});

const getDeviceID = () => `e${Math.random().toFixed(15).toString().substring(2, 17)}`;

class WeixinBot extends EventEmitter {
  constructor() {
    super();
  }

  async run() {
    console.log('Start login');

    try {
      this.uuid = await this.fetchUUID();
    } catch (e) {
      console.error(e);
    }

    if (!this.uuid) {
      console.log('Get uuid failed, restart login');
      this.run();
      return;
    }

    const qrcodePath = conf.QRCODE_PATH + this.uuid;
    exec(`open ${qrcodePath}`, (err) => {
      if (err) {
        console.log(`自动打开浏览器失败，请手动打开下面这个网址并扫描\n ${qrcodePath}`);
      }
    });

    while (await this.waitForLogin() !== 200) continue;

    await this.fetchTickets();

    await this.webwxinit();
  }

  async fetchUUID() {
    const uuidHtml = await rp(conf.API_jsLogin);
    if (!/uuid = "(.+)";$/.test(uuidHtml)) {
      throw new Error('get uuid failed');
    }

    const uuid = /uuid = "(.+)";$/.exec(uuidHtml)[1];
    return uuid;
  }

  async fetchTickets() {
    let result;
    try {
      result = await rp(`${this.redirectUri}&fun=new&version=v2`);
    } catch (e) {
      console.log(e);
      // network error, retry
      this.runAfterLogin();
      return;
    }

    if (!/<ret>0<\/ret>/.test(result)) {
      console.log('Get skey failed, restart login');
      this.run();
      return;
    }

    // const retM = result.match(/<ret>(.*)<\/ret>/);
    // const scriptM = result.match(/<script>(.*)<\/script>/);
    const skeyM = result.match(/<skey>(.*)<\/skey>/);
    const wxsidM = result.match(/<wxsid>(.*)<\/wxsid>/);
    const wxuinM = result.match(/<wxuin>(.*)<\/wxuin>/);
    const passTicketM = result.match(/<pass_ticket>(.*)<\/pass_ticket>/);
    // const redirectUrlM = result.match(/<redirecturl>(.*)<\/redirecturl>/);

    this.skey = skeyM && skeyM[1];
    this.wxsid = wxsidM && wxsidM[1];
    this.wxuin = wxuinM && wxuinM[1];
    this.passTicket = passTicketM && passTicketM[1];

    this.baseRequest = {
      Uin: parseInt(this.wxuin, 10),
      Sid: this.wxsid,
      Skey: this.skey,
      DeviceID: getDeviceID(),
    };
  }

  async waitForLogin() {
    const options = {
      uri: `${conf.API_login}?loginicon=true&uuid=${this.uuid}&tip=1&r=${~new Date}`,
      timeout: 35e3,
    };

    const loginHtml = await rp(options);
    if (!/code=(\d{3});/.test(loginHtml)) {
      throw new Error('check login failed');
    }

    const loginCode = parseInt(/code=(\d{3});/.exec(loginHtml)[1], 10);

    switch (loginCode) {
      case 200:
        console.log('Confirm login!');
        this.redirectUri = /redirect_uri="(.+)";$/.exec(loginHtml)[1];
        break;

      case 201:
        console.log('QRcode scaned!');
        break;

      case 408:
        console.log('Check login timeout, retry...');
        break;

      default:
        console.error('Unkonw status, retry...');
    }

    return loginCode;
  }

  async webwxinit() {
    let result;
    try {
      result = await rp({
        method: 'POST',
        json: true,
        uri: conf.API_webwxinit,
        body: {
          BaseRequest: this.baseRequest,
        },
      });
    } catch (e) {
      console.error(e);
      // network error retry
      this.webwxinit();
      return;
    }

    console.log(result);
  }
}

export default WeixinBot;

const bot = new WeixinBot();
bot.run();
