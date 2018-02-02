//小程序

/** 检查 session 是否合法
 * @param sid: 本地存储的 session 值
 * @returns {isLogin: true|false} 标注登录是否有效
 *  ---------------------------------------------------------------------------------------------
 */
function checkLogin(sid) {
  return new Promise(function (resolve, reject) {
    //sid 为空则直接返回
    if (!sid) resolve({ isLogin: false });

    wx.request({
      url: 'https://www.all-ecar.net/chklogin',
      data: { "sid": sid },
      method: 'GET', // OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT
      // header: {}, // 设置请求的 header
      success: function (res) {
        // success
        console.log("chklogin: ", res);
        resolve(res.data);
      },
      fail: function () {
        // fail
        reject("连接服务器失败");
      },
      complete: function () {
        // complete
      }
    });
  });
}


/** 向server发送用户登录请求
 * @param data: { code: "", encryptedData: "", iv: "" }
 * @returns { sid: "" , expire_in: ""}
 * --------------------------------------------------------------------------------------------------
 */
function login(data) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: 'https://www.all-ecar.net/onLogin',
      data: data,
      method: 'GET', // OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT
      // header: {}, // 设置请求的 header
      success: function (res) {
        // success
        console.log("onLogin: ", res);
        if (res.data.sid) {
          //get sid
          resolve(res.data.sid);
        }
      },
      fail: function () {
        // fail
        reject("onLogin 请求不成功！");
      },
      complete: function () {
        // complete
      }
    });
  });
}