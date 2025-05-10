// main.js - 應用程式入口點

import { stateManager, legacyState } from './state.js';
import { DOM, cacheDOMElements, displayInitializationError } from './dom.js';
import { setViewportHeight } from './animation.js';
import { preloadImages } from './preloader.js';
import { bindOtherButtons } from './testLogic.js';
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
    } else {
        console.error("DOM element caching failed, initialization incomplete.");
    }
    
    console.log("Script initialization complete.");
}

// 在頁面載入完成後執行初始化
document.addEventListener('DOMContentLoaded', initialize);