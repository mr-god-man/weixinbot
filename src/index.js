/* eslint-disable quote-props,no-constant-condition,
  prefer-template,consistent-return,new-cap,no-param-reassign */
import url from 'url';
import path from 'path';
import zlib from 'zlib';
import Debug from 'debug';
import touch from 'touch';
import Datastore from 'nedb';
import Promise from 'bluebird';
import EventEmitter from 'events';
import nodemailer from 'nodemailer';
import RequestPromise from 'request-promise';
import FileCookieStore from 'tough-cookie-filestore';

import { getUrls, CODES } from './conf';

Promise.promisifyAll(Datastore.prototype);
const debug = Debug('weixinbot');
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

const makeDeviceID = () => 'e' + Math.random().toFixed(15).toString().substring(2, 17);

class WeixinBot extends EventEmitter {
  constructor(options = {}) {
    super();

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

    // member store
    this.Members = new Datastore();
    this.Contacts = new Datastore();
    this.Groups = new Datastore();
    this.GroupMembers = new Datastore();
    this.Brands = new Datastore(); // 公众帐号
    this.SPs = new Datastore(); // 特殊帐号

    // indexing
    this.Members.ensureIndex({ fieldName: 'UserName', unique: true });
    this.Contacts.ensureIndex({ fieldName: 'UserName', unique: true });
    this.Groups.ensureIndex({ fieldName: 'UserName', unique: true });
    this.GroupMembers.ensureIndex({ fieldName: 'UserName', unique: true });
    this.Brands.ensureIndex({ fieldName: 'UserName', unique: true });
    this.SPs.ensureIndex({ fieldName: 'UserName', unique: true });

    this.transporter = nodemailer.createTransport(options.mail || {
      service: 'QQex',
      auth: {
        user: 'weixinbot@feit.me',
        pass: 'l53y$cf^7m3wth%^',
      },
    });
    this.receiver = options.receiver || '';

    Object.assign(this, CODES);
  }

  async run() {
    debug('Start login');
    clearTimeout(this.timer);

    try {
      this.uuid = await this.fetchUUID();
    } catch (e) {
      debug('fetch uuid error', e);
      this.run();
      return;
    }

    if (!this.uuid) {
      debug('Get uuid failed, restart login');
      this.run();
      return;
    }

    const qrcodeUrl = URLS.QRCODE_PATH + this.uuid;
    this.emit('qrcode', qrcodeUrl);

    if (this.receiver) {
      this.transporter.sendMail({
        from: 'WeixinBot <weixinbot@feit.me>',
        to: this.receiver,
        subject: 'WeixinBot 请求登录',
        html: `<img src="${qrcodeUrl}" height="256" width="256" />`,
      }, (e) => {
        if (e) debug('send email error', e);
      });
    }

    this.checkTimes = 0;
    while (true) {
      const loginCode = await this.checkLoginStep();
      if (loginCode === 200) break;

      if (loginCode !== 201) this.checkTimes += 1;

      if (this.checkTimes > 6) {
        debug('check too much times, restart login');
        this.run();
        return;
      }
    }

    try {
      debug('fetching tickets');
      await this.fetchTickets();
      debug('fetch tickets complete');

      debug('webwxinit...');
      await this.webwxinit();
      debug('webwxinit complete');

      debug('notify mobile...');
      await this.notifyMobile();
      debug('notify mobile complete');

      debug('fetching contact');
      await this.fetchContact();
      debug('fetch contact complete');

      // await this.fetchBatchgetContact();
      this.pushHost = await this.lookupSyncCheckHost();
    } catch (e) {
      debug('main step occur error', e);
      // retry login
      this.run();
      return;
    }

    URLS = getUrls({ baseHost: this.baseHost, pushHost: this.pushHost });

    debug('start msg loop');
    this.runLoop();
  }

  async runLoop() {
    const { selector, retcode } = await this.syncCheck();
    if (retcode !== '0') {
      debug('你在其他地方登录或登出了微信，正在尝试重新登录...');
      this.run();
      return;
    }

    if (selector !== '0') {
      this.webwxsync();
    }

    this.timer = setTimeout(() => {
      this.runLoop();
    }, 3e3);
  }

