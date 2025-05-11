// js/animation.js - 動畫模組 (重構版)

import { stateManager } from './state.js';
import { DOM } from './dom.js';

// 從 CSS 變數獲取動畫時間 (如果 CSS 中有定義)
const PRELOADER_EXIT_SVG_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preloader-svg-exit-duration').replace('s', '')) * 1000 || 1200;
const SCREEN_TRANSITION_BASE_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s', '')) * 1000 || 600;
const OPTION_CHAR_EXPLODE_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--option-explode-duration').replace('s', '')) * 1000 || 800; // 字符爆炸動畫的基礎時長
const CONTENT_FADEOUT_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadeout-duration').replace('s',''))*1000 || 600;


/**
 * 觸發 Preloader 退場和 Intro 頁面進場的轉場動畫。
 * @returns {Promise<void>} 當轉場動畫完成時 resolve。
 */
export function triggerIntroTransition() {
    console.log("[Animation] Triggering Intro transition...");
    if (!DOM.screens.preloader || !DOM.screens.intro || !DOM.elements.preloaderSvg || !DOM.containers.introTitlePlaceholder) {
        console.error("[Animation ERR] Preloader/Intro/SVG/Title placeholder not found for intro transition.");
        stateManager.unlock('isScreenSwitching'); // 確保解鎖，以防萬一
        stateManager.set('isPreloading', false); // 即使失敗，也標記 preloading 結束
        return Promise.reject(new Error("Intro transition failed: missing critical elements."));
    }

    if (stateManager.isLocked('isScreenSwitching')) {
        console.warn("[Animation WARN] Screen switching is already in progress. Intro transition aborted.");
        return Promise.resolve(); // 或者 reject，視情況而定
    }
    stateManager.lock('isScreenSwitching');
    stateManager.set('isPreloading', true); // 轉場開始，技術上仍在 "preloading" 階段的尾聲

    return new Promise((resolve) => {
        const preloaderScreen = DOM.screens.preloader;
        const introScreen = DOM.screens.intro;
        const preloaderSvg = DOM.elements.preloaderSvg;

        // 1. Preloader SVG 退場動畫 (CSS class 控制)
        if (preloaderSvg) {
            preloaderSvg.classList.add('svg-exiting'); // 觸發 CSS preloaderSvgSlideUpFadeOut
        }

        // 2. Preloader 容器本身淡出 (CSS class 控制)
        preloaderScreen.classList.add('transitioning-out'); // 觸發 CSS opacity 和 visibility 過渡

        // 3. Intro 容器準備並進場 (CSS class 控制)
        introScreen.style.opacity = '0'; // 確保初始透明，以便平滑淡入
        introScreen.classList.add('active'); // 讓它在 DOM 流程中可見並觸發 CSS active 樣式 (例如 opacity: 1 過渡)
        stateManager.set('activeScreen', 'intro');

        // 監聽 Preloader SVG 動畫結束 (或容器過渡結束，取決於哪個更可靠)
        // 這裡我們監聽 Preloader 容器的過渡結束，因為 SVG 動畫結束後容器才消失
        const onPreloaderHidden = (event) => {
            // 確保是 preloader 本身的 opacity 過渡結束
            if (event && event.target === preloaderScreen && event.propertyName === 'opacity') {
                preloaderScreen.removeEventListener('transitionend', onPreloaderHidden);
                preloaderScreen.classList.remove('active', 'transitioning-out'); // 清理 preloader
                if(preloaderSvg) preloaderSvg.classList.remove('svg-exiting');

                // 此時 Intro 應該已經開始或完成了它的淡入 (通過 .active 類觸發的 CSS 過渡)
                // 我們可以再加一個小的延遲確保 Intro 內容動畫有時間執行 (如果有的話)
                // 或者依賴 Intro 自身的動畫結束事件 (如果 Intro 內容有複雜入場動畫)
                // 目前 Intro 內容的動畫是在 CSS 中基於 .active 狀態的延遲動畫
                
                // 假設 Intro 頁面的主要內容動畫（如標題、描述的 fadeIn）總共需要約 intro-fadein-duration
                const introContentAnimationDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-duration').replace('s',''))*1000 || 1000;

                setTimeout(() => {
                    stateManager.unlock('isScreenSwitching');
                    stateManager.set('isPreloading', false); // Preloading 階段正式結束
                    console.log("[Animation] Intro transition completed.");
                    resolve();
                }, introContentAnimationDuration * 0.8); // 等待 Intro 內容動畫大部分完成
            }
        };
        preloaderScreen.addEventListener('transitionend', onPreloaderHidden);

        // 安全超時，以防 transitionend 事件由於某些原因未觸發
        setTimeout(() => {
            if (stateManager.isLocked('isScreenSwitching')) { // 如果狀態仍鎖定，說明 transitionend 未觸發
                console.warn("[Animation WARN] Preloader transitionend event timeout. Forcing completion.");
                preloaderScreen.removeEventListener('transitionend', onPreloaderHidden);
                if(preloaderSvg) preloaderSvg.classList.remove('svg-exiting');
                preloaderScreen.classList.remove('active', 'transitioning-out');

                stateManager.unlock('isScreenSwitching');
                stateManager.set('isPreloading', false);
                resolve();
            }
        }, PRELOADER_EXIT_SVG_DURATION + SCREEN_TRANSITION_BASE_DURATION + 200); // 給予足夠的時間
    });
}


