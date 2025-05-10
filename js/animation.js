// animation.js - 動畫效能優化模組

import { stateManager } from './state.js';
import { DOM } from './dom.js';

// 動畫時間常數
const PRELOADER_SVG_EXIT_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preloader-svg-exit-duration').replace('s','')) * 1000 || 1200;
const PRELOADER_EXIT_DURATION = PRELOADER_SVG_EXIT_DURATION;
const SCREEN_TRANSITION_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s','')) * 1000 || 600;
const OPTION_EXPLODE_DURATION = 800;
const ANIMATION_FALLBACK_TIMEOUT = 2000; // 動畫超時保障

// 優化後的 Intro 轉場函數
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
        // 設置動畫結束事件監聽
        const onAnimationEnd = () => {
            DOM.elements.preloaderSvg.removeEventListener('animationend', onAnimationEnd);
            DOM.containers.preloader.classList.remove('active', 'transitioning-out');
            DOM.elements.preloaderSvg.classList.remove('svg-exiting', 'glow-active');
            
            if (!DOM.containers.intro.classList.contains('active')) {
                DOM.containers.intro.classList.add('active');
                stateManager.set('introVisible', true);
            }
            
            setTimeout(() => {
                stateManager.unlock('isAnimating');
                resolve();
                console.log("Intro 轉場完成，解除狀態鎖定");
            }, 100);
        };
        
        // 添加動畫結束事件監聽
        DOM.elements.preloaderSvg.addEventListener('animationend', onAnimationEnd);
        
        // 觸發退場動畫
        DOM.elements.preloaderSvg.classList.add('svg-exiting');
        DOM.containers.preloader.classList.add('transitioning-out');
        DOM.containers.intro.classList.add('active');
        stateManager.set('introVisible', true);
        
        // 設置安全超時機制，防止動畫事件沒有觸發
        setTimeout(() => {
            if (stateManager.isLocked('isAnimating')) {
                console.warn("動畫結束事件未觸發，強制完成轉場");
                onAnimationEnd();
            }
        }, PRELOADER_EXIT_DURATION + 500);
    });
}

// 優化的屏幕切換函數
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
        // 使用 requestAnimationFrame 優化動畫
        requestAnimationFrame(() => {
            fromScreen.classList.remove('active');
            
            // 使用 transitionend 事件來偵測過渡結束
            const transitionEndHandler = () => {
                // 完成過渡後的處理
                document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
                stateManager.set('resultShowing', (toScreenId === 'result')); 
                stateManager.set('introVisible', (toScreenId === 'intro'));
                
                // 解鎖狀態
                const unlockDelay = (fromScreenId === 'preloader') ? 100 : 0;
                setTimeout(() => {
                    stateManager.unlock('isAnimating');
                    if (toScreenId !== 'test') { 
                        stateManager.unlock('isTransitioning'); 
                    }
                    console.log(`屏幕切換完成，解除鎖定。當前屏幕: ${toScreenId}`);
                    resolve();
                }, unlockDelay);
                
                // 移除事件監聽
                toScreen.removeEventListener('transitionend', transitionEndHandler);
            };
            
            // 設置超時保障
            const timeoutId = setTimeout(() => {
                console.log("過渡超時，強制完成");
                if (toScreen) {
                    toScreen.removeEventListener('transitionend', transitionEndHandler);
                    transitionEndHandler();
                }
            }, SCREEN_TRANSITION_DURATION + 200);
            
            // 添加過渡結束監聽
            toScreen.addEventListener('transitionend', () => {
                clearTimeout(timeoutId);
                transitionEndHandler();
            });
            
            // 下一幀添加 active 類以觸發過渡動畫
            requestAnimationFrame(() => {
                console.log(`添加 .active 到 ${toScreenId}`);
                toScreen.classList.add('active'); 
            });
        });
    });
}

// 優化的選項爆炸動畫
export function animateOptionExplode(clickedOption, allOptions) {
    return new Promise(resolve => {
        if (!clickedOption || !allOptions) {
            resolve();
            return;
        }
        
        // 使用 FLIP 技術優化動畫效能 (First, Last, Invert, Play)
        // 1. First: 記錄初始狀態
        const initialState = allOptions.map(option => {
            const rect = option.getBoundingClientRect();
            return { el: option, rect };
        });
        
        // 2. 添加爆炸動畫到選中的選項
        clickedOption.classList.add('exploding');
        
        // 同時讓其他選項淡出
        allOptions.forEach(option => {
            if (option !== clickedOption) {
                option.style.willChange = 'opacity, transform';
                option.style.animation = 'fadeOut 0.5s forwards';
            }
        });
        
        // 添加問題和背景的淡出動畫
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.style.willChange = 'opacity, filter';
            DOM.elements.questionTitle.classList.add('fade-out');
        }
        
        if (DOM.elements.testBackground) {
            DOM.elements.testBackground.style.willChange = 'opacity, filter';
            DOM.elements.testBackground.classList.add('fade-out');
        }
        
        // 添加螢幕閃光效果
        const flashElement = document.createElement('div');
        flashElement.className = 'screen-flash';
        document.body.appendChild(flashElement);
        
        // 使用 requestAnimationFrame 而非 setTimeout 來優化
        let startTime = null;
        
        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            
            if (elapsed >= OPTION_EXPLODE_DURATION) {
                // 3. 動畫結束後清理
                allOptions.forEach(option => {
                    option.style.willChange = 'auto';
                });
                
                if (DOM.elements.questionTitle) {
                    DOM.elements.questionTitle.style.willChange = 'auto';
                }
                
                if (DOM.elements.testBackground) {
                    DOM.elements.testBackground.style.willChange = 'auto';
                }
                
                // 移除閃光元素
                if (flashElement && flashElement.parentNode) {
                    flashElement.parentNode.removeChild(flashElement);
                }
                
                resolve();
                return;
            }
            
            // 繼續動畫
            requestAnimationFrame(animate);
        }
        
        requestAnimationFrame(animate);
        
        // 設置超時保障
        setTimeout(() => {
            if (flashElement && flashElement.parentNode) {
                flashElement.parentNode.removeChild(flashElement);
            }
            resolve();
        }, OPTION_EXPLODE_DURATION + 100);
    });
}

// 設置視口高度（適配移動設備）
export function setViewportHeight() { 
    try { 
        let vh = window.innerHeight * 0.01; 
        document.documentElement.style.setProperty('--vh', `${vh}px`); 
    } catch (e) { 
        console.warn("設置視口高度錯誤:", e); 
    } 
}