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
    
    // 新增檢查：確保 questions 存在
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        console.error("初始化測驗屏幕失敗：缺少問題資料。");
        alert("測驗初始化失敗：無法載入問題。請重新整理頁面。");
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

/**
 * 綁定開始測驗按鈕 - 優化版本
 * 確保純文字按鈕效果與功能正常運作
 */
export function bindStartButton(questions) { 
    console.log("綁定測驗開始按鈕...", questions ? "問題資料已提供" : "問題資料未提供"); 
    
    // 新增：如果沒有傳入 questions，嘗試從 window.testData 獲取
    if (!questions && window.testData && window.testData.questions) {
        questions = window.testData.questions;
        console.log("從全域 testData 獲取問題資料");
    }
    
    // 獲取按鈕元素
    if (!DOM.buttons.start) { 
        console.error("找不到開始按鈕元素"); 
        return; 
    }
    
    // === 關鍵修復 1: 先移除舊事件並複製元素 ===
    // 使用克隆替換原始元素，確保移除現有事件監聽器
    const originalButton = DOM.buttons.start;
    const clonedButton = originalButton.cloneNode(false); // 淺拷貝，不帶子元素
    
    if (originalButton.parentNode) {
        originalButton.parentNode.replaceChild(clonedButton, originalButton);
    }
    
    // 更新DOM引用
    DOM.buttons.start = clonedButton;
    
    // === 關鍵修復 2: 應用純文字打字機效果 ===
    // 保存原始文字內容
    const originalText = "親啟"; // 固定使用此文字，避免從DOM讀取可能的空值
    
    // 創建打字機效果元素
    const typingSpan = document.createElement('span');
    typingSpan.className = 'btn-text typing-effect';
    typingSpan.textContent = originalText;
    
    // 設置動畫參數 - 從CSS變數獲取
    const styles = getComputedStyle(document.documentElement);
    const typingDelay = styles.getPropertyValue('--typing-base-delay') || '0.5s';
    const typingDuration = styles.getPropertyValue('--typing-base-duration') || '1s';
    
    typingSpan.style.setProperty('--typing-delay', typingDelay);
    typingSpan.style.setProperty('--typing-duration', typingDuration);
    
    // 添加到按鈕
    clonedButton.appendChild(typingSpan);
    
    // === 關鍵修復 3: 重新綁定事件處理函數 ===
    // 直接使用内联函數，避免引用問題
    clonedButton.addEventListener('click', function(event) {
        console.log("開始按鈕被點擊");
        
        // 檢查內容是否已加載完成及動畫狀態
        if (stateManager.isLocked('isAnimating') || stateManager.isLocked('isTransitioning')) {
            console.log("動畫或轉場進行中，忽略點擊"); 
            return; 
        }
        
        if (!stateManager.get('preloadComplete') || !stateManager.get('introVisible')) {
            console.warn("內容未準備好或Intro未顯示"); 
            return; 
        }
        
        // 新增檢查：確保問題資料存在
        if (!questions) {
            console.error("無法啟動測驗：缺少問題資料");
            
            // 嘗試從全域變數取得問題資料
            if (window.testData && window.testData.questions) {
                questions = window.testData.questions;
                console.log("成功從全域 testData 獲取問題資料");
            } else {
                alert("無法啟動測驗：問題資料載入失敗");
                return;
            }
        }
        
        console.log("開始切換到測驗畫面");
        
        // 調用處理函數啟動測驗
        handleStartTestClick(questions);
    });
    
    console.log("開始按鈕綁定完成"); 
}

/**
 * 開始測驗按鈕點擊處理函數 - 獨立出來便於除錯
 */
function handleStartTestClick(questions) {
    console.log("啟動測驗流程，切換到測驗屏幕");
    
    switchScreen('intro', 'test')
        .then(() => {
            console.log("測驗屏幕載入完成");
            initializeTestScreen(questions);
            
            // 為所有選項添加事件監聽
            allOptions.forEach(option => {
                option.addEventListener('click', e => handleOptionClick(e, questions)); 
                option.addEventListener('keydown', e => { 
                    if (e.key === 'Enter' || e.key === ' ') { 
                        e.preventDefault(); 
                        handleOptionClick(e, questions); 
                    } 
                });
            });
        })
        .catch(err => console.error("切換至測驗屏幕失敗:", err));
}

