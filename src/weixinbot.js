'use strict';

/**
 * weixinbot2
 *
 * This project was forked from https://github.com/feit/Weixinbot
 * Thanks for feit's weixinbot
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import url from 'url';
import path from 'path';
import mkdirp from 'mkdirp';
import createDebug from 'debug';
import Promise from 'bluebird';
import EventEmitter from 'events';
import xml2js from 'xml2js';
import SimpleStore from './db';
import rp from './request';

import { getUrls, CODES, SP_ACCOUNTS, PUSH_HOST_LIST } from './conf';

const debug = createDebug('weixinbot2:core');

let URLS = getUrls({});



const makeDeviceID = () => 'e' + Math.random().toFixed(15).toString().substring(2, 17);

function parseContent(input) {
  return new Promise((resolve, reject) => {
    if (/^&lt;.*&gt;$/.test(input)) {
      input = input.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      xml2js.parseString(input, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else {
      resolve(input);
    }
  });
}

function parseEmoji(input) {
  return input.replace(/(<span class="emoji emoji([a-z0-9A-Z]+)"><\/span>)/g, function (_1, _2, s) {
    try {
      return String.fromCodePoint(parseInt(s, 16));
    } catch (err) {
      debug('parseEmoji: %s', err);
    }
    return s;
  });
}

// 用于处理收到的消息，比如替换Emoji字符等
async function fixIncommingMessage(msg) {
  msg.Content = await parseContent(msg.Content);
  if (typeof msg.Content === 'string') {
    msg.Content = parseEmoji(msg.Content);
  }
  if (msg.Member && msg.Member.NickName) {
    msg.Member.NickName = parseEmoji(msg.Member.NickName);
  }
  if (msg.Group && msg.Group.NickName) {
    msg.Group.NickName = parseEmoji(msg.Group.NickName);
  }
  if (msg.Member && msg.Member.NickName) {
    msg.Member.NickName = parseEmoji(msg.Member.NickName);
  }
  if (msg.GroupMember && msg.GroupMember.NickName) {
    msg.GroupMember.NickName = parseEmoji(msg.GroupMember.NickName);
  }
  return msg;
}


class WeixinBot extends EventEmitter {

  /**
   * WeixinBot
   *
   * @param {Object} options
   *   - {String} dataPath
   *   - {Number} updateContactInterval
   */
  constructor(options = {}) {
    super();
    Object.assign(this, CODES);
    this._options = options;
    options.updateContactInterval = options.updateContactInterval || 1000 * 600;
  }

  async initStore() {

    const uin = this.my.Uin;
    const dataDir = path.resolve(this._options.dataPath, `uin_${uin}`);
    mkdirp.sync(dataDir);
    console.log(this.my);

    const getDataFileName = name => {
      if (this._options.dataPath) {
        return path.resolve(dataDir, `${name}.json`);
      } else {
        return null;
      }
    }

    // member store
    this.Members = new SimpleStore('UserName', getDataFileName('Members'));
    this.Contacts = new SimpleStore('UserName', getDataFileName('Contacts'));
    this.Groups = new SimpleStore('UserName', getDataFileName('Groups'));
    this.GroupMembers = new SimpleStore(['UserName', 'GroupUserName'], getDataFileName('GroupMembers'));
    this.Brands = new SimpleStore('UserName', getDataFileName('Brands')); // 公众帐号
    this.SPs = new SimpleStore('UserName', getDataFileName('SPs')); // 特殊帐号

  }

  async saveData() {

    debug('正在保存数据...');
    this.Members.saveToFileIfModified();
    this.Contacts.saveToFileIfModified();
    this.Groups.saveToFileIfModified();
    this.GroupMembers.saveToFileIfModified();
    this.Brands.saveToFileIfModified();
    this.SPs.saveToFileIfModified();
    debug('保存数据成功!');

  }

  async run() {
    debug('开始登录...');
    this.emit('offline');

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

    clearTimeout(this.checkSyncTimer);
    clearInterval(this.updataContactTimer);

    try {
      this.uuid = await this.fetchUUID();
    } catch (e) {
      debug('fetch uuid error', e);
      this.run();
      return;
    }

    if (!this.uuid) {
      debug('获取 uuid 失败，正在重试...');
      this.run();
      return;
    }

    debug(`获得 uuid -> ${this.uuid}`);

    const qrcodeUrl = URLS.QRCODE_PATH + this.uuid;
    this.emit('qrcode', qrcodeUrl);

    // limit check times
    this.checkTimes = 0;
    while (true) {
      const loginCode = await this.checkLoginStep();
      if (loginCode === 200) break;

      if (loginCode !== 201) this.checkTimes += 1;

      if (this.checkTimes > 6) {
        debug('检查登录状态次数超出限制，重新获取二维码');
        this.run();
        return;
      }
    }

    try {

      debug('正在获取凭据...');
      await this.fetchTickets();
      debug('获取凭据成功!');

      debug('正在初始化参数...');
      await this.webwxinit();
      debug('初始化成功!');

      debug('初始化存储...');
      await this.initStore();
      debug('初始化存储成功!');

      debug('正在通知客户端网页端已登录...');
      await this.notifyMobile();
      debug('通知成功!');

      debug('正在获取通讯录列表...');
      await this.updateContact();
      debug('获取通讯录列表成功!');

      debug('正在存储数据...');
      await this.saveData();
      debug('存储数据成功!');

      this.pushHost = await this.lookupSyncCheckHost();

    } catch (e) {
      debug('初始化主要参数步骤出错，正在重新登录... %s', e && e.stack || e);
      this.run();
      return;
    }

    URLS = getUrls({ baseHost: this.baseHost, pushHost: this.pushHost });

    debug('开始循环拉取新消息');
    this.emit('online');
    this.runLoop();

    // auto update Contacts every ten minute
    this.updataContactTimer = setInterval(() => {
      this.updateContact();
    }, this._options.updateContactInterval);
  }

  async runLoop() {
    const { selector, retcode } = await this.syncCheck();
    if (retcode !== '0') {
      debug('你在其他地方登录或登出了微信，正在尝试重新登录...');
      this.run();
      return;
    }

    if (selector !== '0') {
      try {
        this.webwxsync();
      } catch (e) {
        debug('webwxsync error: %s', e.stack);
      }
    }

    this.checkSyncTimer = setTimeout(() => {
      this.runLoop();
    }, 3e3);
  }

  async checkLoginStep() {
    let data;
    try {
      data = await rp({
        uri: URLS.API_login + `?uuid=${this.uuid}&tip=1&r=${Date.now()}`,
        timeout: 35e3,
      });
    } catch (e) {
      debug('checkLoginStep network error', e);
      await this.checkLoginStep();
      return;
    }

    if (!/code=(\d{3});/.test(data)) {
      // retry
      return await this.checkLoginStep();
    }

    const loginCode = parseInt(data.match(/code=(\d{3});/)[1], 10);

    switch (loginCode) {
      case 200:
        debug('已点击确认登录!');
        this.redirectUri = data.match(/redirect_uri="(.+)";$/)[1] + '&fun=new&version=v2';
        this.baseHost = url.parse(this.redirectUri).host;
        URLS = getUrls({ baseHost: this.baseHost });
        break;

      case 201:
        debug('二维码已被扫描，请确认登录!');
        break;

      case 408:
        debug('检查登录超时，正在重试...');
        break;

      default:
        debug('未知的状态，重试...');
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
      await this.webwxinit();
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
      await this.webwxsync();
      return;
    }

    this.syncKey = data.SyncKey;
    this.formateSyncKey = this.syncKey.List.map((item) => item.Key + '_' + item.Val).join('|');

    try {
      data.AddMsgList.forEach((msg) => this.handleMsg(msg));
    } catch (e) {
      debug('webwxsync handleMsg error: %s', e.stack);
    }
  }

  async lookupSyncCheckHost() {
    for (const host of PUSH_HOST_LIST) {
      let data;
      try {
        data = await rp({
          uri: 'https://' + host + '/cgi-bin/mmwebwx-bin/synccheck',
          qs: {
            r: Date.now(),
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
        await this.lookupSyncCheckHost();
        return;
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
          r: Date.now(),
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
      return await this.syncCheck();
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
          ClientMsgId: Date.now(),
        },
      });
    } catch (e) {
      debug('notify mobile network error', e);
      // network error retry
      await this.notifyMobile();
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
      return await this.fetchUUID();
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
      await this.fetchTickets();
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
    debug(`
      获得 skey -> ${this.skey}
      获得 sid -> ${this.sid}
      获得 uid -> ${this.uin}
      获得 pass_ticket -> ${this.passTicket}
    `);

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
          r: Date.now(),
        },
      });
    } catch (e) {
      debug('fetch contact network error', e);
      // network error retry
      await this.fetchContact();
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Fetch contact fail');
    }

    this.totalMemberCount = data.MemberList.length;
    this.brandCount = 0;
    this.spCount = 0;
    this.groupCount = 0;
    this.friendCount = 0;
    data.MemberList.forEach((member) => {
      this.Members.save(member);

      const userName = member.UserName;
      debug('fetchContact: userName=%s', userName);

      if (member.VerifyFlag & CODES.MM_USERATTRVERIFYFALG_BIZ_BRAND) {
        this.brandCount += 1;
        this.Brands.save(member);
        return;
      }

      if (SP_ACCOUNTS.includes(userName) || /@qqim$/.test(userName)) {
        this.spCount += 1;
        this.SPs.save(member);
        return;
      }

      if (userName.includes('@@')) {
        this.groupCount += 1;
        this.Groups.save(member);
        return;
      }

      if (userName !== this.my.UserName) {
        this.friendCount += 1;
        this.Contacts.save(member);
      }
    });

    debug(`
      获取通讯录成功
      全部成员数: ${this.totalMemberCount}
      公众帐号数: ${this.brandCount}
      特殊帐号数: ${this.spCount}
      通讯录好友数: ${this.friendCount}
      加入的群聊数(不准确，只有把群聊加入通讯录才会在这里显示): ${this.groupCount}
    `);
  }

  async fetchBatchgetContact(groupIds) {

    debug('fetchBatchgetContact...');
    const list = groupIds.map((id) => ({ UserName: id, EncryChatRoomId: '' }));
    let data;
    try {
      data = await rp({
        method: 'POST',
        uri: URLS.API_webwxbatchgetcontact,
        qs: {
          type: 'ex',
          r: Date.now(),
        },
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          Count: list.length,
          List: list,
        },
      });
    } catch (e) {
      debug('fetch batchgetcontact network error', e);
      // network error retry
      await this.fetchBatchgetContact(groupIds);
      return;
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('Fetch batchgetcontact fail');
    }

    data.ContactList.forEach((Group) => {
      this.Groups.save(Group);
      debug(`获取到群: ${Group.NickName}`);
      debug(`群 ${Group.NickName} 成员数量: ${Group.MemberList.length}`);

      const { MemberList } = Group;
      MemberList.forEach((member) => {
        member.GroupUserName = Group.UserName;
        this.GroupMembers.save(member);
      });
    });

  }

  async updateContact() {

    debug('正在更新通讯录');

    try {

      await this.fetchContact();

      const groups = this.Groups.list();
      const groupIds = groups.map((group) => group.UserName);
      await this.fetchBatchgetContact(groupIds);

    } catch (e) {
      debug('更新通讯录失败', e);
    }
    debug('更新通讯录成功!');

    await this.saveData();
  }

  async getMember(id) {
    debug('getMember: %s', id);

    const member = this.Members.get(id);

    return member;
  }

  async getGroup(groupId) {
    let group = this.Groups.get(groupId);

    if (group) return group;

    try {
      await this.fetchBatchgetContact([groupId]);
    } catch (e) {
      debug('fetchBatchgetContact error', e);
      return null;
    }

    group = this.Groups.get(groupId);

    return group;
  }

  async getGroupMember(id, groupId) {
    {
      const member = this.GroupMembers.get(id, groupId);
      if (member) return member;
    }

    try {
      await this.fetchBatchgetContact([groupId]);
    } catch (e) {
      debug('fetchBatchgetContact error', e);
      return null;
    }

    {
      const member = this.GroupMembers.list().filter(v => v.UserName === id)[0];
      return member;
    }
  }

  async handleMsg(msg) {

    const emit = async (type, msg) => {
      if ('Member' in msg && !msg.Member) msg.Member = {};
      if ('Group' in msg && !msg.Group) msg.Group = {};
      if ('GroupMember' in msg && !msg.GroupMember) msg.GroupMember = {};
      msg = await fixIncommingMessage(msg);
      this.emit(type, msg);
    };

    if (msg.FromUserName === msg.ToUserName) {
      debug('系统消息 %j', msg.Content);
      emit('system', msg);
      return;
    }

    if (msg.FromUserName.includes('@@')) {
      const userId = msg.Content.match(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/)[1];
      msg.GroupMember = await this.getGroupMember(userId, msg.FromUserName);
      msg.Group = await this.getGroup(msg.FromUserName);
      msg.Content = msg.Content.replace(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/, '');

      debug(`
        来自群 ${msg.Group && msg.Group.NickName} 的消息
        ${msg.GroupMember && (msg.GroupMember.DisplayName || msg.GroupMember.NickName)}: ${msg.Content}
      `);

      emit('group', msg);
      return;
    }

    msg.Member = await this.getMember(msg.FromUserName);
    debug(`
      新消息
      ${msg.Member && (msg.Member.RemarkName || msg.Member.NickName)}: ${msg.Content}
    `);

    emit('friend', msg);
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
    const clientMsgId = (Date.now() + Math.random().toFixed(3)).replace('.', '');

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
