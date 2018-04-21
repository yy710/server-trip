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
let SocketServer = require('ws');

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
//app.use(express.json());
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

// 车聚购微信小程序路由
let routerFlashSale = require('./flash-sale.js').setRouter(express.Router());
app.use('/flashsale', initDb('mongodb://travel:daydayUp@localhost:30000/trip'), routerFlashSale);

//---------------------------------------------------------------------------------------
const options = {
    key: fs.readFileSync('./ssl/214230172760996.key'),
    //ca: [fs.readFileSync('./ca/ca.crt')],
    cert: fs.readFileSync('./ssl/214230172760996.pem')
};

let server = https.createServer(options, app);
let wss = new SocketServer.Server({server});

wss.on('connection', function (socket, req) {
    console.log("wss.clients.size: ", wss.clients.size);

    const products = [
        {
            name: "比亚迪 宋MAX",
            price: 10.99,
            model: "2017款 1.5T 7座MPV",
            image: "../../images/song-max-01.jpg",
            amount: 5,
            status: { id: 1, msg: "即将开始..." },
            timer: { start: new Date(2018, 3, 19, 22, 31, 5, 0), end: new Date }
        },
        {
            name: "比亚迪 唐100",
            price: 28.5,
            model: "2017款 2.0T 5座SUV",
            image: "../../images/tang-01.jpg",
            amount: 1,
            status: { id: 2, msg: "正在抢购中..." },
            timer: { start: new Date(), end: new Date }
        },
        {
            name: "比亚迪 F0",
            price: 3.99,
            model: "2018款 1.0 A0级",
            image: "../../images/song-max-01.jpg",
            amount: 3,
            status: { id: 4, msg: "已抢完..." },
            timer: { start: new Date(), end: new Date(2018, 3, 19, 22, 31, 5, 0) }
        }
    ];

    socket.on('message', function (message) {
        console.log('received: %s', message);
    });

    socket.send(JSON.stringify(products), { binary: false });

    socket.on('close', function () {
        console.log("websocket connection closed");
    });
});

const port = 443;
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