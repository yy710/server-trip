/**
 * Created by yy710 on 16/02/2017.
 *
 * driver = {
 * "_id" : ObjectId("59b04fca745ef53d68289857"),
 * "openid" : "o_iQd0eEZqmVInxK2Ytm-jVvDpjE",
 * "location" : {
 *     "point" : { "type" : "Point", "coordinates" : [ 100.966512, 22.825066 ] },
 *     "label" : " 普洱市政府"
 *     },
 * "updatetime" : ISODate("2017-09-06T19:43:06.720Z"),
 * "name" : "(中)黄文忠",
 * "phone" : "18236898559",
 * "carid" : "云A12345",
 * "rate" : 1,
 * "online" : true,
 * "picurl" : "https://www.xingshenxunjiechuxing.com/images/byd-tang.jpg"
 * "order"  : {orderId: "76574767657", status: "noticed|accepted|started\arrived", msg: '已收到接单通知', updateTime: Date.now()}
 * }
 *
 *
 */
'use strict';

let assert = require('assert');
let location = require('./location.js').location;
let weapp = require('./common.js').weapp;
let wechat = require('wechat');
let EventProxy = require('eventproxy');
let yb = require('./yb.js');
//let customer = yb.customer;
let employee = yb.employee;
//var order = yb.order;
//let log = yb.log;
//let arraySync = yb.arraySync;

//let SMS = require('./sms.js');
//let loginSMS = SMS.loginSMS;

const config = {
    token: 'node.jsForWeappTrip',
    appid: 'wx8a2a674d6018fdc7',
    appsecret: 'c1d496d95aacca6cc1c95531abfca0f8'
};

/**
 * 此处传入一个 router 对象,或者 express?
 * @param router
 * @returns {*}
 */
