/**
 * 专为 Mac Chrome 网页端定制的 Bilibili 播放画质解锁与区域限制欺骗脚本
 * 适用域名：api.bilibili.com
 */

const url = $request.url;
if (!$response || !$response.body) {
    $done({});
}

try {
    let obj = JSON.parse($response.body);

    // 拦截并魔改 Web 网页端的视频/番剧播放鉴权接口
    if (url.indexOf("/pgc/player/web/playurl") !== -1 || url.indexOf("/x/player/wbi/playurl") !== -1) {
        
        // 核心逻辑：解除画质锁定，强制开启 4K/1080P 高码率支持
        if (obj.data && obj.data.accept_quality) {
            if (!obj.data.accept_quality.includes(120)) {
                obj.data.accept_quality.push(120, 116, 80);
                obj.data.accept_description.push("4K 超清", "1080P 高码率", "1080P 高清");
            }
        }
        
        // 如果触发了港澳台等区域版权限制，对返回的状态码进行欺骗修正
        if (obj.code === -404 || obj.code === -400) {
            obj.code = 0;
            obj.message = "success";
        }
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    // 严苛的容错机制：发生任何解析异常时直接返回原请求体，绝不憋死或挂起网页连接
    $done({});
}
