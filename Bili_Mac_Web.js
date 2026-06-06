/**
 * Bilibili 多端通用虚拟大会员及净化核心处理逻辑
 * 适用环境：安卓 (Surfboard/Mihomo) 或 Mac 代理层解密后的 JSON 响应体
 */

function modifyBilibiliResponse(url, responseBody) {
    try {
        let obj = JSON.parse(responseBody);

        // 1. 个人中心与账号状态接口 (虚拟大会员核心)
        if (url.includes("/x/v2/account/mine") || url.includes("/x/space/myinfo") || url.includes("/account/box")) {
            if (obj.data) {
                // 强制注入年度大会员状态
                obj.data.vip = {
                    type: 2,          // 2 代表年度大会员
                    status: 1,        // 1 代表激活状态
                    due_date: 1924992000000, // 有效期至 2031 年
                    vip_label: {
                        path: "",
                        text: "年度大会员",
                        label_theme: "annual_vip",
                        text_color: "#FFFFFF",
                        bg_style: 1,
                        bg_color: "#FB7299",
                        border_color: ""
                    },
                    nickname_color: "#FB7299",
                    role: 3,
                    avatar_subscript: 1,
                    avatar_subscript_url: ""
                };
                // 部分接口的额外大会员标记
                if (obj.data.profile) obj.data.profile.vip = obj.data.vip;
                if (obj.data.vip_type !== undefined) obj.data.vip_type = 2;
                if (obj.data.vip_status !== undefined) obj.data.vip_status = 1;
            }
        }

        // 2. 视频播放界面增强 (尝试解锁高画质画幅标识)
        if (url.includes("/playurl")) {
            if (obj.data && obj.data.vip_info) {
                obj.data.vip_info.status = 1;
                obj.data.vip_info.type = 2;
            }
        }

        // 3. 顺手清理信息流/动态中的广告 (净化层)
        if (url.includes("/feed/index") || url.includes("/feed/rcmd")) {
            if (obj.data && obj.data.items) {
                // 过滤带有广告、游戏推广、电商标签的卡片
                obj.data.items = obj.data.items.filter(item => {
                    const cardType = item.card_type || "";
                    const ad_info = item.ad_info || null;
                    return !cardType.includes("ad") && !ad_info && !item.banner_info;
                });
            }
        }

        return JSON.stringify(obj);
    } catch (e) {
        console.log("Bilibili 虚拟大会员脚本解析失败: " + e);
        return responseBody; // 发生错误时原样返回，防止 App 或网页断网
    }
}

// ================== 平台运行时环境适配 (Environment Wrapper) ==================
if (typeof $request !== "undefined" && typeof $response !== "undefined") {
    // 代理软件环境 (Surge, Surfboard, Mihomo 等)
    let modifiedBody = modifyBilibiliResponse($request.url, $response.body);
    $done({ body: modifiedBody });
} else {
    // 如果你在编写标准的 Web 拦截器 (例如配合 Tampermonkey 劫持 fetch/XHR)
    // 可以在控制台或插件内直接调用 modifyBilibiliResponse(window.location.href, responseData);
}
