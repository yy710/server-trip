/**
 * Created by yy710 on 19/05/2017.
 */

class Test {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    show() {
        console.log("x + y = ", this.x + this.y);
    }
}

//var test = new Test(1, 5);
//console.log("test: ", test);
//test.show();

function Test2(x, y) {
    this.x = x;
    this.y = y;
    //return this;
}

Test2.prototype.show = function () {
    console.log("x + y = ", this.x + this.y);
};

var test2 = new Test2(1, 5);
//test2.show();

var test5 = {x: 7, y: 9};
test5.show = function () {
    var z = this.x + this.y;
    console.log(z);
};

//test5.show();

module.exports = {test5: test5, Test: Test};