/**
 * Created by yy710 on 16/02/2017.
 */
'use strict';

let assert = require('assert');
let location = require('./location.js').location;

let yb = require('./yb.js');
//let customer = yb.customer;
let employee = yb.employee;
//var order = yb.order;
let log = yb.log;
let arraySync = yb.arraySync;

let SMS = require('./sms.js');
let loginSMS = SMS.loginSMS;

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
    let employeeConfig = {token: 'nodejsForXsxjmp', appid: 'wx977eb7e3ce0619c6'};

    //=======================================================================================

    /**
     * 开始处理技师端公众号请求
     */

    _router.use('/', wechat(employeeConfig, function (req, res, next) {

        res.reply("employee ok!");
        let db = req.db;

        // 微信输入信息都在req.weixin上
        const message = req.weixin;
        console.log(message);//debug
        const openid = message.FromUserName;
        let ep = new EventProxy();

        const _employee = employee.loadOrNew(db, openid).then(employee.save(db)).catch(console.log);


        ep.on('sendTextToEmployee', function (text) {
            console.log('event: sendTextToEmployee data: ', text);
            //正式使用需更改openid参数
            employeeAPI.sendText(openid, text, (err, result) => {
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

            let loc = location.new({longitude: message.Longitude, latitude: message.Latitude});
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
            _employee.then(employee.infoCheck(ep)).then(employee.isInfoCompletion).then(employee.login).then(e => {
                ep.emit("sendTextToEmployee", "签到成功, 现在可以接单!");
                return Promise.resolve(e);
            }).then(employee.save(db)).catch(err => {
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
            _employee.then(employee.infoCheck(ep)).then(employee.isInfoCompletion).then(employee.logout).then(e => {
                ep.emit('sendTextToEmployee', e.state.msg);
                return e;
            }).then(employee.save(db)).catch(err => {
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
    return _router;
};