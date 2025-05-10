// js/view.js - 視圖渲染模組 (整合 TypeIt.js)

import { stateManager } from './state.js';
import { DOM, allOptions, setOptions } from './dom.js';
// animateOptionExplode 將由 animation.js 處理，此處不直接引用

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
        console.error(`[view.js] 無效的問題索引: ${index}`);
        if (stateManager.isLocked('isTransitioning')) {
            stateManager.unlock('isTransitioning');
            console.warn("[view.js] isTransitioning 已解鎖 (displayQuestion - 無效索引)");
        }
        return;
    }

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

    // 背景和問題標題的淡入動畫
    if (DOM.elements.testBackground) {
        DOM.elements.testBackground.style.willChange = 'background-image, opacity, filter';
        requestAnimationFrame(() => {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            DOM.elements.testBackground.classList.remove('fade-out', 'fade-in');
            DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
            DOM.elements.testBackground.classList.add('fade-in');
            DOM.elements.testBackground.addEventListener('animationend', function onBgAnimationEnd() {
                if (DOM.elements.testBackground) {
                    DOM.elements.testBackground.style.willChange = 'auto';
                    DOM.elements.testBackground.classList.remove('fade-in');
                    DOM.elements.testBackground.removeEventListener('animationend', onBgAnimationEnd);
                }
            }, { once: true }); // 使用 once: true 確保只觸發一次並自動移除
        });
    }

    if (DOM.elements.questionTitle) {
        DOM.elements.questionTitle.style.willChange = 'transform, opacity, filter';
        requestAnimationFrame(() => {
            DOM.elements.questionTitle.classList.remove('fade-out', 'fade-in');
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.add('fade-in');
            DOM.elements.questionTitle.addEventListener('animationend', function onTitleAnimationEnd() {
                 if (DOM.elements.questionTitle) {
                    DOM.elements.questionTitle.style.willChange = 'auto';
                    DOM.elements.questionTitle.classList.remove('fade-in');
                    DOM.elements.questionTitle.removeEventListener('animationend', onTitleAnimationEnd);
                 }
            }, { once: true });
        });
    }

    if (DOM.containers.options) {
        createOptions(questionData, DOM.containers.options);
        console.log(`[view.js] 問題 ${questionNumber} 和選項準備顯示 (TypeIt將處理打字)`);
    } else {
        console.error("[view.js] 找不到 options-container");
        if (stateManager.isLocked('isTransitioning')) {
            stateManager.unlock('isTransitioning');
            console.warn("[view.js] isTransitioning 已解鎖 (displayQuestion - no options container)");
        }
    }
}

