'use strict';

var http = require('http');
var assert = require('assert');
var BufferHelper = require('./bufferhelper.js');

var location = {};
var customer = {};
var order = {};
var employee = {};
/*
 var employee = function (db, openid, ep) {
 this.db = db;
 this.openid = openid;
 this.ep = ep;//内置事件发射器
 this.state = new Map([
 [0, '新用户'],
 [10, '用户信息完整'],
 [20, '认证通过,已成为正式注册用户'],
 [30, '已签到'],
 [40, '已接单'],
 [50, '已出发, 正在赶往服务地点'],
 [60, '已到达,开始服务'],
 [70, '服务结束,填写颜值报告'],
 [80, '颜值报告已发送']
 ]);
 };
 */


//------------------------------------------------------------------------------------
/**
 * 在 chain 中输出到 console
 * @param res
 * @returns {Promise}
 */
exports.log = function (res) {
    return new Promise(function (resolve, reject) {
        console.log(res);
        resolve(res);
    });
};


//------------------------------------------------------------------------------------
customer.getInput = function (ee, content, sms) {
    return function (customer) {
        return _getInput(ee, content, sms, customer);
    };
};
var _getInput = function (ee, content, sms, customer) {
    return new Promise(function (resolve, reject) {
        //正则表达式定义
        var regMobile = /^1[34578]\d{9}$/;
        var regCar = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领a-zA-Z]{1}[a-zA-Z]{1}[警京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]{0,1}[a-zA-Z0-9]{4}[a-zA-Z0-9挂学警港澳]{1}$/;
        var regName = /^[\u4e00-\u9fa5]{2,4}$/;
        var regPrice = /^35|45|55$/;
        var regCode = /^\d{4}$/;

        //回复内容按空格分隔解析到数组
        var content_arry = content.split(' ');
        var text = '';

        //遍历数组匹配正则
        for (var input of content_arry) {
            if (regMobile.test(input)) {
                var authenticode = Math.round(Math.random() * 10000);
                customer.waitInput = {ifInput: authenticode, thenPhone: input, time: Date.now()};

                sms(authenticode)(input).then(code=> {
                    //customer.waitInput = {"ifInput": code, "thenPhone": input};
                    text += "为确保服务, 已将验证码通过短信发送到你的手机, 请回复您收到的四位数字...";
                    customer.rep = text;
                    ee.emit('sendTextToCustomer', text);
                    //resolve(customer);
                }).catch(console.log);

                /*
                 setTimeout(code=> {
                 customer.waitInput = {ifInput: code || 1234, thenPhone: input};
                 text += "为确保服务, 已将验证码发送到你的手机, 请回复您收到的四位数字...";
                 customer.rep = text;
                 resolve(customer);
                 }, 500);
                 */
            } else if (regCode.test(input) &&
                customer.hasOwnProperty('waitInput') &&
                customer.waitInput !== null &&
                customer.waitInput.ifInput === Number(input)) {
                if ((Date.now() - customer.waitInput.time) > 300) {
                    text += "验证码已过期, 请再次回复你的手机号获取新验证码...\n";
                } else {
                    customer.phone = customer.waitInput.thenPhone;
                    customer.waitInput = null;
                    text += "已设置手机号为: " + customer.phone + '\n';
                }
            } else if (regCar.test(input)) {
                customer.carid = input;
                text += "已设置车牌号为: " + customer.carid + '\n';
            } else if (regName.test(input)) {
                customer.name = input;
                text += "已设置姓名为: " + customer.name;
            } else if (regPrice.test(input)) {
                customer.price = input;
                text += "已设置洗车套餐为: " + customer.price;
                ee.emit('setPrice', input);
            } else text = "系统不能识别您的指令, 请重新输入...";
        }
        customer.rep = text;
        resolve(customer);
    });
};

/**
 * load customer or add new orderid to customer
 * @param db
 * @param openid
 * @returns {Promise}
 */
customer.init = function (db, openid) {
    return new Promise(function (resolve, reject) {
        db.collection('customers').find({openid: openid}).limit(1).next(function (err, result) {
            if (err)reject(err);
            var c = result ? result : {
                openid: openid,
                state: 0,
                orderid: Date.now() + Math.round(Math.random() * 1000),
                updatetime: new Date()
            };
            resolve(c);
        });
    });
};

