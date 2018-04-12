"use strict";

let assert = require('assert');
let xml2js = require('xml2js');//use to wechat moudle
let https = require('https');
let fs = require('fs');
let express = require('express');
let app = express();
let location = require('./location.js').location;
let EventProxy = require('eventproxy');
let weapp = require('./common.js').weapp;
let order = require('./order.js').order;
let passenger = require('./passenger.js').passenger;
let wechat = require('wechat');
let session = require('./session.js').session;
let MongoClient = require('mongodb').MongoClient;
let WechatAPI = require('wechat-api');

const tripConfig = {
    token: 'node.jsForWeappTrip',
    appid: 'wx8a2a674d6018fdc7',
    appsecret: 'c1d496d95aacca6cc1c95531abfca0f8'
};
const sfrfConfig = {
    token: 'nodejsForSfrf',
    appid: 'wx582b3ee9e0e107bb',
    appsecret: 'ae25706cbb3e301c77d0c433e2dbbb06'
};
const xsxjMpConfig = {
    token: 'nodejsForXsxjmp',
    appid: 'wx977eb7e3ce0619c6',
    appsecret: 'c7931d20dd605e4ef0d208c08e054285'
};

//全局路由
app.use(function (req, res, next) {
    //debug req mothed
    console.log("req.url: ", req.url);
    console.log("req.path: ", req.path);
    console.log("req.query: ", req.query);

    //define req.data for store user data
    req.data = {};
    req.data.sid = req.query.sid || 0;

    next();
});

/**
 * 小程序发送模板消息服务器认证
 */
app.use('/weapptrip', wechat(tripConfig, function (req, res, next) {
    //res.reply("weappTrip ok!");
    // 微信输入信息都在req.weixin上
    const message = req.weixin;
    console.log(message);//debug
}));

/**
 * 司机端公众号服务器认证
 */
/*
 app.use('/mp', wechat(xsxjMpConfig, function (req, res, next) {
 //res.reply("mp ok!");
 // 微信输入信息都在req.weixin上
 const message = req.weixin;
 console.log(message);//debug
 //const openid = message.FromUserName;
 //var ep = new EventProxy();
 }));
 */

/*
 app.post('/sfrf', wechat(sfrfConfig, function (req, res, next) {
 res.reply("sfrf ok!");
 // 微信输入信息都在req.weixin上
 const message = req.weixin;
 console.log(message);//debug
 //const openid = message.FromUserName;
 //var ep = new EventProxy();
 }));
 */

//静态路由
app.use('/images', express.static('images'));
app.use('/admin', express.static('admin'));
//app.use('/', express.static('public'));
//app.use('/mp', express.static('public'));


//-------------------------------------------------------------------------------------------
// let routerSfrf = require('./sfrf.js').setRouter(express.Router());
// app.use('/sfrf', initDb('mongodb://yaoling:yyL0529@localhost:30000/sfrf'), routerSfrf);

// 小程序 API 路由
let routerTrip = require('./trip.js').setRouter(express.Router());
app.use('/trip', initDb('mongodb://travel:daydayUp@localhost:30000/trip'), routerTrip);

// 司机端公众号 API 路由
let routerMp = require('./dispatch.js').setRouter(express.Router());
app.use('/mp', initDb('mongodb://travel:daydayUp@localhost:30000/trip'), routerMp);

// 管理界面 API 路由
let routerAdmin = require('./admin.js').setRouter(express.Router());
app.use('/admin', initDb('mongodb://travel:daydayUp@localhost:30000/trip'), routerAdmin);

// 迪坤客户满意度调查路由
let routerRate = require('./rate.js').setRouter(express.Router());
app.use('/rate', initDb('mongodb://travel:daydayUp@localhost:30000/trip'), routerRate);


//---------------------------------------------------------------------------------------
const options = {
    key: fs.readFileSync('./ssl/214230172760996.key'),
    //ca: [fs.readFileSync('./ca/ca.crt')],
    cert: fs.readFileSync('./ssl/214230172760996.pem')
};
const port = 443;
let server = https.createServer(options, app);
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
            req.db = db;//deprecated
            req.data.db = db;//approve
            next();
        });
    };
}