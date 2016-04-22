'use strict';

/**
 * Simple inmemory store
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import assert from 'assert';
import createDebug from 'debug';
const debug = createDebug('weixinbot2:db');

export default class SimpleStore {

  constructor(...keys) {
    this.keys = keys;
    this.data = new Map();
    debug('create: keys=%s', keys);
  }

  _getKey(keys) {
    return this.keys.map((k, i) => `${k}_${keys[i]}`).join('_');
  }

  get(...keys) {
    const key = this._getKey(keys);
    const data = this.data.get(key);
    debug('get: %s <= %j', key, data);
    return data;
  }

  list() {
    const values = this.data.values();
    const list = [];
    for (const item of values) {
      list.push(item);
    }
    debug('list: %j', list);
    return list;
  }

  add(data) {
    const keys = this.keys.map(k => data[k]);
    const key = this._getKey(keys);
    data.$key = key;
    debug('add: key => %j', key, data);
    this.data.set(key, data);
  }

  update(keys, data) {
    const key = this._getKey(keys);
    const old = this.data.get(key);
    if (old) {
      const save = Object.assign(old, data);
      this.data.set(key, save);
      debug('update: key => %j => %j', key, data, save);
    }
  }

}
