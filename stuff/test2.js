/**
 * Created by yy710 on 15/04/2017.
 */

'use strict';

/**
 * call 示范使用
 * @type {{name: string, display: someuser.display}}
 */
var someuser = {
    name: 'byvoid',
    display: function (words) {
        console.log(this.name + ' says ' + words);
    }
};

var foo = {name: 'foobar'};

someuser.display.call(foo, 'hello'); // 输出 foobar says hello


/**
 * 研究 arrary 的 map() async return 问题
 * @type {number[]}
 */
var a = [1, 2, 3];

/**
 * async/await 方案,实际是 return promise 对象
 * @type {Array}
 */
var b = a.map(async function (item) {
    await setTimeout(()=> {
    }, 500);
    return item + 2;
});

setTimeout(()=>console.log("b300: ",b), 300);
Promise.all(b).then(console.log);

/**
 * 采用原生 promise 实现
 * @type {Array}
 */
var c = a.map(function (item) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(item + 3);
        }, 500);
    });
});

setTimeout(()=>console.log("c300: ",c), 300);
Promise.all(c).then(console.log);

/**
 * 采用高阶函数实现, 这也是所有方案的基础
 * @type {Array}
 */
var d = a.map(function (item) {
    return (new function () {
        //this.n = item;
        var that = this;
        setTimeout(function () {
            that.n = item + 5
        }, 500);
    });
});

setTimeout(()=>console.log("d300: ", d), 300);
setTimeout(()=>console.log(d), 600);

//总结: event 方案实现大同小异,核心思想为函数式编程的"惰性求值"扩展,即不直接返回值,而是返回函数和promise对象等高阶结构