/**
 * Created by yy710 on 19/05/2017.
 */
'use strict';

var test = require('./test3');
var Test = test.Test;
console.log((new Test(10,6)).show());


var user = require('../user.js').user;
user.find();