/**
 * 切換主屏幕 (Intro, Test, Result)。
 * @param {string} fromScreenId - 要離開的屏幕的 ID ('intro', 'test', 'result')。
 * @param {string} toScreenId - 要進入的屏幕的 ID ('intro', 'test', 'result')。
 * @returns {Promise<void>} 當屏幕切換完成時 resolve。
 */
export function switchScreen(fromScreenId, toScreenId) {
    console.log(`[Animation] Switching screen from '${fromScreenId}' to '${toScreenId}'`);
    const fromScreen = DOM.screens[fromScreenId];
    const toScreen = DOM.screens[toScreenId];

    if (!fromScreen || !toScreen) {
        console.error(`[Animation ERR] switchScreen failed: Invalid screen ID(s). From: ${fromScreenId}, To: ${toScreenId}`);
        stateManager.unlock('isScreenSwitching'); // 確保解鎖
        return Promise.reject(new Error("Invalid screen ID for switching."));
    }
    if (fromScreen === toScreen) {
        console.warn(`[Animation WARN] switchScreen called with same from and to screen: ${fromScreenId}. No action taken.`);
        return Promise.resolve();
    }

    if (stateManager.isLocked('isScreenSwitching')) {
        console.warn("[Animation WARN] Screen switching is already in progress. New switch aborted.");
        return Promise.reject(new Error("Screen switching already in progress.")); // 返回 reject 讓調用者知道
    }
    stateManager.lock('isScreenSwitching');
    // isOptionProcessing 狀態由選項點擊流程管理，此處不直接操作，除非是從 test 頁切走
    if (fromScreenId === 'test') {
        stateManager.unlock('isOptionProcessing'); // 如果從測驗頁切走，確保選項處理流程結束
        console.log("[State LOG] Unlocked: isOptionProcessing (due to switching away from test screen)");
    }


    return new Promise((resolve) => {
        // 1. 讓當前屏幕 (fromScreen) 淡出或執行退場動畫
        // 我們使用 CSS class 'active' 來控制可見性，移除它會觸發退場過渡
        fromScreen.classList.remove('active');

        // 2. 監聽 fromScreen 的退場過渡/動畫結束
        const onFromScreenOut = (event) => {
            if (event && event.target === fromScreen && event.propertyName === 'opacity') {
                fromScreen.removeEventListener('transitionend', onFromScreenOut);
                console.log(`[Animation] Screen '${fromScreenId}' faded out.`);

                // 3. fromScreen 完全隱藏後，準備並激活 toScreen
                toScreen.style.opacity = '0'; // 確保進場前是透明的
                toScreen.classList.add('active'); // 添加 active 以觸發 CSS 的進場過渡 (opacity 0 to 1)
                stateManager.set('activeScreen', toScreenId);

                // 使用 requestAnimationFrame 確保 DOM 更新後再觸發透明度變化以產生動畫
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { // 雙重 RAF 確保瀏覽器有足夠時間應用初始 opacity: 0
                        toScreen.style.opacity = '1';
                    });
                });


                // 4. 監聽 toScreen 的進場過渡/動畫結束
                const onToScreenIn = (event_in) => {
                    if (event_in && event_in.target === toScreen && event_in.propertyName === 'opacity') {
                        toScreen.removeEventListener('transitionend', onToScreenIn);
                        console.log(`[Animation] Screen '${toScreenId}' faded in.`);
                        stateManager.unlock('isScreenSwitching');
                        resolve();
                    }
                };
                toScreen.addEventListener('transitionend', onToScreenIn);

                // 安全超時 (針對 toScreen 的進場)
                setTimeout(() => {
                    if (stateManager.isLocked('isScreenSwitching')) {
                        console.warn(`[Animation WARN] Screen '${toScreenId}' fade-in transition timeout. Forcing completion.`);
                        toScreen.removeEventListener('transitionend', onToScreenIn);
                        stateManager.unlock('isScreenSwitching');
                        resolve();
                    }
                }, SCREEN_TRANSITION_BASE_DURATION + 200);
            }
        };
        fromScreen.addEventListener('transitionend', onFromScreenOut);

        // 安全超時 (針對 fromScreen 的退場)
        setTimeout(() => {
            if (stateManager.isLocked('isScreenSwitching') && !toScreen.classList.contains('active')) {
                // 如果 fromScreen 的 transitionend 未觸發，但 toScreen 還未激活
                console.warn(`[Animation WARN] Screen '${fromScreenId}' fade-out transition timeout. Forcing progression.`);
                fromScreen.removeEventListener('transitionend', onFromScreenOut);
                // 手動觸發後續步驟
                console.log(`[Animation] Screen '${fromScreenId}' faded out (forced by timeout).`);
                toScreen.style.opacity = '0';
                toScreen.classList.add('active');
                stateManager.set('activeScreen', toScreenId);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        toScreen.style.opacity = '1';
                    });
                });
                // (此處不再監聽 toScreen 的 transitionend，直接假設它會在常規時間內完成)
                setTimeout(() => {
                    stateManager.unlock('isScreenSwitching');
                    resolve();
                }, SCREEN_TRANSITION_BASE_DURATION + 50);
            }
        }, SCREEN_TRANSITION_BASE_DURATION + 200);
    });
}


