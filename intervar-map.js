/**
 * Created by yy710 on 06/05/2017.
 */

'use strict';

/**
 * 递归函数实现按时间间隔调用 fn
 * @param start 数组下标计数起始值,通常为 0
 * @param end 计数结束值, 每次 -1 直到等于 0 则调用结束
 * @param time 调用间隔时间,单位:毫秒
 * @param fn 需要调用的函数名称, 此函数以一个正整数(数组下标)为参数
 * @returns {boolean} 结束时返回布尔值
 */
function intervarFn(start, end, time, fn) {
    if (end === 0)return true;
    fn(start);
    setTimeout(()=>intervarFn(start + 1, end - 1, time, fn), time);
}
//syncTimeout(0, 5, 500, console.log);

/**
 * use currying, 实现按时间间隔调用的  array.map
 * @param arr 为传入的数组
 * @param time 为间隔的时间, 默认500毫秒
 * @returns {Function}
 */
function intervalMap(arr, time) {
    var _time = time || 500;
    return function (map) {
        var call = function (m) {
            map(arr[m]);
        };
        return intervarFn(0, arr.length, _time, call);
    };
}
//var arr = ['a','b','c','d','e'];
//intervalMap(arr)(r=>console.log('this is ',r));

//---------------------------------------------------------
module.exports = intervalMap;