'use strict';

/**
 * 载入断言模块
 * @type {*|ok|exports|module.exports}
 */
var assert = require('assert');
var fs = require('fs');

/**
 * 载入co流程库
 * @type {co.co|*|co|exports|module.exports}
 */
var co = require('co');

/**
 * 初始化 express web service
 * @type {*|exports|module.exports}
 */
var express = require('express');
var app = express();
app.use(express.query());

/**
 * 初始化微信公众号中间件
 */
var wechat = require('wechat');
var employeeConfig = {
    token: 'node.jsForDrivers',
    appid: 'wx11f4203e90e0dc66'
};
var customerConfig = {
    token: 'node.jsForPassengers',
    appid: 'wx4e52bd5984915d9d'
};
var sfrfConfig = {
    token: 'node.jsForSfrf',
    appid: 'wx444f146414e4997f'
};

/**
 * 初始化微信公众号API接口
 */
var WechatAPI = require('wechat-api');
var customerAPI = new WechatAPI('wx4e52bd5984915d9d', '59620200b91d6682bd776a07fae17a21');
var employeeAPI = new WechatAPI('wx11f4203e90e0dc66', 'd4624c36b6795d1d99dcf0547af5443d');
var sfrfAPI = new WechatAPI('wx11f4203e90e0dc66', '69f1c4c0c98652f76a171ca2af2dfe19');

/**
 * 初始化数据库参数
 */
var MongoClient = require('mongodb').MongoClient;
var dbUrl = 'mongodb://127.0.0.1:12345/yangba';

/**
 * 载入自定义函数库
 * @type {exports|module.exports}
 */
let yb = require('./yb.js');
var location = yb.location;
var customer = yb.customer;
var employee = yb.employee;
var order = yb.order;
var log = yb.log;
var arraySync = yb.arraySync;
let SMS = require('./sms.js');
var loginSMS = SMS.loginSMS;


/**
 * 引入事件发射监听类
 * @type {*|EventEmitter}
 */
const EventEmitter = require('events').EventEmitter;
var EventProxy = require('eventproxy');

