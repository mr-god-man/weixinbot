/* eslint-disable no-console,quote-props,no-constant-condition,prefer-template,consistent-return */
import url from 'url';
import path from 'path';
import zlib from 'zlib';
import nodemailer from 'nodemailer';
import RequestPromise from 'request-promise';
import FileCookieStore from 'tough-cookie-filestore';
import EventEmitter from 'events';
import touch from 'touch';

import { getUrls, CODES } from './conf';
let URLS = getUrls({});

const pushHostList = [
  'webpush.weixin.qq.com',
  'webpush2.weixin.qq.com',
  'webpush.wechat.com',
  'webpush1.wechat.com',
  'webpush2.wechat.com',
  'webpush.wechatapp.com',
  'webpush1.wechatapp.com',
];

const spAccounts = 'newsapp,fmessage,filehelper,weibo,qqmail,fmessage,' +
  'tmessage,qmessage,qqsync,floatbottle,lbsapp,shakeapp,medianote,qqfriend,' +
  'readerapp,blogapp,facebookapp,masssendapp,meishiapp,feedsapp,voip,' +
  'blogappweixin,weixin,brandsessionholder,weixinreminder,wxid_novlwrv3lqwv11,' +
  'gh_22b87fa7cb3c,officialaccounts,notification_messages,wxid_novlwrv3lqwv11,' +
  'gh_22b87fa7cb3c,wxitil,userexperience_alarm,notification_messages';

// persistent cookie
const cookiePATHS = path.join(process.cwd(), '.cookie.json');
touch(cookiePATHS);
const rp = RequestPromise.defaults({
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2652.0 Safari/537.36',
  },

  encoding: null,
  jar: new FileCookieStore(cookiePATHS),
  transform(buf, response) {
    if (response.headers['content-encoding'] === 'deflate') {
      const str = zlib.inflateRawSync(buf).toString();
      try {
        return JSON.parse(str);
      } catch (e) {
        return str;
      }
    }

    return buf.toString();
  },
});

const getDeviceID = () => 'e' + Math.random().toFixed(15).toString().substring(2, 17);

class WeixinBot extends EventEmitter {
  constructor(options = {}) {
    super();

    if (!options.receiver) {
      throw new Error('receiver is required for get qrcode img');
    }

    this.baseHost = '';
    this.pushHost = '';
    this.uuid = '';
    this.redirectUri = '';
    this.skey = '';
    this.sid = '';
    this.uin = '';
    this.passTicket = '';
    this.baseRequest = null;
    this.my = null;
    this.syncKey = null;
    this.formateSyncKey = '';
    this.memberList = [];
    this.contactList = [];
    this.groupList = [];
    this.groupMemeberList = [];
    this.brandList = []; // 公众帐号
    this.spList = []; // 特殊帐号

    this.transporter = nodemailer.createTransport(options.mail || {
      service: 'QQex',
      auth: {
        user: 'weixinbot@feit.me',
        pass: 'l53y$cf^7m3wth%^',
      },
    });
    this.receiver = options.receiver;

    Object.assign(this, CODES);
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

    const qrcodeUrl = URLS.QRCODE_PATH + this.uuid;
    this.transporter.sendMail({
      from: 'WeixinBot <weixinbot@feit.me>',
      to: this.receiver,
      subject: 'WeixinBot 请求登录',
      html: `<img src="${qrcodeUrl}" height="256" width="256" />`,
    }, (err) => {
      if (err) console.error(err);
    });

    while (await this.checkLoginStep() !== 200) continue;

    try {
      console.log('fetching tickets');
      await this.fetchTickets();
      console.log('fetch tickets complete');

      console.log('webwxinit...');
      await this.webwxinit();
      console.log('webwxinit complete');

      console.log('notify mobile...');
      await this.notifyMobile();
      console.log('notify mobile complete');

      console.log('fetching contact');
      await this.fetchContact();
      console.log('fetch contact complete');

      // await this.fetchBatchgetContact();
      this.pushHost = await this.lookupSyncCheckHost();
    } catch (e) {
      console.error(e);
      // retry login
      this.run();
      return;
    }

    URLS = getUrls({ baseHost: this.baseHost, pushHost: this.pushHost });

    console.log('start msg loop');
    this.runLoop();
  }

  async runLoop() {
    const { selector, retcode } = await this.syncCheck();
    if (retcode !== '0') {
      console.log('你在其他地方登录或登出了微信，正在尝试重新登录...');
      this.run();
      return;
    }

    if (selector !== '0') {
      this.webwxsync();
    }

    setTimeout(() => {
      this.runLoop();
    }, 2e3);
  }

