/**
 * Created by yy710 on 13/02/2017.
 */

"use strict";

let assert = require('assert');
let https = require('https');
let http = require('http');
let BufferHelper = require('./bufferhelper.js');
let weapp = {};
let dispatch = {};

weapp.getAccessToken = function (db, config) {
    var that = this;
    return new Promise(function (resolve, reject) {
        db.collection('accesstokens').find({appid: config.appid}).limit(1).next(function (err, doc) {
            assert.equal(null, err);
            if (doc && (Date.now() - doc.updateTime ) < doc.expires_in * 1000) {
                resolve(doc.access_token);
            } else {
                that.newAccessToken(db, config).then(resolve).catch(reject);
            }
        });
    });
};

/**
 * create new access_token use to send notice!
 * 接口返回的完整数据机构 res:{access_token:'', expires_in: ''}
 */
weapp.newAccessToken = function (db, config) {
    var that = this;
    return new Promise(function (resolve, reject) {
        var url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appid}&secret=${config.appsecret}`;
        that.httpsGet(url).then((res)=> {
            res.appid = config.appid;
            res.updateTime = Date.now();
            db.collection('accesstokens').replaceOne(
                {appid: config.appid},
                res,
                {upsert: true, w: 1}
            ).then(_res=>resolve(res.access_token)).catch(reject);
        }).catch(reject);
    });
};

weapp.saveOpenid = function (db) {

    return function (res) {
        return db.collection('queues').replaceOne(
            {openid: res.openid},
            res,
            {upsert: true, w: 1}
        );
    };
};

dispatch.getQueues = function (db, ep) {
    return db.collection('quques').find({$or: [{"status.id": "acceptOrder"}, {"status.id": "other"}]}).limit(5).toArray();
};

/**
 * 查找洗车技师
 * @param db
 * @param ee
 * @param maxDistance
 * @returns {Function}
 */
dispatch.getEmployees = function (db, ee, maxDistance) {
    var maxDistance2 = maxDistance || 5000;
    return function (order) {
        return _getEmployees(db, ee, maxDistance2, order);
    };
};
var _getEmployees = function (db, ee, maxDistance, order) {
    return new Promise(function (resolve, reject) {
        db.collection('driverlocations').find({
            "location.point": {
                $nearSphere: {
                    $geometry: order.location.point,
                    $maxDistance: maxDistance
                }
            }
            //已签到
            //"state.id": 30
        }).limit(2).toArray(function (err, driverlocations) {
            if (err)reject(err);
            if (driverlocations) {
                order.driverlocations = driverlocations;
                ee.emit('findEmployee', order);
            } else {
                ee.emit('noFindEmployee', order);
            }
            resolve(order);
        });
    });
};

weapp.httpsGet = function (url) {
    return new Promise(function (resolve, reject) {
        https.get(url, (res) => {
            var bufferHelper = new BufferHelper();
            res.on('data', (chunk) => {
                //console.log(`BODY: ${chunk}`);
                bufferHelper.concat(chunk);
            });
            res.on('end', ()=> {
                var html = bufferHelper.toBuffer().toString();
                var _res = JSON.parse(html);
                resolve(_res);
            });
        }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
            reject(e);
        });
    });
};

weapp.sentTemplate = function (token, data) {

    var postData = JSON.stringify(data);
    var options = {
        hostname: 'api.weixin.qq.com',
        port: 443,
        path: `/cgi-bin/message/wxopen/template/send?access_token=${token}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise(function (resolve, reject) {
        var req = https.request(options, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);

            var bufferHelper = new BufferHelper();
            res.on('data', (chunk) => {
                //console.log(`BODY: ${chunk}`);
                bufferHelper.concat(chunk);
            });
            res.on('end', ()=> {
                var html = bufferHelper.toBuffer().toString();
                var _res = JSON.parse(html);
                resolve(_res);
            });
        });

        req.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        req.write(postData);
        req.end();
    });
};

/**
 * 转换毫秒到小时分钟秒
 * @param msd
 * @returns {*}
 */
