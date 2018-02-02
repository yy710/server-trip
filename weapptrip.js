"use strict";

var assert = require('assert');
var xml2js = require('xml2js');
var https = require('https');
var fs = require('fs');
var express = require('express');
var app = express();
var location = require('./location.js').location;
var EventProxy = require('eventproxy');
var weapp = require('./common.js').weapp;
var order = require('./order.js').order;
var passenger = require('./passenger.js').passenger;
var wechat = require('wechat');
var session = require('./session.js').session;
var MongoClient = require('mongodb').MongoClient;

var tripConfig = {
    token: 'node.jsForWeappTrip',
    appid: 'wx0446424df5ec3069',
    appsecret: '23fc46fc4564b292e1947d1d627b32eb'
};
var sfrfConfig = {
    token: 'nodejsForSfrf',
    appid: 'wx582b3ee9e0e107bb',
    appsecret: 'ae25706cbb3e301c77d0c433e2dbbb06'
};

//wechat 公众号 server 认证
app.use('/weapptrip', wechat(tripConfig, function (req, res, next) {
    res.reply("weappTrip ok!");
    // 微信输入信息都在req.weixin上
    const message = req.weixin;
    console.log(message);//debug
    //const openid = message.FromUserName;
    //var ep = new EventProxy();
}));
app.post('/sfrf', wechat(sfrfConfig, function (req, res, next) {
    res.reply("sfrf ok!");
    // 微信输入信息都在req.weixin上
    const message = req.weixin;
    console.log(message);//debug
    //const openid = message.FromUserName;
    //var ep = new EventProxy();
}));

var WXPay = require('weixin-pay');
var wxpay = WXPay({
    appid: 'wx0446424df5ec3069',
    mch_id: '1355430002',
    partner_key: 'xNHSYZbIlaNmzNeWmJemp2HHzpGjnFds' //微信商户平台API密钥
    //pfx: fs.readFileSync('./wxpay_cert.p12') //微信商户平台证书
    //notify_url: 'https://www.all-ecar.net/wxpayNotify',
    //spbill_create_ip: '120.76.29.184'
});

//this moudle no repaly wechat notify callback
/*
 var Tenpay = require('tenpay');
 var config = {
 appid: 'wx0446424df5ec3069',
 mchid: '1355430002',
 partnerKey: 'xNHSYZbIlaNmzNeWmJemp2HHzpGjnFds',
 //pfx: require('fs').readFileSync('证书文件路径'),
 notify_url: 'https://www.all-ecar.net/wxpayNotify',
 spbill_create_ip: '120.76.29.184'
 };
 var tenpay = new Tenpay(config);
 */

app.use(function (req, res, next) {
    console.log("req.url: ", req.url);
    //console.log("req.query: ", req.query);
    req.sid = req.query.sid ? req.query.sid : null;
    next();
});

var router1 = express.Router();
var router2 = express.Router();
app.use('/a', router1);
app.use('/b', router2);

router1.get('/test', function (req, res, next) {
    res.send({msg: "/a", sid: req.sid});
});
router2.get('/test', function (req, res, next) {
    res.json({msg: "/b", sid: req.sid});
});


/**
 * 初始化数据库参数
 */
