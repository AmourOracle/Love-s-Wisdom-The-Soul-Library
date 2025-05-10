// testLogic.js - 測驗邏輯處理模組

import { stateManager, legacyState } from './state.js';
import { DOM, allOptions, setOptions } from './dom.js';
import { switchScreen } from './animation.js';
import { displayQuestion, updateProgressBar } from './view.js';
import { animateOptionExplode } from './animation.js';
import { showResults } from './resultLogic.js';

// 初始化測驗屏幕
export function initializeTestScreen(questions) {
    if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) { 
        console.error("初始化測驗屏幕失敗：缺少必要元素。"); 
        return; 
    }
    
    console.log("初始化測驗屏幕..."); 
    stateManager.set('currentQuestionIndex', 0); 
    legacyState.userAnswers = []; 
    stateManager.unlock('isTransitioning'); 
    updateProgressBar(0, questions.length); 
    displayQuestion(stateManager.get('currentQuestionIndex'), questions, true); 
    updateProgressBar(1, questions.length);
}

// 綁定開始測驗按鈕
export function bindStartButton(questions) { 
    if (DOM.buttons.start) { 
        DOM.buttons.start.removeEventListener('click', handleStartTestClick); 
        DOM.buttons.start.addEventListener('click', () => handleStartTestClick(questions)); 
        console.log("Start button event bound."); 
        
        // 添加打字機效果
        setupStartButtonTypingEffect();
    } else { 
        console.error("Failed to bind start button event."); 
    } 
}

// 設置開始按鈕打字機效果 (新增)
function setupStartButtonTypingEffect() {
    const startButton = DOM.buttons.start;
    if (!startButton) return;
    
    // 保存原始文字
    const originalText = startButton.textContent.trim() || '親啟';
    startButton.innerHTML = '';
    
    // 創建打字機效果元素
    const typingSpan = document.createElement('span');
    typingSpan.className = 'btn-text typing-effect';
    typingSpan.textContent = originalText;
    
    // 設置打字機效果延遲和持續時間
    typingSpan.style.setProperty('--typing-delay', '0.5s');
    typingSpan.style.setProperty('--typing-duration', '1s');
    
    // 添加到按鈕
    startButton.appendChild(typingSpan);
    
    console.log("Start button typing effect applied.");
}

// 綁定其他按鈕
export function bindOtherButtons() { 
    if (DOM.buttons.restart) { 
        DOM.buttons.restart.removeEventListener('click', handleRestartClick); 
        DOM.buttons.restart.addEventListener('click', handleRestartClick); 
        
        // 添加重新開始按鈕打字效果
        setupButtonTypingEffect(DOM.buttons.restart);
        
        console.log("Restart button event bound."); 
    } else { 
        console.error("Cannot bind restart button."); 
    } 
    
    if (DOM.buttons.copy) { 
        DOM.buttons.copy.removeEventListener('click', copyShareText); 
        DOM.buttons.copy.addEventListener('click', copyShareText); 
        
        // 添加複製按鈕打字效果
        setupButtonTypingEffect(DOM.buttons.copy);
        
        console.log("Copy button event bound."); 
    } else { 
        console.error("Cannot bind copy button."); 
    } 
}

// 通用按鈕打字效果設置 (新增)
function setupButtonTypingEffect(button) {
    if (!button) return;
    
    const originalText = button.textContent.trim();
    if (!originalText) return;
    
    button.innerHTML = '';
    
    const typingSpan = document.createElement('span');
    typingSpan.className = 'btn-text typing-effect';
    typingSpan.textContent = originalText;
    
    // 為每個按鈕設置稍微不同的延遲和速度，增加隨機性
    const randomDelay = (Math.random() * 0.3 + 0.2) + 's';
    const typingDuration = (originalText.length * 30 / 1000 + 0.5) + 's';
    
    typingSpan.style.setProperty('--typing-delay', randomDelay);
    typingSpan.style.setProperty('--typing-duration', typingDuration);
    
    button.appendChild(typingSpan);
}

// 優化的選項點擊處理
export function handleOptionClick(event, questions) {
    const clickedOption = event.currentTarget; 
    const optionIndex = parseInt(clickedOption.dataset.index); 
    const questionIndex = stateManager.get('currentQuestionIndex');
    
    console.log(`Option clicked: Q${questionIndex + 1}, Option ${optionIndex + 1}`);
    
    if (isNaN(optionIndex) || isNaN(questionIndex)) { 
        console.error("無效的選項或問題索引"); 
        return; 
    }
    
    if (stateManager.isLocked('isTransitioning')) { 
        console.log("正在處理上一個點擊或問題轉換..."); 
        return; 
    }
    
    stateManager.lock('isTransitioning');
    console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
    
    legacyState.userAnswers[questionIndex] = optionIndex;
    
    // 螢幕閃光效果
    addScreenFlashEffect();
    
    // 使用優化的動畫系統
    animateOptionExplode(clickedOption, allOptions).then(() => {
        if (stateManager.get('currentQuestionIndex') < questions.length - 1) {
            console.log("準備顯示下一個問題...");
            prepareNextQuestion(questions);
        } else {
            console.log("最後一題完成，準備顯示結果...");
            showResults(questions, legacyState.userAnswers);
        }
    });
}

