/**
 * Created by yy710 on 23/04/2017.
 */

var co = require('co');

function after5() {
    return new Promise(function (resolve, reject) {
        setTimeout(()=>resolve(true), 1000);
    });
}

async function a() {
    var t = await after5();
    console.log("awaiat return: ", t);
}

function* gen() {
    var tt = 0;
    yield tt;
    yield after5();
    return tt;
}

a();
var g = gen();
g.next();
//g.next();
console.log("yield: ", g.next());
console.log(after5());