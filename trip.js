/**
 * Created by yy710 on 01/05/2017.
 */
"use strict";

let assert = require('assert');
let order = require('./order.js').order;
let session = require('./session.js').session;
let weapp = require('./common.js').weapp;
let location = require('./location.js').location;
let EventProxy = require('eventproxy');
let user = require('./user.js').user;
let WXPay = require('weixin-pay');
let WechatAPI = require('wechat-api');
const wxpay = WXPay({
    appid: 'wx8a2a674d6018fdc7',
    mch_id: '1485540692',
    partner_key: 'xingshenxunjiechuxingzszx2133314', //微信商户平台API密钥
    //pfx: fs.readFileSync('./wxpay_cert.p12') //微信商户平台证书
    notify_url: 'https://www.xingshenxunjiechuxing/trip/wxpayNotify',
    spbill_create_ip: '39.108.1.78'
});

/**
 * 此处传入一个 router 对象,或者 express?
 * @param router
 * @returns {*}
 */
exports.setRouter = function (router) {
    const config = {
        token: 'node.jsForWeappTrip',
        appid: 'wx8a2a674d6018fdc7',
        appsecret: 'c1d496d95aacca6cc1c95531abfca0f8'
    };
    let _router = router;

    /**
     *  get access_token and save to mongodb
     */
    _router.use(function (req, res, next) {
        weapp.getAccessToken(req.db, config).then(r => {
            req.tripConfig = config;
            req.tripConfig.accesstoken = r;
            //console.log("req.tripConfig: ", req.tripConfig);
            next();
        }).catch(log);
    });


    _router.use('/getUserPhones', session.find, function (req,res,next) {

        req.db.collection("user")
            .find({"openid": req.session.openid})
            .limit(1)
            .next()
            .then(r=>{

                res.send({"phones": [req.data.user.phone]});
            })
            .catch(log);
    });

    _router.use('/orderAccept', function (req, res, next) {

    });

    _router.use('/getDriver', session.find, order.getTaxiOrdersOfNoPay, function (req, res, next) {
        let drivers = req.data.taxiOrdersOfNoPay[0].drivers;
        let driver = {
            title: "即将为你服务的司机",
            photo: drivers[0].picurl,
            carid: drivers[0].carid,
            phone: drivers[0].phone,
            name: drivers[0].name || "",
            desc: "我们的专车司机将很快赶到，请稍候！"
        };
        res.send(driver);
    });

    _router.use('/payTaxiOrder', session.find, order.fromOrderId);
    _router.use('/payTaxiOrder', function (req, res, next) {
        let _order = req.data.order;
        if (_order) {
            let config = {
                openid: _order.userInfo.openId,
                body: '支付出行订单: ' + _order.orderId,
                //detail: req.order.bookName,
                out_trade_no: _order.orderId,
                total_fee: 1, // Number(_order.nav.prices)*100,
                spbill_create_ip: '39.108.1.78',
                notify_url: 'https://www.xingshenxunjiechuxing.com/trip/wxpayNotify'
            };
            //console.log("weixinPay Config: ", config);

            wxpay.getBrandWCPayRequestParams(config, function (err, result) {
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
        }

    });

    //get json from query and init order object
    _router.use('/order', order.createOrderId);
    _router.use('/order', order.eventOn);
    _router.use('/order', user.getOrNewUser);
    _router.use('/order', order.checkOrder);
    _router.use('/order', order.acceptOrder);
    _router.use('/order', order.getUserInfo);
    _router.use('/order', order.findDrivers);
    _router.use('/order', order.saveOrder);
    //_router.use('/order', order.sendTemplate);
    _router.use('/order', user.update);
    _router.use('/order', order.reply);

    /**
     * 获得用户 openid
     */
    _router.use('/onLogin', session.getSessionKey(config));
    _router.use('/onLogin', session.decryptUserData);
    _router.use('/onLogin', session.saveSession);
    _router.use('/onLogin', session.reply);//回复客户端

    _router.use('/chklogin', function (req, res, next) {
        //console.log("req.query.sid: ", req.query.sid);
        db.collection('sessions').find({sid: Number(req.query.sid)}).limit(1).next(function (err, doc) {
            assert.equal(null, err);
            console.log(doc);
            res.send({isLogin: !!doc});
        });

    });

    /**
     * 获得导航信息
     */
    _router.get('/nav', order.getPrice, function (req, res, next) {
        let points = JSON.parse(req.query.points);
        //var ep = new EventProxy();
        let locs = [location.new(points[0]), location.new(points[1])];

        location.getNavInfo(locs).then(r => {
            //console.log("location.getNavInfo(locs): ", r);
            r.start = locs[0].label;
            r.destination = locs[1].label;
            r.prices = req.data.getTaxiPrice(r.distance);
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

    _router.get('/getTaxiOrders', session.find, order.getTaxiOrders, order.getPrice, (req, res, next) => {
        //console.log(req.taxiOrders);
        let _orders = req.taxiOrders.map(function (order) {
            if (order.status.id !== "payed") {
                return {
                    "orderId": order.orderId,
                    "status": order.status.msg,
                    "payStatus": order.payStatus || "未支付",
                    "desc": `本次出行从 ${order.nav.start} 到 ${order.nav.destination} 共计 ${order.nav.distance} 公里，需支付 ${req.data.getTaxiPrice(order.nav.distance)} 元`
                };
            }
        });
        req.data.taxiOrders = _orders;
        next();
    });
    _router.get('/getTaxiOrders', function (req, res, next) {
        /**
         * 数据接口
         * @type {[*]}
         */
        /*
         [
         {
         orderId: 12121212121,
         status: "已到达目的地",
         payStatus: "未支付",
         desc: "本次出行从 A 到 B 共计111公里，需支付费用30元，请点击支付！"
         }
         ]
         */

        res.send({"title": "我的出行订单", "orders": req.data.taxiOrders});
    });


    _router.get('/getBusOrders', session.find, order.getBusOrders, (req, res, next) => res.send(req.busOrders));

    //app.use('/adopt', dispatch.checkOrder);
    //app.use('/adopt', dispatch.updateOrder);
    //app.use('/adopt', dispatch.sendTemplate);
    //app.user('/adopt', dispatch.noticeDriver);

    _router.use('/getLabel', function (req, res, next) {
        var point = req.query;
        let loc = location.new(point);
        location.getLabel(loc)
            .then(r => {
                point.label = r.label;
                res.send(point)
            })
            .catch(r => {
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


    _router.use('/wxpayNotify', wxpay.useWXCallback(function (msg, req, res, next) {
        console.log("wxpayNotify: ", msg);
        msg.result_code === 'SUCCESS' ? res.success() : res.fail();


        // 处理商户业务逻辑 -----------------------------------------------------------------------------------------

        /*
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


         let pushStatus = pushOrderStatus(col1, orderId);

         if (msg.result_code === 'SUCCESS') {
         pushStatus({id: "payed", msg: "订单已支付"}).then(r => {
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
         */

    }));
    _router.use('/wxpayNotify', function (req, res, next) {
        console.log("开始商户业务逻辑处理");

    });


    _router.use('/book', session.find);
    //app.use('/book', verifyPhone);
    /**
     * reorganize book data
     */
    _router.use('/book', function (req, res, next) {
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
    _router.use('/book', function (req, res, next) {
        var db = req.db;
        var order = req.book;
        order.orderid = '20170413' + Math.random().toString().substr(2, 10);
        order.openid = req.session.openid;
        order.statuses = [];
        order.statuses.push({id: "new", msg: "系统已接受订单", updateTime: (new Date()).toLocaleString()});
        req.order = order;

        db.collection("busorders").insertOne(order).then(r => next()).catch(console.log);

    });
    _router.use('/book', function (req, res, next) {
        wxpay.getBrandWCPayRequestParams({
            openid: req.order.openid,
            body: '预定' + req.order.bookName + '车票',
            //detail: req.order.bookName,
            out_trade_no: req.order.orderid,
            total_fee: 1,//req.order.prices,
            spbill_create_ip: '39.108.1.78',//'120.76.29.184',
            notify_url: 'https://www.xingshenxunjiechuxing.com/trip/wxpayNotify'
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
    _router.use('/verifySid', session.find);
    _router.use('/verifySid', function (req, res, next) {
        res.send({valid: !!req.session});
    });

    _router.get('/getBuses', function (req, res, next) {
        var sid = req.query.sid;
        req.db.collection('buses').find({}).toArray(function (err, doc) {
            assert.equal(null, err);
            res.send(doc);
        });
    });

    return _router;
};

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