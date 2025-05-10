// utils.js - 通用工具函數模組

// 全域錯誤處理
export function setupErrorHandling() {
    window.addEventListener('error', function(event) { 
        console.error("Global error caught:", event.error, "at:", event.filename, ":", event.lineno); 
        
        // 顯示用戶友好的錯誤提示
        showErrorMessage();
    });
}

// 顯示錯誤訊息 UI
function showErrorMessage() {
    const errorMessageElement = document.createElement('div');
    errorMessageElement.className = 'error-message';
    errorMessageElement.innerHTML = `
        <div class="error-container">
            <h3>發生錯誤</h3>
            <p>抱歉，程式運行時出現問題。</p>
            <button id="error-reset-btn">重新開始</button>
        </div>
    `;
    document.body.appendChild(errorMessageElement);
    
    // 綁定重置按鈕
    document.getElementById('error-reset-btn')?.addEventListener('click', function() {
        location.reload();
    });
}

// 效能監測函數
export function setupPerformanceMonitoring() {
    // 如果在開發環境
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        // 測量關鍵渲染時間
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = window.performance.timing;
                    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
                    console.log(`頁面載入時間: ${pageLoadTime}ms`);
                }, 0);
            });
        }
        
        // 測量 FPS
        let lastTime = performance.now();
        let frames = 0;
        let fps = 0;
        
        function measureFPS(now) {
            frames++;
            
            if (now - lastTime > 1000) {
                fps = Math.round((frames * 1000) / (now - lastTime));
                console.log(`當前 FPS: ${fps}`);
                frames = 0;
                lastTime = now;
                
                // 如果 FPS 過低，自動減少動畫效果
                if (fps < 30) {
                    document.body.classList.add('reduced-motion');
                } else {
                    document.body.classList.remove('reduced-motion');
                }
            }
            
            requestAnimationFrame(measureFPS);
        }
        
        requestAnimationFrame(measureFPS);
    }
}

// 檢測設備性能並設置適當的配置
export function detectDeviceCapabilities() {
    // 檢測是否為移動設備
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 檢測是否為低效能設備 (粗略估計)
    const isLowPerfDevice = isMobile && (
        navigator.hardwareConcurrency < 4 || 
        /iPhone\s(5|6|7|8|SE)/i.test(navigator.userAgent)
    );
    
    if (isLowPerfDevice) {
        document.body.classList.add('reduced-motion');
        console.log("檢測到低效能設備，已啟用動畫減少模式");
    }
    
    // 檢測是否預設啟用減少動畫
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('reduced-motion');
        console.log("使用者偏好減少動畫，已啟用減少動畫模式");
    }
}