customer.load = function (db, openid) {
    return db.collection('customers').find({openid: openid}).limit(1).next();
};

customer.addLocation = function (loc) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            customer.location = loc;
            resolve(customer);
        });
    };
};

customer.infoCheck = function (ee) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            var rep = customer.rep;
            rep += "你的个人信息不完整! 请依据以下提示补充个人信息: \n";
            if (!customer.phone) {
                rep += "请输入您的手机号码, 我们的洗车技师在将在必要时和你取得联系!";
                customer.state = 1;
            } else if (!customer.carid) {
                rep += "请输入你的车牌号! 提示: 车牌号将作为我们后续提供服务的重要识别依据.同一车牌的累计洗车金额可等额抵扣下一年度第三者商业险金额";
                customer.state = 2;
            } else if (!customer.name) {
                rep += "请回复你的姓名或昵称, 便于我们和你联系";
                customer.state = 3;
            } else {
                rep = "个人信息完整!";
                customer.state = 5;
                ee.emit('customerOK', customer);
            }
            customer.rep = rep;
            ee.emit('sendTextToCustomer', rep);
            resolve(customer);
        });
    };
};

customer.hasOrder = function (ee) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            if (customer.orderid) {
                //有未完成订单
                ee.emit('hasOrder', customer.orderid);
                reject("hasOrder");
            }
            //无未完成订单
            resolve(customer);
        });
    };
};

customer.getOrderid = function (customer) {
    return customer.orderid;
};

customer.getOrderAndAddEmployee = function (db) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            if (!customer.orderid)reject('Customer.orderid is null!');
            db.collection('orders').find({orderid: customer.orderid}).limit(1).next(function (err, result) {
                if (err)throw err;
                if (!result)reject(new Error('No found order!'));
                resolve(result);
            });
        });
    };
};

customer.setOrderid = function (orderid) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            customer.orderid = orderid;
            resolve(customer);
        });
    };
};

/**
 * 保存用户数据到数据库
 * @param db
 * @param col
 * @param openid
 * @param doc
 * @returns {Promise}
 */
customer.save = function (db) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            db.collection('customers').replaceOne(
                {openid: customer.openid},
                customer,
                {upsert: true, w: 1},
                function (err, result) {
                    assert.equal(err, null);
                    if (err)reject(err);
                    resolve(customer);
                }
            );
        });
    };
};

/**
 * loadOrNew order from customer.orderid
 * @param db
 * @returns {Function}
 */
customer.getAndEnsureOrder = function (db) {
    return function (customer) {
        return new Promise(function (resolve, reject) {
            if (!customer.orderid)reject('Customer.orderid is null!');
            db.collection('orders').find({orderid: customer.orderid}).limit(1).next(function (err, result) {
                if (err)throw err;
                if (!result)reject(new Error('No found order!'));
                resolve(result);
            });
        });
    };
};

customer.isNew = function (ep) {
    return function (c) {

    };
};


//------------------------------------------------------------------------------------
/**
 * 组装location数据结构
 * @param lng
 * @param lat
 * @param label
 * @returns {Promise}
 */
location.new = function (lng, lat, label) {
    return {
        point: {
            type: "Point",
            coordinates: [lng, lat]
        },
        label: label || null
    };
};

/**
 * 调用百度API获得label
 * @param loc
 * @returns {Promise}
 */
location.getLabel = function (loc) {
    var http = require('http');
    var BufferHelper = require('./bufferhelper.js');
    var url = "http://api.map.baidu.com/geocoder/v2/?ak=rXGkZxFwmrEy7B2oFPfvQjR7&location=" + loc.point.coordinates[1] + "," + loc.point.coordinates[0] + "&output=json&coordtype=gcj02ll";

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
                loc.label = res.result.formatted_address;
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


//------------------------------------------------------------------------------------
/**
 * loadOrNew order by orderid
 * @param db
 * @returns {Function}
 */
order.load = function (db) {
    return function (orderid) {
        return db.collection('orders').find({orderid: orderid}).limit(1).next();
    };
};

order.loadOrNew = function (db) {
    return function (orderid) {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    };
};

order.setPrice = function (price) {
    return function (od) {
        od.price = price;
        return Promise.resolve(od);
    };
};

order.setState = function (state) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            order.state = state;
            resolve(order);
        });
    };
};

order.addCustomer = function (c) {
    return function (od) {
        return new Promise(function (resolve, reject) {
            od.customer = c;
            resolve(od);
        });
    };
};

