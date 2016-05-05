'use strict';

/**
 * Simple inmemory store
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import fs from 'fs';
import assert from 'assert';
import createDebug from 'debug';
const debug = createDebug('weixinbot2:db');

export default class SimpleStore {

  constructor(keys, filename) {
    if (!Array.isArray(keys)) keys = [keys];
    filename = filename || null;

    this.keys = keys;
    this.data = new Map();
    this.modified = false;
    debug('create: keys=%s', keys);

    this.filename = filename;
    if (filename && fs.existsSync(filename)) {
      const list = JSON.parse(fs.readFileSync(filename).toString());
      for (const item of list) {
        this.data.set(item[0], item[1]);
      }
      debug('load data: file=%s, total=%s', filename, list.length);
    }
  }

  _getKey(keys) {
    return this.keys.map((k, i) => `${k}_${keys[i]}`).join('_');
  }

  get(...keys) {
    const key = this._getKey(keys);
    const data = this.data.get(key);
    // debug('get: %s <= %j', key, data);
    debug('get: %s [exists=%s] [%s]', key, !!data, this.filename);
    return data;
  }

  list() {
    const values = this.data.values();
    const list = [];
    for (const item of values) {
      list.push(item);
    }
    debug('list: %s [%s]', list.length, this.filename);
    return list;
  }

  save(data) {
    const keys = this.keys.map(k => data[k]);
    const key = this._getKey(keys);
    data.$key = key;
    // debug('add: key => %j', key, data);
    this.data.set(key, data);
    this.modified = true;
  }

  saveToFile() {
    if (!this.filename) return;
    const list = [];
    for (const item of this.data.entries()) {
      list.push(item);
    }
    debug('save data: file=%s, total=%s', this.filename, list.length);
    fs.writeFile(this.filename, JSON.stringify(list), err => {
      if (err) debug('save file failed: %s', err);
    });
  }

  saveToFileIfModified() {
    if (!this.modified) return;
    this.saveToFile();
    this.modified = false;
  }

}
