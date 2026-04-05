(function() {
    console.log('微信公众号 SVG 注入器 - v3.0 ProseMirror 适配版已就绪');

    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'SVG_INJECT_REQUEST') {
            const html = event.data.html;
            
            // 方案 1: 模拟粘贴 (最通用，适配 ProseMirror)
            function insertByPaste(content) {
                const target = document.querySelector('.ProseMirror') || 
                               document.querySelector('[contenteditable="true"]') ||
                               (document.getElementById('ueditor_0') && document.getElementById('ueditor_0').contentDocument.body);
                
                if (!target) return false;

                target.focus();
                
                // 创建 ClipboardData 模拟对象
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/html', content);
                dataTransfer.setData('text/plain', 'SVG Content');

                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true
                });

                target.dispatchEvent(pasteEvent);
                console.log('已尝试通过模拟粘贴插入内容');
                return true;
            }

            // 方案 2: 尝试调用 ProseMirror 内部 View (如果暴露)
            function insertByProseMirror(content) {
                const pmElement = document.querySelector('.ProseMirror');
                if (pmElement && pmElement.view) {
                    const view = pmElement.view;
                    const { state, dispatch } = view;
                    const { schema } = state;
                    // 注意：ProseMirror 插入 HTML 需要解析
                    const element = document.createElement('div');
                    element.innerHTML = content;
                    const slice = view.someProp("clipboardParser").parseSlice(content, { preserveWhitespace: true });
                    const transaction = state.tr.replaceSelection(slice);
                    dispatch(transaction);
                    console.log('已尝试通过 ProseMirror View 插入内容');
                    return true;
                }
                return false;
            }

            // 方案 3: 传统的 UEditor 兼容 (保留作为降级)
            function insertByUEditor(content) {
                try {
                    var ue = window.UE && window.UE.getEditor('js_editor');
                    if (ue && ue.isReady) {
                        ue.execCommand('insertHtml', content);
                        return true;
                    }
                } catch(e) {}
                return false;
            }

            // 执行顺序：ProseMirror -> 模拟粘贴 -> UEditor
            if (!insertByProseMirror(html)) {
                if (!insertByPaste(html)) {
                    insertByUEditor(html);
                }
            }
        }
    });
})();
