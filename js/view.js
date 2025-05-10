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

    console.log(`[view.js] displayQuestion: 正在顯示問題 ${questionNumber}`);

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
            }, { once: true });
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
        console.log(`[view.js] 問題 ${questionNumber} 和選項已調用 createOptions`);
    } else {
        console.error("[view.js] 找不到 options-container");
        if (stateManager.isLocked('isTransitioning')) {
            stateManager.unlock('isTransitioning');
            console.warn("[view.js] isTransitioning 已解鎖 (displayQuestion - no options container)");
        }
    }
}

function createOptions(questionData, container) {
    const fragment = document.createDocumentFragment();
    const optionElements = [];
    container.innerHTML = '';

    const typeItPromises = [];
    console.log(`[view.js] createOptions: 開始為 ${questionData.options.length} 個選項創建元素`);

    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style';
        optionElement.dataset.index = optIndex;
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0;
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);

        const textSpan = document.createElement('span'); // TypeIt 的目標元素
        optionElement.appendChild(textSpan);

        const fadeInDurationMs = 500;
        const baseDelayMs = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--typing-base-delay').replace('s', '')) || 0.15) * 1000; // 縮短一點基礎延遲
        const optionFadeInStartDelayMs = baseDelayMs + optIndex * 200; // 每個選項的淡入錯開

        // TypeIt 的啟動延遲應該在元素淡入動畫開始之後，或者在元素完全可見後
        // 我們讓 TypeIt 在 fadeIn 動畫即將完成時或剛完成時啟動
        const typeItStartActualDelayMs = optionFadeInStartDelayMs + fadeInDurationMs * 0.8;


        optionElement.style.opacity = '0'; // 初始隱藏
        // 監聽選項按鈕容器的 fadeIn 動畫結束事件
        optionElement.addEventListener('animationend', function onOptionFadeInEnd(event) {
            if (event.animationName === 'fadeIn' && event.target === optionElement) {
                console.log(`[view.js] Option ${optIndex} FADE IN animation ended. Target:`, textSpan);
                optionElement.removeEventListener('animationend', onOptionFadeInEnd); // 清理監聽器

                // 在這裡初始化 TypeIt，確保元素已完全可見
                if (typeof TypeIt !== 'undefined') {
                    console.log(`[view.js] Initializing TypeIt for Option ${optIndex} AFTER FADE IN. Text: "${optionData.text}"`);
                    const currentTypeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
                        try {
                            const instance = new TypeIt(textSpan, {
                                strings: [optionData.text],
                                speed: 70, // 調整一個適中的速度
                                lifeLike: false, // 禁用 lifeLike 以簡化調試，成功後再開啟
                                breakLines: true,
                                cursor: true,
                                cursorChar: "▋",
                                waitUntilVisible: false, // 因為我們手動在 fadeIn 後啟動
                                html: false,
                                loop: false,
                                afterComplete: async (completedInstance) => {
                                    console.log(`[TypeIt] Option ${optIndex} COMPLETED. Content: "${textSpan.textContent}"`);
                                    const cursorEl = textSpan.querySelector('.ti-cursor');
                                    if (cursorEl) cursorEl.style.display = 'none';
                                    resolveTypeIt(completedInstance);
                                },
                            });

                            instance.go().catch(err => { // 捕獲 .go() 可能的同步或異步錯誤
                                console.error(`[TypeIt] .go() FAILED for Option ${optIndex}:`, err);
                                textSpan.textContent = optionData.text; // Fallback
                                rejectTypeIt(err);
                            });

                        } catch (e) {
                            console.error(`[TypeIt] Error during new TypeIt() for Option ${optIndex}:`, e);
                            textSpan.textContent = optionData.text; // Fallback
                            rejectTypeIt(e);
                        }
                    });
                    typeItPromises.push(currentTypeItPromise);
                } else {
                    console.error(`[view.js] CRITICAL: TypeIt IS UNDEFINED for Option ${optIndex} (at init time)`);
                    textSpan.textContent = optionData.text;
                    typeItPromises.push(Promise.resolve()); // 也 resolve，避免阻塞 Promise.all
                }
            }
        });
        // 觸發選項按鈕容器的淡入動畫
        optionElement.style.animation = `fadeIn ${fadeInDurationMs / 1000}s forwards ${optionFadeInStartDelayMs / 1000}s`;


        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });

    container.appendChild(fragment);
    setOptions(optionElements);

    // --- 解鎖 isTransitioning 的邏輯 ---
    const contentFadeInDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadein-duration').replace('s', '')) * 1000 || 800;

    // 等待所有 TypeIt 實例完成
    Promise.all(typeItPromises)
        .then(() => {
            console.log("[view.js] 所有 TypeIt 實例的 Promises 均已 resolve (可能成功或失敗後resolve)。");

            // 計算所有選項容器 fadeIn 動畫的最晚結束時間
            let maxContainerFadeInEndTime = 0;
            optionElements.forEach(el => {
                // 獲取實際應用的動畫延遲和持續時間
                const style = window.getComputedStyle(el);
                const animDelay = parseFloat(style.animationDelay || "0s") * 1000;
                const animDur = parseFloat(style.animationDuration || "0s") * 1000; // 假設 fadeIn 持續 0.5s
                if (style.animationName === 'fadeIn') { // 只計算 fadeIn 動畫
                    maxContainerFadeInEndTime = Math.max(maxContainerFadeInEndTime, animDelay + animDur);
                }
            });

            // 解鎖時間點 = max(所有TypeIt完成的時間點, 所有fadeIn完成的時間點, 問題標題等內容fadeIn的時間點) + 緩衝
            // 因為 Promise.all 在這裡，意味著所有 TypeIt 都已 "結束" (無論成功或失敗)
            // 所以現在主要關心的是最後一個視覺動畫（如 fadeIn）的結束時間
            const finalUnlockDelayPoint = Math.max(maxContainerFadeInEndTime, contentFadeInDurationMs) + 200; // 200ms 緩衝

            console.log(`[view.js with TypeIt] isTransitioning 將在約 ${finalUnlockDelayPoint}ms (基於 Promise.all 和 fades) 後解鎖`);

            // 這個 setTimeout 是從 Promise.all.then 執行後開始計時
            // 如果 finalUnlockDelayPoint 是一個絕對時間點，計算會更複雜
            // 這裡假設它是一個相對延遲
            setTimeout(() => {
                 if (stateManager.isLocked('isTransitioning')) {
                    stateManager.unlock('isTransitioning');
                    console.log(`[view.js with TypeIt] isTransitioning 已解鎖 (All Promises & fades considered)`);
                } else {
                    console.log(`[view.js with TypeIt] isTransitioning 在 Promise.all 後已是解鎖狀態。`);
                }
            }, finalUnlockDelayPoint); // 這個延遲是相對於 Promise.all 完成後的延遲

        })
        .catch(error => {
            console.error("[view.js] Promise.all(typeItPromises) 被 rejected: ", error);
            // 即使中途有 TypeIt 實例失敗，也要確保最終解鎖
            if (stateManager.isLocked('isTransitioning')) {
                stateManager.unlock('isTransitioning');
                console.warn(`[view.js with TypeIt] isTransitioning 因 Promise.all 錯誤已解鎖`);
            }
        });

    return optionElements;
}