MongoClient.connect('mongodb://localhost:3000/weapptrip', function (err, db) {
    assert.equal(null, err);

    /**
     *  debug, get accessToken and all common progress
     */
    app.use(function (req, res, next) {
        req.db = db;
        //get access_token and save to mongodb
        weapp.getAccessToken(db, tripConfig).then(r => {
            tripConfig.accesstoken = r;
            req.tripConfig = tripConfig;
            console.log("req.tripConfig: ", req.tripConfig);
        }).catch(log);
        next();
    });

    //get json from query
    app.use('/order', function (req, res, next) {
        req.order = JSON.parse(req.query.order);//order 有二级 json 结构时需用 parse
        //req.sid = req.query.sid;
        //req.order = req.query.order;
        next();
    });
    app.use('/order', order.checkOrder);
    app.use('/order', order.acceptOrder);
    app.use('/order', order.getUserInfo);
    app.use('/order', order.findDrivers);
    app.use('/order', order.saveOrder);
    app.use('/order', order.sendTemplate);
    app.use('/order', order.reply);

    /**
     * 获得用户 openid
     */
    app.use('/onLogin', passenger.getSessionKey(tripConfig));
    app.use('/onLogin', passenger.decryptUserData);
    app.use('/onLogin', passenger.saveSession);
    app.use('/onLogin', passenger.reply);//回复客户端

    app.use('/chklogin', function (req, res, next) {
        //console.log("req.query.sid: ", req.query.sid);
        db.collection('sessions').find({sid: Number(req.query.sid)}).limit(1).next(function (err, doc) {
            assert.equal(null, err);
            console.log(doc);
            res.send({isLogin: !!doc});
        });

    });

    app.get('/nav', function (req, res, next) {
        var points = JSON.parse(req.query.points);
        var ep = new EventProxy();

        //get location object array
        var locs = [location.new(points[0]), location.new(points[1])];

        location.getNavInfo(locs).then(r=> {
            r.start = locs[0].label;
            r.destination = locs[1].label;
            console.log(r);
            res.send(r);
        }).catch(console.log);

        /* asyc get label from location array
         ep.all('getLabel_0', 'getLabel_1', function (getLabel_0, getLabel_1) {
         var locs = [getLabel_0, getLabel_1];
         location.getNavInfo(locs).then(a=> {
         a.start = locs[0].label;
         a.destination = locs[1].label;
         console.log(a);
         res.send(a);
         }).catch(console.log);
         });

         points.forEach(function (item, index) {
         location.getLabel(location.new(item)).then(function (loc) {
         ep.emit('getLabel_' + index, loc);
         });

         });
         */

        /*
         location.getLabel(location.new(points[0])).then(function(loc){
         ep.emit('getLabel_0', loc);
         });

         location.getLabel(location.new(points[1])).then(function(loc){
         ep.emit('getLabel_1', loc);
         });
         */

    });

    app.get('/getTaxiOrders', session.find, order.getTaxiOrders, (req, res, next)=>res.send(req.taxiOrders));
    app.get('/getBusOrders', session.find, order.getBusOrders, (req, res, next)=>res.send(req.busOrders));

    //app.use('/adopt', dispatch.checkOrder);
    //app.use('/adopt', dispatch.updateOrder);
    //app.use('/adopt', dispatch.sendTemplate);
    //app.user('/adopt', dispatch.noticeDriver);

    app.use('/getLabel', function (req, res, next) {
        var point = req.query;
        let loc = location.new(point);
        location.getLabel(loc)
            .then(r=> {
                point.label = r.label;
                res.send(point)
            })
            .catch(r=> {
                point.label = "未能获取到地址名称！";
                res.send(point)
            });
    });

    //tenpay moudle
    /*
     var tenpayMiddleware = tenpay.middlewareForExpress();
     app.use('/wxpayNotify', tenpayMiddleware, function (req, res, next) {
     var payInfo = req.weixin;
     console.log("payInfo", payInfo);

     var buildXML = function (json) {
     var builder = new xml2js.Builder();
     return builder.buildObject(json);
     };

     res.end(buildXML({xml: {return_code: 'SUCCESS'}}));//or buildXML({ xml:{ return_code:'FAIL' } }));
     });
     */

    app.use('/wxpayNotify', wxpay.useWXCallback(function (msg, req, res, next) {
        console.log("wxpayNotify: ", msg);
        // 处理商户业务逻辑
        var orderId = msg.out_trade_no;
        var col1 = db.collection('busorders');
        var col2 = db.collection('buses');

        var pushOrderStatus = function (col, id) {
            return function (status) {
                statuses.updateTime = (new Date()).toLocaleString();
                return col.findOneAndUpdate({orderid: id}, {$push: {statuses: statuses}});
            };
        };

        var addBusesTickes = function (col, busid, amount) {
            return col.findOneAndUpdate({id: busid}, {$inc: {tickes: amount}});
        };

        var pushStatus = pushOrderStatus(col1, orderId);

        if (msg.result_code === 'SUCCESS') {
            pushStatus({id: "payed", msg: "订单已支付"}).then(r=> {
                console.log("from notify order", r);
                addBusesTickes(col2, r.value.bus.id, -r.value.amount).then(log);
                //col2.findOneAndUpdate({id: r.value.bus.id}, {$inc: {tickes: -r.value.amount}}).then(log);
            }).catch(log);
            // res.success() 向微信返回处理成功信息，res.fail()返回失败信息。
            res.success();
        } else {
            pushStatus({id: "payFailed", msg: "订单支付失败"}).catch(log);
            res.fail();
            //res.send({booked: false, msg: "failed!"});
        }
    }));

    app.use('/book', session.find);
    //app.use('/book', verifyPhone);
    /**
     * reorganize book data
     */
    app.use('/book', function (req, res, next) {
        if (!req.session) {
            res.send("error: no login!");
        } else {
            //var book = JSON.parse(req.query.book);
            let book = req.query;
            let bus = JSON.parse(book.bus);
            book.bus = bus;
            console.log("book ", book);
            req.book = book;
            next();
        }
    });
    //app.use('/book', busOrder.checkOrder);
    app.use('/book', function (req, res, next) {
        var db = req.db;
        var order = req.book;
        order.orderid = '20170413' + Math.random().toString().substr(2, 10);
        order.openid = req.session.openid;
        order.statuses = [];
        order.statuses.push({id: "new", msg: "系统已接受订单", updateTime: (new Date()).toLocaleString()});
        req.order = order;

        db.collection("busorders").insertOne(order).then(r=>next()).catch(console.log);

    });
    app.use('/book', function (req, res, next) {
        wxpay.getBrandWCPayRequestParams({
            openid: req.order.openid,
            body: '预定' + req.order.bookName + '车票',
            //detail: req.order.bookName,
            out_trade_no: req.order.orderid,
            total_fee: 1,//req.order.prices,
            spbill_create_ip: '120.76.29.184',
            notify_url: 'https://www.all-ecar.net/wxpayNotify'
        }, function (err, result) {
            // in express
            if (err) {
                console.log("wxpay failed!");
                res.end({booked: false, msg: "get unipay failed!", payres: null});
            } else {
                console.log("wxpay res: ", result);
                res.send({booked: true, msg: "ok!", payres: result});
            }
        });

        //tenpay moudle
        /*
         let order = {
         out_trade_no: '20170412' + Math.random().toString().substr(2, 10),
         body: '小程序支付测试',
         total_fee: 1,
         openid: req.session.openid
         };
         tenpay.getPayParams(order).then(r=> {
         console.log("tenpay res: ", r);
         res.send({booked: true, msg: "ok!", payres: r})
         }).catch(log);
         */
    });


    /**
     * verify session is valid
     */
    app.use('/verifySid', session.find);
    app.use('/verifySid', function (req, res, next) {
        res.send({valid: !!req.session});
    });

    app.get('/getBuses', function (req, res, next) {
        var sid = req.query.sid;
        db.collection('buses').find({}).toArray(function (err, doc) {
            assert.equal(null, err);
            res.send(doc);
        });
    });
});


