// view.js - 視圖渲染模組

import { stateManager } from './state.js';
import { DOM, allOptions, setOptions } from './dom.js';
import { animateOptionExplode } from './animation.js';

// 更新進度條
export function updateProgressBar(questionNumber, totalQuestions) { 
    if (DOM.elements.progressFill) { 
        const progress = (questionNumber / totalQuestions) * 100; 
        requestAnimationFrame(() => {
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`; 
        });
    } 
}

// 優化的問題顯示函數
export function displayQuestion(index, questions, isInitialDisplay = false) {
    if (index < 0 || index >= questions.length) { 
        console.error(`無效的問題索引: ${index}`); 
        stateManager.unlock('isTransitioning'); 
        return; 
    }
    
    const questionData = questions[index]; 
    const questionNumber = index + 1;
    
    // 使用 will-change 為即將發生動畫的元素提示瀏覽器優化
    if (DOM.elements.testBackground) { 
        DOM.elements.testBackground.style.willChange = 'background-image, opacity, filter';
        
        // 使用 requestAnimationFrame 優化動畫
        requestAnimationFrame(() => {
            const imageUrl = `./images/Q${questionNumber}.webp`; 
            
            // 刪除之前的動畫類
            DOM.elements.testBackground.classList.remove('fade-out');
            
            // 設置新背景並添加淡入動畫
            DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`; 
            DOM.elements.testBackground.classList.add('fade-in');
            
            // 動畫結束後清理 will-change
            DOM.elements.testBackground.addEventListener('animationend', () => {
                DOM.elements.testBackground.style.willChange = 'auto';
                DOM.elements.testBackground.classList.remove('fade-in');
            }, { once: true });
        });
    }
    
    // 問題文本淡入
    if (DOM.elements.questionTitle) { 
        DOM.elements.questionTitle.style.willChange = 'transform, opacity, filter';
        
        requestAnimationFrame(() => {
            // 淡入動畫前先清除之前的類
            DOM.elements.questionTitle.classList.remove('fade-out');
            
            // 設置新問題文本
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, ''); 
            
            // 添加自上而下淡入動畫
            DOM.elements.questionTitle.classList.add('fade-in');
            
            // 動畫結束後清理
            DOM.elements.questionTitle.addEventListener('animationend', () => {
                DOM.elements.questionTitle.style.willChange = 'auto';
                DOM.elements.questionTitle.classList.remove('fade-in');
            }, { once: true });
        });
    }
    
    // 使用 DocumentFragment 提高選項創建效能
    if (DOM.containers.options) {
        createOptions(questionData, DOM.containers.options);
        console.log(`問題 ${questionNumber} 和選項已顯示`);
    } else { 
        console.error("找不到 options-container"); 
        stateManager.unlock('isTransitioning'); 
    }
}

// 使用 DocumentFragment 優化選項創建
function createOptions(questionData, container) {
    // 創建文檔片段，避免直接操作 DOM
    const fragment = document.createDocumentFragment();
    const optionElements = [];
    
    // 清除現有選項
    container.innerHTML = '';
    
    // 創建新選項
    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div'); 
        optionElement.className = 'option';
        optionElement.dataset.text = optionData.text; 
        optionElement.dataset.index = optIndex; 
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0; 
        
        // 無障礙增強
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);
        
        // 使用 will-change 提示瀏覽器優化
        optionElement.style.willChange = 'opacity, transform';
        
        // 新增：創建打字機效果的包裝容器
        const textSpan = document.createElement('span');
        textSpan.className = 'option-text typing-effect';
        textSpan.textContent = optionData.text;
        
        // 設置隨機延遲的打字機效果 (0.2s 到 1.2s 之間的隨機值)
        const randomDelay = (0.2 + Math.random() * 1) + 's';
        // 根據文本長度設置打字機動畫持續時間 (每個字符 50ms 到 80ms)
        const typingDuration = (optionData.text.length * (50 + Math.random() * 30) / 1000) + 's';
        
        textSpan.style.setProperty('--typing-delay', randomDelay);
        textSpan.style.setProperty('--typing-duration', typingDuration);
        
        // 為新選項設置淡入動畫
        optionElement.style.animation = 'fadeIn 0.5s forwards';
        optionElement.style.animationDelay = `${0.1 * optIndex}s`; // 錯開每個選項的動畫
        
        // 添加文本到選項
        optionElement.appendChild(textSpan);
        
        // 動畫結束後清理
        optionElement.addEventListener('animationend', () => {
            optionElement.style.willChange = 'auto';
        }, { once: true });
        
        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });
    
    // 一次性添加到 DOM
    container.appendChild(fragment);
    
    // 設置全域引用
    setOptions(optionElements);
    
    // 稍後解鎖狀態
    if (optionElements.length > 0) {
        const lastOption = optionElements[optionElements.length - 1];
        lastOption.addEventListener('animationend', () => {
            stateManager.unlock('isTransitioning'); 
            console.log("isTransitioning 解鎖 (displayQuestion)"); 
        }, { once: true });
    } else {
        // 如果沒有選項，還是要解鎖
        requestAnimationFrame(() => { 
            stateManager.unlock('isTransitioning'); 
            console.log("isTransitioning 解鎖 (displayQuestion - no options)"); 
        });
    }
    
    return optionElements;
}