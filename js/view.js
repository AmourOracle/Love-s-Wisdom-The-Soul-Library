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

function createOptions(questionData, container) {
    const fragment = document.createDocumentFragment();
    const optionElements = [];
    container.innerHTML = ''; // Clear previous options

    const typeItPromises = []; // Array to hold promises for each TypeIt instance
    console.log(`[view.js] createOptions: 開始為 ${questionData.options.length} 個選項創建元素和 TypeIt 實例`);

    questionData.options.forEach((optionData, optIndex) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'ui-btn option-style'; // CSS will make this initially visible (no JS fadeIn)
        optionElement.dataset.index = optIndex;
        optionElement.setAttribute('role', 'button');
        optionElement.tabIndex = 0;
        optionElement.setAttribute('aria-label', `選項 ${optIndex + 1}: ${optionData.text}`);

        const textSpan = document.createElement('span'); // Target for TypeIt
        optionElement.appendChild(textSpan);

        // TypeIt Start Delay: Stagger the start of typing for each option
        const baseTypeItDelayMs = 200; // Base delay before first option starts typing
        const staggerTypeItDelayMs = optIndex * 400; // Each subsequent option delays a bit more
        const typeItInitializationDelay = baseTypeItDelayMs + staggerTypeItDelayMs;

        console.log(`[view.js] Option ${optIndex}: Text to type: "${optionData.text}". TypeIt will start in ${typeItInitializationDelay}ms.`);

        const currentTypeItPromise = new Promise((resolveTypeIt, rejectTypeIt) => {
            setTimeout(() => {
                if (typeof TypeIt !== 'undefined') {
                    console.log(`[view.js] Initializing TypeIt for Option ${optIndex} NOW. Target element:`, textSpan);
                    try {
                        const instance = new TypeIt(textSpan, {
                            strings: [optionData.text],
                            speed: 65,       // Typing speed in ms per character
                            lifeLike: false,  // Keep it false for simpler debugging first
                            breakLines: true, // Allow TypeIt to handle line breaks
                            cursor: true,
                            cursorChar: "▋",
                            html: false,     // Assuming option text is plain text
                            loop: false,
                            afterComplete: async (completedInstance) => {
                                console.log(`[TypeIt] Option ${optIndex} COMPLETED. Final text content: "${textSpan.textContent}"`);
                                const cursorEl = textSpan.querySelector('.ti-cursor');
                                if (cursorEl) {
                                    cursorEl.style.display = 'none'; // Hide cursor on complete
                                }
                                resolveTypeIt(completedInstance);
                            },
                        });

                        instance.go().catch(err => { // Catch errors from .go() itself
                            console.error(`[TypeIt] .go() method FAILED for Option ${optIndex}:`, err);
                            textSpan.textContent = optionData.text; // Fallback display
                            rejectTypeIt(err); // Reject the promise for this instance
                        });

                    } catch (e) {
                        console.error(`[TypeIt] Error during new TypeIt() instantiation for Option ${optIndex}:`, e);
                        textSpan.textContent = optionData.text; // Fallback display
                        rejectTypeIt(e); // Reject the promise
                    }
                } else {
                    console.error(`[view.js] CRITICAL: TypeIt IS UNDEFINED for Option ${optIndex} during initialization.`);
                    textSpan.textContent = optionData.text; // Fallback
                    resolveTypeIt(); // Resolve to not block Promise.all, 실패했지만 다른 옵션은 계속 진행할 수 있도록
                }
            }, typeItInitializationDelay);
        });
        typeItPromises.push(currentTypeItPromise);

        fragment.appendChild(optionElement);
        optionElements.push(optionElement);
    });

    container.appendChild(fragment);
    setOptions(optionElements); // Update the global list of option DOM elements

    // --- Logic to unlock 'isTransitioning' state ---
    const questionTitleFadeInDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-fadein-duration').replace('s', '')) * 1000 || 800;

    Promise.allSettled(typeItPromises) // Use allSettled to wait for all promises regardless of outcome
        .then((results) => {
            console.log("[view.js] All TypeIt Promises have settled (completed or failed).");
            results.forEach((result, idx) => {
                if (result.status === 'rejected') {
                    console.warn(`[view.js] TypeIt Promise for option ${idx} was rejected:`, result.reason);
                }
            });

            // At this point, all TypeIt instances have run.
            // We also need to consider the fadeIn time of the question title and background.
            // Since option buttons are now initially visible (no JS-driven fadeIn for them),
            // the main animation to wait for besides TypeIt is the question title/background.
            const unlockDelayAfterPromises = questionTitleFadeInDurationMs + 200; // Add a buffer

            console.log(`[view.js with TypeIt] 'isTransitioning' will be unlocked after approx. ${unlockDelayAfterPromises}ms (post Promise.allSettled).`);

            setTimeout(() => {
                 if (stateManager.isLocked('isTransitioning')) {
                    stateManager.unlock('isTransitioning');
                    console.log(`[view.js with TypeIt] 'isTransitioning' UNLOCKED.`);
                } else {
                    console.log(`[view.js with TypeIt] 'isTransitioning' was already unlocked when timeout fired.`);
                }
            }, unlockDelayAfterPromises);
        });
        // No .catch here for Promise.allSettled, as it always resolves.
        // Individual errors are handled in the .then block by checking result.status.

    return optionElements;
}