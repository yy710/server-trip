/**
 * middleware: session
 */
'use strict';

const crypto = require('crypto');
var session = {db: null, col: 'sessions'};
var assert = require('assert');
var location = require('./location.js').location;
var weapp = require('./common.js').weapp;
var WXBizDataCrypt = require('./WXBizDataCrypt');

class Session {
    constructor(c) {
        this.db = c.db;
        this.col = c.col || 'sessions';
        this.sid = c.sid || null;
    }

    save(req, res, next) {
        //req.session.sid = Date.now() + Math.round(Math.random() * 1000);
        const buf = crypto.randomBytes(16);
        req.session.sid = buf.toString('hex');
        this.db.collection(this.col).insertOne(req.session, function (err, _res) {
            assert.equal(null, err);
            assert.equal(1, _res.insertedCount);
            next();
        });
    }

    getUserData(config) {
        return function (req, res, next) {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appid}&secret=${config.appsecret}&js_code=${req.query.code}&grant_type=authorization_code`;
            weapp.httpsGet(url).then(function (_res) {
                //_res: { session_key: 'R9RxSEkN3/xM5z7cOuKBuw==', expires_in: 7200, openid: 'oecsZ0RSLJvpweLb5Gzi0KBVARB8' }
                req.session = (new WXBizDataCrypt(config.appid, _res.session_key)).decryptData(req.query.encryptedData, req.query.iv);
                next();
            }).catch(console.log);
        };
    }

    find(req, res, next) {
        var sid = req.sid || req.query.sid;
        this.db.collection(this.col).find({sid: sid}).limit(1).next(function (err, doc) {
            assert.equal(null, err);
            console.log("from session.js/session.find(): ", doc);
            //res.send({valid: !!doc});
            req.session = doc;
            next();
        });
    };
}


/**
 * 获得 openid 及 session_key
 * @param config
 * @returns {Function}
 */
session.getSessionKey = function (config) {
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
session.decryptUserData = function (req, res, next) {
    //console.log("req.session: ", req.session);
    var s = req.session;
    var pc = new WXBizDataCrypt(s.appid, s.session_key);
    s.decryptedData = pc.decryptData(s.encryptedData, s.iv);
    //console.log('decryptedData: ', s.decryptedData);
    req.session = s;
    next();
};


session.saveSession = function (req, res, next) {
    //req.session.sid = Date.now() + Math.round(Math.random() * 1000);
    const buf = crypto.randomBytes(16);
    req.session.sid = buf.toString('hex');
    delete req.session.encryptedData;
    req.db.collection('sessions').insertOne(req.session, function (err, res) {
        assert.equal(null, err);
        assert.equal(1, res.insertedCount);
        next();
    });
};

session.__saveSession = function (db) {
    return function (req, res, next) {
        const buf = crypto.randomBytes(16);
        req.session.sid = buf.toString('hex');
        db.collection('sessions').insertOne(req.session, function (err, res) {
            assert.equal(null, err);
            assert.equal(1, res.insertedCount);
            next();
        });
    }
};

session.find = function (req, res, next) {
    var sid = req.sid || req.query.sid;
    var db = req.db;
    db.collection('sessions').find({sid: sid}).limit(1).next(function (err, doc) {
        assert.equal(null, err);
        //console.log("from session.js/session.find(): ", doc);
        //res.send({valid: !!doc});
        req.session = doc;//deprecated
        req.data.session = doc;//approve
        next();
    });
};

session.getMember = function (req, res, next) {
    req.db.collection('members')
        .find({openid: req.data.session.openid})
        .next()
        .then(doc=> {
            req.data.member = doc;
            next();
        })
        .catch(log);
};

session.reply = function (req, res, next) {
    res.send({sid: req.session.sid, msg: "session ok!"});
};

//-----------------------------------------------------
module.exports.session = session;
//module.exports.Session = Session;

function log(res){
    console.log(res);
    return Promise.resolve(res);
}