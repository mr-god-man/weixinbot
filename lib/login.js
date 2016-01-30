'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _conf = require('./conf');

var _conf2 = _interopRequireDefault(_conf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-console */

var Login = function () {
  function Login() {
    (0, _classCallCheck3.default)(this, Login);

    this.UUID_REG = /uuid = "(.+)";$/;
    this.LOGIN_CODE_REG = /code=(\d{3});$/;
    this.REDIRECT_URI_REG = /redirect_uri="(.+)";$/;
  }

  (0, _createClass3.default)(Login, [{
    key: 'getUUID',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
        var uuidHtml, uuid;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return (0, _requestPromise2.default)(_conf2.default.API_jsLogin);

              case 2:
                uuidHtml = _context.sent;

                if (this.UUID_REG.test(uuidHtml)) {
                  _context.next = 5;
                  break;
                }

                return _context.abrupt('return', { err: new Error('get uuid failed') });

              case 5:
                uuid = this.UUID_REG.exec(uuidHtml)[1];
                return _context.abrupt('return', { uuid: uuid });

              case 7:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));
      return function getUUID() {
        return ref.apply(this, arguments);
      };
    }()
  }, {
    key: 'checkLogin',
    value: function () {
      var ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(uuid) {
        var options, loginHtml, loginCode, redirectUri;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                options = {
                  uri: _conf2.default.API_login + '?loginicon=true&uuid=' + uuid + '&tip=1&r=' + ~new Date(),
                  timeout: 35e3
                };
                _context2.next = 3;
                return (0, _requestPromise2.default)(options);

              case 3:
                loginHtml = _context2.sent;

                if (this.LOGIN_CODE_REG.test(loginHtml)) {
                  _context2.next = 6;
                  break;
                }

                return _context2.abrupt('return', { err: new Error('check login failed') });

              case 6:
                loginCode = parseInt(this.LOGIN_CODE_REG.exec(loginHtml)[1], 10);
                redirectUri = '';

                if (loginCode === 200) {
                  redirectUri = this.REDIRECT_URI_REG.exec(loginHtml)[1];
                }

                return _context2.abrupt('return', { loginCode: loginCode, redirectUri: redirectUri });

              case 10:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));
      return function checkLogin(_x) {
        return ref.apply(this, arguments);
      };
    }()
  }]);
  return Login;
}();

exports.default = Login;