function secondToDate(msd) {
    //毫秒
    var time = parseFloat(msd) / 1000;
    //秒
    //var time = msd;
    if (null != time && "" != time) {
        if (time > 60 && time < 60 * 60) {
            time = parseInt(time / 60.0) + "分钟" + parseInt((parseFloat(time / 60.0) -
                    parseInt(time / 60.0)) * 60) + "秒";
        }
        else if (time >= 60 * 60 && time < 60 * 60 * 24) {
            time = parseInt(time / 3600.0) + "小时" + parseInt((parseFloat(time / 3600.0) -
                    parseInt(time / 3600.0)) * 60) + "分钟" +
                parseInt((parseFloat((parseFloat(time / 3600.0) - parseInt(time / 3600.0)) * 60) -
                    parseInt((parseFloat(time / 3600.0) - parseInt(time / 3600.0)) * 60)) * 60) + "秒";
        }
        else {
            time = parseInt(time) + "秒";
        }
    }
    return time;
}

/**
 * 转换秒到小时及分钟
 * @param second
 * @returns {string}
 */
function secondToMinute(second) {
    var h = 0;
    var d = 0;
    var s = 0;
    var temp = second % 3600;
    if (second > 3600) {
        h = second / 3600;
        if (temp != 0) {
            if (temp > 60) {
                d = temp / 60;
                if (temp % 60 != 0) {
                    s = temp % 60;
                }
            } else {
                s = temp;
            }
        }
    } else {
        d = second / 60;
        if (second % 60 != 0) {
            s = second % 60;
        }
    }
    //return h+"时"+d+"分"+s+"秒";
    return Math.round(h) + "小时" + Math.round(d) + "分";
}

/**

 * approx distance between two points on earth ellipsoid

 * @param {Object} lat1

 * @param {Object} lng1

 * @param {Object} lat2

 * @param {Object} lng2

 */
function getFlatternDistance(lng1, lat1, lng2, lat2) {

    var EARTH_RADIUS = 6378137.0;    //单位M
    var PI = Math.PI;

    function getRad(d) {
        return d * PI / 180.0;
    }

    var f = getRad((lat1 + lat2) / 2);
    var g = getRad((lat1 - lat2) / 2);
    var l = getRad((lng1 - lng2) / 2);

    var sg = Math.sin(g);
    var sl = Math.sin(l);
    var sf = Math.sin(f);

    var s, c, w, r, d, h1, h2;
    var a = EARTH_RADIUS;
    var fl = 1 / 298.257;

    sg = sg * sg;
    sl = sl * sl;
    sf = sf * sf;

    s = sg * (1 - sl) + (1 - sf) * sl;
    c = (1 - sg) * (1 - sl) + sf * sl;

    w = Math.atan(Math.sqrt(s / c));
    r = Math.sqrt(s * c) / w;
    d = 2 * w * a;
    h1 = (3 * r - 1) / 2 / c;
    h2 = (3 * r + 1) / 2 / s;

    var distance = d * (1 + fl * (h1 * sf * (1 - sg) - h2 * (1 - sf) * sg));
    return (distance / 1000).toFixed(2);
}

function syncTimeout(m, n, t, call) {
    if (n === 0)return true;
    call(m);
    setTimeout(()=>syncTimeout(m + 1, n - 1, t, call), t);
}
//syncTimeout(0, 5, 500, console.log);
function arraySync(arr, time) {
    var time2 = time || 500;
    return function (call) {
        var call2 = function (m) {
            call(arr[m]);
        };
        return syncTimeout(0, arr.length, time2, call2);
    };
}
//var arr = ['a','b','c','d','e'];
//arraySyncTimeout(arr)(console.log);

function sendText(api) {
    return function (user) {
        return new Promise(function (resolve, reject) {
            api.sendText(openid, user.rep, function (err, result) {
                assert.equal(null, err);
                if (err)reject(err);
                resolve(user);
            });
        });
    };
}

module.exports.weapp = weapp;