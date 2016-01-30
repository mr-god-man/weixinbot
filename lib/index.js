'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

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

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _child_process = require('child_process');

var _conf = require('./conf');

var _conf2 = _interopRequireDefault(_conf);

var _login = require('./login');

var _login2 = _interopRequireDefault(_login);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-console */

var WeixinBot = function (_EventEmitter) {
  (0, _inherits3.default)(WeixinBot, _EventEmitter);

  function WeixinBot() {
    (0, _classCallCheck3.default)(this, WeixinBot);

    var _this = (0, _possibleConstructorReturn3.default)(this, (0, _getPrototypeOf2.default)(WeixinBot).call(this));

    _this.on('loginSuccess', function (loginResult) {
      console.log(loginResult);
    });
    return _this;
  }

  (0, _createClass3.default)(WeixinBot, [{
    key: 'run',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
        var login, _ref, uuid, checkLoginResult, qrcodePath, loginResult;

        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                login = new _login2.default();
                _context2.next = 3;
                return login.getUUID();

              case 3:
                _ref = _context2.sent;
                uuid = _ref.uuid;

                checkLoginResult = function () {
                  var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(loginResult) {
                    var nextLoginResult;
                    return _regenerator2.default.wrap(function _callee$(_context) {
                      while (1) {
                        switch (_context.prev = _context.next) {
                          case 0:
                            nextLoginResult = null;
                            _context.t0 = loginResult.loginCode;
                            _context.next = _context.t0 === 200 ? 4 : _context.t0 === 201 ? 6 : _context.t0 === 408 ? 12 : 18;
                            break;

                          case 4:
                            this.emit('loginSuccess', { loginResult: loginResult });
                            return _context.abrupt('break', 20);

                          case 6:
                            console.log('qrcode scaned!');
                            _context.next = 9;
                            return login.checkLogin(uuid);

                          case 9:
                            nextLoginResult = _context.sent;

                            checkLoginResult(nextLoginResult);
                            return _context.abrupt('break', 20);

                          case 12:
                            console.log('check login timeout');
                            _context.next = 15;
                            return login.checkLogin(uuid);

                          case 15:
                            nextLoginResult = _context.sent;

                            checkLoginResult(nextLoginResult);
                            return _context.abrupt('break', 20);

                          case 18:
                            console.error('unkonw status process exit');
                            process.exit(1);

                          case 20:
                          case 'end':
                            return _context.stop();
                        }
                      }
                    }, _callee, this);
                  }));
                  return function checkLoginResult(_x) {
                    return ref.apply(this, arguments);
                  };
                }();

                qrcodePath = _conf2.default.QRCODE_PATH + uuid;

                (0, _child_process.exec)('open ' + qrcodePath, function (err) {
                  if (err) {
                    console.log('自动打开浏览器失败，请手动打开下面这个网址并扫描\n ' + qrcodePath);
                  }
                });

                _context2.next = 10;
                return login.checkLogin(uuid);

              case 10:
                loginResult = _context2.sent;

                checkLoginResult(loginResult);

              case 12:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));
      return function run() {
        return ref.apply(this, arguments);
      };
    }()
  }]);
  return WeixinBot;
}(_events2.default);

exports.default = WeixinBot;