//---------------------------------------------------------------------------------------
let routerSfrf = require('./sfrf.js').setRouter(express.Router());
app.use('/sfrf', initDb('mongodb://localhost:3000/sfrf'), routerSfrf);

let routerTrip = require('./trip.js').setRouter(express.Router());
app.use('/trip', initDb('mongodb://localhost:3000/weapptrip'), routerTrip);



//---------------------------------------------------------------------------------------
var options = {
    key: fs.readFileSync('./cert/214010334300719.key'),
    //ca: [fs.readFileSync('./ca/ca.crt')],
    cert: fs.readFileSync('./cert/214010334300719.pem')
};
var port = 443;
var server = https.createServer(options, app);
server.listen(port, function () {
    console.log('https server is running on port ', port);
});


//---------------------------------------------------------------------------------------
/**
 * promise pip log
 * @param res
 * @returns {Promise}
 */
function log(res) {
    return new Promise(function (resolve, reject) {
        console.log(res);
        resolve(res);
    });
}

/**
 * middleware for mongodb
 * @param dbUrl
 * @returns {Function}
 */
function initDb(dbUrl) {
    return function (req, res, next) {
        MongoClient.connect(dbUrl, function (err, db) {
            assert.equal(null, err);
            /**
             *  debug, get accessToken and all common progress
             */
            req.db = db;
            next();
        });
    };
}