// animation.js - 動畫效能優化模組

import { stateManager } from './state.js';
import { DOM } from './dom.js';

// 動畫時間常數
const PRELOADER_SVG_EXIT_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preloader-svg-exit-duration').replace('s','')) * 1000 || 1200;
const PRELOADER_EXIT_DURATION = PRELOADER_SVG_EXIT_DURATION;
const SCREEN_TRANSITION_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s','')) * 1000 || 600;
const OPTION_EXPLODE_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--option-explode-duration').replace('s','')) * 1000 || 800;
const ANIMATION_FALLBACK_TIMEOUT = 2000; // 動畫超時保障

// 優化後的 Intro 轉場函數 (保持不變)
export function triggerIntroTransition() {
    if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg || !DOM.containers.introTitlePlaceholder) {
        console.error("Preloader/Intro/SVG/Title placeholder not found for transition.");
        stateManager.unlock('isAnimating');
        return Promise.reject("缺少必要元素");
    }

    if (stateManager.isLocked('isAnimating')) {
        console.log("正在轉換 Intro，忽略重複觸發");
        return Promise.resolve();
    }

    console.log("開始 Preloader 到 Intro 的轉場...");
    stateManager.lock('isAnimating');

    return new Promise(resolve => {
        const onAnimationEnd = () => {
            if (DOM.elements.preloaderSvg) { // 檢查是否存在
                DOM.elements.preloaderSvg.removeEventListener('animationend', onAnimationEnd);
                DOM.elements.preloaderSvg.classList.remove('svg-exiting', 'glow-active');
            }
            if (DOM.containers.preloader) { // 檢查是否存在
                 DOM.containers.preloader.classList.remove('active', 'transitioning-out');
            }


            if (DOM.containers.intro && !DOM.containers.intro.classList.contains('active')) {
                DOM.containers.intro.classList.add('active');
                stateManager.set('introVisible', true);
            }

            setTimeout(() => {
                stateManager.unlock('isAnimating');
                resolve();
                console.log("Intro 轉場完成，解除狀態鎖定");
            }, 100);
        };

        if (DOM.elements.preloaderSvg) {
            DOM.elements.preloaderSvg.addEventListener('animationend', onAnimationEnd);
            DOM.elements.preloaderSvg.classList.add('svg-exiting');
        } else { // 如果 SVG 不存在，直接模擬完成
            console.warn("Preloader SVG 不存在，直接完成轉場");
            onAnimationEnd();
            return;
        }


        if (DOM.containers.preloader) DOM.containers.preloader.classList.add('transitioning-out');
        if (DOM.containers.intro) {
            DOM.containers.intro.classList.add('active');
            stateManager.set('introVisible', true);
        }


        setTimeout(() => {
            if (stateManager.isLocked('isAnimating')) {
                console.warn("動畫結束事件未觸發，強制完成轉場");
                onAnimationEnd();
            }
        }, PRELOADER_EXIT_DURATION + 500);
    });
}

