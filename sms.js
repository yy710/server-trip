'use strict';

var TopClient = require('./sms-sdk/topClient').TopClient;
var aliSMS = new TopClient({
    'appkey': '23448010',
    'appsecret': 'b3923e4918b49e2d0839f1e2ceca6c86',
    'REST_URL': 'http://gw.api.taobao.com/router/rest'
});

/**
 * 高阶函数, 用于生成一个返回Promise的专用短信发送函数
 * @param sms 阿里大于短信接口对象实例
 * @param authenticode 阿里大于短信接口调用参数
 * @returns {Function}
 * @constructor
 */
var loginSMS = function (sms) {
    return function (authenticode) {
        return function (phone) {
            return new Promise(function (resolve, reject) {
                //var authenticode = Math.round(Math.random() * 10000);
                sms.execute('alibaba.aliqin.fc.sms.num.send', {
                    'extend': '',
                    'sms_type': 'normal',
                    'sms_free_sign_name': '全民e车',
                    'sms_param': '{\"product\": \"全民e车\", \"code\": \"' + authenticode + '\"}',
                    'rec_num': phone,
                    'sms_template_code': "SMS_14276025"
                }, function (error, response) {
                    if (!error) {
                        console.log(response);
                        resolve(authenticode);
                    }
                    else {
                        console.log(error);
                        reject(error);
                    }
                });
            });
        };
    };
};


/**
 * dikun sms function
 * @param sms
 * @returns {Function}
 */
var dkSMS = function (sms) {
    return function (phone, date) {
        return new Promise(function (resolve, reject) {
            sms.execute('alibaba.aliqin.fc.sms.num.send', {
                'extend': '',
                'sms_type': 'normal',
                'sms_free_sign_name': '云南迪坤',
                'sms_param': '{\"name\": \"迪坤会员\", \"day\": "' + date + '"}',
                'rec_num': phone,
                'sms_template_code': "SMS_14271122"
            }, function (error, response) {
                if (!error) {
                    console.log(response);
                    resolve(response);
                }
                else {
                    console.log(error);
                    reject(error);
                }
            });
        });
    };
};

exports.loginSMS = loginSMS(aliSMS);
exports.dkSMS = dkSMS(aliSMS);