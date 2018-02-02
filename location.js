/**
 * Created by yy710 on 10/02/2017.
 */

//------------------------------------------------------------------------------------
"use strict";

var http = require('http');
var BufferHelper = require('./bufferhelper.js');
var location = {};

/**
 * 组装location数据结构
 * @param lng
 * @param lat
 * @param label
 * @returns {Promise}
 */
location.new = function (c) {
    return {
        point: {
            type: "Point",
            coordinates: [Number(c.longitude), Number(c.latitude)]
        },
        label: c.label || null
    };
};

/**
 * 调用百度API获得label
 * @param loc
 * @returns {Promise}
 */
location.getLabel = function (loc) {
    let urlTx = `http://apis.map.qq.com/ws/geocoder/v1/?location=${loc.point.coordinates[1]},${loc.point.coordinates[0]}&key=4RLBZ-JLFKP-ZBLDV-VR6FQ-URJFF-3UFAH&get_poi=0`;
    var url = "http://api.map.baidu.com/geocoder/v2/?ak=rXGkZxFwmrEy7B2oFPfvQjR7&location=" + loc.point.coordinates[1] + "," + loc.point.coordinates[0] + "&output=json&coordtype=gcj02ll";
    return new Promise(function (resolve, reject) {
        http.get(urlTx, (res) => {
            var bufferHelper = new BufferHelper();
            res.on('data', (chunk) => {
                //console.log(`BODY: ${chunk}`);
                bufferHelper.concat(chunk);
            });
            res.on('end', ()=> {
                var html = bufferHelper.toBuffer().toString();
                var res = JSON.parse(html);
                //loc.label = res.result.formatted_address;//百度
                //loc.label = res.result.address;//腾讯
                loc.label = res.result.formatted_addresses.recommend;//腾讯2
                resolve(loc);
            })
        }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
            reject(e);
        });
    });
};

/**
 * 按地球坐标计算两点距离
 * @param loc1
 * @param loc2
 * @returns {string}
 */
location.getDistance = function (loc1, loc2) {
    var lng1 = loc1.point.coordinates[0];
    var lat1 = loc1.point.coordinates[1];
    var lng2 = loc2.point.coordinates[0];
    var lat2 = loc2.point.coordinates[1];

    var EARTH_RADIUS = 6378137.0;    //单位M
    var PI = Math.PI;

    function getRad(d) {
        return d * PI / 180.0;
    }

    var f = getRad((lat1 + lat2) / 2);
    var g = getRad((lat1 - lat2) / 2);
    var l = getRad((lng1 - lng2) / 2);

    var sg = Math.sin(g);
    var sl = Math.sin(l);
    var sf = Math.sin(f);

    var s, c, w, r, d, h1, h2;
    var a = EARTH_RADIUS;
    var fl = 1 / 298.257;

    sg = sg * sg;
    sl = sl * sl;
    sf = sf * sf;

    s = sg * (1 - sl) + (1 - sf) * sl;
    c = (1 - sg) * (1 - sl) + sf * sl;

    w = Math.atan(Math.sqrt(s / c));
    r = Math.sqrt(s * c) / w;
    d = 2 * w * a;
    h1 = (3 * r - 1) / 2 / c;
    h2 = (3 * r + 1) / 2 / s;

    var distance = d * (1 + fl * (h1 * sf * (1 - sg) - h2 * (1 - sf) * sg));
    return (distance / 1000).toFixed(2);
};

/**
 * 获得(腾讯接口)导航链接(需要客户端浏览器能自动获取当前位置)
 * @param loc
 * @returns {*}
 */
location.getTXnavURL = function (loc) {
    var label = loc.label || '目的地';
    return `http://apis.map.qq.com/uri/v1/routeplan?type=drive&to=${label}&tocoord=${loc.point.coordinates[1]},${loc.point.coordinates[0]}&policy=0&referer=wxdd`;
};


/**
 * 调用百度地图API查询(驾车)路径信息及客户确认订单提示
 * 参考 http://lbsyun.baidu.com/index.php?title=webapi/direction-api
 * mode 导航模式，包括：driving（驾车）、walking（步行）、transit（公交）、riding（骑行）
 * 传入一个location数组作为参数
 * @returns {*}
 */