order.addEmployee = function (employee, ep) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            order.state = {id: 20, msg: "已指派服务技师"};
            order.employee = employee;
            ep.emit('employeeAccessOrder', order);
            resolve(order);
        });
    };

};

order.removeEmployee = function (order) {
    return new Promise(function (resolve, reject) {
        order.employee = null;
        resolve(order);
    });
};

order.hasEmployee = function (order) {
    if (order.employee)return true;
};

order.setPrice = function (price) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            order.price = price;
            resolve(order);
        });
    };
};

/**
 * 调用百度地图API查询(骑行)路径信息及客户确认订单提示
 * 参考 http://lbsyun.baidu.com/index.php?title=webapi/direction-api
 * mode 导航模式，包括：driving（驾车）、walking（步行）、transit（公交）、riding（骑行）
 * @returns {*}
 */
order.getNavInfo = function (order) {
    //导航模式设定
    var mode = 'riding';
    //起始坐标设定
    var slat = order.employee.location.point.coordinates[1];
    var slng = order.employee.location.point.coordinates[0];
    var dlat = order.location.point.coordinates[1];
    var dlng = order.location.point.coordinates[0];
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
                order.distance = res['result']['routes'][0]['distance'] / 1000;
                //需要时间
                order.duration = secondToMinute(res['result']['routes'][0]['duration']);
                //费用
                //this.doc.fare = this.doc.distance * this.doc.price;
                resolve(order);
            });

        }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
            reject(e);
        });
    });
};

/**
 * 技师确认接受订单
 * @param ep
 * @returns {Function}
 */
order.employeeAcessOrder = function (ep) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            order.state = 15;
            ep.emit('employeeAccessOrder', order);
            //ep.emit('sendNewsToCustomer', news);
            resolve(order);
        });
    };
};

/**
 * create new order by customer
 * @param customer
 * @returns {Promise}
 */
order.new = function (customer) {
    /**
     * 生成13位数字随机数, 采用时间加随机数算法, 用于订单号
     * @returns {number}
     */
    var random = function () {
        return Date.now() + Math.round(Math.random() * 1000);
    };

    return new Promise(function (resolve, reject) {
        var order = {
            orderid: customer.orderid ? customer.orderid : random(),
            customer: customer,
            updatetime: new Date(),
            price: 35
        };
        resolve(order);
    })
};

order.init = function (db) {
    return function (c) {
        return new Promise(function (resolve, reject) {
            var id = c.orderid ? c.orderid : Date.now() + Math.round(Math.random() * 1000);
            db.collection('orders').find({orderid: id}).limit(1).next(function (err, result) {
                if (err)reject(err);
                resolve(result ? result : {
                    orderid: id,
                    state: 0,
                    customer: c,
                    updatetime: new Date(),
                    price: 35
                });
            });
        });
    };
};

order.addLocation = function (loc) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            order.location = loc;
            resolve(order);
        });
    };
};

order.save = function (db) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            db.collection('orders').replaceOne(
                {orderid: order.orderid},
                order,
                {upsert: true, w: 1},
                function (err, result) {
                    assert.equal(err, null);
                    if (err)reject(err);
                    resolve(order);
                }
            );
        })
    };
};

order.delete = function (db) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            db.collection('orders').deleteOne({orderid: order.orderid}, {w: 1}, function (err, result) {
                if (err)reject(err);
                resolve(order);
            });
        });
    };
};

/**
 * 检查订单完整性
 * @param order
 * @returns {Promise}
 */
order.infoCheck = function (ep) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            var str = null;
            if (order.customer.state !== 5) {
                str = "请完善您的个人信息!";
                order.state = 3;
            } else if (!order.location) {
                str = "请设置车辆停放地点";
                order.state = 1;
            } else if (!order.price) {
                order.price = 35;
                str = "系统默认标准洗车套餐35元,\n更改套餐请回复对应价格即可.\n普通轿车外部清洗35元;\n普通轿车连内饰清洗45元;\nSUV外部清洗45元;\nSUV连内饰清洗55元.\n例: 直接回复 55 即选择55元洗车套餐.";
                order.state = 2;
            } else {
                //订单信息完整
                order.state = 10;
                str = `您车牌为: ${order.customer.carid}的爱车停放在: ${order.location.label}, 您选择的洗车套餐为: ${order.price} 元, 我们会通过手机号: ${order.customer.phone} 来联系您, 10秒后系统将自动确认此订单有效并通知最近的技师为您服务, 取消订单请从菜单点击, 在派单成功之前若需要修改订单内容, 可直接回复对应信息并用空格键分隔, 系统会自动识别并修改!(例如回复: 张飞 13705678321 云A12345 55)`;
                str = !order.customer.name ? str : '尊敬的' + order.customer.name + ': ' + str;

                //发送 orderOK 事件
                ep.emit('orderOK', order);
            }
            //通知客户订单状态
            ep.emit('sendTextToCustomer', str);
            order.rep = str;
            resolve(order);
        });
    };
};

