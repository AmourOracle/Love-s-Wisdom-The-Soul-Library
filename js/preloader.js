// js/preloader.js - 資源預加載模組 (重構版)

import { stateManager } from './state.js';
import { DOM } from './dom.js';
// triggerIntroTransition 和 bindStartButton 的調用將移至 main.js

// 常數定義
const PRELOADER_MIN_DISPLAY_TIME = 1500; // Preloader 至少顯示的時間 (ms)，避免閃爍
const IMAGE_LOADING_TIMEOUT = 8000;      // 單張重要圖片載入的超時時間 (ms)
const TOTAL_PRELOAD_TIMEOUT = 15000;     // 總預加載過程的超時時間 (ms)

let onPreloadFinishCallback = null; // 儲存預加載完成後的回調函數
let preloadStartTime = 0;           // 記錄預加載開始時間

/**
 * 準備 Preloader 的顯示狀態。
 * @private
 */
function _preparePreloaderVisuals() {
    if (DOM.screens.preloader) {
        DOM.screens.preloader.classList.remove('transitioning-out'); // 確保移除退場類
        DOM.screens.preloader.classList.add('active');           // 確保 Preloader 可見
        console.log("[Preloader] Preloader screen visuals prepared and activated.");
    } else {
        console.error("[Preloader ERR] Preloader screen element not found in DOM.");
        return false;
    }

    if (DOM.elements.preloaderSvg) {
        DOM.elements.preloaderSvg.classList.remove('glow-active', 'svg-exiting'); // 重置 SVG 動畫類
        // 可以考慮在這裡觸發 SVG 的初始繪製動畫 (如果有的話)
        // 例如，如果 SVG path 有 'animate-draw' class:
        // DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => p.classList.add('animate-draw'));
        console.log("[Preloader] Preloader SVG visuals reset.");
    } else {
        console.warn("[Preloader WARN] Preloader SVG element not found in DOM.");
    }

    // 確保其他屏幕是隱藏的
    if (DOM.screens.intro) DOM.screens.intro.classList.remove('active');
    if (DOM.screens.test) DOM.screens.test.classList.remove('active');
    if (DOM.screens.result) DOM.screens.result.classList.remove('active');
    return true;
}

/**
 * 添加 <link rel="preload"> 標籤到文檔頭部以預加載圖片。
 * @param {string} url - 要預加載的圖片 URL。
 * @param {string} fetchPriority - 圖片的抓取優先級 ('high', 'auto', 'low')。
 * @private
 */
function _addPreloadLink(url, fetchPriority = 'auto') {
    // 檢查是否已存在相同的 preload link，避免重複添加
    if (document.querySelector(`link[rel="preload"][href="${url}"]`)) {
        // console.log(`[Preloader] Preload link for ${url} already exists.`);
        return;
    }
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.href = url;
    preloadLink.as = 'image';
    if (fetchPriority && ['high', 'low', 'auto'].includes(fetchPriority)) {
        preloadLink.setAttribute('fetchpriority', fetchPriority);
    }
    document.head.appendChild(preloadLink);
    // console.log(`[Preloader] Added preload link for: ${url} with priority: ${fetchPriority}`);
}

/**
 * 決定哪些圖片需要被預加載。
 * @param {object[]} questions - 測驗問題數據陣列。
 * @returns {object[]} 包含 {url, priority} 的圖片對象陣列。
 * @private
 */
function _getImagesToPreload(questions) {
    const images = [];
    // 1. Intro 背景圖 (最高優先級)
    images.push({ url: './images/Intro.webp', priority: 'high' });

    // 2. 前幾個問題的背景圖 (高優先級)
    if (questions && questions.length > 0) {
        for (let i = 0; i < Math.min(questions.length, 3); i++) { // 例如預加載前3個問題的圖
            images.push({ url: `./images/Q${i + 1}.webp`, priority: 'high' });
        }
        // 3. （可選）後續問題的背景圖 (普通或低優先級)
        // for (let i = 3; i < questions.length; i++) {
        //     images.push({ url: `./images/Q${i + 1}.webp`, priority: 'auto' });
        // }
    }
    return images;
}

/**
 * 預加載指定的圖片資源。
 * @param {object[]} imagesToLoad - 包含 {url, priority} 的圖片對象陣列。
 * @returns {Promise<void>} 當所有圖片都嘗試加載後 resolve (不論成功或失敗)。
 * @private
 */
