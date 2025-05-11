// js/dom.js - DOM 操作模組 (重構版)

import { displayInitializationError } from './utils.js'; // 假設 displayInitializationError 移到 utils.js 或在此定義

/**
 * DOM 元素快取對象。
 * 分類儲存對常用 DOM 元素的引用。
 */
export const DOM = {
    // 主要的屏幕容器
    screens: {
        preloader: null,
        intro: null,
        test: null,
        result: null,
    },
    // UI 組件容器
    containers: {
        options: null,             // 測驗選項的容器
        preloaderSvgContainer: null,// Preloader SVG 的直接父容器
        introTitlePlaceholder: null, // Intro 頁面標題 SVG 的佔位符
        traits: null,              // 結果頁：特質顯示區域
        similarBooks: null,        // 結果頁：相似書籍
        complementaryBooks: null,  // 結果頁：互補書籍
    },
    // 單個重要元素
    elements: {
        testBackground: null,      // 測驗頁面的背景 div
        progressFill: null,        // 進度條的填充部分
        questionTitle: null,       // 測驗頁面的問題標題 H1
        
        // 結果頁元素
        resultTitle: null,
        resultSubtitle: null,
        resultDescription: null,
        shareText: null,           // 分享文本的容器

        // SVG 元素
        preloaderSvg: null,        // Preloader 中的主 SVG
        introTitleSvg: null,       // Intro 頁面複製後的標題 SVG
    },
    // 按鈕元素
    buttons: {
        startTest: null,           // Intro 頁的開始測驗按鈕
        copyResult: null,          // 結果頁的複製按鈕
        restartTest: null,         // 結果頁的重新測驗按鈕
    }
};

// 全局儲存測驗選項的 DOM 元素列表 (由 view.js 更新)
export let currentOptionElements = [];

/**
 * 更新當前問題的選項按鈕 DOM 元素列表。
 * @param {HTMLElement[]} optionsArray - 新的選項按鈕元素陣列。
 */
export const setOptionElements = (optionsArray) => {
    if (Array.isArray(optionsArray) && optionsArray.every(el => el instanceof HTMLElement)) {
        currentOptionElements = optionsArray;
    } else {
        console.error("[DOM] setOptionElements: 提供的參數不是有效的 HTMLElement 陣列。");
        currentOptionElements = [];
    }
};


/**
 * 複製 Preloader 中的 SVG 到 Intro 頁面的標題佔位符。
 * @private
 */
function _cloneSvgToIntro() {
    if (DOM.elements.preloaderSvg && DOM.containers.introTitlePlaceholder) {
        console.log("[DOM] 準備複製 Preloader SVG 到 Intro 標題...");
        try {
            const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
            clonedSvg.id = 'intro-title-svg'; // 為複製的 SVG 設置新 ID
            // 移除可能由 Preloader 添加的動畫 class
            clonedSvg.classList.remove('glow-active', 'svg-exiting');

            DOM.containers.introTitlePlaceholder.innerHTML = ''; // 清空佔位符
            DOM.containers.introTitlePlaceholder.appendChild(clonedSvg);
            DOM.elements.introTitleSvg = clonedSvg; // 保存對複製後 SVG 的引用
            console.log("[DOM] Intro 標題 SVG 已成功從 Preloader SVG 複製並插入。");
        } catch (cloneError) {
            console.error("[DOM] 複製或插入 SVG 到 Intro 時發生錯誤:", cloneError);
            if (DOM.containers.introTitlePlaceholder) {
                // 出錯時給一個提示
                DOM.containers.introTitlePlaceholder.innerHTML = '<p style="color:red; text-align:center;">標題 SVG 載入失敗</p>';
            }
        }
    } else {
        let missing = [];
        if (!DOM.elements.preloaderSvg) missing.push("DOM.elements.preloaderSvg");
        if (!DOM.containers.introTitlePlaceholder) missing.push("DOM.containers.introTitlePlaceholder");
        console.warn(`[DOM] 無法複製 SVG 到 Intro：缺少元素 (${missing.join(', ')})。`);
    }
}

