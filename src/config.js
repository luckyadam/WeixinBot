'use strict';

export default {
  LANG: 'zh_CN',
  APPID: 'wx782c26e4c19acffb',
  FUN: 'new',
  URLS: {
    QRCODE: 'https://login.weixin.qq.com/l/',
    QRCODE_IMAGE: 'https://login.weixin.qq.com/qrcode/',
    JS_LOGIN: 'https://login.weixin.qq.com/jslogin',
    LOGIN_STATUS: 'https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login',
    SYNC_CHECK: 'https://webpush.weixin.qq.com/cgi-bin/mmwebwx-bin/synccheck',
    WEB_WX_INIT: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxinit',
    WEB_WX_SYNC: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxsync',
    WEB_WX_STATUS_NOTIFY: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxstatusnotify',
    WEB_WX_NEW_LOGIN_PAGE: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxnewloginpage'
  }
};

const PROTOCAL = 'https';

const WEIXIN_PUSH_HOSTS = [
  'webpush.weixin.qq.com',
  'webpush2.weixin.qq.com',
  'webpush.wechat.com',
  'webpush1.wechat.com',
  'webpush2.wechat.com',
  'webpush.wechatapp.com',
  'webpush1.wechatapp.com',
];
