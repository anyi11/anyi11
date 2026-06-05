/**
 * 专为 Mac Chrome 网页端魔改的 Bilibili 净化脚本
 * 适配原 BiliHD 的基础逻辑，剥离 gRPC，专攻 Web API 
 */

let url = $request.url;
let response = {};

try {
    if ($response.body) {
        let obj = JSON.parse($response.body);

        // 1. 净化网页版首页推荐流中的广告位
        if (url.includes("/x/web-interface/wbi/index/top/feed/rcmd")) {
            if (obj.data && obj.data.item) {
                obj.data.item = obj.data.item.filter(item => {
                    // 剔除带有广告标识（is_ad）或运营推广的内容
                    return !item.is_ad && item.goto !== "ad" && !item.ad_info;
                });
            }
        }

        // 2. 净化播放器下方、侧边栏的相关推荐广告
        if (url.includes("/x/web-interface/wbi/archive/related")) {
            if (obj.data) {
                obj.data = obj.data.filter(item => !item.is_ad && item.goto !== "ad");
            }
        }

        // 3. 屏蔽弹幕/评论区上方的活动横幅广告 (Banner)
        if (url.includes("/x/web-interface/wbi/operation/activity")) {
            if (obj.data) obj.data = {}; // 直接清空活动推荐数据
        }

        response.body = JSON.stringify(obj);
    } else {
        response.body = $response.body;
    }
} catch (e) {
    console.log("Bili_Mac_Web 脚本解析失败: " + e);
    response.body = $response.body;
}

$done(response);