// 添加螢幕閃光效果 (新增)
function addScreenFlashEffect() {
    const flashElement = document.createElement('div');
    flashElement.className = 'screen-flash';
    document.body.appendChild(flashElement);
    
    // 動畫結束後移除元素
    flashElement.addEventListener('animationend', () => {
        if (flashElement.parentNode) {
            flashElement.parentNode.removeChild(flashElement);
        }
    });
}

// 準備下一個問題
function prepareNextQuestion(questions) {
    stateManager.set('currentQuestionIndex', stateManager.get('currentQuestionIndex') + 1); 
    console.log(`準備顯示問題 ${stateManager.get('currentQuestionIndex') + 1}`); 
    updateProgressBar(stateManager.get('currentQuestionIndex') + 1, questions.length); 
    displayQuestion(stateManager.get('currentQuestionIndex'), questions, false);
}

// 開始測驗點擊處理
function handleStartTestClick(questions) {
    console.log("handleStartTestClick triggered.");
    
    if (!stateManager.get('preloadComplete') || !stateManager.get('introVisible')) { 
        console.warn("內容尚未準備好或 Intro 未顯示。"); 
        return; 
    }
    
    const buttonElement = DOM.buttons.start; 
    if (!buttonElement) { 
        console.error("Start button not found!"); 
        return; 
    }
    
    if (stateManager.isLocked('isAnimating') || stateManager.isLocked('isTransitioning')) { 
        console.log("動畫或屏幕轉換進行中..."); 
        return; 
    }
    
    console.log("Start button clicked, switching to test screen...");
    switchScreen('intro', 'test')
        .then(() => {
            console.log("測驗屏幕載入完成");
            initializeTestScreen(questions);
            
            // 添加事件監聽給所有選項
            allOptions.forEach(option => {
                option.addEventListener('click', (e) => handleOptionClick(e, questions)); 
                option.addEventListener('keydown', (e) => { 
                    if (e.key === 'Enter' || e.key === ' ') { 
                        e.preventDefault(); 
                        handleOptionClick(e, questions); 
                    } 
                });
            });
        })
        .catch(err => console.error("切換至測驗屏幕失敗:", err));
}

// 重新開始測驗
function handleRestartClick() { 
    if (stateManager.isLocked('isAnimating')) { 
        console.log("Animation in progress, cannot restart yet."); 
        return; 
    } 
    
    switchScreen('result', 'intro')
        .then(() => {
            console.log("測驗重新開始");
            // 重新應用按鈕打字效果
            setupStartButtonTypingEffect();
        })
        .catch(err => console.error("重新開始測驗失敗:", err));
}

// 複製分享文本
function copyShareText() { 
    if (!DOM.elements.shareText || !DOM.buttons.copy) return; 
    
    try { 
        const textToCopy = DOM.elements.shareText.textContent; 
        
        if (navigator.clipboard && window.isSecureContext) { 
            navigator.clipboard.writeText(textToCopy)
                .then(() => { 
                    DOM.buttons.copy.textContent = '已複製!'; 
                    setTimeout(() => { 
                        DOM.buttons.copy.textContent = '複製'; 
                        // 重新應用按鈕打字效果
                        setupButtonTypingEffect(DOM.buttons.copy);
                    }, 2000); 
                })
                .catch(err => { 
                    console.warn('Clipboard API copy failed:', err); 
                    fallbackCopyText(textToCopy); 
                }); 
        } else { 
            fallbackCopyText(textToCopy); 
        } 
    } catch (error) { 
        console.error("Copy operation error:", error); 
        alert('複製失敗，請手動複製。'); 
        DOM.buttons.copy.textContent = '複製'; 
        // 重新應用按鈕打字效果
        setupButtonTypingEffect(DOM.buttons.copy);
    } 
}

// 複製文本的備用方法
function fallbackCopyText(text) { 
    const textArea = document.createElement("textarea"); 
    textArea.value = text; 
    textArea.style.position = 'fixed'; 
    textArea.style.left = '-9999px'; 
    textArea.style.opacity = '0'; 
    textArea.setAttribute('readonly', ''); 
    document.body.appendChild(textArea); 
    textArea.select(); 
    textArea.setSelectionRange(0, 99999); 
    
    let success = false; 
    try { 
        success = document.execCommand('copy'); 
        if (success) { 
            DOM.buttons.copy.textContent = '已複製!'; 
            setTimeout(() => { 
                DOM.buttons.copy.textContent = '複製'; 
                // 重新應用按鈕打字效果
                setupButtonTypingEffect(DOM.buttons.copy);
            }, 2000); 
        } else { 
            console.error('Fallback copy (execCommand) failed'); 
            alert('複製失敗，瀏覽器不支援此操作。'); 
        } 
    } catch (err) { 
        console.error('Fallback copy error:', err); 
        alert('複製失敗，請手動複製。'); 
    } 
    
    document.body.removeChild(textArea); 
}