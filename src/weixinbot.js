'use strict';

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import EventEmitter from 'events';
import Debug from 'debug';
import RequestPromise from 'request-promise';
import touch from 'touch';
import CookieFileStore from 'tough-cookie-filestore';
import qrcode from 'qrcode-terminal';
import xml2json from 'xml2json';

import Config from './config';

const debug = Debug('WeixinBot');

const getJar = () => {
  const cookiePath = path.join(process.cwd(), '.cookie.json');
  let jar;
  try {
    touch.sync(cookiePath);
    jar = RequestPromise.jar(new CookieFileStore(cookiePath));
  } catch (e) {
    jar = RequestPromise.jar();
  }
  return jar;
};

const sendRequest = (options = {}) => {
  if (options.isDebug) {
    debug('发送请求，来自步骤' + options.step);
  }
  const defaultHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2652.0 Safari/537.36'
  };
  options.headers = options.headers || {};
  options.jar = getJar();
  options.encoding = null;
  options.transform = (body, response) => {
    if (response.headers['content-encoding'] === 'deflate') {
      let str = zlib.inflateRawSync(body).toString();
      try {
        return JSON.parse(str);
      } catch (e) {
        return str;
      }
    }
    return body.toString();
  };
  Object.assign(options.headers, defaultHeaders);
  return RequestPromise(options);
}

const getDeviceId = () => 'e' + Math.random().toFixed(15).toString().substring(2, 17);

const sleep = (time) => new Promise((resolve, reject) => setTimeout(resolve, time));

class WeixinBot extends EventEmitter {
  constructor(options = {}) {
    super();
    this.status = {};
    debug('创建成功！');
  }

  async getUUID() {
    debug('开始获取UUID');
    let data;
    try {
      data = await sendRequest({
        url: Config.URLS.JS_LOGIN,
        method: 'GET',
        isDebug: true,
        step: '获取UUID',
        qs: {
          appid: Config.APPID,
          fun: Config.FUN,
          lang: Config.LANG,
          redirect_uri: Config.WEB_WX_NEW_LOGIN_PAGE
        }
      });
    } catch (e) {
      debug('获取UUID出错', e);
      return await this.getUUID();
    }
    let uuid;
    const ds = data.match(/uuid = "(.+)";$/);
    if (ds) {
      uuid = ds[1];
    } else {
      debug('获取UUID出错，response=%s', body);
    }

    debug('获取UUID成功，UUID=%s', uuid);
    return uuid;
  }

  async getQRCode(uuid) {
    const qrcodeImage = Config.URLS.QRCODE + uuid;
    const qrcodeUrl = Config.URLS.QRCODE_IMAGE + uuid;
    await qrcode.generate(qrcodeImage);
    return qrcodeUrl;
  }

  async checkLoginStatus() {
    let data;
    var url = Config.URLS.LOGIN_STATUS + `?uuid=${this.uuid}&_=${new Date().getTime()}`
    try {
      data = await sendRequest({
        url,
        method: 'GET',
        isDebug: false
      });
    } catch (e) {
      debug('检查登录状态失败，重新检查...', e);
      return await this.checkLoginStatus();
    }
    const ds = data.match(/code=(\d{3});/);
    let code;
    if (ds) {
      code = parseInt(ds[1], 10);
    } else {
      throw new Error('检查登录状态失败');
    }
    return code;
  }

  async getTicket() {
    debug('正在获取凭据...');
    let data;
    try {
      data = await sendRequest({
        url: this.redirectUri
      });
    } catch (e) {
      debug('获取凭据失败', e);
      return await this.getTicket();
    }
    data = xml2json.toJson(data);
    if (data && data.error && data.error.ret == 0) {
      this.skey = data.error.skey;
      this.wxsid = data.error.wxsid;
      this.wxuin = parseInt(data.error.wxuin, 10);
      this.passTicket = data.error.pass_ticket;
      debug(`
        获得 skey -> ${this.skey}
        获得 sid -> ${this.wxsid}
        获得 uid -> ${this.wxuin}
        获得 pass_ticket -> ${this.passTicket}
      `);
      this.baseRequest = {
        Uin: this.wxuin,
        Sid: this.wxsid,
        Skey: this.skey,
        DeviceID: getDeviceId()
      };
      debug('获取凭据成功！');
    } else {
      throw new Error('获取凭据失败');
    }
  }

  async webWxInit() {
    debug('正在初始化参数!');
    let data;
    try {
      data = await sendRequest({
        uri: Config.URLS.WEB_WX_INIT,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
        },
        method: 'POST',
        json: true,
        body: {
          BaseRequest: this.baseRequest
        },
      });
    } catch (e) {
      debug('初始化参数错误', e);
      return await this.webWxInit();
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('初始化参数错误');
    }
    debug('初始化参数成功！');
    Object.assign(this.status, data);
    delete this.status.BaseResponse;
    delete this.status.Count;
    delete this.status.SyncKey;
    this.syncKey = data.SyncKey;
    this.syncKeyString = this.syncKey.List.map((item) => item.key + '_' + item.Val).join('|');
  }

  async webWxStatusNotify() {
    debug('正在通知客户端网页端已登录...');
    let data;
    try {
      data = await sendRequest({
        uri: Config.URLS.WEB_WX_STATUS_NOTIFY,
        method: 'POST',
        json: true,
        body: {
          BaseRequest: this.baseRequest,
          Code: 3,
          FromUserName: this.status.User.UserName,
          ToUserName: this.status.User.UserName,
          ClientMsgId: new Date().getTime()
        }
      });
    } catch (e) {
      debug('通知登录失败', e);
      return await this.webWxStatusNotify();
    }

    if (!data || !data.BaseResponse || data.BaseResponse.Ret !== 0) {
      throw new Error('通知登录失败！');
    }
    debug('通知成功！');
  }

  async login() {
    debug('开始登录！');
    this.uuid = await this.getUUID();
    if (!this.uuid) {
      debug('获取UUID出错，正在重试...');
      return await this.login();
    }
    debug('获取UUID成功，UUID=%s', this.uuid);
    var qrcodeUrl = await this.getQRCode(this.uuid);
    this.emit('qrcode', qrcodeUrl);
    this.checkTimes = 0;
    while (true) {
      await sleep(1000);
      let code = await this.checkLoginStatus();
      if (code === 200) {
        debug('已点击确认登录！');
        this.redirectUri = data.match(/redirect_uri="(.+)";$/)[1] + '&fun=new&version=v2';
        break;
      } else if (code === 201) {
        debug('二维码已被扫描，请确认登录!');
        this.checkTimes++;
      } else if (code === 408) {
        debug('检查登录状态次数超出限制，重新获取登录二维码');
        return this.login();
      } else {
        debug(`未知的状态，正在重试...code=${code}`);
        return this.login();
      }
    }
    console.log('sdsdsd');
    // 获取凭据
    await this.getTicket();
    // 初始化参数
    await this.webWxInit();
    // 通知登录
    await this.webWxStatusNotify();

  }
}

export default WeixinBot;