// 優化的屏幕切換函數 (保持不變)
export function switchScreen(fromScreenId, toScreenId) {
    console.log(`嘗試切換屏幕從 ${fromScreenId} 到 ${toScreenId}`);
    const fromScreen = DOM.containers[fromScreenId];
    const toScreen = DOM.containers[toScreenId];

    if (!fromScreen || !toScreen) {
        console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`);
        stateManager.unlock('isAnimating');
        stateManager.unlock('isTransitioning');
        return Promise.reject("無效的屏幕 ID");
    }

    if (stateManager.isLocked('isAnimating') && fromScreenId !== 'preloader') {
        console.log("屏幕切換已在進行中... 忽略重複請求");
        return Promise.resolve();
    }

    console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
    stateManager.lock('isAnimating');
    stateManager.lock('isTransitioning');

    return new Promise(resolve => {
        requestAnimationFrame(() => {
            fromScreen.classList.remove('active');

            const transitionEndHandler = (event) => {
                // 確保事件是由 toScreen 觸發的，並且是 opacity 屬性
                if (event && event.target !== toScreen && event.propertyName !== 'opacity') {
                    return;
                }

                document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
                stateManager.set('resultShowing', (toScreenId === 'result'));
                stateManager.set('introVisible', (toScreenId === 'intro'));

                const unlockDelay = (fromScreenId === 'preloader') ? 100 : 0;
                setTimeout(() => {
                    stateManager.unlock('isAnimating');
                    if (toScreenId !== 'test') {
                        stateManager.unlock('isTransitioning');
                         console.log(`isTransitioning 已解鎖 (switchScreen to ${toScreenId})`);
                    } else {
                         console.log(`isTransitioning 保持鎖定 (switchScreen to test, displayQuestion 會解鎖)`);
                    }
                    console.log(`屏幕切換完成，解除鎖定。當前屏幕: ${toScreenId}`);
                    resolve();
                }, unlockDelay);

                toScreen.removeEventListener('transitionend', transitionEndHandler);
            };

            let timeoutId = setTimeout(() => {
                console.warn(`過渡超時 (from ${fromScreenId} to ${toScreenId})，強制完成`);
                toScreen.removeEventListener('transitionend', transitionEndHandler);
                transitionEndHandler(null); // 傳入 null 避免事件對象相關錯誤
            }, SCREEN_TRANSITION_DURATION + 300); // 稍微增加超時緩衝

            toScreen.addEventListener('transitionend', (e) => {
                // 只關心 toScreen 本身的 opacity 過渡結束
                if (e.target === toScreen && e.propertyName === 'opacity') {
                    clearTimeout(timeoutId);
                    transitionEndHandler(e);
                }
            });
            
            requestAnimationFrame(() => {
                console.log(`添加 .active 到 ${toScreenId}`);
                toScreen.classList.add('active');
            });
        });
    });
}


// 優化的選項爆炸動畫
export function animateOptionExplode(clickedOption, allOptions) {
    return new Promise((resolve, reject) => { // 修改為可以 reject
        if (!clickedOption || !(clickedOption instanceof HTMLElement)) {
            console.error("animateOptionExplode: clickedOption 無效或不是 HTMLElement.");
            reject(new Error("clickedOption 無效"));
            return;
        }
        if (!allOptions || !Array.isArray(allOptions)) {
            console.error("animateOptionExplode: allOptions 無效或不是數組.");
            reject(new Error("allOptions 無效"));
            return;
        }

        console.log("animateOptionExplode: 開始爆炸動畫 for", clickedOption);

        // 1. 添加爆炸動畫到選中的選項
        clickedOption.classList.add('exploding');
        // clickedOption.style.zIndex = '100'; // 可選：臨時提升層級

        // 2. 其他選項淡出
        allOptions.forEach(option => {
            if (option !== clickedOption && option instanceof HTMLElement) {
                option.style.willChange = 'opacity, transform';
                option.style.animation = 'fadeOut 0.5s forwards'; // 確保 CSS 中有 fadeOut 動畫
            }
        });

        // 3. 問題和背景淡出
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.style.willChange = 'opacity, filter';
            DOM.elements.questionTitle.classList.remove('fade-in');
            DOM.elements.questionTitle.classList.add('fade-out'); // 確保 CSS 中有 fade-out 動畫
        }
        if (DOM.elements.testBackground) {
            DOM.elements.testBackground.style.willChange = 'opacity, filter';
            DOM.elements.testBackground.classList.remove('fade-in');
            DOM.elements.testBackground.classList.add('fade-out'); // 確保 CSS 中有 fade-out 動畫
        }

        // 4. 屏幕閃光效果
        const existingFlash = document.querySelector('.screen-flash');
        if (existingFlash) existingFlash.remove();

        const flashElement = document.createElement('div');
        flashElement.className = 'screen-flash'; // 確保 CSS 中有 screenFlash 動畫
        document.body.appendChild(flashElement);
        flashElement.addEventListener('animationend', () => flashElement.remove(), { once: true });


        // 5. 等待動畫完成
        // OPTION_EXPLODE_DURATION 應與 CSS 中 .exploding 的動畫時長一致
        setTimeout(() => {
            console.log("animateOptionExplode: 動畫結束，執行清理");

            // 清理工作 (可選，因為元素通常會被替換)
            // if (clickedOption.classList.contains('exploding')) {
            //     clickedOption.classList.remove('exploding');
            // }
            allOptions.forEach(option => {
                if (option instanceof HTMLElement) {
                    option.style.willChange = 'auto';
                    // option.style.animation = ''; // 避免影響下次出現
                }
            });
            if (DOM.elements.questionTitle) DOM.elements.questionTitle.style.willChange = 'auto';
            if (DOM.elements.testBackground) DOM.elements.testBackground.style.willChange = 'auto';

            resolve();
        }, OPTION_EXPLODE_DURATION); // 確保這個時間與 CSS 動畫持續時間相符
    });
}

// 設置視口高度（適配移動設備）(保持不變)
export function setViewportHeight() {
    try {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    } catch (e) {
        console.warn("設置視口高度錯誤:", e);
    }
}