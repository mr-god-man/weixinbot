'use strict';

/**
 * utils
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import fs from 'fs';
import xml2js from 'xml2js';
import createDebug from 'debug';

const debug = createDebug('weixinbot2:utils');


export function makeDeviceID() {
  return 'e' + Math.random().toFixed(15).toString().substring(2, 17);
}

export function parseContent(input) {
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

export function parseEmoji(input) {
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
export async function fixIncommingMessage(msg) {
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

export function readJSONFileSync(file) {
  return JSON.parse(fs.readFileSync(file).toString());
}

export function writeJSONFile(file, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, JSON.stringify(data), err => {
      err ? reject(err) : resolve();
    });
  });
}
/**
 * 模糊匹配算法
 * @param string1
 * @param string2
 * @returns {boolean}
 */
export function isStringMatched(keyword,string2) {
  var str_arr_1 = keyword.split("");
  var str_arr_2 = string2.split("");

  var minEqualCharCount = str_arr_1.length;

  var equalCount = 0;
  str_arr_1.forEach(function(char1){
    str_arr_2.forEach(function(char2){
      if(char1 == char2){
        equalCount++;
      }
    })
  })

  if(equalCount >= minEqualCharCount){
    return true;
  }else{
    return false;
  }
}