  async checkLoginStep() {
    let result;
    try {
      result = await rp({
        uri: URLS.API_login + `?uuid=${this.uuid}&tip=1&r=${+new Date}`,
        timeout: 35e3,
      });
    } catch (e) {
      console.error(e);
      this.checkLoginStep();
      return;
    }

    if (!/code=(\d{3});/.test(result)) {
      // retry
      return this.checkLoginStep();
    }

    const loginCode = parseInt(result.match(/code=(\d{3});/)[1], 10);

    switch (loginCode) {
      case 200:
        console.log('Confirm login!');
        this.redirectUri = result.match(/redirect_uri="(.+)";$/)[1] + '&fun=new&version=v2';
        this.baseHost = url.parse(this.redirectUri).host;
        URLS = getUrls({ baseHost: this.baseHost });
        break;

      case 201:
        // console.log('QRcode scaned!');
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
        uri: URLS.API_webwxinit,
        method: 'POST',
        json: true,
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

    if (!result || !result.BaseResponse || result.BaseResponse.Ret !== 0) {
      throw new Error('Init Webwx failed');
    }

    this.my = result.User;
    this.syncKey = result.SyncKey;
    this.formateSyncKey = this.syncKey.List.map((item) => item.Key + '_' + item.Val).join('|');
  }

  async webwxsync() {
    let result;
    try {
      result = await rp({
        uri: URLS.API_webwxsync,
        method: 'POST',
        qs: {
          sid: this.sid,
          skey: this.skey,
        },
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          SyncKey: this.syncKey,
          rr: ~new Date,
        },
      });
    } catch (e) {
      console.error(e);
      // network error retry
      this.webwxsync();
      return;
    }

    this.syncKey = result.SyncKey;
    this.formateSyncKey = this.syncKey.List.map((item) => item.Key + '_' + item.Val).join('|');

    result.AddMsgList.forEach((msg) => this.handleMsg(msg));
  }

  async lookupSyncCheckHost() {
    for (const host of pushHostList) {
      let result;
      try {
        result = await rp({
          uri: 'https://' + host + '/cgi-bin/mmwebwx-bin/synccheck',
          qs: {
            r: +new Date,
            skey: this.skey,
            sid: this.sid,
            uin: this.uin,
            deviceid: getDeviceID(),
            synckey: this.formateSyncKey,
          },
          timeout: 35e3,
        });
      } catch (e) {
        console.error(e);
        // network error retry
        return this.lookupSyncCheckHost();
      }

      const retcode = result.match(/retcode:"(\d+)"/)[1];
      if (retcode === '0') return host;
    }
  }

  async syncCheck() {
    let result;
    try {
      result = await rp({
        uri: URLS.API_synccheck,
        qs: {
          r: +new Date,
          skey: this.skey,
          sid: this.sid,
          uin: this.uin,
          deviceid: getDeviceID(),
          synckey: this.formateSyncKey,
        },
        timeout: 35e3,
      });
    } catch (e) {
      console.error(e);
      // network error retry
      return this.syncCheck();
    }

    const retcode = result.match(/retcode:"(\d+)"/)[1];
    const selector = result.match(/selector:"(\d+)"/)[1];

    return { retcode, selector };
  }

  async notifyMobile() {
    let result;
    try {
      result = await rp({
        uri: URLS.API_webwxstatusnotify,
        method: 'POST',
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          Code: CODES.StatusNotifyCode_INITED,
          FromUserName: this.my.UserName,
          ToUserName: this.my.UserName,
          ClientMsgId: +new Date,
        },
      });
    } catch (e) {
      console.error(e);
      // network error retry
      this.notifyMobile();
      return;
    }

