/**
 * 专为 Mac Chrome 网页端魔改的 Bilibili 净化脚本 (GitHub 托管验证版)
 * 完美清洗：首页 Web 推荐流广告、视频页侧边栏、弹幕上方活动 Banner
 */

let url = $request.url;
let response = {};

// 严格环境验证：确保响应体存在且非空，防止 JSON.parse 崩溃引发 Surge 死锁
if (typeof $response !== "undefined" && $response.body) {
    try {
        let obj = JSON.parse($response.body);

        // 1. 验证并清洗：网页版首页推荐流 (WBI Index Feed) 中的广告位
        if (url.includes("/x/web-interface/wbi/index/top/feed/rcmd")) {
            if (obj.data && Array.isArray(obj.data.item)) {
                obj.data.item = obj.data.item.filter(item => {
                    // 精准剔除带有广告（is_ad）、 goto=="ad" 以及附带 ad_info 结构的推荐块
                    return !item.is_ad && item.goto !== "ad" && !item.ad_info;
                });
            }
        }

        // 2. 验证并清洗：播放器右侧、侧边栏的相关视频推荐广告
        if (url.includes("/x/web-interface/wbi/archive/related")) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => {
                    return !item.is_ad && item.goto !== "ad";
                });
            }
        }

        // 3. 验证并清洗：弹幕区/评论区上方的活动横幅广告 (Banner)
        if (url.includes("/x/web-interface/wbi/operation/activity")) {
            if (obj.data) {
                obj.data = {}; // 直接降维打击，清空运营活动广告数据
            }
        }

        response.body = JSON.stringify(obj);
    } catch (e) {
        // 容错机制：一旦解析失败（例如B站偷偷改了字段结构），平滑放行原数据，绝不卡死网页
        console.log("⚠️ Bili_Mac_Web 脚本解析异常: " + e);
        response.body = $response.body;
    }
} else {
    response.body = $response.body;
}

// 必须调用 $done 归还控制权给 Surge 核心
$done(response);
