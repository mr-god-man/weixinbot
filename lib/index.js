'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _touch = require('touch');

var _touch2 = _interopRequireDefault(_touch);

var _nedb = require('nedb');

var _nedb2 = _interopRequireDefault(_nedb);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _nodemailer = require('nodemailer');

var _nodemailer2 = _interopRequireDefault(_nodemailer);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _toughCookieFilestore = require('tough-cookie-filestore');

var _toughCookieFilestore2 = _interopRequireDefault(_toughCookieFilestore);

var _conf = require('./conf');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable quote-props,no-constant-condition,
  prefer-template,consistent-return,new-cap,no-param-reassign */

_bluebird2.default.promisifyAll(_nedb2.default.prototype);
var debug = (0, _debug2.default)('weixinbot');
var URLS = (0, _conf.getUrls)({});

var pushHostList = ['webpush.weixin.qq.com', 'webpush2.weixin.qq.com', 'webpush.wechat.com', 'webpush1.wechat.com', 'webpush2.wechat.com', 'webpush.wechatapp.com', 'webpush1.wechatapp.com'];

var spAccounts = 'newsapp,fmessage,filehelper,weibo,qqmail,fmessage,' + 'tmessage,qmessage,qqsync,floatbottle,lbsapp,shakeapp,medianote,qqfriend,' + 'readerapp,blogapp,facebookapp,masssendapp,meishiapp,feedsapp,voip,' + 'blogappweixin,weixin,brandsessionholder,weixinreminder,wxid_novlwrv3lqwv11,' + 'gh_22b87fa7cb3c,officialaccounts,notification_messages,wxid_novlwrv3lqwv11,' + 'gh_22b87fa7cb3c,wxitil,userexperience_alarm,notification_messages';

// persistent cookie
var cookiePATHS = _path2.default.join(process.cwd(), '.cookie.json');
(0, _touch2.default)(cookiePATHS);
var rp = _requestPromise2.default.defaults({
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) ' + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2652.0 Safari/537.36'
  },

  encoding: null,
  jar: new _toughCookieFilestore2.default(cookiePATHS),
  transform: function transform(buf, response) {
    if (response.headers['content-encoding'] === 'deflate') {
      var str = _zlib2.default.inflateRawSync(buf).toString();
      try {
        return JSON.parse(str);
      } catch (e) {
        return str;
      }
    }

    return buf.toString();
  }
});

var makeDeviceID = function makeDeviceID() {
  return 'e' + Math.random().toFixed(15).toString().substring(2, 17);
};

