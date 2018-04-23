let assert = require('assert');
let mongoXlsx = require('mongo-xlsx');
const session = require('wafer-node-session');
let MongoDBStore = require('./mongodb-ssesion')(session);

const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
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

    _router.use('/me', function (req, res, next) {
        if (req.session) {
            //console.log("req.session: ", req.session);
            // 从会话获取用户信息
            let _userInfo = req.session.userInfo;

            req.data.db.collection('rate')
                .find({openid: _userInfo.openId})
                .limit(1)
                .next()
                .then(log)
                .then(doc => {
                    _userInfo.money = doc.money;
                    delete _userInfo.openId;
                    res.json(_userInfo);
                })
                .catch(console.log);
        } else {
            res.json({nobody: true});
        }
    });

    _router.use('/init', function(req, res, next){
        res.json({ notic: "提示：近日可能会有厂家400电话回访，请注意接听，感谢配合！" });
    });

    _router.use('/buy', function (req, res, next) {
        let saveData = req.data.query;
        saveData.date = new Date();
        //saveData.sid = req.data.sid;
        saveData.openid = req.session.userInfo.openId;

        let _products = req.data.products.map(item=>{
            if(item.id === saveData.productId){
                item.amount--;
                saveData.product = item;
            }
            return item;
        });

        req.db.collection("flashsale")
            .insertOne(saveData)
            .then(r => {
                res.json({status:{id: 1, msg: 'success'}, products: _products})
            })
            .catch(r => res.json({id: 0, msg: 'failed'}));
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

function log(r) {
    console.log("promise: ", r);
    return Promise.resolve(r);
}