(function () {
    console.log('微信公众号 SVG 注入插件 v3.4 已加载');

    // 1. 注入核心脚本 inject.js 到页面上下文
    function injectCoreScript() {
        if (document.getElementById('svg-carousel-inject-script')) return;
        const script = document.createElement('script');
        script.id = 'svg-carousel-inject-script';
        script.src = chrome.runtime.getURL('inject.js');
        script.onload = function () {
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
    }

    // 2. 持续注入按钮到工具栏
    function startPersistentInjection() {
        setInterval(() => {
            const toolbarSelectors = [
                '.edui-toolbar',
                '.editor_toolbar',
                '#edui1_toolbarbox',
                '.mp-editor-toolbar',
                '.weui-desktop-panel__hd',
                '.editor_area_toolbar'
            ];
            let toolbar = null;
            for (const selector of toolbarSelectors) {
                toolbar = document.querySelector(selector);
                if (toolbar) break;
            }

            if (toolbar && !document.getElementById('svg-carousel-btn')) {
                injectButton(toolbar);
            }
        }, 1000);
    }

    function injectButton(toolbar) {
        const btn = document.createElement('div');
        btn.id = 'svg-carousel-btn';
        btn.className = 'edui-box edui-button edui-default';
        btn.style.cssText = 'display: inline-block; vertical-align: middle; margin-left: 5px;';
        btn.innerHTML = `
            <div class="edui-box edui-icon edui-default" style="background: none !important; display: flex; align-items: center; justify-content: center; cursor: pointer; width: 24px; height: 24px;" title="插入SVG组件">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#07c160"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
            </div>
        `;

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showModal();
        };
        toolbar.appendChild(btn);
    }

    // 3. 显示配置弹窗
    function showModal() {
        let modal = document.getElementById('svg-carousel-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'svg-carousel-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; align-items: center;
                justify-content: center; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: #fff; padding: 24px; border-radius: 12px; width: 520px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); position: relative;">
                    <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#07c160"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
                        SVG 注入器 v3.4
                    </h3>
                    
                    <div style="display: flex; border-bottom: 1px solid #eee; margin-bottom: 20px;">
                        <div id="tab-gen" style="padding: 8px 16px; cursor: pointer; border-bottom: 2px solid #07c160; color: #07c160; font-weight: 500;">图片滑动</div>
                        <div id="tab-raw" style="padding: 8px 16px; cursor: pointer; color: #666;">源码注入</div>
                    </div>

                    <!-- 轮播图生成模式 -->
                    <div id="panel-gen">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #666;">图片链接 (每行一个):</label>
                            <textarea id="img-urls" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 12px; line-height: 1.5;" placeholder="请务必使用公众号素材库链接 (https://mmbiz.qpic.cn/...)"></textarea>
                        </div>
                        <div style="margin-bottom: 20px; display: flex; gap: 12px;">
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #666;">宽高比 (宽:高):</label>
                                <input type="text" id="img-ratio" value="375:250" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1; display: flex; align-items: flex-end; padding-bottom: 8px;">
                                <span style="font-size: 12px; color: #999;">支持圆角、引导小字 & 点击放大</span>
                            </div>
                        </div>
                    </div>

                    <!-- 源码注入模式 -->
                    <div id="panel-raw" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #666;">粘贴 SVG 源码:</label>
                            <textarea id="svg-raw-code" style="width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-family: monospace; font-size: 12px; line-height: 1.4;" placeholder="在此粘贴完整的 <svg>...</svg> 代码"></textarea>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
                        <button id="cancel-btn" style="padding: 9px 20px; border: 1px solid #ddd; background: #fff; cursor: pointer; border-radius: 6px; font-size: 14px; color: #666;">取消</button>
                        <button id="confirm-btn" style="padding: 9px 20px; border: none; background: #07c160; color: #fff; cursor: pointer; border-radius: 6px; font-size: 14px; font-weight: 500;">确定插入</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const tabGen = document.getElementById('tab-gen');
            const tabRaw = document.getElementById('tab-raw');
            const panelGen = document.getElementById('panel-gen');
            const panelRaw = document.getElementById('panel-raw');

            tabGen.onclick = () => {
                tabGen.style.borderBottom = '2px solid #07c160';
                tabGen.style.color = '#07c160';
                tabRaw.style.borderBottom = 'none';
                tabRaw.style.color = '#666';
                panelGen.style.display = 'block';
                panelRaw.style.display = 'none';
                modal.dataset.mode = 'gen';
            };

            tabRaw.onclick = () => {
                tabRaw.style.borderBottom = '2px solid #07c160';
                tabRaw.style.color = '#07c160';
                tabGen.style.borderBottom = 'none';
                tabGen.style.color = '#666';
                panelRaw.style.display = 'block';
                panelGen.style.display = 'none';
                modal.dataset.mode = 'raw';
            };

            document.getElementById('cancel-btn').onclick = () => modal.style.display = 'none';
            document.getElementById('confirm-btn').onclick = handleConfirm;
            modal.dataset.mode = 'gen';
        }
        modal.style.display = 'flex';
    }

    function handleConfirm() {
        const modal = document.getElementById('svg-carousel-modal');
        const mode = modal.dataset.mode;
        let finalHtml = '';

        if (mode === 'raw') {
            let rawCode = document.getElementById('svg-raw-code').value.trim();
            if (!rawCode) return;

            if (rawCode.includes('<svg')) {
                rawCode = rawCode.replace(/<svg/i, '<svg style="display: block; width: 100%; visibility: visible !important;"');
            }

            finalHtml = `
                <section style="overflow: hidden; line-height: 0; pointer-events: none; visibility: visible !important; display: block !important;">
                    ${rawCode}
                </section>
                <p><br/></p>
            `;
        } else {
            finalHtml = generatePerfectCarouselHtml();
        }

        if (finalHtml) {
            window.postMessage({ type: 'SVG_INJECT_REQUEST', html: finalHtml }, '*');
            modal.style.display = 'none';
        }
    }

    // 4. 视觉完美版轮播生成逻辑 (v3.4 核心优化)
    function generatePerfectCarouselHtml() {
        const urls = document.getElementById('img-urls').value.split('\n').map(u => u.trim()).filter(u => u);
        if (urls.length < 1) {
            alert('请至少输入一张图片链接');
            return '';
        }

        const ratioStr = document.getElementById('img-ratio').value || '375:250';
        const [width, height] = ratioStr.split(':').map(Number);

        let imagesHtml = '';
        urls.forEach((url, i) => {
            imagesHtml += `
                <section style="display: inline-block; width: 100%; scroll-snap-align: center; vertical-align: top;">
                    <svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display: block; width: 100%; visibility: visible !important;">
                        <image href="${url}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                    </svg>
                </section>
            `;
        });

        // 核心优化：
        // 1. 外部容器添加 border-radius 和 overflow: hidden
        // 2. 底部添加引导小字
        // 3. 确保图片可独立点击放大
        return `
            <section style="margin: 10px 0; visibility: visible !important; display: block !important;">
                <section style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); line-height: 0;">
                    <section style="overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; line-height: 0; white-space: nowrap; scroll-snap-type: x mandatory; visibility: visible !important; display: block !important;">
                        ${imagesHtml}
                    </section>
                </section>
                <section style="text-align: center; margin-top: 8px; line-height: 1.5;">
                    <span style="font-size: 12px; color: #999; letter-spacing: 1px;">左右滑动查看</span>
                </section>
            </section>
            <p><br/></p>
        `;
    }

    injectCoreScript();
    startPersistentInjection();
})();