/**
 * 為被點擊的選項按鈕執行字符爆炸噴濺動畫。
 * @param {HTMLElement} clickedOptionElement - 被點擊的選項按鈕元素。
 * @returns {Promise<void>} 動畫完成時 resolve。
 */
export function animateOptionExplode(clickedOptionElement) {
    console.log("[Animation] Starting character explosion for option:", clickedOptionElement);
    if (!clickedOptionElement || !(clickedOptionElement instanceof HTMLElement)) {
        console.error("[Animation ERR] animateOptionExplode: Invalid clickedOptionElement.");
        return Promise.reject(new Error("Invalid element for explosion animation."));
    }

    // 鎖定選項處理狀態
    // stateManager.lock('isOptionProcessing'); // 這個鎖應該在調用此函數之前，在 handleOptionClick 中設置

    const textSpan = clickedOptionElement.querySelector('span'); // 假設 TypeIt 的文字在第一個 span 內
    if (!textSpan || !textSpan.textContent) {
        console.warn("[Animation WARN] No text found in option to explode. Skipping character animation.");
        // 即使沒有文字，也模擬一個短延遲，並讓按鈕本身淡出
        clickedOptionElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        clickedOptionElement.style.opacity = '0';
        clickedOptionElement.style.transform = 'scale(0.9)';
        return new Promise(resolve => setTimeout(resolve, 300));
    }

    const originalText = textSpan.textContent;
    textSpan.innerHTML = ''; // 清空原來的整體文本

    const characters = originalText.split('');
    const charPromises = [];

    characters.forEach((char, index) => {
        if (char.trim() === '') char = '\u00A0'; // 將空格替換為不換行空格以確保渲染

        const charSpan = document.createElement('span');
        charSpan.className = 'exploding-char'; // CSS 應定義此類的動畫
        charSpan.textContent = char;

        // 為每個字符設置隨機的動畫變量 (通過 CSS Variables)
        charSpan.style.setProperty('--tx', `${(Math.random() - 0.5) * 150}px`); // X位移
        charSpan.style.setProperty('--ty', `${(Math.random() - 0.5) * 180}px`); // Y位移
        charSpan.style.setProperty('--r', `${(Math.random() - 0.5) * 600}deg`);  // 旋轉
        charSpan.style.setProperty('--s', `${0.2 + Math.random() * 0.5}`);     // 縮放
        charSpan.style.setProperty('--b', `${1 + Math.random() * 4}px`);       // 模糊

        textSpan.appendChild(charSpan);

        // 觸發動畫 (CSS 中的 scatterChar)
        // 稍微錯開每個字符的動畫開始時間
        const animationDelay = index * 0.025; // s
        charSpan.style.animationName = 'scatterChar'; // 確保 CSS 中有 @keyframes scatterChar
        charSpan.style.animationDelay = `${animationDelay}s`;
        charSpan.style.animationDuration = `${OPTION_CHAR_EXPLODE_DURATION / 1000}s`;
        charSpan.style.animationFillMode = 'forwards';

        // 創建一個 Promise 來追蹤單個字符動畫的完成
        // 由於 animationend 可能對大量元素不太可靠，我們基於已知的最長動畫時間
        const charPromise = new Promise(resolveCharAnim => {
            setTimeout(resolveCharAnim, OPTION_CHAR_EXPLODE_DURATION + animationDelay * 1000 + 50); // 50ms 緩衝
        });
        charPromises.push(charPromise);
    });

    // 標記按鈕正在爆炸 (CSS 可以用這個類來改變按鈕本身的樣式，例如背景變淡)
    clickedOptionElement.classList.add('option-is-exploding');

    // 等待所有字符動畫的 Promise 完成
    return Promise.all(charPromises).then(() => {
        console.log("[Animation] All characters have finished exploding.");
        // 動畫完成後，可以選擇隱藏整個按鈕或做其他清理
        // clickedOptionElement.style.visibility = 'hidden';
        // stateManager.unlock('isOptionProcessing'); // 解鎖應在 handleOptionClick 的更高層次進行
    });
}


/**
 * 設置視口高度 CSS 變數 --vh (用於移動設備適配)。
 */
export function setViewportHeight() {
    try {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    } catch (e) {
        console.warn("[Animation WARN] Setting viewport height failed:", e);
    }
}