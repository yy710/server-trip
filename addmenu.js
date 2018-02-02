'use strict';

/**
 * 初始化微信公众号API接口
 */
let WechatAPI = require('wechat-api');
//let customerAPI = new WechatAPI('wx4e52bd5984915d9d', '59620200b91d6682bd776a07fae17a21');
//let employeeAPI = new WechatAPI('wx977eb7e3ce0619c6', 'c7931d20dd605e4ef0d208c08e054285');
//let sfrfAPI = new WechatAPI('wx444f146414e4997f', '69f1c4c0c98652f76a171ca2af2dfe19');
let driverAPI = new WechatAPI('wx977eb7e3ce0619c6', 'c7931d20dd605e4ef0d208c08e054285');


/*
const util = require('util');
employeeAPI.getMenu(function (err, result) {
    console.log('result: %j', result);
});
*/

let employeeMenu = {
    "button": [
        {
            "name": "每日签到",
            "sub_button": [
                {
                    "type": "click",
                    "name": "开始接单",
                    "key": "login"
                },
                {
                    "type": "click",
                    "name": "取消接单",
                    "key": "logout"
                },
                {
                    "type": "click",
                    "name": "状态查询",
                    "key": "queryState"
                }
            ]
        },
        {
            "name": "订单查询",
            "sub_button": [
                {
                    "type": "click",
                    "name": "今日订单",
                    "key": "queryDayOrder"
                },
                {
                    "type": "click",
                    "name": "本月订单",
                    "key": "queryMonthOrder"

                }
            ]
        },
        {
            "name": "派单处理",
            "sub_button": [
                {
                    "type": "click",
                    "name": "接受订单",
                    "key": "acceptOrder"
                },
                {
                    "type": "click",
                    "name": "取消订单",
                    "key": "cancelOrder"
                },
                {
                    "type": "click",
                    "name": "现在出发",
                    "key": "startNow"
                },
                {
                    "type": "click",
                    "name": "开始服务",
                    "key": "startService"
                },
                {
                    "type": "click",
                    "name": "颜值报告",
                    "key": "report"
                }
            ]
        }
    ]
};

let driverMenu = {
    "button": [
        {
            "name": "每日签到",
            "sub_button": [
                {
                    "type": "click",
                    "name": "开始接单",
                    "key": "login"
                },
                {
                    "type": "click",
                    "name": "取消接单",
                    "key": "logout"
                },
                {
                    "type": "click",
                    "name": "状态查询",
                    "key": "queryState"
                },
                {
                    "type": "click",
                    "name": "申请加入",
                    "key": "joinUs"
                }
            ]
        },
        {
            "type": "click",
            "name": "到达终点",
            "key": "arrived"
        },
        {
            "type": "click",
            "name": "我要抢单",
            "key": "ordersAccept"
        }
    ]
};

let customerMenu = {
    "button": [
        {
            "name": "上门洗车",
            "sub_button": [
                {
                    "type": "location_select",
                    "name": "停车地点",
                    "key": "start"
                },
                {
                    "type": "click",
                    "name": "选择套餐",
                    "key": "price"
                },
                {
                    "type": "click",
                    "name": "个人信息",
                    "key": "info"
                }
            ]
        },
        {
            "name": "订单处理",
            "sub_button": [
                {
                    "type": "click",
                    "name": "订单支付",
                    "key": "pay"
                },
                {
                    "type": "click",
                    "name": "订单查询",
                    "key": "queryOrder"
                },
                {
                    "type": "click",
                    "name": "订单取消",
                    "key": "cancelOrder"
                }
            ]
        },
        {
            "name": "关于我们",
            "sub_button": [
                {
                    "type": "click",
                    "name": "最新优惠",
                    "key": "news"
                },
                {
                    "type": "click",
                    "name": "注意事项",
                    "key": "notice"
                },
                {
                    "type": "click",
                    "name": "技术介绍",
                    "key": "technology"
                }
            ]
        }
    ]
};

let sfrfMenu = {
    "button": [
        {
            "name": "会员卡",
            "sub_button": [
                {
                    "type": "click",
                    "name": "申请",
                    "key": "sign"
                },
                {
                    "type": "click",
                    "name": "充值",
                    "key": "add"
                },
                {
                    "type": "click",
                    "name": "查询",
                    "key": "query"
                }
            ]
        },
        {
            "name": "订单",
            "sub_button": [
                {
                    "type": "click",
                    "name": "预约",
                    "key": "pay"
                },
                {
                    "type": "click",
                    "name": "查询",
                    "key": "queryOrder"
                },
                {
                    "type": "click",
                    "name": "取消",
                    "key": "cancelOrder"
                }
            ]
        },
        {
            "name": "了解产品",
            "sub_button": [
                {
                    "type": "click",
                    "name": "最新优惠",
                    "key": "news"
                },
                {
                    "type": "click",
                    "name": "注意事项",
                    "key": "notice"
                },
                {
                    "type": "click",
                    "name": "技术介绍",
                    "key": "technology"
                }
            ]
        }
    ]
};

createMenu(driverAPI, driverMenu);

//-----------------------------------------------------------------
function createMenu(api, menu){
    api.createMenu(menu, function(err, result){
        if(err)throw err;
        console.log(result);
    });
}