  async checkLoginStep() {
    let data;
    try {
      data = await rp({
        uri: URLS.API_login + `?uuid=${this.uuid}&tip=1&r=${+new Date}`,
        timeout: 35e3,
      });
    } catch (e) {
      debug('checkLoginStep network error', e);
      this.checkLoginStep();
      return;
    }

    if (!/code=(\d{3});/.test(data)) {
      // retry
      return this.checkLoginStep();
    }

    const loginCode = parseInt(data.match(/code=(\d{3});/)[1], 10);

    switch (loginCode) {
      case 200:
        debug('Confirm login!');
        this.redirectUri = data.match(/redirect_uri="(.+)";$/)[1] + '&fun=new&version=v2';
        this.baseHost = url.parse(this.redirectUri).host;
        URLS = getUrls({ baseHost: this.baseHost });
        break;

      case 201:
        debug('QRcode scaned!');
        break;

      case 408:
        debug('Check login timeout, retry...');
        break;

      default:
        debug('Unkonw status, retry...');
    }

    return loginCode;
  }

  async webwxinit() {
    let data;
    try {
      data = await rp({
        uri: URLS.API_webwxinit,
        method: 'POST',
        json: true,
        body: {
          BaseRequest: this.baseRequest,
        },
      });
    } catch (e) {
      debug('webwxinit network error', e);
      // network error retry
      this.webwxinit();
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Init Webwx failed');
    }

    this.my = data.User;
    this.syncKey = data.SyncKey;
    this.formateSyncKey = this.syncKey.List.map((item) => item.Key + '_' + item.Val).join('|');
  }

