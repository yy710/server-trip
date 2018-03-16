exports.setRouter = function (router) {
    let _router = router;

    _router.use('/dksale', function (req, res, next) {
        let _req = req.data.query;
        console.log("req.data.query: ", _req);

        req.db.collection("rate")
            .insertOne(_req)
            .then(r => res.json({id: 1, msg: 'success'}))
            .catch(r => res.json({id: 0, msg: 'failed'}));
    });

    return _router;
};