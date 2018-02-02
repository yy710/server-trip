/**
 * Created by yy710 on 22/02/2017.
 */
'use strict';

/** req.order struct
 {
     sid: 'f34fe8be1c7b1f45d9c6149e9a299b4c',
     order: {
         "nav": {
             "distance": 2.685,
             "duration": "0小时4分",
             "start": "云南省普洱市思茅区",
             "destination": "云南省普洱市思茅区永平路思茅区普洱公路管理总段(湿地公园西北)"
         },
         "phone": "222",
         "formId": "the formId is a mock one",
         "points": [{
             "latitude": "22.825066",
             "longitude": "100.966512",
             "label": "云南省普洱市思茅区"
         }, {
             "latitude": 22.811893616081022,
             "longitude": 100.96719864550778,
             "label": "云南省普洱市思茅区永平路思茅区普洱公路管理总段(湿地公园西北)"
         }],
         status: { id: "finished", msg: "已完成订单", date: "2017-09-10"},
         driver: {}
     }
 }

 {
    "nav": {
        "distance": 8.566,
        "duration": "0小时10分",
        "start": "云南省普洱市思茅区迎春巷",
        "destination": "云南省普洱市思茅区南屏镇昆磨高速公路芒昔农场芒昔农场"
    },
    "phone": "999",
    "formId": "ebae9accb5438914b8031c0de23e4c79",
    "orderId": 1504887378707,
    "acceptTime": "2017-9-9 00:16:18",
    "status": {"id": "waitingDriver", "msg": "已找到附近司机,等待回应..."},
    "userInfo": {
        "nickName": "学游泳的鱼",
        "gender": 1,
        "language": "zh_CN",
        "city": "Kunming",
        "province": "Yunnan",
        "country": "China",
        "avatarUrl": "https://wx.qlogo.cn/mmopen/vi_32/phnEmic0vRm0sFzsF2ugLa4opqNjpVKCgeqXqKAwcHFbU6YgI8Qpnlibib6Y55fGHQbE2ObmsmNMZhk2tfNoF5S8Q/0",
        "watermark": {"timestamp": 1504886222, "appid": "wx8a2a674d6018fdc7"}
    },
    "drivers": [{
        "openid": "o_VMZwO9sFdY2VmlNnmxeQnvcB3w",
        "location": {"point": {"type": "Point", "coordinates": [100.973312, 22.771353]}, "label": null},
        "updatetime": ISODate("2017-09-08T16:10:59.396Z"),
        "name": "(中)黄文忠",
        "phone": "18236898559",
        "carid": "云A12345",
        "rate": 1,
        "online": true,
        "picurl": "https://www.xingshenxunjiechuxing.com/images/byd-tang.jpg"
    }]
};
 **/

let order = {};
let assert = require('assert');
let location = require('./location.js').location;
let weapp = require('./common.js').weapp;
let user = require('./user').user;
let WechatAPI = require('wechat-api');
let EventProxy = require('eventproxy');

/**
 * creat 订单号
 * @param req
 * @param res
 * @param next
 */
order.createOrderId = function (req, res, next) {
    req.data.order = JSON.parse(req.query.order);//order 有二级 json 结构时需用 parse
    req.data.order.orderId = Date.now() + Math.round(Math.random() * 1000);//生成13位数字随机数, 采用时间加随机数算法, 用于订单号;
    next();
};

/**
 * 加入监听事件
 * @param req
 * @param res
 * @param next
 */
order.eventOn = function (req, res, next) {
    /**
     * 初始化司机端服务号接口
     * @type {*}
     */
    let driversAPI = new WechatAPI('wx977eb7e3ce0619c6', 'c7931d20dd605e4ef0d208c08e054285');
    //传入监听对象
    let ep = new EventProxy();
    req.data.ep = ep;

    //注册监听函数，监听找到司机事件
    ep.once("findDrivers", function (order) {

        /**
         * 发送派单通知到司机
         */
        order.drivers.forEach(function (driver) {
            //注意正式使用时修改为 driver.openid
            driversAPI.sendText(driver.openid, '你好！' + driver.name + ': ' +  order.navTxt[0], function (err, result) {
                assert.equal(null, err);
                //更改司机状态
                driver.order = {orderId: order.orderId, status: "noticed", msg: '已收到接单通知', updateTime: Date.now()};//更改订单状态
                //保存订单
                req.db.collection('drivers').replaceOne({"openid": driver.openid}, driver, {
                    upsert: false,
                    w: 1
                }).catch(log);
                //在 employee 中 push orderid to orderids
            });
        });
    });

    next();
};

/**
 * 检查用户是否有未处理订单
 * @param req
 * @param res
 * @param next
 */
