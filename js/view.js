// js/view.js - 視圖渲染模組 (重構版 - 整合 TypeIt.js)

import { stateManager } from './state.js';
import { DOM, setOptionElements } from './dom.js'; // 導入 setOptionElements
import { handleOptionClick } from './testLogic.js'; // 導入核心選項點擊處理函數

/**
 * 更新進度條的顯示。
 * @param {number} currentQuestionNumber - 當前是第幾題 (從1開始)。
 * @param {number} totalQuestions - 總題目數量。
 */
export function updateProgressBar(currentQuestionNumber, totalQuestions) {
    if (DOM.elements.progressFill && totalQuestions > 0) {
        const progress = (currentQuestionNumber / totalQuestions) * 100;
        requestAnimationFrame(() => {
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        });
    } else if (totalQuestions <= 0) {
        DOM.elements.progressFill.style.width = '0%';
    }
}

/**
 * 顯示指定索引的問題及其選項。
 * @param {number} questionIndex - 要顯示的問題在 questions 陣列中的索引。
 * @param {object[]} questionsData - 包含所有問題數據的陣列。
 */
export function displayQuestion(questionIndex, questionsData) {
    if (questionIndex < 0 || questionIndex >= questionsData.length) {
        console.error(`[View ERR] displayQuestion: 無效的問題索引 ${questionIndex}`);
        // 考慮是否需要解鎖狀態，但通常此函數由已控制狀態的邏輯調用
        return;
    }

    const question = questionsData[questionIndex];
    const questionNumberForDisplay = questionIndex + 1; // 用於顯示的題號 (1-based)

    console.log(`[View LOG] displayQuestion: 顯示問題 ${questionNumberForDisplay}/${questionsData.length}`);

    // 1. 更新背景圖片 (通過 CSS class 控制動畫)
    if (DOM.elements.testBackground) {
        DOM.elements.testBackground.style.willChange = 'background-image, opacity';
        requestAnimationFrame(() => {
            const imageUrl = `./images/Q${questionNumberForDisplay}.webp`;
            DOM.elements.testBackground.classList.remove('fade-out', 'fade-in'); // 清除舊類
            DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
            DOM.elements.testBackground.classList.add('fade-in'); // 觸發CSS動畫
            DOM.elements.testBackground.addEventListener('animationend', function onBgFadeInEnd() {
                if (DOM.elements.testBackground) {
                    DOM.elements.testBackground.style.willChange = 'auto';
                    DOM.elements.testBackground.classList.remove('fade-in'); // 清理動畫類
                    DOM.elements.testBackground.removeEventListener('animationend', onBgFadeInEnd);
                }
            }, { once: true });
        });
    }

    // 2. 更新問題標題 (通過 CSS class 控制動畫)
    if (DOM.elements.questionTitle) {
        DOM.elements.questionTitle.style.willChange = 'opacity, transform';
        requestAnimationFrame(() => {
            DOM.elements.questionTitle.classList.remove('fade-out', 'fade-in'); // 清除舊類
            DOM.elements.questionTitle.textContent = question.question.replace(/^\d+\.\s*/, ''); // 移除題號前綴
            DOM.elements.questionTitle.classList.add('fade-in'); // 觸發CSS動畫 (假設包含 slide)
             DOM.elements.questionTitle.addEventListener('animationend', function onTitleFadeInEnd() {
                if (DOM.elements.questionTitle) {
                    DOM.elements.questionTitle.style.willChange = 'auto';
                    DOM.elements.questionTitle.classList.remove('fade-in');
                    DOM.elements.questionTitle.removeEventListener('animationend', onTitleFadeInEnd);
                }
            }, { once: true });
        });
    }

    // 3. 創建並顯示選項按鈕
    if (DOM.containers.options) {
        createOptionsUI(question, DOM.containers.options, questionsData); // 傳入問題數據用於事件處理器
    } else {
        console.error("[View ERR] displayQuestion: 選項容器 'options-container' 未找到。");
    }

    // 4. 更新進度條
    updateProgressBar(questionNumberForDisplay, questionsData.length);
}

/**
 * 創建問題的選項按鈕 UI，並為其綁定事件和 TypeIt 動畫。
 * @param {object} questionData - 當前問題的數據。
 * @param {HTMLElement} optionsContainerElement - 選項按鈕的父容器元素。
 * @param {object[]} allQuestionsData - 所有問題的數據陣列 (用於傳遞給 handleOptionClick)。
 */