var WeixinBot = function (_EventEmitter) {
  (0, _inherits3.default)(WeixinBot, _EventEmitter);

  function WeixinBot() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    (0, _classCallCheck3.default)(this, WeixinBot);

    var _this = (0, _possibleConstructorReturn3.default)(this, (0, _getPrototypeOf2.default)(WeixinBot).call(this));

    _this.baseHost = '';
    _this.pushHost = '';
    _this.uuid = '';
    _this.redirectUri = '';
    _this.skey = '';
    _this.sid = '';
    _this.uin = '';
    _this.passTicket = '';
    _this.baseRequest = null;
    _this.my = null;
    _this.syncKey = null;
    _this.formateSyncKey = '';

    // member store
    _this.Members = new _nedb2.default();
    _this.Contacts = new _nedb2.default();
    _this.Groups = new _nedb2.default();
    _this.GroupMembers = new _nedb2.default();
    _this.Brands = new _nedb2.default(); // 公众帐号
    _this.SPs = new _nedb2.default(); // 特殊帐号

    // indexing
    _this.Members.ensureIndex({ fieldName: 'UserName', unique: true });
    _this.Contacts.ensureIndex({ fieldName: 'UserName', unique: true });
    _this.Groups.ensureIndex({ fieldName: 'UserName', unique: true });
    _this.Brands.ensureIndex({ fieldName: 'UserName', unique: true });
    _this.SPs.ensureIndex({ fieldName: 'UserName', unique: true });

    _this.transporter = _nodemailer2.default.createTransport(options.mail || {
      service: 'QQex',
      auth: {
        user: 'weixinbot@feit.me',
        pass: 'l53y$cf^7m3wth%^'
      }
    });
    _this.receiver = options.receiver || '';

    (0, _assign2.default)(_this, _conf.CODES);
    return _this;
  }

  (0, _createClass3.default)(WeixinBot, [{
    key: 'run',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
        var _this2 = this;

        var qrcodeUrl, loginCode;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                debug('Start login');
                clearTimeout(this.checkSyncTimer);
                clearInterval(this.updataContactTimer);

                _context.prev = 3;
                _context.next = 6;
                return this.fetchUUID();

              case 6:
                this.uuid = _context.sent;
                _context.next = 14;
                break;

              case 9:
                _context.prev = 9;
                _context.t0 = _context['catch'](3);

                debug('fetch uuid error', _context.t0);
                this.run();
                return _context.abrupt('return');

              case 14:
                if (this.uuid) {
                  _context.next = 18;
                  break;
                }

                debug('Get uuid failed, restart login');
                this.run();
                return _context.abrupt('return');

              case 18:
                qrcodeUrl = URLS.QRCODE_PATH + this.uuid;

                this.emit('qrcode', qrcodeUrl);

                if (this.receiver) {
                  this.transporter.sendMail({
                    from: 'WeixinBot <weixinbot@feit.me>',
                    to: this.receiver,
                    subject: 'WeixinBot 请求登录',
                    html: '<img src="' + qrcodeUrl + '" height="256" width="256" />'
                  }, function (e) {
                    if (e) debug('send email error', e);
                  });
                }

                this.checkTimes = 0;

              case 22:
                if (!true) {
                  _context.next = 35;
                  break;
                }

                _context.next = 25;
                return this.checkLoginStep();

              case 25:
                loginCode = _context.sent;

                if (!(loginCode === 200)) {
                  _context.next = 28;
                  break;
                }

                return _context.abrupt('break', 35);

              case 28:

                if (loginCode !== 201) this.checkTimes += 1;

                if (!(this.checkTimes > 6)) {
                  _context.next = 33;
                  break;
                }

                debug('check too much times, restart login');
                this.run();
                return _context.abrupt('return');

              case 33:
                _context.next = 22;
                break;

              case 35:
                _context.prev = 35;

                debug('fetching tickets');
                _context.next = 39;
                return this.fetchTickets();

              case 39:
                debug('fetch tickets complete');

                debug('webwxinit...');
                _context.next = 43;
                return this.webwxinit();

              case 43:
                debug('webwxinit complete');

                debug('notify mobile...');
                _context.next = 47;
                return this.notifyMobile();

              case 47:
                debug('notify mobile complete');

                debug('fetching contact');
                _context.next = 51;
                return this.fetchContact();

              case 51:
                debug('fetch contact complete');

                // await this.fetchBatchgetContact();
                _context.next = 54;
                return this.lookupSyncCheckHost();

              case 54:
                this.pushHost = _context.sent;
                _context.next = 62;
                break;

              case 57:
                _context.prev = 57;
                _context.t1 = _context['catch'](35);

                debug('main step occur error', _context.t1);
                // retry login
                this.run();
                return _context.abrupt('return');

              case 62:

                URLS = (0, _conf.getUrls)({ baseHost: this.baseHost, pushHost: this.pushHost });

                debug('start msg loop');
                this.runLoop();

                // auto update Contacts every ten minute
                this.updataContactTimer = setInterval(function () {
                  _this2.updateContact();
                }, 1000 * 60 * 10);

              case 66:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[3, 9], [35, 57]]);
      }));
      return function run() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'runLoop',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
        var _this3 = this;

        var _ref, selector, retcode;

        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.syncCheck();

              case 2:
                _ref = _context2.sent;
                selector = _ref.selector;
                retcode = _ref.retcode;

                if (!(retcode !== '0')) {
                  _context2.next = 9;
                  break;
                }

                debug('你在其他地方登录或登出了微信，正在尝试重新登录...');
                this.run();
                return _context2.abrupt('return');

              case 9:

                if (selector !== '0') {
                  this.webwxsync();
                }

                this.checkSyncTimer = setTimeout(function () {
                  _this3.runLoop();
                }, 3e3);

              case 11:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));
      return function runLoop() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'checkLoginStep',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
        var data, loginCode;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                data = undefined;
                _context3.prev = 1;
                _context3.next = 4;
                return rp({
                  uri: URLS.API_login + ('?uuid=' + this.uuid + '&tip=1&r=' + +new Date()),
                  timeout: 35e3
                });

              case 4:
                data = _context3.sent;
                _context3.next = 12;
                break;

              case 7:
                _context3.prev = 7;
                _context3.t0 = _context3['catch'](1);

                debug('checkLoginStep network error', _context3.t0);
                this.checkLoginStep();
                return _context3.abrupt('return');

              case 12:
                if (/code=(\d{3});/.test(data)) {
                  _context3.next = 14;
                  break;
                }

                return _context3.abrupt('return', this.checkLoginStep());

              case 14:
                loginCode = parseInt(data.match(/code=(\d{3});/)[1], 10);
                _context3.t1 = loginCode;
                _context3.next = _context3.t1 === 200 ? 18 : _context3.t1 === 201 ? 23 : _context3.t1 === 408 ? 25 : 27;
                break;

              case 18:
                debug('Confirm login!');
                this.redirectUri = data.match(/redirect_uri="(.+)";$/)[1] + '&fun=new&version=v2';
                this.baseHost = _url2.default.parse(this.redirectUri).host;
                URLS = (0, _conf.getUrls)({ baseHost: this.baseHost });
                return _context3.abrupt('break', 28);

              case 23:
                debug('QRcode scaned!');
                return _context3.abrupt('break', 28);

              case 25:
                debug('Check login timeout, retry...');
                return _context3.abrupt('break', 28);

              case 27:
                debug('Unkonw status, retry...');

              case 28:
                return _context3.abrupt('return', loginCode);

              case 29:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this, [[1, 7]]);
      }));
      return function checkLoginStep() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'webwxinit',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4() {
        var data;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                data = undefined;
                _context4.prev = 1;
                _context4.next = 4;
                return rp({
                  uri: URLS.API_webwxinit,
                  method: 'POST',
                  json: true,
                  body: {
                    BaseRequest: this.baseRequest
                  }
                });

              case 4:
                data = _context4.sent;
                _context4.next = 12;
                break;

              case 7:
                _context4.prev = 7;
                _context4.t0 = _context4['catch'](1);

                debug('webwxinit network error', _context4.t0);
                // network error retry
                this.webwxinit();
                return _context4.abrupt('return');

              case 12:
                if (!(!data || !data.BaseResponse || data.BaseResponse.Ret !== 0)) {
                  _context4.next = 14;
                  break;
                }

                throw new Error('Init Webwx failed');

              case 14:

                this.my = data.User;
                this.syncKey = data.SyncKey;
                this.formateSyncKey = this.syncKey.List.map(function (item) {
                  return item.Key + '_' + item.Val;
                }).join('|');

              case 17:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this, [[1, 7]]);
      }));
      return function webwxinit() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'webwxsync',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5() {
        var _this4 = this;

        var data;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                data = undefined;
                _context5.prev = 1;
                _context5.next = 4;
                return rp({
                  uri: URLS.API_webwxsync,
                  method: 'POST',
                  qs: {
                    sid: this.sid,
                    skey: this.skey
                  },
                  json: true,
                  body: {
                    BaseRequest: this.baseRequest,
                    SyncKey: this.syncKey,
                    rr: ~new Date()
                  }
                });

              case 4:
                data = _context5.sent;
                _context5.next = 12;
                break;

              case 7:
                _context5.prev = 7;
                _context5.t0 = _context5['catch'](1);

                debug('webwxsync network error', _context5.t0);
                // network error retry
                this.webwxsync();
                return _context5.abrupt('return');

              case 12:

                this.syncKey = data.SyncKey;
                this.formateSyncKey = this.syncKey.List.map(function (item) {
                  return item.Key + '_' + item.Val;
                }).join('|');

                data.AddMsgList.forEach(function (msg) {
                  return _this4.handleMsg(msg);
                });

              case 15:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this, [[1, 7]]);
      }));
      return function webwxsync() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'lookupSyncCheckHost',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6() {
        var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, host, data, retcode;

        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context6.prev = 3;
                _iterator = (0, _getIterator3.default)(pushHostList);

              case 5:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context6.next = 24;
                  break;
                }

                host = _step.value;
                data = undefined;
                _context6.prev = 8;
                _context6.next = 11;
                return rp({
                  uri: 'https://' + host + '/cgi-bin/mmwebwx-bin/synccheck',
                  qs: {
                    r: +new Date(),
                    skey: this.skey,
                    sid: this.sid,
                    uin: this.uin,
                    deviceid: makeDeviceID(),
                    synckey: this.formateSyncKey
                  },
                  timeout: 35e3
                });

              case 11:
                data = _context6.sent;
                _context6.next = 18;
                break;

              case 14:
                _context6.prev = 14;
                _context6.t0 = _context6['catch'](8);

                debug('lookupSyncCheckHost network error', _context6.t0);
                // network error retry
                return _context6.abrupt('return', this.lookupSyncCheckHost());

              case 18:
                retcode = data.match(/retcode:"(\d+)"/)[1];

                if (!(retcode === '0')) {
                  _context6.next = 21;
                  break;
                }

                return _context6.abrupt('return', host);

              case 21:
                _iteratorNormalCompletion = true;
                _context6.next = 5;
                break;

              case 24:
                _context6.next = 30;
                break;

              case 26:
                _context6.prev = 26;
                _context6.t1 = _context6['catch'](3);
                _didIteratorError = true;
                _iteratorError = _context6.t1;

              case 30:
                _context6.prev = 30;
                _context6.prev = 31;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 33:
                _context6.prev = 33;

                if (!_didIteratorError) {
                  _context6.next = 36;
                  break;
                }

                throw _iteratorError;

              case 36:
                return _context6.finish(33);

              case 37:
                return _context6.finish(30);

              case 38:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this, [[3, 26, 30, 38], [8, 14], [31,, 33, 37]]);
      }));
      return function lookupSyncCheckHost() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'syncCheck',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee7() {
        var data, retcode, selector;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                data = undefined;
                _context7.prev = 1;
                _context7.next = 4;
                return rp({
                  uri: URLS.API_synccheck,
                  qs: {
                    r: +new Date(),
                    skey: this.skey,
                    sid: this.sid,
                    uin: this.uin,
                    deviceid: makeDeviceID(),
                    synckey: this.formateSyncKey
                  },
                  timeout: 35e3
                });

              case 4:
                data = _context7.sent;
                _context7.next = 11;
                break;

              case 7:
                _context7.prev = 7;
                _context7.t0 = _context7['catch'](1);

                debug('synccheck network error', _context7.t0);
                // network error retry
                return _context7.abrupt('return', this.syncCheck());

              case 11:
                retcode = data.match(/retcode:"(\d+)"/)[1];
                selector = data.match(/selector:"(\d+)"/)[1];
                return _context7.abrupt('return', { retcode: retcode, selector: selector });

              case 14:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, this, [[1, 7]]);
      }));
      return function syncCheck() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'notifyMobile',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee8() {
        var data;
        return _regenerator2.default.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                data = undefined;
                _context8.prev = 1;
                _context8.next = 4;
                return rp({
                  uri: URLS.API_webwxstatusnotify,
                  method: 'POST',
                  json: true,
                  body: {
                    BaseRequest: this.baseRequest,
                    Code: _conf.CODES.StatusNotifyCode_INITED,
                    FromUserName: this.my.UserName,
                    ToUserName: this.my.UserName,
                    ClientMsgId: +new Date()
                  }
                });

              case 4:
                data = _context8.sent;
                _context8.next = 12;
                break;

              case 7:
                _context8.prev = 7;
                _context8.t0 = _context8['catch'](1);

                debug('notify mobile network error', _context8.t0);
                // network error retry
                this.notifyMobile();
                return _context8.abrupt('return');

              case 12:
                if (!(!data || !data.BaseResponse || data.BaseResponse.Ret !== 0)) {
                  _context8.next = 14;
                  break;
                }

                throw new Error('Notify mobile fail');

              case 14:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this, [[1, 7]]);
      }));
      return function notifyMobile() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'fetchUUID',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee9() {
        var data, uuid;
        return _regenerator2.default.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                data = undefined;
                _context9.prev = 1;
                _context9.next = 4;
                return rp(URLS.API_jsLogin);

              case 4:
                data = _context9.sent;
                _context9.next = 12;
                break;

              case 7:
                _context9.prev = 7;
                _context9.t0 = _context9['catch'](1);

                debug('fetch uuid network error', _context9.t0);
                // network error retry
                this.fetchUUID();
                return _context9.abrupt('return');

              case 12:
                if (/uuid = "(.+)";$/.test(data)) {
                  _context9.next = 14;
                  break;
                }

                throw new Error('get uuid failed');

              case 14:
                uuid = data.match(/uuid = "(.+)";$/)[1];
                return _context9.abrupt('return', uuid);

              case 16:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, this, [[1, 7]]);
      }));
      return function fetchUUID() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'fetchTickets',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee10() {
        var data, skeyM, wxsidM, wxuinM, passTicketM;
        return _regenerator2.default.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                data = undefined;
                _context10.prev = 1;
                _context10.next = 4;
                return rp(this.redirectUri);

              case 4:
                data = _context10.sent;
                _context10.next = 12;
                break;

              case 7:
                _context10.prev = 7;
                _context10.t0 = _context10['catch'](1);

                debug('fetch tickets network error', _context10.t0);
                // network error, retry
                this.fetchTickets();
                return _context10.abrupt('return');

              case 12:
                if (/<ret>0<\/ret>/.test(data)) {
                  _context10.next = 14;
                  break;
                }

                throw new Error('Get skey failed, restart login');

              case 14:

                // const retM = data.match(/<ret>(.*)<\/ret>/);
                // const scriptM = data.match(/<script>(.*)<\/script>/);
                skeyM = data.match(/<skey>(.*)<\/skey>/);
                wxsidM = data.match(/<wxsid>(.*)<\/wxsid>/);
                wxuinM = data.match(/<wxuin>(.*)<\/wxuin>/);
                passTicketM = data.match(/<pass_ticket>(.*)<\/pass_ticket>/);
                // const redirectUrl = data.match(/<redirect_url>(.*)<\/redirect_url>/);

                this.skey = skeyM && skeyM[1];
                this.sid = wxsidM && wxsidM[1];
                this.uin = wxuinM && wxuinM[1];
                this.passTicket = passTicketM && passTicketM[1];

                this.baseRequest = {
                  Uin: parseInt(this.uin, 10),
                  Sid: this.sid,
                  Skey: this.skey,
                  DeviceID: makeDeviceID()
                };

              case 23:
              case 'end':
                return _context10.stop();
            }
          }
        }, _callee10, this, [[1, 7]]);
      }));
      return function fetchTickets() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'fetchContact',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee11() {
        var _this5 = this;

        var data;
        return _regenerator2.default.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                data = undefined;
                _context11.prev = 1;
                _context11.next = 4;
                return rp({
                  uri: URLS.API_webwxgetcontact,
                  qs: {
                    skey: this.skey,
                    pass_ticket: this.passTicket,
                    seq: 0,
                    r: +new Date()
                  }
                });

              case 4:
                data = _context11.sent;
                _context11.next = 12;
                break;

              case 7:
                _context11.prev = 7;
                _context11.t0 = _context11['catch'](1);

                debug('fetch contact network error', _context11.t0);
                // network error retry
                this.fetchContact();
                return _context11.abrupt('return');

              case 12:
                if (!(!data || !data.BaseResponse || data.BaseResponse.Ret !== 0)) {
                  _context11.next = 14;
                  break;
                }

                throw new Error('Fetch contact fail');

              case 14:

                this.Members.insert(data.MemberList);
                data.MemberList.forEach(function (member) {
                  var userName = member.UserName;

                  if (member.VerifyFlag & _conf.CODES.MM_USERATTRVERIFYFALG_BIZ_BRAND) {
                    _this5.Brands.insert(member);
                    return;
                  }

                  if (spAccounts.includes(userName) || /@qqim$/.test(userName)) {
                    _this5.SPs.insert(member);
                    return;
                  }

                  if (userName.includes('@@')) {
                    _this5.Groups.insert(member);
                    return;
                  }

                  if (userName !== _this5.my.UserName) {
                    _this5.Contacts.insert(member);
                  }
                });

              case 16:
              case 'end':
                return _context11.stop();
            }
          }
        }, _callee11, this, [[1, 7]]);
      }));
      return function fetchContact() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'fetchBatchgetContact',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee12(groupIds) {
        var _this6 = this;

        var list, data;
        return _regenerator2.default.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                list = groupIds.map(function (id) {
                  return { UserName: id, EncryChatRoomId: '' };
                });
                data = undefined;
                _context12.prev = 2;
                _context12.next = 5;
                return rp({
                  method: 'POST',
                  uri: URLS.API_webwxbatchgetcontact,
                  qs: {
                    type: 'ex',
                    r: +new Date()
                  },
                  json: true,
                  body: {
                    BaseRequest: this.baseRequest,
                    Count: list.length,
                    List: list
                  }
                });

              case 5:
                data = _context12.sent;
                _context12.next = 14;
                break;

              case 8:
                _context12.prev = 8;
                _context12.t0 = _context12['catch'](2);

                debug('fetch batchgetcontact network error', _context12.t0);
                // network error retry
                _context12.next = 13;
                return this.fetchBatchgetContact(groupIds);

              case 13:
                return _context12.abrupt('return');

              case 14:
                if (!(!data || !data.BaseResponse || data.BaseResponse.Ret !== 0)) {
                  _context12.next = 16;
                  break;
                }

                throw new Error('Fetch batchgetcontact fail');

              case 16:

                data.ContactList.forEach(function (Group) {
                  _this6.Groups.insert(Group);

                  var MemberList = Group.MemberList;

                  MemberList.forEach(function (member) {
                    member.GroupUserName = Group.UserName;
                    _this6.GroupMembers.update({
                      UserName: member.UserName,
                      GroupUserName: member.GroupUserName
                    }, member, { upsert: true });
                  });
                });

              case 17:
              case 'end':
                return _context12.stop();
            }
          }
        }, _callee12, this, [[2, 8]]);
      }));
      return function fetchBatchgetContact(_x2) {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'updateContact',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee13() {
        var groups, groupIds;
        return _regenerator2.default.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.prev = 0;
                _context13.next = 3;
                return this.fetchContact();

              case 3:
                _context13.next = 5;
                return this.Groups.find({});

              case 5:
                groups = _context13.sent;
                groupIds = groups.map(function (group) {
                  return group.UserName;
                });
                _context13.next = 9;
                return this.fetchBatchgetContact(groupIds);

              case 9:
                _context13.next = 14;
                break;

              case 11:
                _context13.prev = 11;
                _context13.t0 = _context13['catch'](0);

                debug('update contact fail', _context13.t0);

              case 14:
              case 'end':
                return _context13.stop();
            }
          }
        }, _callee13, this, [[0, 11]]);
      }));
      return function updateContact() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'getMember',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee14(id) {
        var member;
        return _regenerator2.default.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return this.Members.findOneAsync({ UserName: id });

              case 2:
                member = _context14.sent;
                return _context14.abrupt('return', member);

              case 4:
              case 'end':
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));
      return function getMember(_x3) {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'getGroup',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee15(groupId) {
        var group;
        return _regenerator2.default.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.next = 2;
                return this.Groups.findOneAsync({ UserName: groupId });

              case 2:
                group = _context15.sent;

                if (!group) {
                  _context15.next = 5;
                  break;
                }

                return _context15.abrupt('return', group);

              case 5:
                _context15.prev = 5;
                _context15.next = 8;
                return this.fetchBatchgetContact([groupId]);

              case 8:
                _context15.next = 14;
                break;

              case 10:
                _context15.prev = 10;
                _context15.t0 = _context15['catch'](5);

                debug('fetchBatchgetContact error', _context15.t0);
                return _context15.abrupt('return', null);

              case 14:
                _context15.next = 16;
                return this.Groups.findOneAsync({ UserName: groupId });

              case 16:
                group = _context15.sent;
                return _context15.abrupt('return', group);

              case 18:
              case 'end':
                return _context15.stop();
            }
          }
        }, _callee15, this, [[5, 10]]);
      }));
      return function getGroup(_x4) {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'getGroupMember',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee16(id, groupId) {
        var member;
        return _regenerator2.default.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _context16.next = 2;
                return this.GroupMembers.findOneAsync({
                  UserName: id,
                  GroupUserName: groupId
                });

              case 2:
                member = _context16.sent;

                if (!member) {
                  _context16.next = 5;
                  break;
                }

                return _context16.abrupt('return', member);

              case 5:
                _context16.prev = 5;
                _context16.next = 8;
                return this.fetchBatchgetContact([groupId]);

              case 8:
                _context16.next = 14;
                break;

              case 10:
                _context16.prev = 10;
                _context16.t0 = _context16['catch'](5);

                debug('fetchBatchgetContact error', _context16.t0);
                return _context16.abrupt('return', null);

              case 14:
                _context16.next = 16;
                return this.GroupMembers.findOneAsync({ UserName: id });

              case 16:
                member = _context16.sent;
                return _context16.abrupt('return', member);

              case 18:
              case 'end':
                return _context16.stop();
            }
          }
        }, _callee16, this, [[5, 10]]);
      }));
      return function getGroupMember(_x5, _x6) {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'handleMsg',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee17(msg) {
        var userId;
        return _regenerator2.default.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                if (!msg.FromUserName.includes('@@')) {
                  _context17.next = 11;
                  break;
                }

                userId = msg.Content.match(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/)[1];
                _context17.next = 4;
                return this.getGroupMember(userId, msg.FromUserName);

              case 4:
                msg.Member = _context17.sent;
                _context17.next = 7;
                return this.getGroup(msg.FromUserName);

              case 7:
                msg.Group = _context17.sent;

                msg.Content = msg.Content.replace(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/, '');

                this.emit('group', msg);
                return _context17.abrupt('return');

              case 11:
                _context17.next = 13;
                return this.getMember(msg.FromUserName);

              case 13:
                msg.Member = _context17.sent;

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

              case 15:
              case 'end':
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));
      return function handleMsg(_x7) {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'sendText',
    value: function sendText(to, content, callback) {
      var _this7 = this;

      var clientMsgId = (+new Date() + Math.random().toFixed(3)).replace('.', '');

      rp({
        uri: URLS.API_webwxsendmsg,
        method: 'POST',
        qs: {
          pass_ticket: this.passTicket
        },
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          Msg: {
            Type: _conf.CODES.MSGTYPE_TEXT,
            Content: content,
            FromUserName: this.my.UserName,
            ToUserName: to,
            LocalID: clientMsgId,
            ClientMsgId: clientMsgId
          }
        }
      }).then(function (data) {
        callback = callback || function () {
          return null;
        };
        if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
          return callback(new Error('Send text fail'));
        }

        callback();
      }).catch(function (e) {
        debug('send text network error', e);
        // network error, retry
        _this7.sendText(to, content, callback);
        return;
      });
    }
  }]);
  return WeixinBot;
}(_events2.default);

// compatible nodejs require

module.exports = WeixinBot;