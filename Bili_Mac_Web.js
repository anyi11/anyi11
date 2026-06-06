/**
 * Bilibili 多端虚拟大会员 & 净化重写脚本 (Surge 专用纯 JS 版)
 * 适用于: Surge / Surfboard / Quantumult X
 * 拦截域名: app.bilibili.com, api.bilibili.com
 */

(function() {
    const url = typeof $request !== "undefined" ? $request.url : "";
    const body = typeof $response !== "undefined" ? $response.body : null;

    if (!body) {
        if (typeof $done !== "undefined") $done({});
        return;
    }

    try {
        let obj = JSON.parse(body);

        // 1. 个人中心与账号状态接口 (虚拟大会员核心)
        if (url.includes("/x/v2/account/mine") || url.includes("/x/space/myinfo")) {
            if (obj.data) {
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
                if (obj.data.profile) {
                    obj.data.profile.vip = obj.data.vip;
                }
                if (obj.data.vip_type !== undefined) obj.data.vip_type = 2;
                if (obj.data.vip_status !== undefined) obj.data.vip_status = 1;
            }
        }

        // 2. 视频播放界面增强 (尝试解锁客户端本地画质画幅限制)
        if (url.includes("/playurl")) {
            if (obj.data) {
                obj.data.vip_type = 2;
                obj.data.vip_status = 1;
                if (obj.data.vip_info) {
                    obj.data.vip_info.status = 1;
                    obj.data.vip_info.type = 2;
                }
            }
        }

        // 3. 清理客户端推荐流/动态中的广告 (净化层)
        if (url.includes("/feed/index") || url.includes("/feed/rcmd")) {
            if (obj.data && obj.data.items) {
                obj.data.items = obj.data.items.filter(item => {
                    const cardType = item.card_type || "";
                    const adInfo = item.ad_info || null;
                    return !cardType.includes("ad") && !adInfo && !item.banner_info;
                });
            }
        }

        if (typeof $done !== "undefined") {
            $done({ body: JSON.stringify(obj) });
        }
    } catch (e) {
        console.log("Bilibili Surge 脚本解析失败: " + e);
        if (typeof $done !== "undefined") {
            $done({ body: body }); // 发生错误时原样返回，防止客户端断网
        }
    }
})();