  async webwxsync() {
    let data;
    try {
      data = await rp({
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
      debug('webwxsync network error', e);
      // network error retry
      this.webwxsync();
      return;
    }

    this.syncKey = data.SyncKey;
    this.formateSyncKey = this.syncKey.List.map((item) => item.Key + '_' + item.Val).join('|');

    data.AddMsgList.forEach((msg) => this.handleMsg(msg));
  }

  async lookupSyncCheckHost() {
    for (const host of pushHostList) {
      let data;
      try {
        data = await rp({
          uri: 'https://' + host + '/cgi-bin/mmwebwx-bin/synccheck',
          qs: {
            r: +new Date,
            skey: this.skey,
            sid: this.sid,
            uin: this.uin,
            deviceid: makeDeviceID(),
            synckey: this.formateSyncKey,
          },
          timeout: 35e3,
        });
      } catch (e) {
        debug('lookupSyncCheckHost network error', e);
        // network error retry
        return this.lookupSyncCheckHost();
      }

      const retcode = data.match(/retcode:"(\d+)"/)[1];
      if (retcode === '0') return host;
    }
  }

  async syncCheck() {
    let data;
    try {
      data = await rp({
        uri: URLS.API_synccheck,
        qs: {
          r: +new Date,
          skey: this.skey,
          sid: this.sid,
          uin: this.uin,
          deviceid: makeDeviceID(),
          synckey: this.formateSyncKey,
        },
        timeout: 35e3,
      });
    } catch (e) {
      debug('synccheck network error', e);
      // network error retry
      return this.syncCheck();
    }

    const retcode = data.match(/retcode:"(\d+)"/)[1];
    const selector = data.match(/selector:"(\d+)"/)[1];

    return { retcode, selector };
  }

  async notifyMobile() {
    let data;
    try {
      data = await rp({
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
      debug('notify mobile network error', e);
      // network error retry
      this.notifyMobile();
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Notify mobile fail');
    }
  }

  async fetchUUID() {
    let data;
    try {
      data = await rp(URLS.API_jsLogin);
    } catch (e) {
      debug('fetch uuid network error', e);
      // network error retry
      this.fetchUUID();
      return;
    }

    if (!/uuid = "(.+)";$/.test(data)) {
      throw new Error('get uuid failed');
    }

    const uuid = data.match(/uuid = "(.+)";$/)[1];
    return uuid;
  }

  async fetchTickets() {
    let data;
    try {
      data = await rp(this.redirectUri);
    } catch (e) {
      debug('fetch tickets network error', e);
      // network error, retry
      this.fetchTickets();
      return;
    }

    if (!/<ret>0<\/ret>/.test(data)) {
      throw new Error('Get skey failed, restart login');
    }

    // const retM = data.match(/<ret>(.*)<\/ret>/);
    // const scriptM = data.match(/<script>(.*)<\/script>/);
    const skeyM = data.match(/<skey>(.*)<\/skey>/);
    const wxsidM = data.match(/<wxsid>(.*)<\/wxsid>/);
    const wxuinM = data.match(/<wxuin>(.*)<\/wxuin>/);
    const passTicketM = data.match(/<pass_ticket>(.*)<\/pass_ticket>/);
    // const redirectUrl = data.match(/<redirect_url>(.*)<\/redirect_url>/);

    this.skey = skeyM && skeyM[1];
    this.sid = wxsidM && wxsidM[1];
    this.uin = wxuinM && wxuinM[1];
    this.passTicket = passTicketM && passTicketM[1];

    this.baseRequest = {
      Uin: parseInt(this.uin, 10),
      Sid: this.sid,
      Skey: this.skey,
      DeviceID: makeDeviceID(),
    };
  }

  async fetchContact() {
    let data;
    try {
      data = await rp({
        uri: URLS.API_webwxgetcontact,
        qs: {
          skey: this.skey,
          pass_ticket: this.passTicket,
          seq: 0,
          r: +new Date,
        },
      });
    } catch (e) {
      debug('fetch contact network error', e);
      // network error retry
      this.fetchContact();
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Fetch contact fail');
    }

    this.Members.insert(data.MemberList);
    data.MemberList.forEach((member) => {
      const userName = member.UserName;

      if (member.VerifyFlag & CODES.MM_USERATTRVERIFYFALG_BIZ_BRAND) {
        this.Brands.insert(member);
        return;
      }

      if (spAccounts.includes(userName) || /@qqim$/.test(userName)) {
        this.SPs.insert(member);
        return;
      }

      if (userName.includes('@@')) {
        this.Groups.insert(member);
        return;
      }

      if (userName !== this.my.UserName) {
        this.Contacts.insert(member);
      }
    });
  }

  async fetchBatchgetContact(groupId) {
    let data;
    try {
      data = await rp({
        method: 'POST',
        uri: URLS.API_webwxbatchgetcontact,
        qs: {
          type: 'ex',
          r: +new Date,
        },
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          Count: 1,
          List: [{ UserName: groupId, EncryChatRoomId: '' }],
        },
      });
    } catch (e) {
      debug('fetch batchgetcontact network error', e);
      // network error retry
      this.fetchBatchgetContact();
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Fetch batchgetcontact fail');
    }

    if (!data.ContactList.length) {
      throw new Error('batchgetcontact not found contact');
    }

    const Group = data.ContactList[0];
    this.Groups.insert(Group);

    const { MemberList } = Group;
    this.GroupMembers.insert(MemberList);
    return Group;
  }

  async getMember(id, groupId) {
    let member = await this.Members.findOneAsync({ UserName: id });

    if (member) return member;

    if (groupId) {
      await this.fetchBatchgetContact(id);
      member = await this.GroupMembers.findOneAsync({ UserName: id });
    }

    return member;
  }

  async getGroup(id) {
    const group = await this.Groups.findOneAsync({ UserName: id });

    if (group) return group;

    return await this.fetchBatchgetContact(id);
  }

  async handleMsg(msg) {
    if (msg.FromUserName.includes('@@')) {
      const userId = msg.Content.match(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/)[1];
      msg.Member = await this.getMember(userId, msg.FromUserName);
      msg.Group = await this.getGroup(msg.FromUserName);
      msg.Content = msg.Content.replace(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/, '');

      this.emit('group', msg);
      return;
    }

    msg.Member = await this.getMember(msg.FromUserName);
    this.emit('friend', msg);
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
      qs: {
        pass_ticket: this.passTicket,
      },
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
      callback = callback || (() => (null));
      if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
        return callback(new Error('Send text fail'));
      }

      callback();
    }).catch((e) => {
      debug('send text network error', e);
      // network error, retry
      this.sendText(to, content, callback);
      return;
    });
  }
}

// compatible nodejs require
module.exports = WeixinBot;
