/**
 * Created by yy710 on 28/02/2017.
 */
'use strict';

const crypto = require('crypto');

// Asynchronous
crypto.randomBytes(8, (err, buf) => {
    if (err) throw err;
    console.log(`${buf.length} bytes of random data: ${buf.toString('hex')}`);
});

// Synchronous
const buf = crypto.randomBytes(16);
console.log(
    `${buf.length} bytes of random data: ${buf.toString('hex')}`);
/*
 function test(n) {
 return new Promise(function (resolve, reject) {
 setTimeout(x=>resolve(n), 1000 * n);
 });
 }

 var aaa = async function () {
 console.log("start!");
 await test(2);
 console.log("end!");
 };

 aaa();

 var order = {
 "_id": ObjectId("58bce75c8e597e3a8c481cd2"),
 "nav": {"distance": 1.22, "duration": "0小时3分", "start": "云南省昆明市五华区虹山北路44号", "destination": "云南省昆明市五华区虹山南路120号"},
 "phone": "12345",
 "formId": "1488775004432",
 "points": [{"latitude": 25.059223, "longitude": 102.677055}, {"latitude": "25.055607", "longitude": "102.684135"}],
 "acceptTime": "3/6/2017, 12:36:44 PM",
 "id": 1488775005780,
 "statuses": {"id": "waitingDriver", "msg": "已找到司机,等待回应..."},
 "drivers": [{
 "_id": ObjectId("58a0ac423ec479baa41adb0b"),
 "openid": "oEU72wcjD9aveNfBortmwHuuIyt7",
 "location": {"type": "Point", "coordinates": [102.652168, 25.05377]},
 "updatetime": ISODate("2017-02-12T18:41:06.807Z"),
 "label": "西市区美丽新世界",
 "name": "西司机 马超",
 "phone": "18236898331",
 "carid": "云A78456",
 "picurl": "http://www.ynbyd.com/tempic/03.jpg"
 }, {
 "_id": ObjectId("58a0ac583ec479baa41adb0d"),
 "openid": "oEU72wcjD9aveNfBortmwrtuIdf9",
 "location": {"type": "Point", "coordinates": [102.708916, 25.044329]},
 "updatetime": ISODate("2017-02-12T18:41:28.484Z"),
 "label": "五华区华山南路",
 "name": "中司机 黄忠",
 "phone": "18236898559",
 "carid": "云A45888",
 "picurl": "http://www.ynbyd.com/tempic/05.jpg"
 }]
 };
 */

var assert = require('assert');
var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var app = express();
var EventProxy = require('eventproxy');

var router = express.Router();
//app.use('/static', express.static('public'));//use "https://localhost:10000/1.jpg" to get
router.use('/s', express.static('public'));
app.use('/static', router);

app.get((req, res, next)=> {
    console.log(req.query);
    next();
});

var router1 = express.Router();
var router2 = express.Router();
app.use('/', router1);//equal app.use(ruter1);
app.use('/2', router2);

router1.get('/test', function (req, res, next) {
    res.send({msg: "router1", sid: req.query.sid});
});
router2.get('/test', function (req, res, next) {
    res.json({msg: "router2", sid: req.query.sid});
});


var f1 = function (a) {
    return function () {
        return a + 1;
    };
};

console.log(f1(2)());

var ep = new EventProxy();

var options = {
    key: fs.readFileSync('./cert/214010334300719.key'),
    //ca: [fs.readFileSync('./ca/ca.crt')],
    cert: fs.readFileSync('./cert/214010334300719.pem')
};
//var server = https.createServer(options, app);
var server = http.createServer(app);
server.listen(10000, ()=>console.log('server is running on port 10000'));