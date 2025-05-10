// dom.js - DOM 操作模組

// DOM 元素快取對象
export const DOM = {
    containers: {},
    elements: {},
    buttons: {}
};

// 所有選項元素參考
export let allOptions = [];
export const setOptions = (options) => {
    allOptions = options;
};

// 快取 DOM 元素
export function cacheDOMElements() {
    try {
        DOM.containers = {
            intro: document.getElementById('intro-container'),
            test: document.getElementById('test-container'),
            result: document.getElementById('result-container'),
            preloader: document.getElementById('preloader'),
            options: document.getElementById('options-container'),
            preloaderSvgContainer: document.getElementById('preloader-svg-container'),
            introTitlePlaceholder: document.querySelector('#intro-container .intro-title-placeholder')
        };
        
        DOM.elements = {
            testBackground: document.getElementById('test-background'),
            progressFill: document.getElementById('progress-fill'),
            questionTitle: document.getElementById('question-title'),
            resultTitle: document.getElementById('result-title'),
            resultSubtitle: document.getElementById('result-subtitle'),
            resultDescription: document.getElementById('result-description'),
            traitsContainer: document.getElementById('traits-container'),
            similarBooks: document.getElementById('similar-books'),
            complementaryBooks: document.getElementById('complementary-books'),
            shareText: document.getElementById('share-text'),
            preloaderSvg: document.getElementById('preloader-svg'),
            introTitleSvg: null
        };
        
        DOM.buttons = {
            start: document.getElementById('start-test'),
            copy: document.getElementById('copy-btn'),
            restart: document.getElementById('restart-btn')
        };
        
        // 檢查關鍵元素是否存在
        const criticalElements = [
            DOM.containers.intro, DOM.containers.test, DOM.containers.result,
            DOM.containers.preloader, DOM.containers.options,
            DOM.containers.preloaderSvgContainer, DOM.elements.preloaderSvg,
            DOM.containers.introTitlePlaceholder, DOM.elements.testBackground,
            DOM.elements.questionTitle, DOM.buttons.start
        ];
        
        if (criticalElements.some(el => !el)) {
            console.error("錯誤：未能找到所有必要的 HTML 元素");
            return false;
        }
        
        // 從 Preloader SVG 複製到 Intro
        cloneSvgToIntro();
        
        console.log("DOM 元素已快取"); 
        return true;
    } catch (error) { 
        console.error("快取 DOM 元素時出錯:", error); 
        return false; 
    }
}

// 複製 SVG 到 Intro 區域
function cloneSvgToIntro() {
    if (DOM.elements.preloaderSvg && DOM.containers.introTitlePlaceholder) { 
        console.log("準備複製 Preloader SVG 到 Intro..."); 
        try { 
            const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true); 
            clonedSvg.id = 'intro-title-svg'; 
            clonedSvg.classList.remove('glow-active', 'svg-exiting'); 
            DOM.containers.introTitlePlaceholder.innerHTML = ''; 
            DOM.containers.introTitlePlaceholder.appendChild(clonedSvg); 
            DOM.elements.introTitleSvg = clonedSvg; 
            console.log("Intro title SVG 已從 Preloader SVG 複製並插入"); 
        } catch (cloneError) { 
            console.error("複製或插入 SVG 時發生錯誤:", cloneError); 
            if (DOM.containers.introTitlePlaceholder) { 
                DOM.containers.introTitlePlaceholder.innerHTML = '<h1 style="color:red;">Title Clone Error</h1>'; 
            } 
        } 
    }
}

// 顯示錯誤提示
export function displayInitializationError(message) {
    const preloaderContent = document.querySelector('.preloader-content');
    if (preloaderContent) { 
        preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; 
        const preloader = document.getElementById('preloader'); 
        if (preloader) preloader.classList.add('active'); 
    } else { 
        document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; 
    }
}