order.infoCheck2 = function (od) {
    var text = null;
    if (od.customer.state !== 5) {
        text = "请完善您的个人信息!";
        od.state = 3;
    } else if (!od.location) {
        text = "请设置车辆停放地点";
        od.state = 1;
    } else if (!od.price) {
        od.price = 35;
        text = "系统默认标准洗车套餐35元,\n更改套餐请回复对应价格即可.\n普通轿车外部清洗35元;\n普通轿车连内饰清洗45元;\nSUV外部清洗45元;\nSUV连内饰清洗55元.\n例: 直接回复 55 即选择55元洗车套餐.";
        od.state = 2;
    } else {
        //订单信息完整
        od.state = 10;
        text = `您车牌为: ${od.customer.carid}的爱车停放在: ${od.location.label}, 您选择的洗车套餐为: ${od.price} 元, 我们会通过手机号: ${od.customer.phone} 来联系您, 10秒后系统将自动确认此订单有效并通知最近的技师为您服务, 取消订单请从菜单点击, 在派单成功之前若需要修改订单内容, 可直接回复对应信息并用空格键分隔, 系统会自动识别并修改!(例如回复: 张飞 13705678321 云A12345 55)`;
        text = !od.customer.name ? text : '尊敬的' + od.customer.name + ': ' + text;
    }
    od.rep = text;
    return Promise.resolve(od);
};

order.sendTextToCustomer = function (api) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            api.sendText(order.customer.openid, order.rep, function (err, result) {
                assert.equal(null, err);
                if (err)reject(err);
                if (order.state === 10)setTimeout(()=>ee.emit('orderOK', order), 10000);
                resolve(order);
            });
        });
    };
};

/**
 * 按时间间隔分配任务到技师
 * 按设定的时间间隔遍历employees数组, 形式为process(employee)
 * @param process
 * @returns {Function}
 */
order.dispatch = function (process, time) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            arraySyncTimeout(order.employees, time)(process);
            resolve(order);
        });
    };
};

/**
 * 查找洗车技师
 * @param db
 * @param ee
 * @param maxDistance
 * @returns {Function}
 */
order.getEmployees = function (db, ee, maxDistance) {
    var maxDistance2 = maxDistance || 5000;
    return function (order) {
        return _getEmployees(db, ee, maxDistance2, order);
    };
};
var _getEmployees = function (db, ee, maxDistance, order) {
    return new Promise(function (resolve, reject) {
        db.collection('employees').find({
            "location.point": {
                $nearSphere: {
                    $geometry: order.location.point,
                    $maxDistance: maxDistance
                }
            },
            //已签到
            "state.id": 30
        }).limit(2).toArray(function (err, employees) {
            if (err)reject(err);
            if (employees) {
                order.employees = employees;
                ee.emit('findEmployee', order);
            } else {
                ee.emit('noFindEmployee', order);
            }
            resolve(order);
        });
    });
};

order.askEmployee = function (ee) {
    return function (order) {
        return new Promise(function (resolve, reject) {
            ee.emit('isWorker', order);
        });
    };
};


//------------------------------------------------------------------------------------
employee.loadOrNew = function (db, openid) {
    return new Promise(function (resolve, reject) {
        db.collection('employees').find({openid: openid}).limit(1).next(function (err, result) {
            if (err)reject(err);

            if (!result) {
                //创建新技师数据
                result = {
                    openid: openid,
                    state: {id: 0, msg: "新技师"},
                    orderids: [],
                    updateTime: new Date()
                };
            }
            resolve(result);
        });
    });
};