MongoClient.connect(dbUrl, function (err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to server");

    //设立全局监听对象
    /*
    var epa = new EventProxy();
    epa.all('customerEvent', 'employeeEvent', function (data1, data2) {
        console.log('customerEvent: ', data1);
        console.log('employeeEvent: ', data2);
    });
    */


    //=======================================================================================

    /**
     * 开始处理客户端公众号请求
     */
    app.use('/passengers', wechat(customerConfig, function (req, res, next) {

        // 微信输入信息都在req.weixin上
        var message = req.weixin;
        //debug
        console.log(message);
        //初始化数据(注意函数式编程原则: 不修改源数据)
        const openid = message.FromUserName;
        var ep = new EventProxy();
        //epa.emit('customerEvent', openid);//global ep test

        /**
         * 初始化 data chain
         * @type {Promise.<T>}
         * @private
         */
        var _customer = customer.init(db, openid);
        _customer.then(customer.save(db)).catch(console.log);

        //是否有关联订单
        var _order = _customer.then(order.init(db));
        _order.then(order.save(db)).catch(console.log);


        /**
         * debug: check data
         */
        /*
         setTimeout(()=> {
         console.log('_customer: ', _customer);
         console.log('_order: ', _order);
         }, 1000);
         */


        //提示: event对象的定义作用域要小心, 如果引用自上层作用域, 不用时一定要 removeListeners
        //var ep = new EventEmitter();
        //ep.removeAllListeners();


        //重要提示: ep.on() 必须在 ep.emit() 之前定义,否则监听失效
        ep.on('sendTextToCustomer', function (text) {
            console.log('event: sendTextToCustomer');
            customerAPI.sendText(openid, text, function (err, result) {
                assert.equal(null, err);
                console.log('Customer sendText ok!');
            });
        });

        ep.on('sendTextToEmployee', function (text) {
            console.log('event: sendTextToEmployee');
            //注意这里的 openid 值
            employeeAPI.sendText('oEU72wcjD9aveNfBoNwmwHlsITD4', text, function (err, result) {
                assert.equal(null, err);
                console.log('Employee sendText ok!');
            });
        });

        ep.once('customerOK', function () {
            console.log("event: customerOK");
        });

        /**
         * listening order info complete event
         */
        ep.once('orderOK', function (order2) {
            console.log('event: orderOK');
            //先预设客户订单成立
            //_customer.then(customer.setOrderid(order2.orderid)).then(customer.save(db)).catch(console.log);
            //延迟10秒后检查订单是否被取消, 未取消则进入确认订单流程
            setTimeout(function () {
                customer.load(db, openid).then(function (c) {
                    //检查客户是否已取消订单
                    if (!c.orderid) {
                        console.log("orderOK, but customer.orderid is null!");
                        return Promise.reject(new Error("order canceled!"));
                    }
                    customerAPI.sendText(openid, '您的订单已被系统接受, 正在为你查找最近的洗车技师, 请稍等...', (err, res)=> {
                        if (err)throw err
                    });
                    //按地理位置查找并将结果存入 order.employees 数组
                    order.getEmployees(db, ep, 10000)(order2).then(order.save(db)).catch(console.log);
                }).catch(console.log);
            }, 10000);

        });

        ep.once('noFindEmployee', function (order) {
            console.log('event: noFindEmployee');
            customerAPI.sendText(openid, '抱歉, 附近未找到洗车技师!', function (err, result) {
                assert.equal(null, err);
            });
        });

        /**
         * 处理搜索到的 employees 数组
         */
        ep.once('findEmployee', function (od) {
            console.log('event: findEmployee');

            let nav = location.getTXnavURL(od.location);
            var txt = `有新的洗车订单!, 客户姓名: ${od.customer.name}, 电话: ${od.customer.phone}, 车牌: ${od.customer.carid}, 车辆停放地点: ${od.location.label}, 可点击 <a href="${nav}"> 开始导航 </a> 来迅速赶往停车位置, 请在2分钟内从菜单中选择"接受订单", 否则系统将认定你拒单, 一天内无故拒单超过三次将取消你的接单资格!`;

            arraySync(od.employees, 10000)(function (emp) {
                //注意正式使用时修改openid
                employeeAPI.sendText(emp.openid, txt, function (err, result) {
                    assert.equal(null, err);
                    //在 employee 中 push orderid to orderids
                    employee.load(db, emp.openid).then(employee.assignOrder(od.orderid)).then(employee.save(db)).catch(console.log);
                });
            });

            /*
             for (var _employee of od.employees) {
             //通知查找到的employees, 注意正式使用时替换openid
             employeeAPI.sendText('oEU72wcjD9aveNfBoNwmwHlsITD4', txt, function (err, result) {
             assert.equal(null, err);
             //这里应增加一个 sleep 函数或者采用尾递归解决
             //在 employee 中设置 orderid 字段
             employee.load(db, _employee.openid).then(employee.assignOrder(od.orderid)).then(employee.save(db));
             });
             }
             */
        });

        ep.once('customerCancelOrder', function (openid) {
            console.log('event: customerCancelOrder: ', openid);
        });

        ep.once('hasOrder', function (orderid) {
            console.log("event: hasOrder");
            //yb.orderLoad(db)(orderid).then(yb.orderInfoCheck(ep)).then(yb.log).then(yb.orderSave(db));
        });

        ep.once('setPrice', function (price) {
            console.log('event: setPrice');
            _order.then(order.setPrice(price)).then(order.save(db));
        });

        /**
         * 由于event 监听延迟导致微信重复发送消息, 因此取消
         */
        /*
         ep.once('replyText', function (text) {
         console.log('event: replyText');
         res.reply(text);
         });
         */

        /**
         * 处理上报地理位置事件
         */
        if (message.Event === 'LOCATION') {
            //避免微信重复发送信息
            res.reply('');

            let lng = message.longitude;
            let lat = message.latitude;
            let loc = location.new(lng, lat);

            _customer.then(customer.addLocation(loc)).then(customer.save(db)).then(log);
        }


        /**
         * 处理弹出地理位置选择器事件
         */
        if (message.Event === 'location_select' && message.EventKey === 'start') {
            //避免微信重复发送信息
            res.reply('');

            //得到位置坐标
            let lng = Math.round(message.SendLocationInfo.Location_Y * 1000000) / 1000000;
            let lat = Math.round(message.SendLocationInfo.Location_X * 1000000) / 1000000;
            let label = message.SendLocationInfo.Label;
            let loc = location.new(lng, lat, label);

            //check customer info completion
            _customer.then(customer.infoCheck(ep)).then(customer.save(db)).then(function (c) {
                //set order service add and check order completion
                _order.then(order.addLocation(loc)).then(order.infoCheck(ep)).then(order.save(db)).catch(log);
            }).catch(log);

        }


        /**
         * 处理用户点击 更改套餐 按钮
         */
        if (message.EventKey === 'price') {

            _order.then(od=> {
                let price = od.price;
                let text = `您现在的洗车套餐为 ${price} 元,\n 我们的服务价格为:\n普通轿车外部清洗35元;\n普通轿车连内饰清洗45元;\nSUV外部清洗45元;\nSUV连内饰清洗55元.\n直接回复即可更改, 例如: 回复55即选择55元洗车套餐`;
                res.reply(text);
            });
        }


        /**
         * 处理客户点击 "取消订单" 按钮
         */
        if (message.EventKey === 'cancelOrder') {
            res.reply('cancelOrder!');

            _order.then(od=> {
                if (od.state < 11) return Promise.resolve(od);
                return Promise.reject(new Error('you can not cancel order!'));
            }).then(order.delete(db)).then(function (od) {
                _customer.then(customer.setOrderid(null)).then(customer.save(db));
            });
        }


        /**
         * 处理点击 "查询订单" 按钮
         */
        if (message.EventKey === 'queryOrder') {
            _order.then(order.infoCheck2).then(od=>res.reply(od.rep)).then(order.save(db)).catch(log);
        }


        /**
         * 处理点击 个人信息 按钮
         */
        if (message.EventKey === 'info') {
            _customer.then(customer.infoCheck(ep)).then(c=> {
                let text = "你的姓名: " + c.name + "\n你的联系电话: " + c.phone + "\n你的爱车车牌号: " + c.carid + "\n需要更改信息请直接回复, 例如: 李晨 13709993215 云A12345";
                res.reply(text);
            });
        }


        /**
         * 处理发送地理位置消息
         */
        if (message.MsgType === 'location') {
            //避免再选取地理位置时微信重复发送消息
            res.reply('');
        }


        /**
         * 处理文本回复
         */
        if (message.MsgType === 'text') {
            //保存相关参数
            var content = message.Content;
            res.reply("请稍候,系统正在处理...");

            //处理用户完善个人信息指令
            _customer.then(customer.getInput(ep, content, loginSMS)).then(customer.infoCheck(ep)).then(log).then(customer.save(db)).then(function (c) {

                _order.then(order.addCustomer(c)).then(order.infoCheck(ep)).then(order.save(db)).catch(console.log);

            }).catch(console.log);
        }

    }));


    //=======================================================================================

    /**
     * 开始处理技师端公众号请求
     */
    app.use('/drivers', wechat(employeeConfig, function (req, res, next) {

        res.reply("employee ok!");

        // 微信输入信息都在req.weixin上
        const message = req.weixin;
        console.log(message);//debug
        const openid = message.FromUserName;
        var ep = new EventProxy();

        const _employee = employee.loadOrNew(db, openid).then(employee.save(db)).catch(console.log);
        //const _order = _employee.then(employee.getOrderAndAddEmployee(db, ep)).catch(console.log);

        /**
         * debug
         */
        /*
         setTimeout(()=> {
         console.log('_employee: ', _employee);
         //console.log('_order: ', _order);
         }, 1000);
         */


        ep.on('sendTextToEmployee', function (text) {
            console.log('event: sendTextToEmployee data: ', text);
            //正式使用需更改openid参数
            employeeAPI.sendText(openid, text, (err, result)=> {
                if (err)throw err;
                console.log('Send text to employee ok!');
            });
        });


        ep.once('replyText', function (text) {
            console.log('event: replyText');
            res.reply(text);
        });

        /**
         * 监听技师确认接单事件, 发送图文消息到客户
         */
        ep.once('employeeAcceptOrder', function (order2) {
            console.log('event: employeeAccessOrder');
            //console.log(order2);
            order.getNavInfo(order2).then(function (od) {
                var articles = [{
                    "title": "本次为您服务的洗车技师: " + od.employee.name,
                    "description": `技师所在位置: ${od.employee.location.label} \n 距离停车点约 ${od.distance} 公里 \n 预计大约 ${od.duration} 可到达停车点 ${od.location.label}  \n 洗车技师电话: ${od.employee.phone} \n 您本次消费金额为 ${od.price} 元, \n 稍候我们的专业技师将会和你取得联系, 请保持电话始终处于可接通状态!`,
                    "url": "",
                    "picurl": od.employee.picurl
                }];
                customerAPI.sendNews(od.customer.openid, articles, function (err, result) {
                    assert.equal(null, err);
                    console.log('Send news to customer ok!');
                });
            }).catch(console.log);
        });


        /**
         * 处理发送文本消息
         */
        if (message.MsgType === 'text') {
            let content = message.Content;
            _employee.then(employee.getInput(ep, content)).then(employee.infoCheck(ep)).then(employee.save(db)).catch(console.log);
        }


        /**
         * 处理上报地理位置事件
         */
        if (message.Event === 'LOCATION') {
            //避免微信重复发送信息
            //res.reply('已收到上报位置!');

            var lng = Number(message.Longitude);
            var lat = Number(message.Latitude);
            var loc = location.new(lng, lat);
            console.log(loc);

            _employee.then(employee.addLocation(loc)).then(log).then(employee.save(db)).catch(console.log);
        }


        /**
         * 处理点击 接受订单 按钮
         */
        if (message.EventKey === 'accessOrder') {
            console.log('acceptOrder!');
            //res.reply('acceptOrder!');
            //ep.emit('employeeAccessOrder', 'click');
            _employee
                .then(employee.isAssign(ep))//是否已派单
                .then(employee.getOrderAndAddEmployee(db, ep))//查找订单并接单
                .then(log)
                .then(order.save(db))
                .catch(console.log);
        }

        /**
         * 处理 取消订单 按钮
         * remove employee from order, then save order, then emit event
         */
        if (message.EventKey === 'cancelOrder') {
            console.log('cancelOrder!');
            res.reply('cancelOrder!');
            _employee.then(employee.isAssign(ep)).then(employee.canelOrder).then(employee.save(db)).catch(console.log);
        }

        /**
         * 处理 开始接单 按钮
         * remove employee from order, then save order, then emit event
         */
        if (message.EventKey === 'login') {
            console.log('click login!');
            _employee.then(employee.infoCheck(ep)).then(employee.isInfoCompletion).then(employee.login).then(e=> {
                ep.emit("sendTextToEmployee", "签到成功, 现在可以接单!");
                return Promise.resolve(e);
            }).then(employee.save(db)).catch(err=> {
                console.log(err);
                ep.emit("sendTextToEmployee", "签到失败!");
            });
        }

        /**
         * 处理 取消接单 按钮
         * remove employee from order, then save order, then emit event
         */
        if (message.EventKey === 'logout') {
            console.log('click logout!');
            _employee.then(employee.infoCheck(ep)).then(employee.isInfoCompletion).then(employee.logout).then(e=> {
                ep.emit('sendTextToEmployee', e.state.msg);
                return e;
            }).then(employee.save(db)).catch(err=> {
                console.log(err);
                ep.emit('sendTextToEmployee', "签出失败!");
            });
            //res.reply("你已取消接单, 需要重新接单请点击签到!");
        }

        //处理 发送图片 消息
        if (message.MsgType === 'image') {
            //res.reply('image');
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
        }
    }));



    //=======================================================================================

    app.use('/sfrf', wechat(sfrfConfig, function (req, res, next) {

        res.reply("sfrf ok!");

        // 微信输入信息都在req.weixin上
        const message = req.weixin;
        console.log(message);//debug
        const openid = message.FromUserName;
        var ep = new EventProxy();


    }));

});


/**
 * 监听端口
 */
var port = 8080;
app.listen(port, function(){
    console.log('express server listening on ', port);
});