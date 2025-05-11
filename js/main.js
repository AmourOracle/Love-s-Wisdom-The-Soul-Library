// js/main.js - 應用程式入口點 (重構版)

import { stateManager } from './state.js';
import { DOM, cacheDOMElements } from './dom.js';
import { setViewportHeight, triggerIntroTransition, switchScreen } from './animation.js';
import { preloadImages } from './preloader.js'; // 假設 preloadImages 返回 Promise 或有回調
import { initializeTestScreen } from './testLogic.js';
import { setupErrorHandling, setupPerformanceMonitoring, detectDeviceCapabilities, displayInitializationError } from './utils.js'; // 導入 displayInitializationError
import { calculateAndShowResults, bindResultPageButtons } from './resultLogic.js'; // 假設 resultLogic 有這些

/**
 * 應用程式的主初始化函數。
 */
async function initializeApp() {
    console.log("[Main] Application initialization started...");
    stateManager.set('activeScreen', 'preloader'); // 初始屏幕是 preloader

    // 1. 基礎設置
    setupErrorHandling();
    setupPerformanceMonitoring();
    detectDeviceCapabilities();
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    // 2. 檢查全局測驗數據是否存在
    if (typeof testData === 'undefined' || !testData || typeof testData.questions !== 'object') {
        console.error("[Main ERR] testData is missing or invalid.");
        displayInitializationError("無法載入測驗數據，請刷新頁面重試。");
        return; // 終止初始化
    }

    // 3. 快取 DOM 元素
    if (!cacheDOMElements()) {
        console.error("[Main ERR] DOM element caching failed. Application cannot start.");
        // cacheDOMElements 內部會在失敗時調用 displayInitializationError
        return; // 終止初始化
    }

    // 4. 資源預加載
    // 假設 preloadImages 現在返回一個 Promise，在所有主要圖片加載完成後 resolve
    // 或者 preloadImages 內部會在完成時調用一個回調或設置一個狀態
    try {
        // 我們讓 preloadImages 內部處理 isPreloading 狀態的更新和 triggerIntroTransition 的調用
        // preloadImages(testData.questions, setupIntroPage); // 舊的調用方式可能需要調整
        // 新的思路：preloadImages 內部完成後會調用 setupIntroPage
        if (typeof preloadImages === 'function') {
            // 為了讓 preloadImages 能在完成後觸發後續步驟，我們傳遞一個回調
            await preloadImages(testData.questions, () => {
                console.log("[Main LOG] Preloading presumed complete by preloadImages callback.");
                setupIntroPage();
            });
        } else {
            console.warn("[Main WARN] preloadImages function not found, attempting to setup Intro page directly.");
            setupIntroPage(); // 如果沒有 preloadImages，直接嘗試設置 Intro
        }
    } catch (error) {
        console.error("[Main ERR] Error during preloading phase:", error);
        displayInitializationError("資源預加載失敗，請檢查網絡連接並刷新。");
        // 即使預加載失敗，也嘗試設置 Intro 頁面，或者顯示一個更特定的錯誤
        stateManager.set('isPreloading', false); // 標記預加載結束（即使是失敗的）
        setupIntroPage(); // 嘗試繼續，讓用戶至少看到一些東西
    }
}

/**
 * 設置 Intro 頁面的內容和交互。
 * 此函數應在 Preloader 過渡完成後被調用。
 */