exports.setRouter = function (router) {

    let _router = router;
    const employeeConfig = {token: 'nodejsForXsxjmp', appid: 'wx977eb7e3ce0619c6'};

    _router.use(function (req, res, next) {
        weapp.getAccessToken(req.db, config).then(r => {
            req.tripConfig = config;
            req.tripConfig.accesstoken = r;
            //console.log("req.tripConfig: ", req.tripConfig);
            next();
        }).catch(log);
    });

    //-------------------------------------------------------------------------------------
    /**
     * 开始处理司机端公众号请求和事件
     */

    /**
     * 获得 driver 信息
     */
    _router.use('/', wechat(employeeConfig, function (req, res, next) {
        // 微信输入信息都在req.weixin上
        const message = req.weixin;
        console.log(message);//debug
        const openid = message.FromUserName;
        let db = req.db;

        /**
         * get 司机信息
         */
        db.collection('drivers')
            .find({openid: openid})
            .limit(1)
            .next()
            .then(function (driver) {
                console.log("Driver: ", driver);
                req.data.driver = driver || null;
                next();
            })
            .catch(log);
    }));

    /**
     * 相应事件
     */
    _router.use('/', function (req, res, next) {

        let db = req.db,
            driver = req.data.driver,
            replyText = "",
            ep = new EventProxy();

        // 微信输入信息都在req.weixin上
        const message = req.weixin;
        const openid = message.FromUserName;

        /**
         * 处理发送文本消息
         */
        if (message.MsgType === 'text') {
            let content = message.Content;
            //_employee.then(employee.getInput(ep, content)).then(employee.infoCheck(ep)).then(employee.save(db)).catch(console.log);
        }

        /**
         * 处理上报地理位置事件
         */
        if (message.Event === 'LOCATION') {
            //避免微信重复发送信息
            res.send("success");

            let loc = location.new({longitude: message.Longitude, latitude: message.Latitude});
            db.collection('drivers')
                .updateOne({openid: openid}, {$set: {location: loc}}, {upsert: false, w: 1})
                .catch(log);
        }

        /**
         * 处理点击 申请加入 按钮
         */
        if (message.EventKey === 'joinUs') {
            console.log('click joinUs!');
            replyText = driver ? "您已经是我们注册驾驶员，无需重复申请！" : "你的申请码：" + openid + " 请将此码出示给我们的工作人员";
            res.reply(replyText);
        }

        /**
         * 处理 开始接单 按钮
         */
        if (message.EventKey === 'login') {
            console.log('click login!');
            let replyText = "";
            if (driver) {
                driver.online = true;
                replyText = "现在可以接单！";

                db.collection('drivers')
                    .updateOne({openid: openid}, {$set: {online: true}}, {upsert: false, w: 1})
                    .catch(log);
            } else {
                replyText = "你尚未注册为正式驾驶员，请找我们服务人员注册！";
            }
            res.reply(replyText);
        }

        /**
         * 处理 取消接单 按钮
         */
        if (message.EventKey === 'logout') {
            console.log('click logout!');
            if (driver) {
                driver.online = false;
                replyText = "你已取消接单！";

                db.collection('drivers')
                    .updateOne({openid: openid}, {$set: {online: false}}, {upsert: false, w: 1})
                    .catch(log);
            } else {
                replyText = "你尚未注册为正式驾驶员，请找我们服务人员注册！";
            }
            res.reply(replyText);
        }

        /**
         * 处理 查询状态 菜单
         */
        if (message.EventKey === 'queryState') {
            console.log('click queryState!');
            if (driver) {
                replyText = driver.busy?"你有未到达订单，若已到达目的地，请点击 到达终点 按钮！":"";
                replyText += driver.online ? "你现在可正常接单" : "你今日尚未签到接单！";
            } else {
                replyText = "你尚未注册为正式驾驶员，请联系我们服务人员注册！";
            }
            res.reply(replyText);
        }

        /**
         * 处理 到达终点 菜单
         */
        if (message.EventKey === 'arrived') {
            console.log('click arrived!');
            if (driver) {
                if(driver.order.status === 'tripStart'){
                    driver.order.status = 'tripArrived';
                    driver.order.msg = '已到达目的地';
                    driver.order.updateTime = new Date();
                    driver.busy = false;
                    db.collection('drivers')
                        .replaceOne({"openid": driver.openid}, driver, {"upsert": false, "w": 1})
                        .then(r=>{
                            db.collection('orders')
                                .find({"orderId": driver.order.orderId})
                                .limit(1)
                                .next()
                                .then(order =>{
                                    order.status = {"id": "arrived", "msg": "已到达终点", "date": new Date()};
                                    order.drivers = [driver];

                                    db.collection('orders')
                                        .replaceOne({"orderId": driver.order.orderId}, order, { "upsert": false, "w": 1})
                                        .then(r => {
                                            res.reply("恭喜完成出行订单！");
                                            //sendTemplate(req.tripConfig.accesstoken, order);
                                        });
                                });
                        })
                        .catch(log);
                }else{
                    res.reply("你没有相关出行订单！");
                }

            } else {
                replyText = "你尚未注册为正式驾驶员，请联系我们服务人员注册！";
                res.reply(replyText);
            }
        }

        /**
         * 我要抢单
         */
        if (message.EventKey === 'ordersAccept') {
            console.log('click orderAccept!');
            if (driver) {
                let orderId = driver.order.orderId;
                //拿到订单数据
                db.collection('orders')
                    .find({"orderId": orderId})
                    .limit(1)
                    .next()
                    .then(order => {
                        //可抢订单
                        if (order.status.id === "waitingDriver") {
                            //更改订单状态
                            order.status = {"id": "tripStart", "msg": "出行开始", "date": new Date()};
                            //删除订单其余司机数据
                            order.drivers = [driver];
                            //保存订单到数据库
                            db.collection('orders')
                                .replaceOne({"orderId": orderId}, order, { "upsert": false, "w": 1})
                                .then(r => {
                                    //修改并保存司机信息
                                    driver.busy = true;
                                    driver.order.status = "tripStart";
                                    driver.order.msg = "出行开始";
                                    driver.order.updateTime = new Date();
                                    db.collection('drivers')
                                        .replaceOne({"openid": driver.openid}, driver, {"upsert": false, "w": 1})
                                        .then(r=>{
                                            res.reply(order.navTxt[1]);
                                            sendTemplate(req.tripConfig.accesstoken, order);
                                        })
                                        .catch(log);
                                })
                                .catch(log);
                        } else {
                            replyText = "出行订单过期或不存在，抢单失败！";
                            res.reply(replyText);
                        }
                    })
                    .catch(log);
            } else {
                replyText = "你尚未注册为正式驾驶员，请联系我们服务人员注册！";
                res.reply(replyText);
            }
        }

        /**
         * 订单查询
         */
        if (message.EventKey === 'queryOrders') {
            console.log('click queryDayOrders!');
            req.db.collection("orders")
                .find({time: {$gte: new Date().toLocaleDateString()}, "driver.openid": openid})
                .count()
                .then(n => res.reply("今日共完成网约车" + n + "单"))
                .catch(log);
        }

        if (message.EventKey === 'queryMonthOrders') {
            console.log('click queryMonthOrders!');
            req.db.collection("orders")
                .aggregate(
                    [
                        {
                            $project: {
                                //year: {$year: "$time"},
                                month: {$month: "$status.date"},
                                //day: {$dayOfMonth: "$time"},
                                //hour: {$hour: "$time"},
                                //minutes: {$minute: "$time"},
                                //seconds: {$second: "$time"},
                                //milliseconds: {$millisecond: "$time"},
                                //dayOfYear: {$dayOfYear: "$time"},
                                //dayOfWeek: {$dayOfWeek: "$time"},
                                //week: {$week: "$time"}
                            }
                        }
                    ]
                )
                .toArray()
                .then(n => res.reply("本月共完成网约车" + n.month + "单"))
                .catch(log);
        }

        //处理 发送图片 消息
        if (message.MsgType === 'image') {
            //res.reply('image');
            /*
             var mediaId = message.MediaId;
             employeeAPI.getMedia(mediaId, function (err, buffer) {
             if (err) throw err;
             var imageName = './images/' + openid + '.jpg';
             var picUrl = "http://www.all2key.com:81/wechat/images/" + openid + ".jpg";
             fs.writeFile(imageName, buffer, function (err) {
             if (err) throw err;
             console.log('pic saved!');
             _employee.then(employee.setAvatar(picUrl)).then(employee.infoCheck(ep)).then(employee.save(db)).catch(console.log);
             });
             });
             */
        }

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

function sendTemplate(accesstoken, order) {
    //定义行程模板消息数据结构
    let trip = {
        "touser": order.userInfo.openId,
        "template_id": "okU5RcKohHHqum2obMpObL0WzvHP2q5sRTgy_AS9w0k",
        "page": "pages/my/my",
        "form_id": order.formId,
        "data": {
            //行程日期
            "keyword1": {
                "value": order.acceptTime,
                "color": "#173177"
            },
            //行程起点
            "keyword2": {
                "value": order.nav.start,
                "color": "#173177"
            },
            //行程地点
            "keyword3": {
                "value": order.nav.destination,
                "color": "#173177"
            },
            //司机姓名
            "keyword4": {
                "value": order.drivers[0].name,
                "color": "#173177"
            },
            //车牌号码
            "keyword5": {
                "value": order.drivers[0].carid,
                "color": "#ED5D15"
            },
            //行程状态
            "keyword6": {
                "value": order.status.msg,
                "color": "#173177"
            },
            //行程备注
            "keyword7": {
                "value": `距离${order.nav.distance}公里, 预计需时${order.nav.duration}可到达...`,
                "color": "#173177"
            }
        },
        "emphasis_keyword": "keyword5.DATA"
    };
    console.log("order.sendTemplate()/trip: ", trip);
    return weapp.sentTemplate(accesstoken, trip).then(log).catch(console.log);
}