let assert = require('assert');
let mongoXlsx = require('mongo-xlsx');
const session = require('wafer-node-session');
let MongoDBStore = require('./mongodb-ssesion')(session);

const EventEmitter = require('events');

class MyEmitter extends EventEmitter {
}

const ev = new MyEmitter();

const weappConfig = {
    //token: 'nodejsForXsxjmp',
    appid: 'wxedad6d5932ef4149',
    appsecret: '2d7b0b1b2419d05612ee655b3fbea287'
};

exports.setRouter = function (router) {
    let _router = router;

    _router.use(function (req, res, next) {
        // parse req data structor
        req.data.query = req.query.data ? JSON.parse(req.query.data) : req.query;
        next();
    });

    _router.use(function (req, res, next) {
        session({
            // 小程序 appId
            appId: weappConfig.appid,
            // 小程序 appSecret
            appSecret: weappConfig.appsecret,
            // 登录地址
            loginPath: '/login',
            // 会话存储
            store: new MongoDBStore({db: req.data.db, collection: 'flashsaleSessions'})
        })(req, res, next);
    });

    _router.use('/checkoutChartPwd', function (req, res, next) {
        req.query.pwd === "2018" ? res.json({allow: true}) : res.json({allow: false});
    });

    _router.use('/myOrders', function (req, res, next) {
        if (req.session) {
            //console.log("req.session: ", req.session);
            // 从会话获取用户信息
            let _userInfo = req.session.userInfo;

            req.data.db.collection('flashsale')
                .find({"user.openId": _userInfo.openId, date: {$gte: new Date(new Date() - 300000)}})
                .toArray()
                .then(log)
                .then(doc => {
                    res.json(doc.map(item => {
                        return item.product;
                    }));
                })
                .catch(console.log);
        } else {
            res.json({nobody: true});
        }
    });

    _router.use('/init', function (req, res, next) {
        (async function () {
            let productsGroup = await getAllSalesVol(req.data.db.collection('flashsale'));
            console.log("init products group: ", productsGroup);
            let _products = JSON.parse(JSON.stringify(req.data.products));
            let products = _products.map(product => {
                productsGroup.forEach(group => {
                    if (group._id === product.id) {
                        product.amount -= group.count;
                    }
                });
                return product;
            });
            //console.log("req.data.products: ", req.data.products);
            res.json(JSON.stringify(products));
        })();
    });

    _router.use('/buy', function (req, res, next) {
        (async function () {
            if (!'userInfo' in req.session) return;

            const pid = req.query.productId;
            const products = JSON.parse(JSON.stringify(req.data.products));
            const col = req.data.db.collection('flashsale');

            let product = products.find(p => p.id === pid);
            let pIndex = products.findIndex(p => p.id === pid);
            const store = product.amount - await getProductSalesVol(col, pid);
            if (store <= 0) return;

            product.amount = store - 1;
            console.log("req.data.products: ", req.data.products);
            let order = {
                user: req.session.userInfo,
                product: product,
                date: new Date(),
                status: {id: 0, msg: "定金未付"}
            };
            //save order
            col.insertOne(order)
                .then(r => {
                    res.json({id: 1, msg: 'success'});
                    //notice to everyone for
                    req.data.wss.broadcast(JSON.stringify({index: pIndex, amount: product.amount}));
                })
                .catch(r => {
                    console.log("error: ", r);
                    res.json({id: 0, msg: 'failed'});
                });
        })();
    });

    _router.use('/query-star', function (req, res, next) {
        const col = req.data.db.collection("rate");
        col.aggregate([{$group: {_id: "$respondents", avg: {$avg: "$star.id"}}}])
            .toArray()
            .then(r => res.json({id: 1, msg: "success", data: r}))
            .catch(e => res.json({id: 0, msg: "faile"}));
    });

    _router.use('/get-xlsx', function (req, res, next) {

        const col = req.data.db.collection("rate");
        col.aggregate([{
            $project: {
                //_id: 0,
                rateCheckbox: 1,
                star: 1,
                date: {
                    $dateToString: {
                        format: "%Y-%m-%d %H:%M:%S",
                        date: {
                            $add: ['$date', 28800000]
                        }
                    }
                }
            }
        }])
            .toArray()
            .then(log)
            .then(data => {

                let data1 = [{name: "Peter", lastName: "Parker", isSpider: true, _id: "5aaf4ba798c75b0ad6e2de73"},
                    {name: "Remy", lastName: "LeBeau", powers: ["kinetic cards"], day: "2018-03-19T05:33:27.684Z"}];

                /* Generate automatic model for processing (A static model should be used) */
                let model = mongoXlsx.buildDynamicModel(data);
                mongoXlsx.mongoData2Xlsx(data, model, function (err, data) {
                    //console.log('File saved at:', data.fullPath);

                    let options = {
                        root: '/var/www/html/rate/',
                        dotfiles: 'deny',
                        headers: {
                            'x-timestamp': Date.now(),
                            'x-sent': true
                        }
                    };

                    //var fileName = req.params.name;
                    res.sendFile(data.fileName, options, function (err) {
                        if (err) {
                            //next(err);
                        } else {
                            console.log('Sent:', data.fileName);
                        }
                    });
                });
            })
            .catch(console.log);

    });

    return _router;
};


//------------------------------------------------------------------------------------------------------------
function log(r) {
    console.log("promise: ", r);
    return Promise.resolve(r);
}

function mergeOptions(options, defaults) {
    for (var key in defaults) {
        options[key] = options[key] || defaults[key];
    }
}

/**
 * get all sales by group
 * @param col
 * @returns {Promise<T | void>}
 */
function getAllSalesVol(col) {
    return col.aggregate([
        {
            $match: {
                date: {
                    $gte: new Date(new Date() - 300000)
                }
            }
        },
        {
            $group: {
                _id: "$product.id",
                count: {$sum: 1}
            }
        }
    ])
        .toArray()
        //.then(log)
        .catch(console.log);
}

/**
 * get product sales amount
 * @param col
 * @param pid
 * @return Promise
 */
function getProductSalesVol(col, pid) {
    return col.find({date: {$gte: new Date(new Date() - 300000)}, "product.id": pid})
        .count()
        .then(log)
        .catch(console.log);
}

function deepCopy(obj){
    if(typeof obj != 'object'){
        return obj;
    }
    var newobj = {};
    for ( var attr in obj) {
        newobj[attr] = deepCopy(obj[attr]);
    }
    return newobj;
}