// 綁定其他按鈕
export function bindOtherButtons() { 
    if (DOM.buttons.restart) { 
        DOM.buttons.restart.removeEventListener('click', handleRestartClick); 
        DOM.buttons.restart.addEventListener('click', handleRestartClick); 
        
        // 應用打字效果
        setupButtonTypingEffect(DOM.buttons.restart, DOM.buttons.restart.textContent.trim());
        
        console.log("Restart button event bound."); 
    } else { 
        console.error("Cannot bind restart button."); 
    } 
    
    if (DOM.buttons.copy) { 
        DOM.buttons.copy.removeEventListener('click', copyShareText); 
        DOM.buttons.copy.addEventListener('click', copyShareText); 
        
        // 應用打字效果
        setupButtonTypingEffect(DOM.buttons.copy, DOM.buttons.copy.textContent.trim());
        
        console.log("Copy button event bound."); 
    } else { 
        console.error("Cannot bind copy button."); 
    } 
}

/**
 * 為按鈕應用打字機效果
 */
function setupButtonTypingEffect(button, text) {
    if (!button || !text) return;
    
    // 檢查是否已經應用了打字效果
    const existingSpan = button.querySelector('.btn-text');
    if (existingSpan) return;
    
    // 創建打字機效果元素
    const typingSpan = document.createElement('span');
    typingSpan.className = 'btn-text typing-effect';
    typingSpan.textContent = text;
    
    // 為每個按鈕設置稍微不同的延遲和速度
    const randomDelay = (Math.random() * 0.3 + 0.2) + 's';
    const typingDuration = (text.length * 30 / 1000 + 0.5) + 's';
    
    typingSpan.style.setProperty('--typing-delay', randomDelay);
    typingSpan.style.setProperty('--typing-duration', typingDuration);
    
    // 清空按鈕內容並添加新的打字效果
    button.innerHTML = '';
    button.appendChild(typingSpan);
}

/**
 * 處理測驗選項點擊 - 優化版本
 */
export function handleOptionClick(event, questions) {
    const clickedOption = event.currentTarget; 
    const optionIndex = parseInt(clickedOption.dataset.index); 
    const questionIndex = stateManager.get('currentQuestionIndex');
    
    console.log(`選項點擊: Q${questionIndex + 1}, Option ${optionIndex + 1}`);
    
    // 基本檢查
    if (isNaN(optionIndex) || isNaN(questionIndex)) { 
        console.error("無效的選項或問題索引"); 
        return; 
    }
    
    if (stateManager.isLocked('isTransitioning')) { 
        console.log("正在處理上一個點擊或問題轉換..."); 
        return; 
    }
    
    // 鎖定狀態，記錄用戶答案
    stateManager.lock('isTransitioning');
    legacyState.userAnswers[questionIndex] = optionIndex;
    
    // 添加螢幕閃光效果
    addScreenFlashEffect();
    
    // 執行爆炸動畫，完成後顯示下一題或結果
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

/**
 * 添加螢幕閃光效果
 */
function addScreenFlashEffect() {
    const flashElement = document.createElement('div');
    flashElement.className = 'screen-flash';
    document.body.appendChild(flashElement);
    
    // 動畫結束後自動移除元素
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

// 重新開始測驗
function handleRestartClick() { 
    if (stateManager.isLocked('isAnimating')) { 
        console.log("Animation in progress, cannot restart yet."); 
        return; 
    } 
    
    switchScreen('result', 'intro')
        .then(() => {
            console.log("測驗重新開始");
            
            // 確保事件被正確綁定
            if (window.testData && window.testData.questions) {
                bindStartButton(window.testData.questions);
            } else {
                console.error("testData not found, cannot bind start button correctly");
            }
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
                    // 安全更新按鈕文字
                    const originalText = DOM.buttons.copy.textContent;
                    DOM.buttons.copy.textContent = '已複製!'; 
                    setTimeout(() => { 
                        DOM.buttons.copy.textContent = '複製'; 
                        // 重新應用打字效果
                        setupButtonTypingEffect(DOM.buttons.copy, '複製');
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
        // 重新應用打字效果
        setupButtonTypingEffect(DOM.buttons.copy, '複製');
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
                // 重新應用打字效果
                setupButtonTypingEffect(DOM.buttons.copy, '複製');
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

/**
 * 應急初始化函數 - 用於手動強制初始化按鈕功能
 * 可從主模塊調用此函數確保按鈕功能正常
 */
export function forceInitializeButtons() {
    console.log("強制初始化按鈕功能...");
    
    try {
        // 1. 查找按鈕元素
        const startButton = document.getElementById('start-test');
        if (!startButton) {
            console.error("無法找到開始按鈕元素!");
            return false;
        }
        
        // 2. 更新DOM引用
        DOM.buttons.start = startButton;
        
        // 3. 重新綁定按鈕事件
        if (window.testData && window.testData.questions) {
            bindStartButton(window.testData.questions);
            console.log("強制初始化按鈕完成");
            return true;
        } else {
            console.error("無法找到測驗數據，按鈕初始化失敗");
            return false;
        }
    } catch (error) {
        console.error("強制初始化按鈕時發生錯誤:", error);
        return false;
    }
}