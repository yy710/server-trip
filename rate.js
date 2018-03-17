var mongoXlsx = require('mongo-xlsx');

exports.setRouter = function (router) {
    let _router = router;

    _router.use(function (req, res, next) {
        // parse req data structor
        req.data.query = req.query.data ? JSON.parse(req.query.data) : req.query;
        next();
    });

    _router.use('/dksale', function (req, res, next) {
        let rateData = req.data.query;
        rateData.day = new Date();
        rateData.sid = req.data.sid;
        //console.log("req.data.query: ", _req);

        req.db.collection("rate")
            .insertOne(rateData)
            .then(r => res.json({id: 1, msg: 'success'}))
            .catch(r => res.json({id: 0, msg: 'failed'}));
    });

    _router.use('/queryStar', function (req, res, next) {
        const col = req.data.db.collection("rate");
        col.aggregate([{$group: {_id: "$respondents", avg: {$avg: "$star.id"}}}])
            .toArray()
            .then(r => res.json({id: 1, msg: "success", data: r}))
            .catch(e => res.json({id: 0, msg: "faile"}));
    });

    _router.use('/getXlsx', function (req, res, next) {

        const col = req.data.db.collection("rate");
        col.find({}).toArray()
            .then(data1 => {


                var data = [ { name : "Peter", lastName : "Parker", isSpider : true } ,
                    { name : "Remy",  lastName : "LeBeau", powers : ["kinetic cards"] }];


                /* Generate automatic model for processing (A static model should be used) */
                var model = mongoXlsx.buildDynamicModel(data);

                /* Generate Excel */
                mongoXlsx.mongoData2Xlsx(data, model, function (err, data) {
                    console.log('File saved at:', data.fullPath);
                    res.sendFile('./'+data.fileName);
                });

            })
            .catch(console.log);

    });

    return _router;
};