async function _loadImages(imagesToLoad) {
    if (!imagesToLoad || imagesToLoad.length === 0) {
        console.log("[Preloader] No images specified for preloading.");
        return Promise.resolve();
    }

    const imagePromises = imagesToLoad.map(({ url, priority }) => {
        _addPreloadLink(url, priority); // 添加 <link rel="preload">

        // 同時使用 Image 對象來監聽加載完成或錯誤，並設置超時
        return new Promise((resolve, reject) => {
            const img = new Image();
            let loaded = false;
            let timer = setTimeout(() => {
                if (!loaded) {
                    console.warn(`[Preloader WARN] Image loading timed out (>${IMAGE_LOADING_TIMEOUT}ms): ${url}`);
                    img.onload = img.onerror = null; // 清除事件處理器
                    resolve({ url, status: 'timeout' }); // 超時也視為 resolve，但不標記為成功
                }
            }, IMAGE_LOADING_TIMEOUT);

            img.onload = () => {
                loaded = true;
                clearTimeout(timer);
                // console.log(`[Preloader] Image loaded successfully: ${url}`);
                resolve({ url, status: 'loaded' });
            };
            img.onerror = () => {
                loaded = true;
                clearTimeout(timer);
                console.error(`[Preloader ERR] Failed to load image: ${url}`);
                resolve({ url, status: 'error' }); // 錯誤也 resolve，避免 Promise.all 卡住
            };
            img.src = url;
        });
    });

    // 等待所有圖片的加載嘗試完成 (Promise.allSettled 更適合，但 Promise.all 配合 resolve on error 也可)
    try {
        const results = await Promise.all(imagePromises);
        const successfullyLoaded = results.filter(r => r.status === 'loaded').length;
        const erroredOrTimedOut = results.length - successfullyLoaded;
        console.log(`[Preloader] Image loading attempts finished. Successful: ${successfullyLoaded}, Errored/TimedOut: ${erroredOrTimedOut}`);
    } catch (error) {
        // Promise.all 在有 reject 時會進入 catch，但我們上面讓所有都 resolve 了
        console.error("[Preloader ERR] Unexpected error during Promise.all for image loading:", error);
    }
}

/**
 * 完成預加載流程，並執行回調。
 * @private
 */
function _finishPreloading() {
    stateManager.set('isPreloading', false);
    console.log("[Preloader] Preloading state set to false.");

    const elapsedTime = Date.now() - preloadStartTime;
    const remainingMinTime = PRELOADER_MIN_DISPLAY_TIME - elapsedTime;

    if (remainingMinTime > 0) {
        console.log(`[Preloader] Waiting for minimum display time: ${remainingMinTime}ms`);
        setTimeout(() => {
            if (typeof onPreloadFinishCallback === 'function') {
                onPreloadFinishCallback();
            }
        }, remainingMinTime);
    } else {
        if (typeof onPreloadFinishCallback === 'function') {
            onPreloadFinishCallback();
        }
    }
}

/**
 * 啟動資源預加載流程。
 * @param {object[]} questionsData - 測驗問題數據陣列，用於決定預加載哪些圖片。
 * @param {function} onFinishCallback - 預加載完成後要執行的回調函數。
 */
export async function preloadImages(questionsData, onFinishCallback) {
    console.log("[Preloader] preloadImages called.");
    if (typeof onFinishCallback !== 'function') {
        console.error("[Preloader ERR] onFinishCallback is not a function. Preloading aborted.");
        return;
    }
    onPreloadFinishCallback = onFinishCallback;
    preloadStartTime = Date.now();

    stateManager.set('isPreloading', true); // 確保狀態正確
    stateManager.set('activeScreen', 'preloader'); // 確保屏幕狀態正確

    if (!_preparePreloaderVisuals()) {
        // 如果 Preloader 自身都無法顯示，直接結束
        _finishPreloading(); // 會將 isPreloading 設為 false 並調用回調
        return;
    }

    const imagesToPreload = _getImagesToPreload(questionsData);
    if (imagesToPreload.length === 0) {
        console.log("[Preloader] No images to preload based on questions data.");
        _finishPreloading();
        return;
    }

    console.log(`[Preloader] Starting to load ${imagesToPreload.length} prioritized images.`);

    // 設置總預加載超時
    const totalTimeout = setTimeout(() => {
        console.warn(`[Preloader WARN] Total preloading process timed out (>${TOTAL_PRELOAD_TIMEOUT}ms). Finishing up.`);
        _finishPreloading();
    }, TOTAL_PRELOAD_TIMEOUT);

    try {
        await _loadImages(imagesToPreload);
        // 不論圖片加載結果如何，都認為 "預加載流程" 執行完畢了
    } catch (error) {
        console.error("[Preloader ERR] Error during _loadImages:", error);
    } finally {
        clearTimeout(totalTimeout); // 清除總超時
        _finishPreloading(); // 總是在 _loadImages 嘗試完成後結束預加載流程
    }
}