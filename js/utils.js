// utils.js - 通用工具函數模組

/**
 * 設置全域錯誤處理。
 * 捕獲未處理的 JavaScript 錯誤，並顯示用戶友好的錯誤訊息。
 */
export function setupErrorHandling() {
    window.addEventListener('error', function(event) {
        console.error("Global error caught:", event.error, "at:", event.filename, ":", event.lineno);

        // 從錯誤事件中提取訊息，如果可用
        const errorMessage = event.error ? event.error.message : '發生未知的運行時錯誤。';
        displayInitializationError(`很抱歉，應用程式遇到問題：${errorMessage}`);
    });

    window.addEventListener('unhandledrejection', function(event) {
        console.error("Global unhandled rejection caught:", event.reason);
        const errorMessage = event.reason instanceof Error ? event.reason.message : (typeof event.reason === 'string' ? event.reason : '發生未知的異步操作錯誤。');
        displayInitializationError(`很抱歉，應用程式在異步操作中遇到問題：${errorMessage}`);
    });
}

/**
 * 顯示一個用戶友好的初始化或運行時錯誤訊息。
 * @param {string} message - 要顯示給用戶的錯誤訊息。
 */
export function displayInitializationError(message) {
    // 移除可能已存在的錯誤訊息，避免重複顯示
    const existingErrorDiv = document.querySelector('.initialization-error-overlay');
    if (existingErrorDiv) {
        existingErrorDiv.remove();
    }

    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'initialization-error-overlay';
    // 應用一些內聯樣式以確保可見性，即使 CSS 未完全加載
    errorOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        padding: 20px;
        box-sizing: border-box;
    `;

    const errorMessageElement = document.createElement('div');
    errorMessageElement.className = 'error-message-content';
    errorMessageElement.style.cssText = `
        background-color: #fff;
        color: #333;
        padding: 30px;
        border-radius: 8px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        font-family: 'Noto Sans TC', sans-serif; /* 與專案其他部分字體保持一致 */
    `;

    errorMessageElement.innerHTML = `
        <h3 style="color: #d9534f; margin-top: 0; margin-bottom: 15px; font-size: 1.5em;">喔不，出錯了！</h3>
        <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.6;">${message || '抱歉，程式初始化時遇到無法處理的問題。'}</p>
        <p style="font-size: 0.9em; color: #777; margin-bottom: 25px;">請嘗試重新載入頁面。如果問題持續發生，請檢查瀏覽器控制台以獲取更多技術細節。</p>
        <button id="error-reset-button" style="
            background-color: #d9534f;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 5px;
            font-size: 1em;
            cursor: pointer;
            transition: background-color 0.3s;
        ">重新載入頁面</button>
    `;
    // 滑鼠懸停效果
    const errorButton = errorMessageElement.querySelector('#error-reset-button');
    if (errorButton) {
        errorButton.onmouseover = () => errorButton.style.backgroundColor = '#c9302c';
        errorButton.onmouseout = () => errorButton.style.backgroundColor = '#d9534f';
    }


    errorOverlay.appendChild(errorMessageElement);
    document.body.appendChild(errorOverlay);

    // 綁定重置按鈕事件
    const resetButton = document.getElementById('error-reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            location.reload();
        });
    }
}

/**
 * 設置效能監測相關功能 (主要用於開發環境)。
 */
export function setupPerformanceMonitoring() {
    // 檢查是否在開發環境 (可以根據需要調整判斷條件)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port) {
        // 測量頁面載入時間
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                // 使用 setTimeout 確保在所有 load 事件處理完畢後執行
                setTimeout(() => {
                    const timing = window.performance.timing;
                    const navigationStart = timing.navigationStart;
                    if (navigationStart === 0) { // navigationStart 可能為 0，表示無法獲取
                        console.warn("[Performance] Navigation Timing API not fully available or navigationStart is 0.");
                        return;
                    }
                    const pageLoadTime = timing.loadEventEnd - navigationStart;
                    if (pageLoadTime > 0) {
                        console.log(`[Performance] 頁面載入時間 (Navigation Timing): ${pageLoadTime}ms`);
                    } else {
                        console.warn("[Performance] Unable to calculate page load time via Navigation Timing (result was <= 0).");
                    }

                    // 嘗試使用 PerformanceNavigationTiming (更現代的 API)
                    if (performance.getEntriesByType) {
                        const navEntries = performance.getEntriesByType("navigation");
                        if (navEntries.length > 0 && navEntries[0] instanceof PerformanceNavigationTiming) {
                            const pnt = navEntries[0];
                            console.log(`[Performance] 頁面載入時間 (PerformanceNavigationTiming - duration): ${pnt.duration.toFixed(2)}ms`);
                            console.log(`[Performance] DOMContentLoaded: ${pnt.domContentLoadedEventEnd.toFixed(2)}ms`);
                            console.log(`[Performance] LoadEvent: ${pnt.loadEventEnd.toFixed(2)}ms`);
                        }
                    }
                }, 0);
            });
        }

        // 簡易 FPS 監測器
        let lastTime = performance.now();
        let frameCount = 0;
        const fpsDisplay = document.createElement('div');
        // 可以為 fpsDisplay 添加一些樣式，使其顯示在頁面上
        // fpsDisplay.style.cssText = 'position:fixed;top:10px;right:10px;padding:5px;background:rgba(0,0,0,0.5);color:white;font-family:sans-serif;z-index:10001;';
        // document.body.appendChild(fpsDisplay);

        function measureFPS(now) {
            frameCount++;
            const delta = now - lastTime;
            if (delta >= 1000) { // 每秒更新一次
                const fps = Math.round((frameCount * 1000) / delta);
                // fpsDisplay.textContent = `FPS: ${fps}`;
                console.log(`[Performance] 當前 FPS: ${fps}`);
                frameCount = 0;
                lastTime = now;

                // 如果 FPS 過低，可以選擇添加 'reduced-motion' class
                // if (fps < 30 && !document.body.classList.contains('reduced-motion')) {
                //     console.warn("[Performance] FPS is low, consider enabling reduced motion.");
                //     // document.body.classList.add('reduced-motion');
                // } else if (fps >= 30 && document.body.classList.contains('reduced-motion')) {
                //     // document.body.classList.remove('reduced-motion');
                // }
            }
            requestAnimationFrame(measureFPS);
        }
        // requestAnimationFrame(measureFPS); // 開啟 FPS 監測
    }
}

/**
 * 檢測設備能力並可能應用一些優化。
 */
export function detectDeviceCapabilities() {
    // 檢測是否為移動設備
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 檢測是否為低效能設備 (這是一個非常粗略的估計)
    // navigator.hardwareConcurrency 可以獲取 CPU 核心數
    // navigator.deviceMemory 可以獲取設備記憶體 (GB，實驗性)
    const cpuCoreCount = navigator.hardwareConcurrency;
    const deviceMemory = (navigator.deviceMemory || 0); // 單位 GB

    let isLowPerfDevice = false;
    if (isMobile) {
        if (cpuCoreCount && cpuCoreCount < 4) { // 少於4核的移動設備
            isLowPerfDevice = true;
        }
        if (deviceMemory > 0 && deviceMemory < 2) { // 記憶體少於 2GB 的移動設備
            isLowPerfDevice = true;
        }
        // 可以加入更多基於 User Agent 的特定舊型號判斷
        if (/iPhone\s(5|6|7|8|SE)/i.test(navigator.userAgent) && (!cpuCoreCount || cpuCoreCount <=2)) {
             isLowPerfDevice = true;
        }
    }

    if (isLowPerfDevice) {
        if (!document.body.classList.contains('reduced-motion')) {
            document.body.classList.add('reduced-motion');
            console.log("[Utils] 檢測到可能為低效能設備，已嘗試啟用動畫減少模式。");
        }
    }

    // 檢測使用者是否在其作業系統中啟用了減少動畫的偏好設定
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
        if (!document.body.classList.contains('reduced-motion')) {
            document.body.classList.add('reduced-motion');
            console.log("[Utils] 使用者偏好減少動畫，已啟用減少動畫模式。");
        }
    }

    // 監聽偏好設定的變化
    prefersReducedMotion.addEventListener('change', (event) => {
        if (event.matches) {
            if (!document.body.classList.contains('reduced-motion')) {
                document.body.classList.add('reduced-motion');
                console.log("[Utils] 使用者偏好減少動畫已變更為啟用。");
            }
        } else {
            // 只有當不是因為低效能設備強制開啟時，才移除
            if (document.body.classList.contains('reduced-motion') && !isLowPerfDevice) {
                document.body.classList.remove('reduced-motion');
                console.log("[Utils] 使用者偏好減少動畫已變更為停用。");
            }
        }
    });
}