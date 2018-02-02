/**
 * Created by yy710 on 19/05/2017.
 */

let session = require('./session').session;

let user = {};
user.getOrNewUser = function (req, res, next) {
    let _order = req.data.order;
    req.db.collection("users")
        .find({phone: _order.phone})
        .next()
        .then(log)
        .then(doc => {
            req.data.user = doc ? doc : {sid: req.query.sid, phone: _order.phone, status: {id: "normal", msg: "可下单客户"}};
            next();
            //return req.data.user;
        })
        //.then(log)
        .catch(log);
};

user.update = function (req, res, next) {
    let _user = req.data.user;
    req.db.collection("users")
        .replaceOne({phone: _user.phone}, _user, {upsert: true, w: 1})
        .then(r => next())
        .catch(log);
};

user.isNormal = function (req, res, next) {
  next();
};

user.save = function(req, res, next){

};

class User {
    constructor(sid) {
        this.sid = sid;
    }

    find(req, res, next) {
        req.db.collection(this.colName)
            .find({$or: {phone: req.query.userPhone, openid: req.data.session.openid}})
            .next()
            .then(log)
            .then(doc => {
                req.data.member = doc;
                next();
            })
            .catch(log);
    }

    update(req, res, next) {
        let user = req.data.member || req.data.session.decryptedData;
        user.phone = req.query.userPhone;
        req.db.collection(this.colName)
            .replaceOne({phone: user.phone}, user, {w: 1})
            .then(r => next())
            .catch(log);
    }
}

let member = {colName: "members"};

/**
 * find member by phone or openid
 * @param req
 * @param res
 * @param next
 */
member.find = function (req, res, next) {
    //console.log("this.colName: ", this.colName);
    req.db.collection('members')
        .find({$or: [{phone: req.query.userPhone}, {openid: req.data.session.openid}]})
        .next()
        .then(doc => {
            req.data.member = doc;
            next();
        })
        .catch(log);
};

member.upsert = function (req, res, next) {
    if (!req.data.member || !req.data.member.phone) {
        //no find member, create a new member
        req.data.member = {
            name: req.query.userName,
            phone: req.query.userPhone,
            openid: req.data.session.openid,
            have: []
        };
        //member.have.push(req.data.order);
    }
    next();
};

member.save = function (req, res, next) {
    req.db.collection('members')
        .replaceOne({phone: req.data.member.phone}, req.data.member, {upsert: true, w: 1})
        .then(r => next())
        .catch(log);
};

/**
 * statistics member has orders
 * @param req
 * @param res
 * @param next
 */
member.updateHave = function (req, res, next) {
    req.db.collection('books')
        .find({userOpenid: req.data.member.openid})
        .toArray()
        .then(docs => {
            req.data.books = docs;
            next();
        })
        .catch(log);
};

//-------------------------------------------------------------
module.exports.user = user;

function log(result) {
    console.log(result);
    return Promise.resolve(result);
}