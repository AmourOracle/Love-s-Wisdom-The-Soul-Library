// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', async function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isBusy: false, // 單一狀態鎖
        currentQuestionIndex: 0,
        userAnswers: [],
        preloadComplete: false,
        introVisible: false,
        resultShowing: false,
        contentRendered: false,
        finalScores: {}
    };

    // --- DOM 元素快取 ---
    let DOM = {};
    let allOptions = [];

    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') {
        console.error("錯誤：找不到有效的 testData...");
        displayInitializationError("無法載入測驗數據。");
        return;
    }
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) {
        console.error("錯誤：testData.questions 不是有效的陣列或為空。");
        displayInitializationError("測驗問題數據格式錯誤。");
        return;
    }
    const questions = testData.questions;
    const results = testData.results || {};
    const traitNames = testData.traitNames || {};
    const totalQuestions = questions.length;

    // --- 常數 (從 CSS 變數讀取) ---
    function getCssTimeInMillis(variableName, defaultValue = 0) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) { return parseFloat(value.replace('s', '')) * 1000; }
        } catch (e) { console.warn(`無法讀取 CSS 變數 ${variableName}:`, e); }
        return defaultValue;
    }
    function getCssInt(variableName, defaultValue = 0) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) { return parseInt(value); }
        } catch (e) { console.warn(`無法讀取 CSS 變數 ${variableName}:`, e); }
        return defaultValue;
    }

    const PRELOADER_PATH_EXIT_DURATION = getCssTimeInMillis('--preloader-path-exit-duration', 800);
    const SVG_BASE_DRAW_DURATION = getCssTimeInMillis('--svg-base-draw-duration', 2500);
    const SVG_STAGGER_DELAY = getCssTimeInMillis('--svg-stagger-delay', 150);
    const MAX_STAGGER_STEPS = getCssInt('--svg-max-stagger-steps', 4);
    const SVG_ANIMATION_TOTAL_ESTIMATED_TIME = SVG_BASE_DRAW_DURATION + (MAX_STAGGER_STEPS * SVG_STAGGER_DELAY);
    const PRELOADER_PAUSE_AFTER_SVG = 400;
    const PRELOADER_EXTRA_DELAY = SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG;
    const INTRO_FADEIN_DELAY = getCssTimeInMillis('--intro-fadein-delay', 100);
    const INTRO_FADEIN_DURATION = getCssTimeInMillis('--intro-fadein-duration', 1000);
    const INTRO_ANIMATION_TOTAL_TIME = INTRO_FADEIN_DELAY + INTRO_FADEIN_DURATION;
    const SCREEN_TRANSITION_DURATION = getCssTimeInMillis('--transition-duration', 600);
    const EXPLOSION_DURATION = 800; // *** 稍微縮短爆炸時間 ***
    const SVG_GLOW_DELAY = getCssTimeInMillis('--svg-glow-delay', 3000);
    const QUESTION_FADE_DURATION = 500;
    const OPTIONS_ENTER_START_DELAY = 200;
    const OPTION_STAGGER_DELAY = 80;
    const OPTION_ENTER_DURATION = 500;

    // --- 輔助函數 ---
    function setViewportHeight() { /* ... (保持不變) ... */
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (e) {
            console.warn("設置視口高度錯誤:", e);
        }
    }
    function displayInitializationError(message) { /* ... (保持不變) ... */
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('active'); // 確保 Preloader 可見
        } else {
            document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
        }
    }
    function cacheDOMElements() { /* ... (保持不變，確保 introTitlePlaceholder 存在) ... */
        try {
            DOM = {
                containers: {
                    intro: document.getElementById('intro-container'),
                    test: document.getElementById('test-container'),
                    result: document.getElementById('result-container'),
                    preloader: document.getElementById('preloader'),
                    options: document.getElementById('options-container'),
                    explosion: document.getElementById('explosion-container'),
                    startBtnExplosion: document.getElementById('start-btn-explosion-container'),
                    preloaderSvgContainer: document.getElementById('preloader-svg-container')
                },
                elements: {
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
                    startBtnText: document.querySelector('#start-test .btn-text'),
                    introTitlePlaceholder: document.querySelector('.intro-title-placeholder') // 快取 Intro 標題容器
                },
                buttons: {
                    start: document.getElementById('start-test'),
                    copy: document.getElementById('copy-btn'),
                    restart: document.getElementById('restart-btn')
                }
            };

            const criticalElements = [
                DOM.containers.intro, DOM.containers.test, DOM.containers.result,
                DOM.containers.preloader, DOM.containers.options, DOM.containers.explosion,
                DOM.containers.startBtnExplosion, DOM.containers.preloaderSvgContainer,
                DOM.elements.preloaderSvg, DOM.elements.testBackground, DOM.elements.questionTitle,
                DOM.elements.startBtnText, DOM.buttons.start, DOM.elements.introTitlePlaceholder
            ];

            if (criticalElements.some(el => !el)) {
                console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID。", DOM);
                const missing = criticalElements.findIndex(el => !el);
                console.error("Missing element index:", missing, criticalElements[missing]);
                displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                return false;
            }

            const mainTitleGroup = DOM.elements.preloaderSvg?.querySelector('#main-title-group');
            const engSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#eng-subtitle-group');
            const chnSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#chn-subtitle-group');
            if (!mainTitleGroup || !engSubtitleGroup || !chnSubtitleGroup) {
                console.warn("警告：未能找到所有的 SVG Group ID (main-title-group, eng-subtitle-group, chn-subtitle-group)。請檢查 index.html。");
            }

            if (DOM.elements.preloaderSvg && DOM.elements.introTitlePlaceholder) {
                const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
                clonedSvg.id = 'intro-title-svg';
                clonedSvg.classList.remove('glow-active');
                clonedSvg.style.animation = 'none';
                clonedSvg.style.transform = '';
                clonedSvg.querySelectorAll('path, g').forEach(el => {
                    el.style.animation = 'none';
                    el.style.animationDelay = '0s';
                    el.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                    el.style.transform = '';
                    el.style.filter = '';
                    el.style.opacity = '';
                    el.style.strokeDashoffset = '0';
                    el.style.fillOpacity = '1';
                    el.style.visibility = 'visible';
                });
                DOM.elements.introTitlePlaceholder.innerHTML = '';
                DOM.elements.introTitlePlaceholder.appendChild(clonedSvg);
                console.log("Intro title SVG 已從 Preloader SVG 複製並插入");
            } else {
                console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro title placeholder");
            }

            console.log("DOM 元素已快取");
            return true;
        } catch (error) {
            console.error("快取 DOM 元素時出錯:", error);
            displayInitializationError("頁面初始化時發生錯誤。");
            return false;
        }
    }
    function delay(ms) { /* ... (保持不變) ... */
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function nextFrame() { /* ... (保持不變) ... */
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    /**
     * 執行 Preloader 退場到 Intro 頁面顯示的轉場動畫
     * @returns {Promise<void>} 當轉場動畫完成時 resolve
     */
    function triggerIntroTransition() {
        return new Promise(async (resolve) => {
            console.log("開始 Preloader 到 Intro 的轉場...");
            if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
                console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
                resolve(); return;
            }

            // *** FIX 1: Preserve Scale & Stop Entrance Animation ***
            // 停止入口動畫，但保留其最終狀態 (特別是 transform: scale(1.05))
            // 讀取當前的 transform 狀態
            const currentTransform = window.getComputedStyle(DOM.elements.preloaderSvg).transform;
            DOM.elements.preloaderSvg.style.animation = 'none'; // 停止入口動畫
            // 如果入口動畫設置了 transform，顯式應用它，否則設置為 1.05
            DOM.elements.preloaderSvg.style.transform = currentTransform !== 'none' ? currentTransform : 'scale(1.05)';
            DOM.elements.preloaderSvg.classList.remove('glow-active'); // 移除光暈

            const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll( /* ... */
                '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path'
            );
            const preloaderBg = DOM.containers.preloader;

            if (pathsToExit.length === 0 && !preloaderBg) { /* ... (保持不變) ... */
                console.warn("警告：找不到任何需要退場的 Preloader Path 或背景。直接顯示 Intro。");
                if (DOM.containers.preloader) {
                    DOM.containers.preloader.classList.remove('active');
                    DOM.containers.preloader.style.display = 'none';
                }
                if (DOM.containers.intro) DOM.containers.intro.classList.add('active');
                state.introVisible = true;
                resolve();
                return;
            }

            let maxDelay = 0;
            const baseExitDelay = 0;
            const randomExitRange = 800; // *** 稍微縮短隨機範圍，讓退場更快一點 ***

            pathsToExit.forEach(path => { /* ... (添加退場 class 邏輯不變) ... */
                path.style.animation = ''; path.style.opacity = '';
                path.style.transform = ''; path.style.filter = ''; path.style.visibility = '';
                const randomDelay = baseExitDelay + Math.random() * randomExitRange;
                maxDelay = Math.max(maxDelay, randomDelay);
                const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';
                setTimeout(() => {
                    path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
                    path.classList.add(exitClass);
                }, 5);
            });

            if (preloaderBg) { /* ... (背景淡出邏輯不變) ... */
                setTimeout(() => {
                    preloaderBg.classList.add('is-exiting-bg');
                }, baseExitDelay + randomExitRange * 0.2);
            }

            const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
            console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);
            await delay(totalExitTime);

            console.log("Preloader 所有 Path 退場動畫結束。");
            if (DOM.containers.preloader) { /* ... (隱藏 preloader 不變) ... */
                DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                DOM.containers.preloader.style.display = 'none';
            }
            pathsToExit.forEach(path => { /* ... (清理 path class 不變) ... */
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = ''; path.style.animationDelay = '';
            });
            if (DOM.elements.preloaderSvg) { /* ... (清理 SVG style 不變) ... */
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.style.transform = ''; // *** 清理 transform ***
            }

            if (!state.introVisible && DOM.containers.intro) { /* ... (激活 Intro 不變) ... */
                console.log("激活 Intro 容器...");
                DOM.containers.intro.classList.add('active');
                state.introVisible = true;
                await delay(INTRO_ANIMATION_TOTAL_TIME);
            } else {
                 await delay(100);
            }

            console.log("Intro 轉場完成。");
            resolve();
        });
    }

    function preloadAndAnimate() { /* ... (保持不變) ... */
        return new Promise(async (resolve, reject) => {
            if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) {
                reject(new Error("Preloader 或 SVG 元素未找到。")); return;
            }
            if (!questions || questions.length === 0) {
                reject(new Error("問題數據無效。")); return;
            }

            console.log("顯示 Preloader...");
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('is-exiting-bg');
                DOM.containers.preloader.style.display = '';
                DOM.containers.preloader.classList.add('active');
            }
            if (DOM.elements.preloaderSvg) {
                DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
                    p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                    p.style.animation = ''; p.style.animationDelay = '';
                    p.style.opacity = '0'; p.style.strokeDashoffset = '1500';
                    p.style.fillOpacity = '0'; p.style.visibility = 'visible';
                });
                await nextFrame();
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.classList.remove('glow-active');
                // *** 確保入口動畫設置了 forwards ***
                DOM.elements.preloaderSvg.style.animation = `preloaderEntranceZoom ${SVG_ANIMATION_TOTAL_ESTIMATED_TIME}ms ease-out forwards`;

                setTimeout(() => {
                    if (DOM.containers.preloader?.classList.contains('active')) {
                        DOM.elements.preloaderSvg?.classList.add('glow-active');
                    }
                }, SVG_GLOW_DELAY);
            }

            const imageUrls = ['./images/Intro.webp'];
            questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
            let loadedCount = 0; const totalImages = imageUrls.length;
            let errorOccurred = false; const imagePromises = [];

            console.log(`開始預載入 ${totalImages} 張圖片...`);
            imageUrls.forEach(url => {
                const promise = new Promise((imgResolve) => { // Removed imgReject for simplicity
                    const img = new Image();
                    img.onload = () => { loadedCount++; imgResolve(); };
                    img.onerror = () => {
                        console.warn(`圖片載入失敗: ${url}`);
                        loadedCount++; errorOccurred = true; imgResolve();
                    };
                    img.src = url;
                });
                imagePromises.push(promise);
            });

            const preloadStartTime = performance.now(); // Track preload start time
            await Promise.all(imagePromises);
            state.preloadComplete = true;
            console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);

            // Calculate remaining delay based on actual preload time vs estimated SVG time
            const preloadDuration = performance.now() - preloadStartTime;
            const estimatedSvgEndTime = startTime + SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG; // startTime is from outer scope
            const now = performance.now();
            const remainingDelay = Math.max(0, estimatedSvgEndTime - now);

            console.log(`圖片載入耗時: ${preloadDuration.toFixed(0)}ms`);
            console.log(`等待 SVG 動畫 + 停留剩餘時間: ${remainingDelay.toFixed(0)}ms...`);
            await delay(remainingDelay);

            console.log("Preloader 動畫和延遲完成。");
            resolve();
        });
    }


    /**
     * 觸發元素內文字的爆炸效果 (調整參數)
     * @param {HTMLElement} targetElement - 觸發爆炸的目標元素
     * @param {string} textToExplode - 要爆炸的文字
     * @param {HTMLElement} explosionContainer - 容納爆炸粒子的容器
     * @returns {Promise<void>} 爆炸動畫完成時 resolve
     */
    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        return new Promise(resolve => {
            if (!explosionContainer || !targetElement) {
                console.error("Explosion failed: Missing container or target element.");
                resolve(); return;
            }
            explosionContainer.innerHTML = '';

            const targetRect = targetElement.getBoundingClientRect();
            const containerRect = explosionContainer.getBoundingClientRect();
            let startX = targetRect.left - containerRect.left + targetRect.width / 2;
            let startY = targetRect.top - containerRect.top + targetRect.height / 2;

            const chars = textToExplode.split('');
            let animationsPending = 0;

            chars.forEach((char) => {
                if (char.trim() === '') return;

                const span = document.createElement('span');
                span.textContent = char;
                span.className = `char-explode`;

                // *** FIX 2: Refine Explosion Parameters ***
                const angle = Math.random() * Math.PI * 2;
                // 減小爆炸半徑，使其更集中
                const radius = Math.random() * (Math.min(targetRect.width, targetRect.height) * 1.5) + 20; // Base on target size
                const translateX = Math.cos(angle) * radius;
                const translateY = Math.sin(angle) * radius;
                // 減小 Z 軸距離
                const translateZ = Math.random() * 150 + 100;
                const rotateZ = (Math.random() - 0.5) * 360; // 減小旋轉
                // 減小縮放比例
                const scale = Math.random() * 1.5 + 1.2;
                const animationDelay = Math.random() * 0.1; // 減小延遲

                span.style.left = `${startX}px`; span.style.top = `${startY}px`;
                span.style.setProperty('--tx', `${translateX}px`);
                span.style.setProperty('--ty', `${translateY}px`);
                span.style.setProperty('--tz', `${translateZ}px`);
                span.style.setProperty('--rz', `${rotateZ}deg`);
                span.style.setProperty('--sc', `${scale}`);
                span.style.animationDelay = `${animationDelay}s`;
                // *** Use the updated EXPLOSION_DURATION from constants ***
                span.style.animationDuration = `${EXPLOSION_DURATION}ms`;


                explosionContainer.appendChild(span);
                animationsPending++;

                span.addEventListener('animationend', () => {
                    if (span.parentNode === explosionContainer) { explosionContainer.removeChild(span); }
                    animationsPending--;
                    if (animationsPending === 0) { resolve(); }
                }, { once: true });
            });

             if (animationsPending === 0) { resolve(); }

            // Timeout insurance
            setTimeout(() => {
                if (animationsPending > 0) {
                    console.warn("Explosion animation timeout, forcing resolve.");
                    explosionContainer.innerHTML = ''; resolve();
                }
            }, EXPLOSION_DURATION + 300); // Adjust timeout based on new duration
        });
    }


    /**
     * 處理開始測驗按鈕點擊事件
     */
    async function handleStartTestClick() {
        // *** FIX 5: Log state on click ***
        console.log(`[Click] 開始測驗按鈕被點擊，isBusy: ${state.isBusy}`);
        if (state.isBusy) {
            console.log("正在處理其他操作，請稍候...");
            return;
        }
        state.isBusy = true;
        console.log("[Lock] handleStartTestClick set isBusy = true");

        try {
            if (DOM.buttons.start && DOM.elements.startBtnText && DOM.containers.startBtnExplosion) {
                const buttonText = DOM.elements.startBtnText.textContent;
                DOM.elements.startBtnText.classList.add('hidden');
                // *** Make explosion faster ***
                await triggerExplosion(DOM.buttons.start, buttonText, DOM.containers.startBtnExplosion);
                DOM.buttons.start.classList.add('exploded');
                await delay(100); // Short delay after explosion
            }

            // *** FIX 3 related: Ensure screen switch completes before initializing test ***
            await switchScreen('intro', 'test');
            // Now that screen switch is complete, initialize
            await initializeTestScreen(); // Make initialize async if needed
            state.contentRendered = true;

        } catch (error) {
            console.error("處理開始測驗點擊時出錯:", error);
            await switchScreen('test', 'intro'); // Attempt rollback
        } finally {
            // *** 解鎖狀態由 initializeTestScreen 或 showResults 內部處理 ***
            // state.isBusy = false; // DO NOT UNLOCK HERE
             console.log("[Unlock Check] handleStartTestClick finished, isBusy should be handled by next step.");
        }
    }

    /**
     * 切換顯示的屏幕容器 (調整計時)
     * @param {string} fromScreenId - 要隱藏的屏幕 ID ('intro', 'test', 'result')
     * @param {string} toScreenId - 要顯示的屏幕 ID ('intro', 'test', 'result')
     * @returns {Promise<void>} 屏幕切換動畫完成時 resolve
     */
    function switchScreen(fromScreenId, toScreenId) {
        return new Promise(async (resolve) => {
            const fromScreen = DOM.containers[fromScreenId];
            const toScreen = DOM.containers[toScreenId];

            if (!fromScreen || !toScreen) {
                console.error(`屏幕切換失敗: 找不到 ${fromScreenId} 或 ${toScreenId}`);
                resolve(); return;
            }

            console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);

            // *** FIX 3: Activate target screen earlier ***
            // 隱藏來源屏幕
            fromScreen.classList.remove('active');
            // *立即* 激活目標屏幕，讓 CSS transition 同時處理淡出淡入
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';

            // 更新狀態
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            if (toScreenId === 'intro') { /* ... (重置 Intro 狀態不變) ... */
                state.currentQuestionIndex = 0; state.userAnswers = [];
                state.finalScores = {}; state.contentRendered = false;
                if (DOM.buttons.start && DOM.elements.startBtnText) {
                    DOM.buttons.start.classList.remove('exploded');
                    DOM.elements.startBtnText.classList.remove('hidden');
                }
            }

            // 只需要等待一次 CSS 過渡時間
            await delay(SCREEN_TRANSITION_DURATION);

            console.log(`屏幕切換至 ${toScreenId} 完成`);
            resolve(); // 切換完成
        });
    }

    /**
     * 初始化測驗屏幕，顯示第一個問題
     */
    async function initializeTestScreen() {
        // No need to return Promise if displayQuestion handles unlock
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("無法初始化測驗屏幕，缺少必要元素。");
            state.isBusy = false; // Ensure unlock on error
            console.log("[Unlock] initializeTestScreen error, set isBusy = false");
            return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        updateProgressBar(0);
        // displayQuestion will handle unlocking isBusy
        await displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1);
        console.log("initializeTestScreen 完成");
    }

    /**
     * 顯示指定索引的問題及其選項
     * @param {number} index - 問題的索引 (0-based)
     * @param {boolean} [isInitialDisplay=false] - 是否為測驗開始時的第一次顯示
     * @returns {Promise<void>} 問題和選項入場動畫完成時 resolve
     */
    function displayQuestion(index, isInitialDisplay = false) {
        // This function now handles unlocking isBusy
        return new Promise(async (resolve) => {
            // Set busy lock at the beginning of the operation
            // state.isBusy = true; // Moved lock setting to caller (initializeTestScreen, prepareNextQuestion)
            // console.log(`[Lock] displayQuestion ${index + 1} set isBusy = true`);

            if (index < 0 || index >= totalQuestions) {
                console.error("無效的問題索引:", index);
                state.isBusy = false; // Unlock on error
                console.log(`[Unlock] displayQuestion invalid index ${index}, set isBusy = false`);
                resolve(); return;
            }
            const questionData = questions[index];
            const questionNumber = index + 1;
            console.log(`顯示問題 ${questionNumber}`);

            // --- 更新背景圖片 ---
            const bgPromise = (async () => {
                if (DOM.elements.testBackground) {
                    const imageUrl = `./images/Q${questionNumber}.webp`;
                    if (!isInitialDisplay) {
                        DOM.elements.testBackground.classList.add('is-hidden');
                        await delay(QUESTION_FADE_DURATION);
                        DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                        await nextFrame();
                        DOM.elements.testBackground.classList.remove('is-hidden');
                    } else {
                        DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                        DOM.elements.testBackground.classList.remove('is-hidden');
                    }
                }
            })();


            // --- 更新問題標題 ---
             const titlePromise = (async () => {
                if (DOM.elements.questionTitle) {
                    // *** FIX 4 related: Ensure smooth transition ***
                    // Apply is-hidden first, then update text, then remove is-hidden for fade-in
                     if (!isInitialDisplay) {
                        DOM.elements.questionTitle.classList.add('is-hidden');
                        await delay(10); // Small delay to ensure class is applied before text change
                     }
                     DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                     await nextFrame(); // Ensure text is updated in DOM
                     // Remove is-hidden to trigger transition defined in CSS
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                     // Wait for the CSS transition to complete
                     await delay(QUESTION_FADE_DURATION); // Wait for title fade-in
                }
             })();


            // --- 生成並顯示選項 ---
            const optionsPromise = (async () => {
                if (DOM.containers.options) {
                    DOM.containers.options.innerHTML = '';
                    allOptions = [];

                    questionData.options.forEach((optionData, optIndex) => { /* ... (選項生成不變) ... */
                        const optionElement = document.createElement('div');
                        optionElement.className = 'option is-hidden';
                        optionElement.style.transition = 'none';
                        optionElement.dataset.text = optionData.text;
                        optionElement.dataset.index = optIndex;
                        optionElement.innerText = optionData.text;
                        optionElement.setAttribute('role', 'button');
                        optionElement.tabIndex = 0;
                        optionElement.addEventListener('click', handleOptionClick);
                        optionElement.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); }
                        });
                        DOM.containers.options.appendChild(optionElement);
                        allOptions.push(optionElement);
                    });

                    // Wait a bit before starting option animation
                    await delay(isInitialDisplay ? 150 : 50); // Shorter delay for subsequent questions
                    await triggerQuestionEnterAnimation(); // Wait for options to enter

                } else {
                    console.error("找不到選項容器 #options-container");
                }
            })();

            // Wait for all parallel animations to roughly complete
            await Promise.all([bgPromise, titlePromise, optionsPromise]);

            console.log(`問題 ${questionNumber} 顯示完成。`);
            state.isBusy = false; // *** 解鎖狀態 ***
            console.log(`[Unlock] displayQuestion ${questionNumber} finished, set isBusy = false`);
            resolve();
        });
    }


    /**
     * 處理選項點擊事件
     * @param {Event} event - 點擊或鍵盤事件對象
     */
    async function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        console.log(`[Click] 選項 ${optionIndex + 1} 被點擊, isBusy: ${state.isBusy}`); // Log state on click
        if (state.isBusy || isNaN(optionIndex) || isNaN(questionIndex) || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            return;
        }

        state.isBusy = true; // *** 設置狀態鎖 ***
        console.log(`[Lock] handleOptionClick set isBusy = true for Q${questionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex;

        // --- 執行退場動畫 ---
        if (DOM.elements.testBackground) DOM.elements.testBackground.classList.add('is-hidden');
        if (DOM.elements.questionTitle) DOM.elements.questionTitle.classList.add('is-hidden');

        const explosionPromise = triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);
        triggerQuestionFadeOut(clickedOption); // Start fade out of other options

        // Wait for explosion and fade effects
        await explosionPromise;
        await delay(QUESTION_FADE_DURATION); // Wait for fades

        if (DOM.containers.explosion) { DOM.containers.explosion.innerHTML = ''; }

        // --- 決定下一步 ---
        try {
            if (state.currentQuestionIndex < totalQuestions - 1) {
                await prepareNextQuestion(); // This will handle unlocking
            } else {
                await showResults(); // This will handle unlocking
            }
        } catch (error) {
             console.error("處理選項點擊後續步驟時出錯:", error);
             state.isBusy = false; // Ensure unlock on error
             console.log("[Unlock] handleOptionClick error in next step, set isBusy = false");
             await switchScreen('test', 'intro'); // Attempt rollback
        }
        // Unlock is handled by prepareNextQuestion or showResults
        console.log("handleOptionClick 流程結束");
    }

    function triggerQuestionFadeOut(clickedOptionElement) { /* ... (保持不變) ... */
        console.log("觸發問題退場動畫");
        allOptions.forEach(option => {
            option.style.transitionDelay = '';
            option.style.pointerEvents = 'none';
            if (option === clickedOptionElement) {
                option.classList.add('exploded');
            } else {
                option.classList.add('fade-out');
            }
        });
    }

    /**
     * 準備並顯示下一題
     * @returns {Promise<void>} 下一題顯示完成時 resolve
     */
    async function prepareNextQuestion() {
        // Lock should be set by caller (handleOptionClick)
        console.log("準備下一題");
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1);
        // displayQuestion will unlock isBusy when done
        await displayQuestion(state.currentQuestionIndex, false);
    }

    function triggerQuestionEnterAnimation() { /* ... (保持不變) ... */
        return new Promise(async (resolve) => {
            console.log("觸發問題入場動畫");
            if (!allOptions || allOptions.length === 0) { resolve(); return; }

            let maxDelay = 0;
            allOptions.forEach((option, index) => {
                const delay = OPTIONS_ENTER_START_DELAY + index * OPTION_STAGGER_DELAY;
                maxDelay = Math.max(maxDelay, delay);
                option.style.transition = '';
                option.style.transitionDelay = `${delay}ms`;
                option.classList.remove('is-hidden', 'fade-out', 'exploded');
                option.style.pointerEvents = '';
            });

            const totalAnimationTime = maxDelay + OPTION_ENTER_DURATION;
            await delay(totalAnimationTime + 100);

            allOptions.forEach(option => { option.style.transitionDelay = ''; });
            console.log("問題入場動畫完成");
            resolve();
        });
    }
    function updateProgressBar(questionNumber) { /* ... (保持不變) ... */
        if (DOM.elements.progressFill) {
            const progress = (questionNumber / totalQuestions) * 100;
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        }
    }
    function calculateResult() { /* ... (保持不變) ... */
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== totalQuestions) {
                console.error("錯誤：答案數量與問題數量不符！");
                return results['A'] || null;
            }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const questionData = questions[questionIndex];
                if (questionData?.options?.[answerIndex]?.scores) {
                    const optionScores = questionData.options[answerIndex].scores;
                    for (const type in optionScores) {
                        if (scores.hasOwnProperty(type)) {
                            scores[type] += optionScores[type];
                        }
                    }
                } else {
                    console.warn(`警告：問題 ${questionIndex + 1} 的選項 ${answerIndex + 1} 分數數據缺失。`);
                }
            });
            state.finalScores = scores;
            console.log("計算出的原始分數:", scores);

            const scoreValues = Object.values(scores);
            const scoreFrequency = {};
            scoreValues.forEach(score => {
                const scoreKey = score.toFixed(2);
                scoreFrequency[scoreKey] = (scoreFrequency[scoreKey] || 0) + 1;
            });
            console.log("分數頻率 (key 為分數):", scoreFrequency);
            for (const scoreKey in scoreFrequency) {
                if (scoreFrequency[scoreKey] >= 4) {
                    console.log("觸發 SPECIAL 結果（分數高度相似）");
                    return results["SPECIAL"];
                }
            }

            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) {
                if (scores[type] > maxScore) {
                    maxScore = scores[type]; highestTypes = [type];
                } else if (scores[type] === maxScore) {
                    highestTypes.push(type);
                }
            }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);

            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { console.log("觸發 SPECIAL 結果（多個類型平分最高）"); return results["SPECIAL"]; }
            if (highestTypes.length === 2) {
                console.log(`兩個類型平分最高: ${highestTypes.join(', ')}，執行 tie-breaker...`);
                let primaryCount = { [highestTypes[0]]: 0, [highestTypes[1]]: 0 };
                state.userAnswers.forEach((answerIndex, questionIndex) => {
                    const primaryType = questions[questionIndex]?.options[answerIndex]?.primary;
                    if (primaryType && primaryCount.hasOwnProperty(primaryType)) { primaryCount[primaryType]++; }
                });
                console.log("Primary 出現次數:", primaryCount);
                if (primaryCount[highestTypes[0]] > primaryCount[highestTypes[1]]) {
                    console.log(`Tie-breaker: ${highestTypes[0]} 勝出`); return results[highestTypes[0]];
                } else if (primaryCount[highestTypes[1]] > primaryCount[highestTypes[0]]) {
                    console.log(`Tie-breaker: ${highestTypes[1]} 勝出`); return results[highestTypes[1]];
                } else { console.log("Tie-breaker 平手，返回 SPECIAL 結果"); return results["SPECIAL"]; }
            }
            console.warn("無法確定最高分類型，返回默認結果 A"); return results['A'];
        } catch (error) { console.error("計算結果時出錯:", error); return results['A'] || null; }
    }
    function prepareResultData(resultData) { /* ... (保持不變) ... */
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
            console.error("準備結果數據失敗：缺少結果數據或必要的 DOM 元素。"); return false;
        }
        try {
            DOM.elements.resultTitle.textContent = resultData.title || "你的靈魂之書是：";
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || "";
            DOM.elements.resultDescription.textContent = resultData.description || "發生了一些錯誤，無法顯示描述。";
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法顯示特質：缺少分數數據。");
                 DOM.elements.traitsContainer.innerHTML = '<p>無法計算特質分數。</p>';
            } else if (resultData.title && resultData.title.includes('管理員')) {
                 const specialTrait = document.createElement('div');
                 specialTrait.className = 'trait-item';
                 specialTrait.textContent = "能夠理解並欣賞所有情感類型";
                 DOM.elements.traitsContainer.appendChild(specialTrait);
            } else {
                const maxScoreValue = Math.max(...Object.values(typeScores));
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0;
                    const starCount = Math.max(0, Math.min(5, Math.round(score * 1.2)));
                    addTraitElement(type, starCount);
                });
            }
            function populateBookList(element, books) {
                element.innerHTML = '';
                if (Array.isArray(books) && books.length > 0) {
                    const ul = document.createElement('ul');
                    books.forEach(bookText => { const li = document.createElement('li'); li.textContent = bookText; ul.appendChild(li); });
                    element.appendChild(ul);
                } else { element.innerHTML = '<p>暫無相關書籍推薦。</p>'; }
            }
            populateBookList(DOM.elements.similarBooks, resultData.similar);
            populateBookList(DOM.elements.complementaryBooks, resultData.complementary);
            DOM.elements.shareText.textContent = resultData.shareText || "快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle";
            console.log("結果數據已準備並填充到頁面"); return true;
        } catch (error) {
            console.error("準備結果數據時發生錯誤:", error);
            DOM.elements.resultTitle.textContent = "發生錯誤";
            DOM.elements.resultDescription.textContent = "無法顯示結果，請稍後再試。"; return false;
        }
    }
    /**
     * 顯示最終的測驗結果頁面
     * @returns {Promise<void>} 結果頁面顯示完成時 resolve
     */
    async function showResults() {
        // Lock should be set by caller (handleOptionClick)
        console.log("測驗結束，準備顯示結果...");
        try {
            const resultData = calculateResult();
            if (!resultData) throw new Error("結果計算返回 null 或 undefined。");
            const dataPrepared = prepareResultData(resultData);
            if (!dataPrepared) throw new Error("結果數據準備或填充失敗。");
            await switchScreen('test', 'result');
        } catch (error) {
            console.error("顯示結果時出錯:", error);
            displayInitializationError("無法顯示測驗結果，請重試。");
            await delay(2000);
            await switchScreen('test', 'intro'); // Attempt rollback
        } finally {
            state.isBusy = false; // *** 解鎖狀態 ***
            console.log("[Unlock] showResults finished, set isBusy = false");
        }
    }
    function addTraitElement(type, starCount) { /* ... (保持不變) ... */
        if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div'); traitElement.className = 'trait-item';
            const traitName = document.createElement('span'); traitName.className = 'trait-name';
            traitName.textContent = traitNames[type] || type;
            const traitStars = document.createElement('span'); traitStars.className = 'trait-stars';
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);
            traitElement.appendChild(traitName); traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) { console.error(`添加特質 ${type} 時出錯:`, error); }
    }
    async function copyShareText() { /* ... (保持不變) ... */
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
        const textToCopy = DOM.elements.shareText.textContent;
        const copyButton = DOM.buttons.copy;
        const originalButtonText = copyButton.textContent;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
                console.log("分享文本已複製到剪貼板 (Clipboard API)");
                copyButton.textContent = '已複製!';
            } else { fallbackCopyText(textToCopy); }
        } catch (error) {
            console.error("複製分享文本時出錯:", error); copyButton.textContent = '複製失敗';
        } finally { setTimeout(() => { copyButton.textContent = originalButtonText; }, 2000); }
    }
    function fallbackCopyText(text) { /* ... (保持不變) ... */
        const textArea = document.createElement("textarea"); textArea.value = text;
        textArea.style.position = 'fixed'; textArea.style.top = '-9999px'; textArea.style.left = '-9999px';
        document.body.appendChild(textArea); textArea.focus(); textArea.select(); textArea.setSelectionRange(0, 99999);
        let success = false;
        try {
            success = document.execCommand('copy');
            console.log("分享文本已複製到剪貼板 (execCommand)");
            if (DOM.buttons.copy) DOM.buttons.copy.textContent = '已複製!';
        } catch (err) {
            console.error('無法使用 execCommand 複製:', err);
            if (DOM.buttons.copy) DOM.buttons.copy.textContent = '複製失敗';
        }
        document.body.removeChild(textArea);
    }
    function bindStartButton() { /* ... (保持不變) ... */
        if (DOM.buttons.start) {
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("開始測驗按鈕事件已綁定。");
        } else {
            console.error("無法綁定開始按鈕事件：按鈕元素未找到。");
            displayInitializationError("無法啟動測驗，關鍵按鈕丟失。");
        }
    }
    function bindOtherButtons() { /* ... (保持不變) ... */
        if (DOM.buttons.restart) {
            DOM.buttons.restart.removeEventListener('click', handleRestartClick);
            DOM.buttons.restart.addEventListener('click', handleRestartClick);
        }
        if (DOM.buttons.copy) {
            DOM.buttons.copy.removeEventListener('click', copyShareText);
            DOM.buttons.copy.addEventListener('click', copyShareText);
        }
        console.log("其他按鈕事件已綁定。");
    }
    async function handleRestartClick() { /* ... (保持不變) ... */
        // *** FIX 5: Check lock on restart too ***
        console.log(`[Click] 重新測驗按鈕被點擊, isBusy: ${state.isBusy}`);
        if (state.isBusy) return;
        state.isBusy = true;
        console.log("[Lock] handleRestartClick set isBusy = true");
        console.log("重新開始測驗...");
        try {
            await switchScreen('result', 'intro');
        } catch (error) {
            console.error("重新測驗時切換屏幕出錯:", error);
        } finally {
            state.isBusy = false; // *** 解鎖狀態 ***
            console.log("[Unlock] handleRestartClick finished, set isBusy = false");
        }
    }

    // --- 全局錯誤處理 ---
    window.addEventListener('error', function(event) { /* ... (保持不變) ... */
        console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
        if (state.isBusy) { console.warn("因全局錯誤，嘗試解除 isBusy 狀態鎖。"); state.isBusy = false; }
    });
    window.addEventListener('unhandledrejection', function(event) { /* ... (保持不變) ... */
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        if (state.isBusy) { console.warn("因未處理的 Promise rejection，嘗試解除 isBusy 狀態鎖。"); state.isBusy = false; }
    });

    // --- 初始化流程 ---
    console.log("開始初始化...");
    const startTime = performance.now();

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (!cacheDOMElements()) {
        console.error("DOM 元素緩存失敗，初始化中止。");
        return;
    }

    try {
        state.isBusy = true; // 設置初始鎖
        console.log("[Lock] Initialization start, set isBusy = true");
        await preloadAndAnimate();
        await triggerIntroTransition();
        bindStartButton();
        bindOtherButtons();
        state.isBusy = false; // *** 解鎖狀態 ***
        console.log("[Unlock] Initialization finished, set isBusy = false");
        const endTime = performance.now();
        console.log(`初始化完成，總耗時: ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
        console.error("初始化過程中發生錯誤:", error);
        displayInitializationError(`初始化失敗: ${error.message || '未知錯誤'}`);
        state.isBusy = false; // 確保解鎖
        console.log("[Unlock] Initialization error, set isBusy = false");
    }

    console.log("腳本初始化流程結束。");
});
