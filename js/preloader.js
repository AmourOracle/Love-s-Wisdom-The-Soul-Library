// preloader.js - 優化的資源預加載模組

import { stateManager } from './state.js';
import { DOM } from './dom.js';
import { triggerIntroTransition } from './animation.js';
import { bindStartButton } from './testLogic.js';

// 常數定義
const PRELOADER_EXTRA_DELAY = 2000;
const EARLY_GLOW_TRIGGER_DELAY = 100;
const IMAGE_LOADING_TIMEOUT = 10000;  // 圖片載入超時時間

// 優化的預加載函數
export function preloadImages(questions) {
    if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) { 
        console.warn("找不到 preloader 或 preloader SVG..."); 
        stateManager.set('preloadComplete', true); 
        bindStartButton(questions); // 修正：傳遞 questions 參數
        return; 
    }
    
    if (!questions || questions.length === 0) { 
        console.warn("無法預載入圖片：缺少 questions..."); 
        stateManager.set('preloadComplete', true); 
        if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active'); 
        bindStartButton(questions); // 修正：仍然傳遞 questions 參數（即使可能是 undefined）
        return; 
    }
    
    console.log("顯示 Preloader...");
    preparePreloader();
    
    // 添加優先級分組的預加載策略
    addPrioritizedPreloadTags(questions.length);
    
    // 提前添加 SVG 發光效果
    triggerEarlyGlowEffect();
    
    // 優化的載入狀態檢查
    checkPreloadStatus(questions.length, questions); // 修正：傳遞 questions 參數
}

// 準備 Preloader 顯示
function preparePreloader() {
    if(DOM.containers.preloader) {
        DOM.containers.preloader.classList.remove('transitioning-out');
        DOM.containers.preloader.classList.add('active');
    }
    
    if (DOM.elements.preloaderSvg) {
        DOM.elements.preloaderSvg.classList.remove('glow-active', 'svg-exiting');
    }
    
    if (DOM.containers.intro) DOM.containers.intro.classList.remove('active'); 
    if (DOM.containers.test) DOM.containers.test.classList.remove('active'); 
    if (DOM.containers.result) DOM.containers.result.classList.remove('active');
}

// 優化預加載實現：按優先級分組加載
function addPrioritizedPreloadTags(questionCount) {
    // 第一階段：必須立即加載的資源(前3題)
    for(let i = 2; i <= Math.min(3, questionCount); i++) {
        addPreloadTag(`./images/Q${i}.webp`, 'high');
    }
    
    // 第二階段：重要但可延遲加載的資源(4-7題)
    setTimeout(() => {
        for(let i = 4; i <= Math.min(7, questionCount); i++) {
            addPreloadTag(`./images/Q${i}.webp`, 'medium');
        }
    }, 500);
    
    // 第三階段：剩餘資源延遲加載(8題及之後)
    setTimeout(() => {
        for(let i = 8; i <= questionCount; i++) {
            addPreloadTag(`./images/Q${i}.webp`, 'low');
        }
    }, 1000);
}

// 添加優化的預加載標籤
function addPreloadTag(url, priority) {
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.href = url;
    preloadLink.as = 'image';
    
    // 為不同優先級資源設置不同屬性
    if (priority === 'high') {
        preloadLink.setAttribute('fetchpriority', 'high');
    } else if (priority === 'low') {
        preloadLink.setAttribute('fetchpriority', 'low');
    }
    
    document.head.appendChild(preloadLink);
}

// 提前觸發 SVG 發光效果
function triggerEarlyGlowEffect() {
    setTimeout(() => { 
        if (DOM.containers.preloader && 
            DOM.containers.preloader.classList.contains('active') && 
            DOM.elements.preloaderSvg) { 
            console.log(`在 ${EARLY_GLOW_TRIGGER_DELAY}ms 後提早觸發 SVG 放大`); 
            DOM.elements.preloaderSvg.classList.add('glow-active'); 
        } 
    }, EARLY_GLOW_TRIGGER_DELAY);
}

// 優化的預加載狀態檢查
function checkPreloadStatus(questionCount, questions) { // 修正：添加 questions 參數
    // 獲取預加載的前三題圖片
    const highPriorityImages = [];
    for(let i = 1; i <= Math.min(3, questionCount); i++) {
        highPriorityImages.push(`./images/Q${i}.webp`);
    }
    highPriorityImages.push('./images/Intro.webp');
    
    // 設置圖片載入超時
    const loadTimeout = setTimeout(() => {
        console.warn("圖片載入超時，強制完成預加載");
        completePreloading(false, questions); // 修正：傳遞 questions 參數
    }, IMAGE_LOADING_TIMEOUT);
    
    // 使用 Promise.all 檢查高優先級圖片載入狀態
    const imagePromises = highPriorityImages.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    });
    
    // 當高優先級圖片加載完成後，繼續處理
    Promise.all(imagePromises).then(results => {
        clearTimeout(loadTimeout);
        const hasErrors = results.includes(false);
        stateManager.set('preloadComplete', true);
        console.log(`關鍵圖片預載入完成: ${hasErrors ? '(有錯誤)' : '(成功)'}`);
        
        // 模擬延遲讓 SVG 動畫有足夠時間顯示
        setTimeout(() => {
            completePreloading(hasErrors, questions); // 修正：傳遞 questions 參數
        }, hasErrors ? 500 : PRELOADER_EXTRA_DELAY);
    });
}

// 完成預加載處理
function completePreloading(hasErrors, questions) { // 修正：添加 questions 參數
    if (DOM.containers.preloader && DOM.containers.preloader.classList.contains('active')) {
        triggerIntroTransition()
            .then(() => bindStartButton(questions)) // 修正：傳遞 questions 參數
            .catch(err => console.error("轉場錯誤:", err));
    } else {
        console.log("Preloader 不再活躍，跳過轉場。");
        bindStartButton(questions); // 修正：傳遞 questions 參數
    }
    
    // 實作懶加載，使用 Intersection Observer
    setupLazyLoading();
}

// 設置圖片懶加載
function setupLazyLoading() {
    // 檢查瀏覽器支援
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target;
                    const src = lazyImage.getAttribute('data-src');
                    if (src) {
                        lazyImage.src = src;
                        lazyImage.removeAttribute('data-src');
                        observer.unobserve(lazyImage);
                    }
                }
            });
        });
        
        // 觀察所有標記為懶加載的圖片
        document.querySelectorAll('img[data-src]').forEach(img => {
            imgObserver.observe(img);
        });
    } else {
        // 若不支援 Intersection Observer，則直接載入圖片
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
        });
    }
}