employee.getInput = function (ep, content) {
    return function (e) {
        return new Promise(function (resolve, reject) {
            //正则表达式定义
            var regMobile = /^1[34578]\d{9}$/;
            var regName = /^[\u4e00-\u9fa5]{2,4}$/;
            var regIDcard = /^[1-9]\d{5}[1-9]\d{3}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])\d{3}([0-9]|X)$/;

            //回复内容按空格分隔解析到数组
            var content_arry = content.split(' ');
            var text = '';

            //遍历数组匹配正则
            for (let c of content_arry) {
                if (regMobile.test(c)) {
                    e.phone = c;
                    text += "已设置手机号为: " + e.phone + '\n';
                } else if (regIDcard.test(c)) {
                    e.IDcard = c;
                    text += "已设置身份证号码为: " + e.IDcard + '\n';
                } else if (regName.test(c)) {
                    e.name = c;
                    text += "已设置姓名为: " + e.name + '\n';
                } else {
                    text += "系统不能识别您的指令 " + c + ", 请重新输入...\n";
                    //reject(new Error('Input is not identify!'));
                }
            }
            e.rep = text;
            //ep.emit('sendTextToEmployee', text);
            resolve(e);
        });
    };
};

employee.infoCheck = function (ep) {
    return function (e) {
        let str = "你的个人信息不完整! 请依据以下提示补充个人信息, 否则不能正常接单... \n";
        var rep = e.rep ? e.rep + str : str;
        if (!e.phone) {
            rep += "请回复您的手机号码!";
            e.state = {id: 1, msg: "等待回复手机号"};
        } else if (!e.IDcard) {
            rep += "请回复你的身份证号码!";
            e.state = {id: 2, msg: "等待回复身份证号"};
        } else if (!e.name) {
            rep += "请回复你的姓名!";
            e.state = {id: 3, msg: "等待回复姓名"};
        } else if (!e.picurl) {
            rep += "请发送你的正装头像照片!";
            e.state = {id: 4, msg: "等待回复头像"};
        } else {
            rep = "个人信息完整,请从右上角点击头像图标, 然后打开[提供位置信息]开关, 在重新进入公众号后, 再从下方菜单点击签到接单!";
            e.state = {id: 10, msg: "个人信息完整"};
            //ep.emit('replyText', '');
            //return Promise.resolve(e);
        }
        e.rep = rep;
        //ep.emit('replyText', rep);
        ep.emit('sendTextToEmployee', rep);
        return Promise.resolve(e);

    };
};

/**
 * 检查个人信息是否完整 state.id: 10
 * @param e
 * @returns {*}
 */
employee.isInfoCompletion = function (e) {
    if (e.state.id === 10)return Promise.resolve(e);
    return Promise.reject(new Error('Employee info no completion!'));
};

/**
 * 检查是否已签到 state.id: 30
 * @param ep
 * @returns {Function}
 */
employee.isLogin = function (ep) {
    return function (e) {
        return new Promise(function (resolve, reject) {
            if (e.state.id === 30) {
                resolve(e);
            } else {
                ep.emit('sendTextToEmployee', e.state.msg);
                reject(e.state.msg);
            }
        });
    };
};

/**
 * from mongodb load
 * @param db
 * @param openid
 * @returns {Promise}
 */
employee.load = function (db, openid) {
    return db.collection('employees').find({openid: openid}).limit(1).next();
};

employee.check = function (employee) {
    if (employee.state)ep.emit('newEmployee', employee);
};

employee.setStateToAcceptOrder = function () {

};

/**
 * check is or not to be assign
 * @param orderid
 * @returns {Function}
 */
employee.assignOrder = function (orderid) {
    return function (employee) {
        return new Promise(function (resolve, reject) {
            employee.state = {id: 35, msg: "被通知派单"};
            employee.orderids.push(orderid);
            resolve(employee);
        });
    };
};

employee.save = function (db) {
    return function (e) {
        return new Promise(function (resolve, reject) {
            db.collection('employees').replaceOne(
                {openid: e.openid},
                e,
                {upsert: true, w: 1},
                function (err, result) {
                    assert.equal(err, null);
                    if (err)reject(err);
                    resolve(e);
                }
            );
        });
    };
};

/**
 * 检查是否属于被通知接单的技师
 * @param ep
 * @returns {Function}
 */
employee.isAssign = function (ep) {
    return function (e) {
        if (e.orderids.length) {
            return Promise.resolve(e);
        } else {
            ep.emit('sendTextToEmployee', '未指派洗车订单!');
            return Promise.reject(new Error('No order assigned to employee!'));
        }
    }
};

