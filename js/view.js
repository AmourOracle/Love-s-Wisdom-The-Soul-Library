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

    const questionData = questions[index];
    const questionNumber = index + 1;

    // 背景和問題標題的淡入動畫
    if (DOM.elements.testBackground) {
        DOM.elements.testBackground.style.willChange = 'background-image, opacity, filter';
        requestAnimationFrame(() => {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            DOM.elements.testBackground.classList.remove('fade-out', 'fade-in'); // 清除舊動畫
            DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
            DOM.elements.testBackground.classList.add('fade-in'); // 觸發 CSS fade-in
            DOM.elements.testBackground.addEventListener('animationend', function onBgAnimationEnd() {
                if (DOM.elements.testBackground) { // 再次檢查元素是否存在
                    DOM.elements.testBackground.style.willChange = 'auto';
                    DOM.elements.testBackground.classList.remove('fade-in');
                    DOM.elements.testBackground.removeEventListener('animationend', onBgAnimationEnd);
                }
            });
        });
    }

    if (DOM.elements.questionTitle) {
        DOM.elements.questionTitle.style.willChange = 'transform, opacity, filter';
        requestAnimationFrame(() => {
            DOM.elements.questionTitle.classList.remove('fade-out', 'fade-in'); // 清除舊動畫
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.add('fade-in'); // 觸發 CSS fade-in (假設包含 slide down)
            DOM.elements.questionTitle.addEventListener('animationend', function onTitleAnimationEnd() {
                 if (DOM.elements.questionTitle) { // 再次檢查元素是否存在
                    DOM.elements.questionTitle.style.willChange = 'auto';
                    DOM.elements.questionTitle.classList.remove('fade-in');
                    DOM.elements.questionTitle.removeEventListener('animationend', onTitleAnimationEnd);
                 }
            });
        });
    }

    // 創建並顯示選項
    if (DOM.containers.options) {
        createOptions(questionData, DOM.containers.options); // questions 參數不再需要傳給 createOptions
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
    container.innerHTML = ''; // 清空舊選項

    let longestOptionAnimationTime = 0;
    const typeItPromises = []; // 用於收集所有 TypeIt 實例的完成 Promise

    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style'; // CSS 應處理基本樣式和佈局
        optionElement.dataset.index = optIndex;
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0;
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);

        // TypeIt 將直接在這個 span 上工作
        const textSpan = document.createElement('span');
        // textSpan.className = 'typing-effect'; // 此 class 主要用於 CSS 文本樣式，而非動畫
        optionElement.appendChild(textSpan);

        // 計算動畫延遲
        const fadeInDurationMs = 500; // 選項按鈕容器淡入動畫時長
        const baseDelayMs = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--typing-base-delay').replace('s', '')) || 0.2) * 1000;
        const optionFadeInStartDelayMs = baseDelayMs + optIndex * 150; // 每個選項錯開出現
        const typeItStartActualDelayMs = optionFadeInStartDelayMs + fadeInDurationMs * 0.3; // TypeIt 在淡入中途開始

        // TypeIt 配置
        const typeSpeed = 60 + Math.random() * 20; // 打字速度 (ms/字符)
        const typeLifeLike = true;

        // 估算單個 TypeIt 實例的時長 (用於粗略計算 longestOptionAnimationTime)
        // 實際完成由 Promise 控制
        let estimatedDuration = optionData.text.length * typeSpeed * (typeLifeLike ? 1.4 : 1.0); // lifeLike 增加約40%時間
        estimatedDuration = Math.max(estimatedDuration, 500); // 最小打字動畫時間
        const currentOptionTotalEstTime = typeItStartActualDelayMs + estimatedDuration;
        longestOptionAnimationTime = Math.max(longestOptionAnimationTime, currentOptionTotalEstTime);

        // 選項按鈕容器的淡入動畫
        optionElement.style.opacity = '0'; // 初始隱藏
        optionElement.style.animation = `fadeIn ${fadeInDurationMs / 1000}s forwards ${optionFadeInStartDelayMs / 1000}s`;

        // 延遲初始化 TypeIt
        const typeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
            setTimeout(() => {
                if (typeof TypeIt !== 'undefined') {
                    const instance = new TypeIt(textSpan, {
                        strings: [optionData.text],
                        speed: typeSpeed,
                        lifeLike: typeLifeLike,
                        waitUntilVisible: true, // TypeIt 會等元素可見 (雖然我們也控制了 fadeIn)
                        cursorChar: "▋",
                        cursorSpeed: 800,
                        breakLines: true,     // **關鍵: TypeIt 會處理自動換行**
                        html: false,          // 如果確認選項文本不含 HTML，設為 false 性能更好
                        loop: false,
                        afterComplete: async (completedInstance) => {
                            const cursorEl = textSpan.querySelector('.ti-cursor');
                            if (cursorEl) cursorEl.style.display = 'none'; // 隱藏光標
                            // completedInstance.destroy(); // 或者完全銷毀實例
                            resolveTypeIt(completedInstance); // TypeIt 完成後 resolve
                        },
                        onError: (err) => {
                            console.error(`[TypeIt] Option ${optIndex} error:`, err);
                            textSpan.textContent = optionData.text; // Fallback
                            rejectTypeIt(err); // TypeIt 出錯時 reject
                        }
                    });
                    instance.go().catch(rejectTypeIt); // 確保 go() 的錯誤也被捕獲
                } else {
                    console.warn("[view.js] TypeIt is not defined. Falling back to simple text.");
                    textSpan.textContent = optionData.text;
                    resolveTypeIt(); // 如果 TypeIt 未定義，也立即 resolve
                }
            }, typeItStartActualDelayMs); // 確保在正確的延遲後啟動
        });
        typeItPromises.push(typeItPromise);

        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });

    container.appendChild(fragment);
    setOptions(optionElements); // 更新全局選項數組

    // --- 解鎖 isTransitioning 的邏輯 ---
    // 等待所有 TypeIt 實例和主要內容淡入動畫完成
    const contentFadeInDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadein-duration').replace('s', '')) * 1000 || 800;

    Promise.all(typeItPromises)
        .then(() => {
            console.log("[view.js] 所有 TypeIt 實例均已完成。");
            // 此時所有打字已完成，還需考慮 questionTitle 和背景的淡入
            // 以及選項容器的 fadeIn 動畫
            let maxContainerFadeInTime = 0;
            optionElements.forEach(el => {
                const animDelay = parseFloat(el.style.animationDelay || "0s") * 1000;
                const animDur = parseFloat(el.style.animationDuration || "0.5s") * 1000;
                maxContainerFadeInTime = Math.max(maxContainerFadeInTime, animDelay + animDur);
            });

            const finalUnlockTimePoint = Math.max(maxContainerFadeInTime, contentFadeInDurationMs) + 100; // 額外 100ms 緩衝

            console.log(`[view.js with TypeIt] isTransitioning 將在約 ${finalUnlockTimePoint}ms 後解鎖 (基於 Promise.all)`);
            // 實際解鎖延遲是 finalUnlockTimePoint 減去當前已過去的時間
            // 為簡化，可以直接使用 setTimeout(..., finalUnlockTimePoint) 如果動畫開始時間點已知
            // 或者，更簡單的方式是，既然 Promise.all 已完成，就直接設定一個短延遲解鎖
            setTimeout(() => {
                if (stateManager.isLocked('isTransitioning')) {
                    stateManager.unlock('isTransitioning');
                    console.log(`[view.js with TypeIt] isTransitioning 已解鎖 (All TypeIt Promises & fades resolved)`);
                }
            }, 150); // 在所有 Promise 完成後再加一個非常短的延遲

        })
        .catch(error => {
            console.error("[view.js] 一個或多個 TypeIt 實例初始化或執行出錯: ", error);
            // 即使出錯，也要確保解鎖，避免卡住流程
            if (stateManager.isLocked('isTransitioning')) {
                stateManager.unlock('isTransitioning');
                console.warn(`[view.js with TypeIt] isTransitioning 因錯誤已解鎖 (TypeIt Promises catch)`);
            }
        });

    return optionElements;
}