order.checkOrder = function (req, res, next) {
    req.data.user.status.id === "normal" ? next() : req.data.ep.emit("invalidOrder", req.data.order);
};

/**
 * 接受用户订单
 * @param req
 * @param res
 * @param next
 */
order.acceptOrder = function (req, res, next) {
    let _order = req.data.order;
    _order.acceptTime = (new Date()).toLocaleString();
    _order.status = {id: "acceptOrder", msg: "系统已接受出行订单, 正在为您查找附近的司机...", date: new Date()};

    /**
     * 组装mongodb坐标
     * @type {{point, label}|Promise}
     */
    let dloc = location.new({
        longitude: _order.points[1].longitude,
        latitude: _order.points[1].latitude
    });
    let sloc = location.new({
        longitude: _order.points[0].longitude,
        latitude: _order.points[0].latitude
    });

    //获得腾讯地图导航链接
    let dNavUrl = location.getTXnavURL(dloc);
    let sNavUrl = location.getTXnavURL(sloc);

    //let act = `https://www.xingshenxunjiechuxing.com/trip/orderAccept?orderid=${order.orderId}&driverid=${driver.openid}&nav=${nav}`;
    let txt1 = `附近有新的出行订单!, 出发地: ${ _order.nav.start}, 目的地: ${_order.nav.destination}, 请点击下方 我要抢单`;
    let txt2 = `已接受出行订单，客户电话: ${_order.phone}, 本次出行里程为${_order.nav.distance}公里, 预计需时${_order.nav.duration}, <a href="${sNavUrl}"> 点此处导航到客户出发地点 </a>, <a href="${dNavUrl}"> 点此处导航到目的地点 </a>`;
    _order.navTxt = [txt1, txt2];

    req.data.order = _order;
    next();
};

/**
 * get 用户会话信息
 * @param req
 * @param res
 * @param next
 */
order.getUserInfo = function (req, res, next) {
    let _order = req.data.order;
    req.db.collection('sessions').find({sid: req.query.sid}).limit(1).next(function (err, doc) {
        assert.equal(null, err);
        _order.userInfo = doc ? doc.decryptedData : null;
        req.data.order = _order;
        next();
    });
};

/**
 * 按距离查找司机
 * @param req
 * @param res
 * @param next
 */
order.findDrivers = function (req, res, next) {

    let that = this;
    let db = req.db;
    let _order = req.data.order;
    //console.log("req.data.order", _order);

    /**
     * 组装mongodb坐标
     * @type {{point, label}|Promise}
     */
    let loc = location.new({
        longitude: _order.points[0].longitude,
        latitude: _order.points[0].latitude
    });

    db.collection('drivers').find({
            "online": true,
            "busy": false,
            "location.point": {
                $nearSphere: {
                    $geometry: loc.point,
                    $maxDistance: 50000
                }
            }
        },
        {"_id": 0}).limit(20).toArray(function (err, drivers) {
        assert.equal(null, err);
        console.log("find Drivers: ", drivers);
        _order.drivers = drivers || [];//return empty arrary to setDate in weapp pages

        if (!Array.isArray(drivers) || drivers.length === 0) {
            _order.status = {id: "noFindDriver", msg: "在指定范围内未找到司机!请稍等，系统会再次查找。。。", date: new Date()};
            _order.findStatus = {findDrivers: false, findCount: 1};//查找失败一次
            req.data.ep.emit("noFindDriver", _order);
        } else {
            _order.status = {id: 'waitingDriver', msg: '已找到附近司机,等待回应...', date: new Date()};
            _order.findStatus = {findDrivers: true, findCount: 1};//查找成功一次
            req.data.ep.emit("findDrivers", _order);
        }
        req.data.order = _order;

        next();
    });
};

/**
 * 保存用户订单
 * @param req
 * @param res
 * @param next
 */
order.saveOrder = function (req, res, next) {
    delete req.data.order.points;
    let _order = req.data.order;
    //write req.order to mongodb
    req.db.collection('orders').replaceOne(
        {"id": _order.id},
        _order,
        {upsert: true, w: 1}
    ).then(r => next()).catch(console.log);
};

/**
 * 发送模板消息
 * @param req
 * @param res
 * @param next
 */
