// main.js - 應用程式入口點

import { stateManager, legacyState } from './state.js';
import { DOM, cacheDOMElements, displayInitializationError } from './dom.js';
import { setViewportHeight } from './animation.js';
import { preloadImages } from './preloader.js';
import { bindOtherButtons, bindStartButton, forceInitializeButtons } from './testLogic.js';
import { setupErrorHandling, setupPerformanceMonitoring, detectDeviceCapabilities } from './utils.js';

// 初始化函數
function initialize() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 全域錯誤處理
    setupErrorHandling();
    
    // 效能監測
    setupPerformanceMonitoring();
    
    // 檢測設備能力
    detectDeviceCapabilities();
    
    // 檢查測驗數據
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') { 
        console.error("錯誤：找不到有效的 testData..."); 
        displayInitializationError("無法載入測驗數據。"); 
        return; 
    }
    
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) { 
        console.error("錯誤：testData.questions 不是有效的陣列或為空。"); 
        displayInitializationError("測驗問題數據格式錯誤。"); 
        return; 
    }
    
    // 設置視口高度
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    
    // 快取 DOM 元素
    if (cacheDOMElements()) {
        preloadImages(testData.questions);
        bindOtherButtons();
        
        // 【新增】確保測驗開始按鈕被正確綁定
        // 延遲一小段時間確保 DOM 已完全就緒
        setTimeout(() => {
            if (DOM.buttons.start && testData.questions) {
                console.log("主函數中確認綁定開始按鈕...");
                bindStartButton(testData.questions);
            } else {
                console.warn("無法在主函數中綁定開始按鈕，將在 3 秒後重試");
                // 如果初始綁定失敗，3秒後再次嘗試
                setTimeout(() => forceInitializeButtons(), 3000);
            }
        }, 100);
    } else {
        console.error("DOM element caching failed, initialization incomplete.");
    }
    
    console.log("Script initialization complete.");
}

// 在頁面載入完成後執行初始化
document.addEventListener('DOMContentLoaded', initialize);

// 【新增】確保頁面完全載入後按鈕可用
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!stateManager.get('preloadComplete') && window.testData && window.testData.questions) {
            console.log("載入事件：確保按鈕初始化");
            forceInitializeButtons();
        }
    }, 1000);
});