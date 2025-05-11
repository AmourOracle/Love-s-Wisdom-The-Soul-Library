// js/preloader.js - 資源預加載模組 (最終確認版)

import { stateManager } from './state.js';
import { DOM } from './dom.js';

// 常數定義
const PRELOADER_MIN_DISPLAY_TIME_MS = 1800;
const IMAGE_LOADING_TIMEOUT_MS = 7000;
const TOTAL_PRELOAD_PROCESS_TIMEOUT_MS = 15000;

let onFinishGlobalCallback = null; // 儲存完成回調
let preloadStartTime = 0;
let totalPreloadProcessTimer = null;

/**
 * 準備 Preloader 的視覺元素。
 * @private
 */
function _preparePreloaderUI() {
    if (!DOM.screens.preloader) {
        console.error("[Preloader ERR] DOM.screens.preloader is not available.");
        return false;
    }
    DOM.screens.preloader.classList.remove('transitioning-out');
    DOM.screens.preloader.classList.add('active');

    if (DOM.elements.preloaderSvg) {
        DOM.elements.preloaderSvg.classList.remove('glow-active', 'svg-exiting');
        // 可以在此處觸發SVG的初始動畫（例如，通過添加一個CSS類）
    }
    
    // 確保其他屏幕隱藏
    if(DOM.screens.intro) DOM.screens.intro.classList.remove('active');
    if(DOM.screens.test) DOM.screens.test.classList.remove('active');
    if(DOM.screens.result) DOM.screens.result.classList.remove('active');
    console.log("[Preloader LOG] Preloader UI prepared and activated.");
    return true;
}

/**
 * 添加 <link rel="preload">。
 * @private
 */
function _addPreloadLink(url, priority = 'auto') {
    if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'image';
    if (['high', 'low', 'auto'].includes(priority)) {
        link.setAttribute('fetchpriority', priority);
    }
    document.head.appendChild(link);
}

/**
 * 獲取要預加載的圖片列表。
 * @private
 */
function _getImagesForPreload(questions) {
    const images = [{ url: './images/Intro.webp', priority: 'high' }];
    if (questions && questions.length > 0) {
        for (let i = 0; i < Math.min(questions.length, 3); i++) {
            images.push({ url: `./images/Q${i + 1}.webp`, priority: 'high' });
        }
    }
    console.log(`[Preloader LOG] ${images.length} images identified for preloading.`);
    return images;
}

/**
 * 加載單張圖片。
 * @private
 */
function _loadImageAsync(url, priority) {
    _addPreloadLink(url, priority);
    return new Promise((resolve) => {
        const img = new Image();
        let handled = false;
        const timer = setTimeout(() => {
            if (!handled) {
                handled = true;
                console.warn(`[Preloader WARN] Timeout loading image: ${url}`);
                img.onload = img.onerror = null;
                resolve({ url, status: 'timeout' });
            }
        }, IMAGE_LOADING_TIMEOUT_MS);

        img.onload = () => {
            if (!handled) {
                handled = true;
                clearTimeout(timer);
                resolve({ url, status: 'loaded' });
            }
        };
        img.onerror = () => {
            if (!handled) {
                handled = true;
                clearTimeout(timer);
                console.error(`[Preloader ERR] Failed to load image: ${url}`);
                resolve({ url, status: 'error' });
            }
        };
        img.src = url;
    });
}

/**
 * 執行所有圖片的預加載。
 * @private
 */
async function _preloadAllImages(imagesToLoad) {
    if (!imagesToLoad || imagesToLoad.length === 0) {
        console.log("[Preloader LOG] No images to preload in _preloadAllImages.");
        return;
    }
    const imagePromises = imagesToLoad.map(imgInfo => _loadImageAsync(imgInfo.url, imgInfo.priority));
    try {
        const results = await Promise.all(imagePromises);
        const loadedCount = results.filter(r => r.status === 'loaded').length;
        console.log(`[Preloader LOG] Image preloading attempts complete. Loaded: ${loadedCount}/${results.length}`);
    } catch (error) {
        console.error("[Preloader ERR] Unexpected error in _preloadAllImages Promise.all:", error);
    }
}

/**
 * 完成預加載流程並執行回調。
 * @private
 */
function _completePreloadProcess() {
    if (totalPreloadProcessTimer) {
        clearTimeout(totalPreloadProcessTimer);
        totalPreloadProcessTimer = null;
    }

    if (stateManager.get('isPreloading')) { 
        stateManager.set('isPreloading', false); 
        console.log("[Preloader LOG] isPreloading state set to false.");
    }

    const elapsedTime = Date.now() - preloadStartTime;
    const timeToWait = PRELOADER_MIN_DISPLAY_TIME_MS - elapsedTime;

    const executeCallback = () => {
        if (typeof onFinishGlobalCallback === 'function') {
            console.log("[Preloader LOG] Executing onFinishGlobalCallback.");
            onFinishGlobalCallback();
            onFinishGlobalCallback = null; 
        }
    };

    if (timeToWait > 0) {
        console.log(`[Preloader LOG] Waiting an additional ${timeToWait}ms for min display time.`);
        setTimeout(executeCallback, timeToWait);
    } else {
        executeCallback();
    }
}

/**
 * 啟動資源預加載流程。
 * @export
 * @param {object[]} questionsData - 測驗問題數據。
 * @param {function} onFinish - 預加載完成後執行的回調。
 */
export async function preloadImages(questionsData, onFinish) {
    console.log("[Preloader LOG] preloadImages function initiated.");
    if (typeof onFinish !== 'function') {
        console.error("[Preloader ERR] onFinish callback is not a function. Aborting preload.");
        stateManager.set('isPreloading', false); 
        return;
    }
    onFinishGlobalCallback = onFinish;
    preloadStartTime = Date.now();

    stateManager.lock('isPreloading'); 
    stateManager.set('activeScreen', 'preloader');

    if (!_preparePreloaderUI()) {
        console.error("[Preloader ERR] Failed to prepare Preloader UI. Finalizing preload early.");
        _completePreloadProcess(); 
        return;
    }

    const imagesToLoad = _getImagesForPreload(questionsData);
    if (imagesToLoad.length === 0) {
        console.log("[Preloader LOG] No images to preload. Finalizing preload.");
        _completePreloadProcess();
        return;
    }

    if (totalPreloadProcessTimer) clearTimeout(totalPreloadProcessTimer);
    totalPreloadProcessTimer = setTimeout(() => {
        console.warn(`[Preloader WARN] Total preload process timed out (>${TOTAL_PRELOAD_PROCESS_TIMEOUT_MS}ms).`);
        _completePreloadProcess(); 
    }, TOTAL_PRELOAD_PROCESS_TIMEOUT_MS);

    try {
        await _preloadAllImages(imagesToLoad);
        console.log("[Preloader LOG] Image preloading attempts have concluded.");
    } catch (error) {
        console.error("[Preloader ERR] Error occurred during image preloading execution:", error);
    } finally {
        if (totalPreloadProcessTimer) { 
            _completePreloadProcess();
        }
    }
}