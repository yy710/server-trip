"use strict";

var session = require('./session.js').session;
var weapp = require('./common.js').weapp;
var user = require('./user.js').user;

/**
 * 此处传入一个 router 对象,或者 express?
 * @param router
 * @returns {*}
 */
exports.setRouter = function (router) {
    const config = {
        token: 'nodejsForSfrf',
        appid: 'wx582b3ee9e0e107bb',
        appsecret: 'ae25706cbb3e301c77d0c433e2dbbb06'
    };
    var _router = router;

    /**
     *  get access_token and save to mongodb
     */
    _router.use(function (req, res, next) {
        weapp.getAccessToken(req.db, config).then(r => {
            req.sfrfConfig = config;
            req.sfrfConfig.accesstoken = r;
            console.log("req.sfrfConfig: ", req.sfrfConfig);
            next();
        }).catch(log);
    });


    _router.get('/getMember', session.find, session.getMember, function (req, res, next) {
        var member = req.data.member;
        delete  member.openid;
        res.json(member);
    });

    _router.get('/getProducts', function (req, res, next) {
        req.db.collection('users').find({phone: '13708438123'}).next(function (err, doc) {
            if (err)throw err;
            req.user = doc;
            next();
        });
    });
    _router.get('/getProducts', function (req, res, next) {
        req.db.collection('products')
            .find()
            .toArray()
            .then(products=> {
                req.products = products.map(product=> {
                    var orders = req.user.orders || [];
                    for (var i = 0; i < orders.length; i++) {
                        if (orders[i].productName === product.name) {
                            product.isBought = orders[i];
                            delete product.isBought.productName;
                        }
                        delete product._id;
                    }
                    return product;
                });
                next();
                // setTimeout(()=>next(), 1000);
            })
            .catch(log);
    });
    _router.get('/getProducts', function (req, res, next) {
        res.json(req.products);
    });


    /**
     * 订购洗发产品
     */
        //-----------------------------------------------------------------------------------------------------------
    _router.get('/book', session.find);//获得用户 openid
    /**
     * 保存订购单(book)到数据库
     */
    _router.get('/book', function (req, res, next) {
        let book = req.query;
        book.bookBoxAmount = Number(book.bookBoxAmount);
        book.status = [];
        book.status.push({msg: "已接受订单, 等待支付", id: "accepted", time: Date.now()});
        book.userOpenid = req.data.session.openid;
        req.data.book = book;
        req.db.collection('books').insertOne(book).then(r=>next()).catch(console.log);
    });
    _router.get('/book', user.find);
    _router.get('/book', user.upsert);
    _router.get('/book', user.updateHave);
    _router.get('/book', user.save);
    _router.get('/book', debug);
    _router.get('/book', function (req, res, next) {
        res.send({msg: "ok"});
    });


    _router.get('/myBook', function (req, res, next) {
        req.db.collection('book').find({}).limit(5).toArray().then(r=> {
            console.log("find: ", r);
            res.send(r);
        }).catch();
    });

    _router.get('/onLogin', session.getSessionKey(config));
    _router.get('/onLogin', session.decryptUserData);
    _router.get('/onLogin', session.saveSession);
    _router.get('/onLogin', session.reply);

    _router.use('/verifySid', session.find);
    _router.use('/verifySid', function (req, res, next) {
        res.send({valid: !!req.session});
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

function debug(req, res, next) {
    console.log('req.data: ', req.data);
    next();
}