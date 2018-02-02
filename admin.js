/**
 * Created by yy710 on 08/09/2017.
 */

exports.setRouter = function (router) {

    let _router = router;

    _router.use('/addDriver', function (req, res, next) {

        let driver = req.query;
        driver.online = true;
        driver.busy = false;
        driver.picurl = "https://www.xingshenxunjiechuxing.com/images/byd-tang.jpg";

        req.db.collection("drivers")
            .updateOne({openid: driver.openid}, driver, {upsert: true, w: 1})
            .then(r => res.send("操作成功！"))
            .catch(r => res.send("操作失败！"));
    });


    _router.use('/addBus', function (req, res, next) {
        let bus = req.query;
        req.db.collection("buses")
            .replaceOne({id: bus.id}, bus, {upsert: true, w: 1})
            .then(r => res.send("操作成功！"))
            .catch(r => res.send("操作失败！"));
    });

    _router.use('/setTaxiPrice', function (req, res, next) {
        let conf = req.query;
        req.db.collection('config')
            .updateOne({"id": 1}, {$set: {"taxiPrice": conf}}, {upsert: false, w: 1})
            .then(r => res.send("操作成功！"))
            .catch(r => res.send("操作失败！"));
    });

    return _router;
};
