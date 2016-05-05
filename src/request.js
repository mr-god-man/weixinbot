'use strict';

/**
 * weixinbot2
 *
 * This project was forked from https://github.com/feit/Weixinbot
 * Thanks for feit's weixinbot
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import os from 'os';
import path from 'path';
import touch from 'touch';
import zlib from 'zlib';
import RequestPromise from 'request-promise';
import FileCookieStore from 'tough-cookie-filestore';


// try persistent cookie
const cookiePath = path.join(os.tmpdir(), `${Date.now()}.${Math.random()}.cookie.json`);
let jar;
try {
  touch.sync(cookiePath);
  jar = RequestPromise.jar(new FileCookieStore(cookiePath));
} catch (e) {
  jar = RequestPromise.jar();
}

const rp = RequestPromise.defaults({
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2652.0 Safari/537.36',
  },
  jar,
  encoding: null,
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

module.exports = rp;
