// js/view.js - 視圖渲染模組 (整合 TypeIt.js - 再次修訂)

import { stateManager } from './state.js';
import { DOM, allOptions, setOptions } from './dom.js';

export function updateProgressBar(questionNumber, totalQuestions) {
    if (DOM.elements.progressFill) {
        const progress = (questionNumber / totalQuestions) * 100;
        requestAnimationFrame(() => {
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        });
    }
}

export function displayQuestion(index, questions, isInitialDisplay = false) {
    if (index < 0 || index >= questions.length) {
        console.error(`[view.js] 無效的問題索引: ${index}`);
        if (stateManager.isLocked('isTransitioning')) {
            stateManager.unlock('isTransitioning');
            console.warn("[view.js] isTransitioning 已解鎖 (displayQuestion - 無效索引)");
        }
        return;
    }

    const questionData = questions[index];
    const questionNumber = index + 1;

    console.log(`[view.js] displayQuestion: 準備顯示問題 ${questionNumber}. isTransitioning: ${stateManager.isLocked('isTransitioning')}`);

    // 背景和問題標題的淡入動畫
    if (DOM.elements.testBackground) {
        DOM.elements.testBackground.style.willChange = 'background-image, opacity, filter';
        requestAnimationFrame(() => {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            DOM.elements.testBackground.classList.remove('fade-out', 'fade-in');
            DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
            DOM.elements.testBackground.classList.add('fade-in');
            DOM.elements.testBackground.addEventListener('animationend', function onBgAnimationEnd() {
                if (DOM.elements.testBackground) { // Defensively check if element still exists
                    DOM.elements.testBackground.style.willChange = 'auto';
                    DOM.elements.testBackground.classList.remove('fade-in');
                    DOM.elements.testBackground.removeEventListener('animationend', onBgAnimationEnd);
                }
            }, { once: true });
        });
    }

    if (DOM.elements.questionTitle) {
        DOM.elements.questionTitle.style.willChange = 'transform, opacity, filter';
        requestAnimationFrame(() => {
            DOM.elements.questionTitle.classList.remove('fade-out', 'fade-in');
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.add('fade-in'); // CSS should handle slide down if 'fade-in' includes it
            DOM.elements.questionTitle.addEventListener('animationend', function onTitleAnimationEnd() {
                 if (DOM.elements.questionTitle) { // Defensively check
                    DOM.elements.questionTitle.style.willChange = 'auto';
                    DOM.elements.questionTitle.classList.remove('fade-in');
                    DOM.elements.questionTitle.removeEventListener('animationend', onTitleAnimationEnd);
                 }
            }, { once: true });
        });
    }

    if (DOM.containers.options) {
        createOptions(questionData, DOM.containers.options);
        // console.log(`[view.js] 問題 ${questionNumber} 和選項已調用 createOptions`); // Logged inside createOptions
    } else {
        console.error("[view.js] 找不到 options-container");
        if (stateManager.isLocked('isTransitioning')) {
            stateManager.unlock('isTransitioning');
            console.warn("[view.js] isTransitioning 已解鎖 (displayQuestion - no options container)");
        }
    }
}

// js/view.js - createOptions 函數 (極簡化 TypeIt 調用)

function createOptions(questionData, container) {
    const fragment = document.createDocumentFragment();
    const optionElements = [];
    container.innerHTML = '';

    const typeItPromises = [];
    console.log(`[view.js ULTRA_SIMPLE] createOptions for ${questionData.options.length} options`);

    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style';
        optionElement.dataset.index = optIndex;
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0;
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);

        const textSpan = document.createElement('span');
        optionElement.appendChild(textSpan);

        const baseTypeItDelayMs = 150; // 基礎延遲
        const staggerTypeItDelayMs = optIndex * 250; // 錯開延遲
        const typeItInitializationDelay = baseTypeItDelayMs + staggerTypeItDelayMs;

        console.log(`[view.js ULTRA_SIMPLE] Option ${optIndex}: Text: "${optionData.text}". Starting TypeIt in ${typeItInitializationDelay}ms.`);

        const currentTypeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
            setTimeout(() => {
                if (typeof TypeIt !== 'undefined') {
                    console.log(`[view.js ULTRA_SIMPLE] Initializing TypeIt for Option ${optIndex} NOW. Target:`, textSpan);
                    try {
                        const instance = new TypeIt(textSpan, {
                            strings: [optionData.text],
                            speed: 70,
                            lifeLike: false, // 保持 false 進行調試
                            breakLines: true,
                            cursor: true,
                            cursorChar: "▋",
                            html: false,
                            loop: false,
                            afterComplete: async (completedInstance) => {
                                console.log(`[TypeIt ULTRA_SIMPLE] Option ${optIndex} COMPLETED. Content: "${textSpan.textContent}"`);
                                const cursorEl = textSpan.querySelector('.ti-cursor');
                                if (cursorEl) {
                                    cursorEl.style.display = 'none';
                                }
                                resolveTypeIt(completedInstance); // 主要依賴這個 resolve
                            },
                        });

                        instance.go(); // << --- 確保這一行後面絕對沒有 .catch()

                        // 由於持續報錯，我們暫時完全移除對 instance.finished 的依賴
                        // 主要依賴 afterComplete 來 resolve，和 try...catch 捕獲同步錯誤

                    } catch (e) {
                        console.error(`[TypeIt ULTRA_SIMPLE] Error during TypeIt instantiation or SYNC .go() for Option ${optIndex}:`, e);
                        textSpan.textContent = optionData.text; // Fallback
                        rejectTypeIt(e);
                    }
                } else {
                    console.error(`[view.js ULTRA_SIMPLE] CRITICAL: TypeIt IS UNDEFINED for Option ${optIndex}.`);
                    textSpan.textContent = optionData.text;
                    resolveTypeIt(); // Resolve 以讓 Promise.allSettled 繼續
                }
            }, typeItInitializationDelay);
        });
        typeItPromises.push(currentTypeItPromise);

        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });

    container.appendChild(fragment);
    setOptions(optionElements);

    // --- 解鎖 isTransitioning 的邏輯 (與之前版本類似) ---
    const questionTitleFadeInDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadein-duration').replace('s', '')) * 1000 || 800;

    Promise.allSettled(typeItPromises)
        .then((results) => {
            console.log("[view.js ULTRA_SIMPLE] All TypeIt Promises have settled.");
            results.forEach((result, idx) => {
                if (result.status === 'rejected') {
                    console.warn(`[view.js ULTRA_SIMPLE] TypeIt Promise for option ${idx} was rejected:`, result.reason);
                }
            });

            const unlockDelayAfterPromises = questionTitleFadeInDurationMs + 250; // 緩衝
            console.log(`[view.js ULTRA_SIMPLE] 'isTransitioning' will unlock in approx. ${unlockDelayAfterPromises}ms.`);
            setTimeout(() => {
                 if (stateManager.isLocked('isTransitioning')) {
                    stateManager.unlock('isTransitioning');
                    console.log(`[view.js ULTRA_SIMPLE] 'isTransitioning' UNLOCKED.`);
                } else {
                    console.log(`[view.js ULTRA_SIMPLE] 'isTransitioning' was already unlocked.`);
                }
            }, unlockDelayAfterPromises);
        });

    return optionElements;
}