    if (!result || !result.BaseResponse || result.BaseResponse.Ret !== 0) {
      throw new Error('Notify mobile fail');
    }
  }

  async fetchUUID() {
    const uuidHtml = await rp(URLS.API_jsLogin);
    if (!/uuid = "(.+)";$/.test(uuidHtml)) {
      throw new Error('get uuid failed');
    }

    const uuid = uuidHtml.match(/uuid = "(.+)";$/)[1];
    return uuid;
  }

  async fetchTickets() {
    let result;
    try {
      result = await rp(this.redirectUri);
    } catch (e) {
      // network error, retry
      this.fetchTickets();
      return;
    }

    if (!/<ret>0<\/ret>/.test(result)) {
      throw new Error('Get skey failed, restart login');
    }

    // const retM = result.match(/<ret>(.*)<\/ret>/);
    // const scriptM = result.match(/<script>(.*)<\/script>/);
    const skeyM = result.match(/<skey>(.*)<\/skey>/);
    const wxsidM = result.match(/<wxsid>(.*)<\/wxsid>/);
    const wxuinM = result.match(/<wxuin>(.*)<\/wxuin>/);
    const passTicketM = result.match(/<pass_ticket>(.*)<\/pass_ticket>/);
    // const redirectPATHSM = result.match(/<redirectPATHS>(.*)<\/redirectPATHS>/);

    this.skey = skeyM && skeyM[1];
    this.sid = wxsidM && wxsidM[1];
    this.uin = wxuinM && wxuinM[1];
    this.passTicket = passTicketM && passTicketM[1];

    this.baseRequest = {
      Uin: parseInt(this.uin, 10),
      Sid: this.sid,
      Skey: this.skey,
      DeviceID: getDeviceID(),
    };
  }

  async fetchContact() {
    let result;
    try {
      result = await rp({
        uri: URLS.API_webwxgetcontact,
        qs: {
          skey: this.skey,
          pass_ticket: this.passTicket,
          seq: 0,
          r: +new Date,
        },
      });
    } catch (e) {
      console.error(e);
      // network error retry
      this.fetchContact();
      return;
    }

    if (!result || !result.BaseResponse || result.BaseResponse.Ret !== 0) {
      throw new Error('Fetch contact fail');
    }

    this.memberList = result.MemberList;
    this.memberList.forEach((member) => {
      const userName = member.UserName;

      if (member.VerifyFlag & CODES.MM_USERATTRVERIFYFALG_BIZ_BRAND) {
        this.brandList.push(member);
        return;
      }

      if (spAccounts.includes(userName) || /@qqim$/.test(userName)) {
        this.spList.push(member);
        return;
      }

      if (userName.includes('@@')) {
        this.groupList.push(member);
        return;
      }

      if (userName !== this.my.UserName) {
        this.contactList.push(member);
      }
    });
  }

  async fetchBatchgetContact() {
    let result;
    try {
      result = await rp({
        method: 'POST',
        uri: URLS.API_webwxbatchgetcontact,
        qs: {
          type: 'ex',
          r: +new Date,
        },
        body: {
          BaseRequest: this.baseRequest,
        },
      });
    } catch (e) {
      console.error(e);
      // network error retry
      this.fetchContact();
      return;
    }

    if (!result || !result.BaseResponse || result.BaseResponse.Ret !== 0) {
      throw new Error('Fetch batchgetcontact fail');
    }

    this.memberList = result.MemberList;
  }

  async handleMsg(msg) {
    this.emit('message', msg);
    // if (msg.MsgType === CODES.MSGTYPE_SYSNOTICE) {
    //   return;
    // }

    // switch (msg.MsgType) {
    //   case CODES.MSGTYPE_APP:
    //     break;
    //   case CODES.MSGTYPE_EMOTICON:
    //     break;
    //   case CODES.MSGTYPE_IMAGE:
    //     break;
    //   case CODES.MSGTYPE_VOICE:
    //     break;
    //   case CODES.MSGTYPE_VIDEO:
    //     break;
    //   case CODES.MSGTYPE_MICROVIDEO:
    //     break;
    //   case CODES.MSGTYPE_TEXT:
    //     try {
    //       await this.sendText(msg.FromUserName, msg.Content);
    //     } catch (e) {
    //       console.error(e);
    //     }
    //     break;
    //   case CODES.MSGTYPE_RECALLED:
    //     break;
    //   case CODES.MSGTYPE_LOCATION:
    //     break;
    //   case CODES.MSGTYPE_VOIPMSG:
    //   case CODES.MSGTYPE_VOIPNOTIFY:
    //   case CODES.MSGTYPE_VOIPINVITE:
    //     break;
    //   case CODES.MSGTYPE_POSSIBLEFRIEND_MSG:
    //     break;
    //   case CODES.MSGTYPE_VERIFYMSG:
    //     break;
    //   case CODES.MSGTYPE_SHARECARD:
    //     break;
    //   case CODES.MSGTYPE_SYS:
    //     break;
    //   default:
    // }
  }

  sendText(to, content, callback) {
    const clientMsgId = (+new Date + Math.random().toFixed(3)).replace('.', '');

    rp({
      uri: URLS.API_webwxsendmsg,
      method: 'POST',
      json: true,
      body: {
        BaseRequest: this.baseRequest,
        Msg: {
          Type: CODES.MSGTYPE_TEXT,
          Content: content,
          FromUserName: this.my.UserName,
          ToUserName: to,
          LocalID: clientMsgId,
          ClientMsgId: clientMsgId,
        },
      },
    }).then((data) => {
      if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
        return callback(new Error('Send text fail'));
      }

      callback();
    }).catch((err) => {
      console.error(err);
      // network error, retry
      this.sendText(to, content, callback);
      return;
    });
  }
}

// compatible nodejs require
module.exports = WeixinBot;