async function setupIntroPage() {
    console.log("[Main LOG] Setting up Intro page...");

    if (!DOM.screens.intro || !DOM.buttons.startTest) {
        console.error("[Main ERR] Intro screen or start button not found in DOM.");
        displayInitializationError("無法初始化介紹頁面。");
        return;
    }
    
    // 確保 Preloader 已退場，Intro 頁已激活
    // triggerIntroTransition 應該返回 Promise
    try {
        if (stateManager.get('activeScreen') === 'preloader' || !DOM.screens.intro.classList.contains('active')) {
             console.log("[Main LOG] Triggering intro transition from setupIntroPage as preloader might still be active.");
             await triggerIntroTransition(); // 等待 Preloader 退場動畫完成
        }
        stateManager.set('activeScreen', 'intro'); // 確保狀態正確
        console.log("[Main LOG] Intro screen transition completed or was already done.");
    } catch (error) {
        console.error("[Main ERR] Error during triggerIntroTransition:", error);
        displayInitializationError("頁面過渡動畫失敗。");
        // 即使過渡失敗，也嘗試綁定開始按鈕
    }


    // 為「親啟」按鈕設置 TypeIt 動畫
    const startButton = DOM.buttons.startTest;
    const startButtonText = "親啟"; // 按鈕上的文字

    if (typeof TypeIt !== 'undefined' && startButton) {
        // 清空按鈕現有內容，以防重複
        // startButton.innerHTML = ''; // TypeIt 通常會處理目標元素的內容
        
        // 創建 TypeIt 實例的目標 span (如果按鈕內沒有特定 span)
        // 但通常按鈕本身就可以作為目標，TypeIt 會替換其內容
        // 為了與選項按鈕一致，我們可以在按鈕內創建一個 span
        let textTargetSpan = startButton.querySelector('span.typeit-target');
        if (!textTargetSpan) {
            textTargetSpan = document.createElement('span');
            textTargetSpan.className = 'typeit-target'; // 給一個 class 方便 CSS 定位
            startButton.innerHTML = ''; // 清空按鈕
            startButton.appendChild(textTargetSpan);
        }


        console.log("[Main LOG] Initializing TypeIt for Start Test button.");
        new TypeIt(textTargetSpan, { // 直接作用於按鈕或按鈕內的 span
            strings: [startButtonText],
            speed: 75,
            lifeLike: true,
            breakLines: false, // 開始按鈕通常是單行
            cursor: true,
            cursorChar: "▋",
            afterComplete: async (instance) => {
                const cursorEl = startButton.querySelector('.ti-cursor');
                if (cursorEl) cursorEl.style.display = 'none';
                console.log("[Main LOG] Start Test button TypeIt completed.");
            }
        }).go();
    } else {
        console.warn("[Main WARN] TypeIt not available for Start Test button, or button not found. Setting text directly.");
        if(startButton) startButton.textContent = startButtonText;
    }

    // 綁定開始測驗按鈕的點擊事件
    if (startButton) {
        // 先移除可能存在的舊監聽器，以防重複綁定（如果 setupIntroPage 可能被多次調用）
        // 更安全的做法是使用 AbortController 或確保只綁定一次
        const handleStartClick = async () => {
            console.log("[Main LOG] Start Test button clicked.");
            if (stateManager.isLocked('isScreenSwitching')) {
                console.warn("[Main WARN] Start Test click ignored: Screen is already switching.");
                return;
            }
            stateManager.lock('isScreenSwitching'); // 鎖定屏幕切換

            try {
                await switchScreen('intro', 'test'); // 切換到測驗屏幕
                console.log("[Main LOG] Switched to test screen. Initializing test...");
                initializeTestScreen(testData.questions); // 初始化測驗
            } catch (error) {
                console.error("[Main ERR] Error switching to test screen or initializing test:", error);
                stateManager.unlock('isScreenSwitching'); // 出錯時解鎖
            }
            // isScreenSwitching 的解鎖由 switchScreen 內部在其 Promise resolve 時處理
        };

        // 為了避免重複綁定，可以先移除再添加，或者使用 once 選項（如果適用）
        // 這是一個簡化的處理，實際應用中可能需要更完善的事件管理
        startButton.removeEventListener('click', handleStartClick); // 嘗試移除舊的（如果存在）
        startButton.addEventListener('click', handleStartClick);
    }

    // 綁定結果頁的按鈕 (雖然結果頁還未顯示，但可以先準備好邏輯)
    // 這些按鈕的事件應該在結果頁實際顯示時才激活，或者在這裡綁定後，
    // 依賴按鈕的 display 狀態來決定是否可交互。
    // 更好的做法是當 result screen 激活時再綁定。
    // 暫時先註釋掉，或者移到 resultLogic.js 中由其負責。
    // bindResultPageActions();
}


/**
 * 綁定結果頁面上的交互按鈕（複製、重新開始）。
 * 此函數應在結果頁面顯示後被調用。
 */
function bindResultPageActions() {
    if (DOM.buttons.restartTest) {
        const restartHandler = async () => {
            console.log("[Main LOG] Restart Test button clicked.");
            if (stateManager.isLocked('isScreenSwitching')) return;
            stateManager.lock('isScreenSwitching');
            stateManager.resetForNewTest(); // 重置測驗狀態
            try {
                await switchScreen('result', 'intro');
                // Intro 頁面會在其激活時重新執行 setupIntroPage (如果流程如此設計)
                // 或者在這裡手動調用 setupIntroPage
                console.log("[Main LOG] Switched back to Intro screen for restart.");
                // 確保 intro 頁面的 startTest 按鈕的 TypeIt 和事件被重新初始化
                // 這可能需要在 setupIntroPage 中加入一些防止重複初始化的邏輯，或者使其可重入
                setupIntroPage(); // 重新設置 Intro 頁
            } catch (error) {
                console.error("[Main ERR] Error restarting test:", error);
                stateManager.unlock('isScreenSwitching');
            }
        };
        DOM.buttons.restartTest.removeEventListener('click', restartHandler); // 防重複
        DOM.buttons.restartTest.addEventListener('click', restartHandler);
    }

    if (DOM.buttons.copyResult) {
        const copyHandler = () => {
            console.log("[Main LOG] Copy Result button clicked.");
            if (!DOM.elements.shareText) {
                console.warn("[Main WARN] Share text element not found for copying.");
                return;
            }
            const textToCopy = DOM.elements.shareText.textContent || "";
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        console.log("[Main LOG] Result text copied to clipboard.");
                        DOM.buttons.copyResult.textContent = "已複製!"; // 簡單反饋
                        setTimeout(() => {
                             // 如果希望恢復 TypeIt 效果，需要重新初始化
                             // setupButtonTypeIt(DOM.buttons.copyResult, "複製");
                             DOM.buttons.copyResult.textContent = "複製";
                        }, 2000);
                    })
                    .catch(err => console.error("[Main ERR] Failed to copy result text:", err));
            } else {
                // Fallback for non-secure contexts or older browsers (less common now)
                console.warn("[Main WARN] Clipboard API not available. Implement fallback or inform user.");
                alert("複製功能在此環境下不可用，請手動複製。");
            }
        };
        DOM.buttons.copyResult.removeEventListener('click', copyHandler); // 防重複
        DOM.buttons.copyResult.addEventListener('click', copyHandler);
    }
    console.log("[Main LOG] Result page actions bound.");
}

// 為了讓 resultLogic.js 能在正確時機綁定結果頁按鈕，我們可以導出這個函數
// 或者在 testLogic.js 的 triggerShowResults 中，當結果頁切換完成後調用它。
// 目前，我們會在 testLogic.js 的 triggerShowResults 的 Promise.then 中調用 bindResultPageActions
export { bindResultPageActions };


// ================= 主程序啟動點 =================
// 等待 DOM 完全加載後執行初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp(); // DOM 已加載
}