employee.isAssign2 = function (e) {
    var this2 = this;
    return new Promise(function (resolve, reject) {
        this2.db.collection("orders").find({"employees.openid": this2.openid}).limit(1).next(function (err, result) {
            if (err)throw(err);
            if (result) {
                resolve(result);
            } else {
                this2.ep.emit('sendTextToEmployee', '未指派洗车订单!');
                reject(new Error('No order assigned to employee!'));
            }
        });
    });
};

/**
 * loadOrNew order from employee.orderid and add employee to order
 * @param db
 * @returns {Function}
 */
employee.getAndEnsureOrder = function (db, ep) {
    return function (employee) {
        return new Promise(function (resolve, reject) {
            if (!employee.orderid)reject('Employee.orderid is null!');
            db.collection('orders').find({openid: employee.orderid}).limit(1).next(function (err, result) {
                assert.equal(err, null);
                if (err)throw err;
                if (!result)reject(new Error('Employee not be dispatch!'));
                result.employee = employee;
                result.state = 15;
                ep.emit('employeeAccessOrder', order);
                resolve(result);
            });
        });
    };
};

employee.getOrderAndAddEmployee = function (db, ep) {
    var self = this;
    return function (e) {
        return new Promise(function (resolve, reject) {
            db.collection('orders').find({orderid: e.orderids.pop()}).limit(1).next(function (err, order) {
                if (err)throw err;
                if (!order) {
                    ep.emit('sendTextToEmployee', '订单不存在或被取消!');
                    reject(new Error('order is be canceled!!'));
                } else if (order.employee) {
                    ep.emit('sendTextToEmployee', '订单已被其他技师抢走...要加油哦!');
                    reject(new Error('order is be assigned!!'));
                } else {
                    //确认接单
                    e.orderid = order.orderid;
                    e.state = {id: 40, msg: '已接单'};
                    let loc = e.location;
                    location.getLabel(loc).then(loc=> {
                        e.location = loc;
                        order.employee = e;
                        //保存employee
                        self.save(db)(e);
                        ep.emit('employeeAcceptOrder', order);
                        resolve(order);
                    }).catch(console.log);
                }
            });
        });
    };
};

employee.canelOrder = function (e) {
    e.orderid = null;
    return Promise.resolve(e);
};

employee.setAvatar = function (img) {
    return function (e) {
        e.picurl = img;
        return Promise.resolve(e);
    };
};

employee.acceptOrder = function (e) {
    e.state = {id: 20, msg: "技师已接单"};
    return Promise.resolve(e);
};

employee.setLabel = function (getLabel) {
    return function (e) {
        let location = e.location;
        getLabel(location).then(loc=>e.location = loc).catch(console.log);
    };
};

employee.login = function (e) {
    e.state = {id: 30, msg: "你今日已签到, 现在已可以接单!"};
    return Promise.resolve(e);
};

employee.logout = function (e) {
    if (e.state.id < 40) {
        e.state = {id: 20, msg: "你已取消接单, 需要接单请重新签到."};
        return Promise.resolve(e);
    }
    return Promise.reject("你有订单未完成!");
};

employee.addLocation = function (loc) {
    return function (e) {
        return new Promise(function (resolve, reject) {
            e.location = loc;
            resolve(e);
        });
    };
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

function syncTimeout(m, n, t, call) {
    if (n === 0)return true;
    call(m);
    setTimeout(()=>syncTimeout(m + 1, n - 1, t, call), t);
}
//syncTimeout(0, 5, 500, console.log);
function arraySync(arr, time) {
    var time2 = time || 500;
    return function (call) {
        var call2 = function (m) {
            call(arr[m]);
        };
        return syncTimeout(0, arr.length, time2, call2);
    };
}
//var arr = ['a','b','c','d','e'];
//arraySyncTimeout(arr)(console.log);

function sendText(api) {
    return function (user) {
        return new Promise(function (resolve, reject) {
            api.sendText(openid, user.rep, function (err, result) {
                assert.equal(null, err);
                if (err)reject(err);
                resolve(user);
            });
        });
    };
}


//------------------------------------------------------------------------------------
exports.location = location;
exports.customer = customer;
exports.employee = employee;
exports.order = order;
exports.arraySync = arraySync;