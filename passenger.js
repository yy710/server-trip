'use strict';

const crypto = require('crypto');
var passenger = {};
var assert = require('assert');
var location = require('./location.js').location;
var weapp = require('./common.js').weapp;
var WXBizDataCrypt = require('./WXBizDataCrypt');


/**
 * 获得 openid 及 session_key
 * @param config
 * @returns {Function}
 */
passenger.getSessionKey = function (config) {
    return function (req, res, next) {
        var code = req.query.code;
        //console.log(code);
        var url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appid}&secret=${config.appsecret}&js_code=${code}&grant_type=authorization_code`;
        weapp.httpsGet(url).then(function (_res) {
            //_res: { session_key: 'R9RxSEkN3/xM5z7cOuKBuw==', expires_in: 7200, openid: 'oecsZ0RSLJvpweLb5Gzi0KBVARB8' }
            _res.code = code;
            _res.appid = config.appid;
            _res.encryptedData = req.query.encryptedData;
            _res.iv = req.query.iv;
            req.session = _res;
            next();
        }).catch(console.log);
    };
};

/**
 * 解密用户数据
 * @param req
 * @param res
 * @param next
 */
passenger.decryptUserData = function (req, res, next) {
    //console.log("req.session: ", req.session);
    var s = req.session;
    var pc = new WXBizDataCrypt(s.appid, s.session_key);
    s.decryptedData = pc.decryptData(s.encryptedData, s.iv);
    //console.log('decryptedData: ', s.decryptedData);
    req.session = s;
    next();
};


passenger.saveSession = function (req, res, next) {
    const buf = crypto.randomBytes(16);
    req.session.sid = buf.toString('hex');
    req.db.collection('sessions').insertOne(req.session, function (err, res) {
        assert.equal(null, err);
        assert.equal(1, res.insertedCount);
        next();
    });
};


passenger.reply = function(req, res, next){
    res.send({sid: req.session.sid, msg: "session ok!"});
};

//-----------------------------------------------------
module.exports.passenger = passenger;