/**
 * 快取所有必要的 DOM 元素到 DOM 對象中。
 * @returns {boolean} 如果所有關鍵元素都成功快取，返回 true；否則返回 false。
 */
export function cacheDOMElements() {
    console.log("[DOM] 開始快取 DOM 元素...");
    let success = true;
    const getEl = (id, category, key) => {
        const element = document.getElementById(id);
        if (element) {
            if (category && key) {
                DOM[category][key] = element;
            } else if (category) { // 如果沒有 key，則 id 就是 key
                 DOM[category][id] = element;
            }
        } else {
            console.error(`[DOM ERR] 找不到 ID 為 "${id}" 的元素。`);
            success = false;
        }
        return element;
    };
    
    const getElByQuery = (selector, category, key) => {
        const element = document.querySelector(selector);
        if (element) {
            if (category && key) {
                DOM[category][key] = element;
            }
        } else {
             console.warn(`[DOM WARN] 找不到選擇器為 "${selector}" 的元素 (非關鍵錯誤)。`);
             // success 不因此設為 false，除非是關鍵元素
        }
        return element;
    }

    // 主要屏幕容器
    getEl('preloader', 'screens', 'preloader');
    getEl('intro-container', 'screens', 'intro');
    getEl('test-container', 'screens', 'test');
    getEl('result-container', 'screens', 'result');

    // UI 組件容器
    getEl('options-container', 'containers', 'options');
    getEl('preloader-svg-container', 'containers', 'preloaderSvgContainer');
    // introTitlePlaceholder 是 class，不是 id
    getElByQuery('#intro-container .intro-title-placeholder', 'containers', 'introTitlePlaceholder');
    getEl('traits-container', 'containers', 'traits');
    getEl('similar-books', 'containers', 'similarBooks');
    getEl('complementary-books', 'containers', 'complementaryBooks');
    
    // 單個重要元素
    getEl('test-background', 'elements', 'testBackground');
    getEl('progress-fill', 'elements', 'progressFill');
    getEl('question-title', 'elements', 'questionTitle');
    getEl('result-title', 'elements', 'resultTitle');
    getEl('result-subtitle', 'elements', 'resultSubtitle');
    getEl('result-description', 'elements', 'resultDescription');
    getEl('share-text', 'elements', 'shareText');
    getEl('preloader-svg', 'elements', 'preloaderSvg');
    // DOM.elements.introTitleSvg 將由 _cloneSvgToIntro 填充

    // 按鈕元素
    getEl('start-test', 'buttons', 'startTest');
    getEl('copy-btn', 'buttons', 'copyResult');
    getEl('restart-btn', 'buttons', 'restartTest');

    // 檢查最關鍵的屏幕容器是否存在，這些是應用運行的基礎
    if (!DOM.screens.preloader || !DOM.screens.intro || !DOM.screens.test || !DOM.screens.result) {
        console.error("[DOM CRITICAL ERR] 一個或多個主要屏幕容器未找到，應用程式無法繼續。");
        displayInitializationError("頁面結構錯誤，無法啟動測驗。"); // 使用 utils 中的函數
        return false; // 阻止後續初始化
    }
    if (!DOM.containers.options) { // options-container 也很關鍵
        console.error("[DOM CRITICAL ERR] options-container 未找到。");
        success = false;
    }
    if (!DOM.buttons.startTest) { // 開始按鈕也很關鍵
        console.error("[DOM CRITICAL ERR] start-test 按鈕未找到。");
        success = false;
    }


    if (success) {
        console.log("[DOM] 所有預期的 DOM 元素已嘗試快取。");
        // 在所有元素都基本快取後再嘗試複製 SVG
        _cloneSvgToIntro();
    } else {
        console.error("[DOM ERR] 部分關鍵 DOM 元素快取失敗。請檢查 HTML 結構和 ID。");
        displayInitializationError("頁面初始化失敗：缺少必要的頁面組件。");
    }
    return success;
}