// 使用 TypeIt.js 優化選項創建和打字機效果
function createOptions(questionData, container) {
    const fragment = document.createDocumentFragment();
    const optionElements = [];
    container.innerHTML = '';

    const typeItPromises = [];

    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style';
        optionElement.dataset.index = optIndex;
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0;
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);

        const textSpan = document.createElement('span');
        optionElement.appendChild(textSpan);

        const fadeInDurationMs = 500;
        const baseDelayMs = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--typing-base-delay').replace('s', '')) || 0.2) * 1000;
        const optionFadeInStartDelayMs = baseDelayMs + optIndex * 150;
        const typeItStartActualDelayMs = optionFadeInStartDelayMs + fadeInDurationMs * 0.2;

        const typeSpeed = 55 + Math.random() * 20;
        const typeLifeLike = true;

        optionElement.style.opacity = '0';
        optionElement.style.animation = `fadeIn ${fadeInDurationMs / 1000}s forwards ${optionFadeInStartDelayMs / 1000}s`;

        // 創建一個 Promise 來包裝 TypeIt 的完成
        const currentTypeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
            setTimeout(() => {
                if (typeof TypeIt !== 'undefined') {
                    try {
                        const instance = new TypeIt(textSpan, {
                            strings: [optionData.text],
                            speed: typeSpeed,
                            lifeLike: typeLifeLike,
                            waitUntilVisible: true,
                            cursorChar: "▋",
                            cursorSpeed: 800,
                            breakLines: true,
                            html: false,
                            loop: false,
                            afterComplete: async (completedInstance) => {
                                const cursorEl = textSpan.querySelector('.ti-cursor');
                                if (cursorEl) cursorEl.style.display = 'none';
                                console.log(`[TypeIt] Option ${optIndex} completed.`);
                                resolveTypeIt(completedInstance); // TypeIt 正常完成
                            },
                            // onError 似乎不是 TypeIt 的標準配置選項，錯誤應通過 .go() 的結果處理
                            // 所以我們依賴 instance.finished Promise
                        });

                        // TypeIt v8.1.0+ 有 instance.finished Promise
                        // 如果版本較低，則 afterComplete 是主要完成點
                        instance.go(); // 啟動動畫

                        // 如果 instance.finished 存在，則使用它
                        if (instance.finished && typeof instance.finished.then === 'function') {
                            instance.finished.then(() => {
                                // 這個 then 可能會和 afterComplete 都觸發，
                                // 但 resolveTypeIt 多次調用同一個 Promise 是安全的。
                                // afterComplete 應該是更可靠的完成點。
                                // console.log(`[TypeIt] Option ${optIndex} instance.finished resolved.`);
                                // resolveTypeIt(instance); // afterComplete 已經 resolve 了
                            }).catch(err => {
                                console.error(`[TypeIt] Option ${optIndex} instance.finished rejected:`, err);
                                textSpan.textContent = optionData.text; // Fallback
                                rejectTypeIt(err);
                            });
                        } else {
                            // 如果沒有 instance.finished Promise (例如版本較舊)，
                            // 則依賴 afterComplete 中的 resolveTypeIt。
                            // 為了確保即使 afterComplete 由於某些原因未觸發，我們也應該有一個超時。
                            // 這裡的估算僅用於超時，主要依賴 afterComplete。
                            let estimatedDuration = optionData.text.length * typeSpeed * (typeLifeLike ? 1.4 : 1.0);
                            estimatedDuration = Math.max(estimatedDuration, 500);
                            setTimeout(() => {
                                // 如果到這裡還沒 resolve，可能是 afterComplete 沒執行
                                // 檢查 textSpan 是否有內容來判斷是否 "完成"
                                if (textSpan.textContent.length >= optionData.text.length) {
                                     console.warn(`[TypeIt] Option ${optIndex} resolving via timeout as fallback.`);
                                     resolveTypeIt(instance); // 強制 resolve
                                } else {
                                     console.error(`[TypeIt] Option ${optIndex} FAILED to complete via timeout.`);
                                     textSpan.textContent = optionData.text; // Fallback
                                     rejectTypeIt(new Error(`TypeIt for option ${optIndex} timed out or did not complete`));
                                }
                            }, typeItStartActualDelayMs + estimatedDuration + 1000); // 增加1秒的額外超時
                        }

                    } catch (e) {
                        console.error(`[TypeIt] Error initializing TypeIt for option ${optIndex}:`, e);
                        textSpan.textContent = optionData.text; // Fallback
                        rejectTypeIt(e);
                    }
                } else {
                    console.error("[view.js] CRITICAL: TypeIt IS UNDEFINED for option " + optIndex);
                    textSpan.textContent = optionData.text;
                    resolveTypeIt(); // 即使 TypeIt 未定義，也 resolve 以免阻塞 Promise.all
                }
            }, typeItStartActualDelayMs);
        });
        typeItPromises.push(currentTypeItPromise);

        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });

    container.appendChild(fragment);
    setOptions(optionElements);

    const contentFadeInDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadein-duration').replace('s', '')) * 1000 || 800;

    Promise.all(typeItPromises)
        .then(() => {
            console.log("[view.js] 所有 TypeIt 實例的 Promise 均已 resolve。");
            let maxContainerFadeInTime = 0;
            optionElements.forEach(el => {
                const animDelay = parseFloat(window.getComputedStyle(el).animationDelay || "0s") * 1000;
                const animDur = parseFloat(window.getComputedStyle(el).animationDuration || "0.5s") * 1000;
                maxContainerFadeInTime = Math.max(maxContainerFadeInTime, animDelay + animDur);
            });

            const finalUnlockTimePoint = Math.max(maxContainerFadeInTime, contentFadeInDurationMs) + 150; // 短緩衝

            console.log(`[view.js with TypeIt] isTransitioning 將在約 ${finalUnlockTimePoint}ms (基於實際的 Promise 完成和fadeIn) 後解鎖`);
            // 使用一個 setTimeout 來確保在所有動畫真正結束後解鎖
            setTimeout(() => {
                 if (stateManager.isLocked('isTransitioning')) {
                    stateManager.unlock('isTransitioning');
                    console.log(`[view.js with TypeIt] isTransitioning 已解鎖 (All TypeIt Promises & fades resolved)`);
                }
            }, finalUnlockTimePoint); // 這個延遲是從 Promise.all resolve 之後開始計算的
        })
        .catch(error => {
            console.error("[view.js] 一個或多個 TypeIt 實例的 Promise rejected: ", error);
            if (stateManager.isLocked('isTransitioning')) {
                stateManager.unlock('isTransitioning');
                console.warn(`[view.js with TypeIt] isTransitioning 因錯誤已解鎖 (TypeIt Promises catch)`);
            }
        });

    return optionElements;
}