order.sendTemplate = function (req, res, next) {
    let _order = req.data.order;
    if (_order.findStatus.findDrivers) {
        //定义行程模板消息数据结构
        let trip = {
            "touser": _order.userInfo.openId,
            "template_id": "okU5RcKohHHqum2obMpObL0WzvHP2q5sRTgy_AS9w0k",
            "page": "pages/my/my",
            "form_id": _order.formId,
            "data": {
                //行程日期
                "keyword1": {
                    "value": _order.acceptTime,
                    "color": "#173177"
                },
                //行程起点
                "keyword2": {
                    "value": _order.nav.start,
                    "color": "#173177"
                },
                //行程地点
                "keyword3": {
                    "value": _order.nav.destination,
                    "color": "#173177"
                },
                //司机姓名
                "keyword4": {
                    "value": _order.drivers[0].name,
                    "color": "#173177"
                },
                //车牌号码
                "keyword5": {
                    "value": _order.drivers[0].carid,
                    "color": "#ED5D15"
                },
                //行程状态
                "keyword6": {
                    "value": _order.status.msg,
                    "color": "#173177"
                },
                //行程备注
                "keyword7": {
                    "value": `距离${_order.nav.distance}公里, 预计需时${_order.nav.duration}可到达...`,
                    "color": "#173177"
                }
            },
            "emphasis_keyword": "keyword5.DATA"
        };

        //console.log("req.tripConfig: ", req.tripConfig);
        console.log("order.sendTemplate()/trip: ", trip);
        weapp.sentTemplate(req.tripConfig.accesstoken, trip).then(log).catch(console.log);
    }
    next();
};

/**
 * 回复客户端
 * @param req
 * @param res
 * @param next
 */
order.reply = function (req, res, next) {
    //req.order.status = {id: true, msg: '已找到出发地附近5公里范围内司机!'};
    res.send(req.data.order);
};

/**
 * 获得 打车价格计算函数
 * @param req
 * @param res
 * @param next
 */
order.getPrice = function (req, res, next) {

    req.db.collection('config')
        .find({ }, {"_id": 0, "taxiPrice": 1})
        .limit(1)
        .next()
        .then(doc=>{
            function fc(conf) {
                return function (distance) {
                    return Number(conf.starting) + Number(conf.unit * distance);
                };
            }
            req.data.getTaxiPrice = fc(doc.taxiPrice);
            next();
        })
        .catch(log);
};

/**
 * get 打车订单
 * @param req
 * @param res
 * @param next
 */
order.getTaxiOrders = function (req, res, next) {
    var openid = req.session.openid;
    var db = req.db;

    db.collection('orders')
        .find({"userInfo.openId": openid})
        .toArray()
        .then(r => {
            req.taxiOrders = r;
            next();
        })
        .catch(log)
};

/**
 * get 未支付打车订单
 * @param req
 * @param res
 * @param next
 */
order.getTaxiOrdersOfNoPay = function (req, res, next) {
    let openid = req.session.openid;
    let db = req.db;

    db.collection('orders')
        .find({"userInfo.openId": openid, "status.id": {$ne: "payed"}})
        .toArray()
        .then(r => {
            req.data.taxiOrdersOfNoPay = r;
            next();
        })
        .catch(log)
};

/**
 * get 已开始出行订单
 * @param req
 * @param res
 * @param next
 */
order.getTaxiOrdersOfTripStart = function (req, res, next) {
    let openid = req.session.openid;
    let db = req.db;

    db.collection('orders')
        .find({"userInfo.openId": openid, "status.id": "tripStart"})
        .toArray()
        .then(r => {
            if(r.length >= 1){
                req.data.user.status = {id: "unNormal", msg: "不可下单客户"};//设置用户不能下单
                let _user = req.data.user;
                req.db.collection("users")
                    .replaceOne({phone: _user.phone}, _user, {upsert: true, w: 1})
                    //.then(r => next())
                    .catch(log);
            }
            req.data.taxiOrdersOfTripStart = r;
            next();
        })
        .catch(log)
};

order.getBusOrders = function (req, res, next) {
    var openid = req.session.openid;
    var db = req.db;

    db.collection('busorders')
        .find({"openid": openid})
        .toArray()
        .then(r => {
            req.busOrders = r;
            next();
        })
        .catch(log)
};


order.fromOrderId = function(req, res, next){
    req.db.collection('orders')
        //.find({"orderId": req.query.orderId, "userInfo.openid": req.data.session.openid})
        .find({"orderId": Number(req.query.orderId)})
        .limit(1)
        .next()
        .then(doc=>{
            req.data.order = doc;
            next();
        })
        .catch(log);
};

var busOrder = {collectionName: 'busorders'};
busOrder.findOrderFromDb = function (req, res, next) {
    var orderId = req.orderId;
    var col = req.db.collection(this.collectionName);

    col.find({orderid: orderId})
        .limit(1)
        .next()
        .then(r => {
            req.busOrder = r;
            next();
        })
        .catch(console.log);
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

//--------------------------------------------------------------------
module.exports.order = order;
module.exports.busOrder = busOrder;