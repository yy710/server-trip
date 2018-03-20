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
        rateData.date = new Date();
        rateData.sid = req.data.sid;
        //console.log("req.data.query: ", _req);

        req.db.collection("rate")
            .insertOne(rateData)
            .then(r => res.json({id: 1, msg: 'success'}))
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