location.getNavInfo = function (locs) {
    //导航模式设定
    var mode = 'driving';
    //起始坐标设定
    var slat = locs[0].point.coordinates[1];
    var slng = locs[0].point.coordinates[0];
    var dlat = locs[1].point.coordinates[1];
    var dlng = locs[1].point.coordinates[0];
    //拼接url
    var url = `http://api.map.baidu.com/direction/v1?mode=${mode}&origin=`;
    url = url + slat + ",";
    url = url + slng + "&destination=";
    url = url + dlat + ",";
    url = url + dlng + "&origin_region=%E6%98%86%E6%98%8E&destination_region=%E6%98%86%E6%98%8E&output=json&ak=rXGkZxFwmrEy7B2oFPfvQjR7&coordtype=gcj02ll";

    return new Promise(function (resolve, reject) {
        http.get(url, (res) => {
            var bufferHelper = new BufferHelper();

            res.on('data', (chunk) => {
                //console.log(`BODY: ${chunk}`);
                bufferHelper.concat(chunk);
            });

            res.on('end', ()=> {
                var html = bufferHelper.toBuffer().toString();
                var res = JSON.parse(html);
                //距离
                var distance = res['result']['routes'][0]['distance'] / 1000;
                //需要时间
                var duration = secondToMinute(res['result']['routes'][0]['duration']);
                //费用
                //this.doc.fare = this.doc.distance * this.doc.price;
                resolve({"distance": distance, "duration": duration});
            });

        }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
            reject(e);
        });
    });
};


//------------------------------------------------------------------------------------
/**
 * 转换毫秒到小时分钟秒
 * @param msd
 * @returns {*}
 */
function secondToDate(msd) {
    //毫秒
    var time = parseFloat(msd) / 1000;
    //秒
    //var time = msd;
    if (null != time && "" != time) {
        if (time > 60 && time < 60 * 60) {
            time = parseInt(time / 60.0) + "分钟" + parseInt((parseFloat(time / 60.0) -
                    parseInt(time / 60.0)) * 60) + "秒";
        }
        else if (time >= 60 * 60 && time < 60 * 60 * 24) {
            time = parseInt(time / 3600.0) + "小时" + parseInt((parseFloat(time / 3600.0) -
                    parseInt(time / 3600.0)) * 60) + "分钟" +
                parseInt((parseFloat((parseFloat(time / 3600.0) - parseInt(time / 3600.0)) * 60) -
                    parseInt((parseFloat(time / 3600.0) - parseInt(time / 3600.0)) * 60)) * 60) + "秒";
        }
        else {
            time = parseInt(time) + "秒";
        }
    }
    return time;
}

/**
 * 转换秒到小时及分钟
 * @param second
 * @returns {string}
 */
function secondToMinute(second) {
    var h = 0;
    var d = 0;
    var s = 0;
    var temp = second % 3600;
    if (second > 3600) {
        h = second / 3600;
        if (temp != 0) {
            if (temp > 60) {
                d = temp / 60;
                if (temp % 60 != 0) {
                    s = temp % 60;
                }
            } else {
                s = temp;
            }
        }
    } else {
        d = second / 60;
        if (second % 60 != 0) {
            s = second % 60;
        }
    }
    //return h+"时"+d+"分"+s+"秒";
    return Math.round(h) + "小时" + Math.round(d) + "分";
}

/**

 * approx distance between two points on earth ellipsoid

 * @param {Object} lat1

 * @param {Object} lng1

 * @param {Object} lat2

 * @param {Object} lng2

 */
function getFlatternDistance(lng1, lat1, lng2, lat2) {

    var EARTH_RADIUS = 6378137.0;    //单位M
    var PI = Math.PI;

    function getRad(d) {
        return d * PI / 180.0;
    }

    var f = getRad((lat1 + lat2) / 2);
    var g = getRad((lat1 - lat2) / 2);
    var l = getRad((lng1 - lng2) / 2);

    var sg = Math.sin(g);
    var sl = Math.sin(l);
    var sf = Math.sin(f);

    var s, c, w, r, d, h1, h2;
    var a = EARTH_RADIUS;
    var fl = 1 / 298.257;

    sg = sg * sg;
    sl = sl * sl;
    sf = sf * sf;

    s = sg * (1 - sl) + (1 - sf) * sl;
    c = (1 - sg) * (1 - sl) + sf * sl;

    w = Math.atan(Math.sqrt(s / c));
    r = Math.sqrt(s * c) / w;
    d = 2 * w * a;
    h1 = (3 * r - 1) / 2 / c;
    h2 = (3 * r + 1) / 2 / s;

    var distance = d * (1 + fl * (h1 * sf * (1 - sg) - h2 * (1 - sf) * sg));
    return (distance / 1000).toFixed(2);
}

exports.location = location;