function createOptionsUI(questionData, optionsContainerElement, allQuestionsData) {
    const fragment = document.createDocumentFragment();
    const newOptionElements = []; // 儲存新創建的按鈕元素
    optionsContainerElement.innerHTML = ''; // 清空之前的選項

    const typeItCompletionPromises = []; // 收集所有 TypeIt 實例的完成 Promise

    console.log(`[View LOG] createOptionsUI: 為問題 "${questionData.question.substring(0,20)}..." 創建 ${questionData.options.length} 個選項`);

    questionData.options.forEach((option, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style'; // 應用基礎按鈕和選項樣式
        optionElement.dataset.index = optIndex.toString(); // 儲存選項索引
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0; // 使其可聚焦和可通過鍵盤激活
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${option.text}`);

        const textSpan = document.createElement('span'); // TypeIt 將作用於此 span
        optionElement.appendChild(textSpan);

        // 為每個新創建的選項按鈕直接綁定事件監聽器
        optionElement.addEventListener('click', (event) => {
            // 調用從 testLogic.js 導入的 handleOptionClick
            // 它需要 event 對象和完整的 questions 數據集
            if (!stateManager.isLocked('isOptionProcessing') && !stateManager.isLocked('isScreenSwitching')) {
                handleOptionClick(event, allQuestionsData);
            } else {
                console.warn("[View WARN] Click ignored: Option processing or screen switching is in progress.");
            }
        });
        optionElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault(); // 防止空格鍵滾動頁面
                if (!stateManager.isLocked('isOptionProcessing') && !stateManager.isLocked('isScreenSwitching')) {
                    handleOptionClick(event, allQuestionsData);
                } else {
                    console.warn("[View WARN] Keydown ignored: Option processing or screen switching is in progress.");
                }
            }
        });

        // TypeIt 初始化
        const typeItDelay = (optIndex * 300) + 300; // 錯開每個選項的打字開始時間，基礎延遲300ms

        const currentTypeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
            setTimeout(() => {
                if (typeof TypeIt !== 'undefined') {
                    console.log(`[View LOG] Initializing TypeIt for option ${optIndex} (text: "${option.text.substring(0,20)}...")`);
                    try {
                        const instance = new TypeIt(textSpan, {
                            strings: [option.text],
                            speed: 60, // 打字速度
                            lifeLike: false, // 為簡化調試，暫時禁用
                            breakLines: true, // 允許自動換行
                            cursor: true,
                            cursorChar: "▋",
                            html: false, // 假設選項文本是純文本
                            afterComplete: async (instance) => {
                                console.log(`[TypeIt] Option ${optIndex} COMPLETED. Content: "${textSpan.textContent.substring(0,30)}..."`);
                                const cursorEl = textSpan.querySelector('.ti-cursor');
                                if (cursorEl) cursorEl.style.display = 'none'; // 打完後隱藏光標
                                resolveTypeIt(instance);
                            }
                        });
                        instance.go(); // 啟動打字

                        // 如果 TypeIt 版本支持 .finished Promise，可以用來捕獲異步錯誤
                        if (instance.finished && typeof instance.finished.catch === 'function') {
                            instance.finished.catch(err => {
                                console.error(`[TypeIt ERR] instance.finished REJECTED for Option ${optIndex}:`, err);
                                // 即使 instance.finished reject，afterComplete 可能已經 resolve 了。
                                // 通常 afterComplete 是更可靠的完成信號。
                                // 但如果 afterComplete 未觸發而 finished reject 了，則 reject 外層 Promise。
                                textSpan.textContent = option.text; // Fallback
                                rejectTypeIt(err); // reject 外層 Promise
                            });
                        }
                    } catch (e) {
                        console.error(`[TypeIt ERR] Instantiation or .go() SYNC error for Option ${optIndex}:`, e);
                        textSpan.textContent = option.text; // Fallback
                        rejectTypeIt(e);
                    }
                } else {
                    console.error("[View ERR] TypeIt IS UNDEFINED when trying to initialize for option " + optIndex);
                    textSpan.textContent = option.text; // Fallback
                    resolveTypeIt(); // Resolve 以免阻塞 Promise.allSettled
                }
            }, typeItDelay);
        });
        typeItCompletionPromises.push(currentTypeItPromise);

        fragment.appendChild(optionElement);
        newOptionElements.push(optionElement);
    });

    optionsContainerElement.appendChild(fragment);
    setOptionElements(newOptionElements); // 更新 DOM 模組中對當前選項的引用

    // --- isOptionProcessing 狀態的解鎖 ---
    // 這個狀態主要由 testLogic.js 中的 handleOptionClick 流程控制。
    // 當所有 TypeIt 動畫完成後，可以認為 view 層面的選項“準備就緒”了。
    // 但真正的“選項處理流程”是否結束，取決於 handleOptionClick 的後續操作。
    // 這裡我們只確保所有打字動畫都已啟動並有機會完成。
    // view.js 不再直接解鎖 isOptionProcessing，這個職責交給 testLogic.js
    Promise.allSettled(typeItCompletionPromises).then(() => {
        console.log("[View LOG] All TypeIt instances for current options have settled (finished or failed). View rendering complete.");
        // 此處可以觸發一個自訂事件或回調，通知 testLogic.js 視圖已準備好，
        // 但更簡單的做法是讓 testLogic.js 的 handleOptionClick 自己管理 isOptionProcessing 的完整生命週期。
        // 現在，當 isOptionProcessing 為 false 且 isScreenSwitching 為 false 時，選項才能被點擊。
    });
}