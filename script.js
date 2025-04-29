// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', async function() {
    // 記錄初始化開始時間，用於追蹤總耗時
    const initializationStartTime = performance.now();
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isBusy: false, // 全局狀態鎖
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
        console.error("錯誤：找不到有效的 testData 全域變數。");
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
    const EXPLOSION_DURATION = getCssTimeInMillis('--explosion-duration', 1000);
    const SVG_GLOW_DELAY = getCssTimeInMillis('--svg-glow-delay', 3000);
    const QUESTION_FADE_DURATION = 500;
    const OPTIONS_ENTER_START_DELAY = 200;
    const OPTION_STAGGER_DELAY = 80;
    const OPTION_ENTER_DURATION = 500;

    // --- 輔助函數 ---
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (e) { console.warn("設置視口高度錯誤:", e); }
    }
    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('active');
        } else { document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; }
    }

    /**
     * 快取常用的 DOM 元素，減少重複查詢，提高效能
     * @returns {boolean} 是否成功快取所有必要元素
     */
    function cacheDOMElements() {
        try {
            DOM = {
                containers: {
                    intro: document.getElementById('intro-container'),
                    test: document.getElementById('test-container'),
                    result: document.getElementById('result-container'),
                    preloader: document.getElementById('preloader'),
                    options: document.getElementById('options-container'),
                    explosion: document.getElementById('explosion-container'), // 主爆炸容器 (用於選項)
                    startBtnExplosion: document.getElementById('start-btn-explosion-container'), // *** 恢復快取開始按鈕爆炸容器 ***
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
                    introTitlePlaceholder: document.querySelector('.intro-title-placeholder')
                },
                buttons: {
                    start: document.getElementById('start-test'),
                    copy: document.getElementById('copy-btn'),
                    restart: document.getElementById('restart-btn')
                }
            };

            // 定義必須存在的關鍵元素列表 (恢復 startBtnExplosion)
            const criticalElements = [
                DOM.containers.intro, DOM.containers.test, DOM.containers.result,
                DOM.containers.preloader, DOM.containers.options, DOM.containers.explosion,
                DOM.containers.startBtnExplosion, // *** 恢復檢查 ***
                DOM.containers.preloaderSvgContainer,
                DOM.elements.preloaderSvg, DOM.elements.testBackground, DOM.elements.questionTitle,
                DOM.elements.startBtnText, DOM.buttons.start, DOM.elements.introTitlePlaceholder
            ];

            if (criticalElements.some(el => !el)) {
                console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID。", DOM);
                const missingIndex = criticalElements.findIndex(el => !el);
                // 找到第一個缺失的元素並打印其預期 ID (如果可能)
                const expectedIds = [
                    'intro-container', 'test-container', 'result-container', 'preloader',
                    'options-container', 'explosion-container', 'start-btn-explosion-container',
                    'preloader-svg-container', 'preloader-svg', 'test-background',
                    'question-title', '#start-test .btn-text', 'start-test', '.intro-title-placeholder'
                ];
                console.error(`缺失元素的索引: ${missingIndex}, 預期 ID/選擇器: ${expectedIds[missingIndex] || '未知'}`);
                displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                return false;
            }

            // 檢查 SVG Group
            const mainTitleGroup = DOM.elements.preloaderSvg?.querySelector('#main-title-group');
            const engSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#eng-subtitle-group');
            const chnSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#chn-subtitle-group');
            if (!mainTitleGroup || !engSubtitleGroup || !chnSubtitleGroup) {
                console.warn("警告：未能找到所有的 SVG Group ID (main-title-group, eng-subtitle-group, chn-subtitle-group)。請檢查 index.html。");
            }

            // 複製 SVG
            if (DOM.elements.preloaderSvg && DOM.elements.introTitlePlaceholder) {
                 const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
                 clonedSvg.id = 'intro-title-svg';
                 clonedSvg.classList.remove('glow-active');
                 clonedSvg.style.animation = 'none';
                 clonedSvg.style.transform = '';
                 clonedSvg.querySelectorAll('path, g').forEach(el => {
                     el.style.animation = 'none'; el.style.animationDelay = '0s';
                     el.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                     el.style.transform = ''; el.style.filter = ''; el.style.opacity = '';
                     el.style.strokeDashoffset = '0'; el.style.fillOpacity = '1'; el.style.visibility = 'visible';
                 });
                 DOM.elements.introTitlePlaceholder.innerHTML = '';
                 DOM.elements.introTitlePlaceholder.appendChild(clonedSvg);
                 console.log("Intro title SVG 已從 Preloader SVG 複製並插入");
             } else {
                 console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro title placeholder");
             }

            console.log("DOM 元素已成功快取");
            return true;
        } catch (error) {
            console.error("快取 DOM 元素時發生錯誤:", error);
            displayInitializationError("頁面初始化時發生錯誤。");
            return false;
        }
    }
    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    function nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }
    function triggerIntroTransition() {
        return new Promise(async (resolve) => {
            console.log("開始 Preloader 到 Intro 的轉場...");
            if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
                console.error("Preloader, Intro container, or Preloader SVG not found for transition."); resolve(); return;
            }
            const currentTransform = window.getComputedStyle(DOM.elements.preloaderSvg).transform;
            DOM.elements.preloaderSvg.style.animation = 'none';
            DOM.elements.preloaderSvg.style.transform = currentTransform !== 'none' ? currentTransform : 'scale(1.05)';
            DOM.elements.preloaderSvg.classList.remove('glow-active');
            const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
                 '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path'
            );
            const preloaderBg = DOM.containers.preloader;
            if (pathsToExit.length === 0 && !preloaderBg) {
                 if (DOM.containers.preloader) {
                    DOM.containers.preloader.classList.remove('active');
                    DOM.containers.preloader.style.display = 'none';
                 }
                 if (DOM.containers.intro) DOM.containers.intro.classList.add('active');
                 state.introVisible = true;
                 resolve();
                 return;
            }
            let maxExitDelay = 0; const baseExitDelay = 0; const randomExitRange = 800;
            pathsToExit.forEach(path => {
                 path.style.animation = ''; path.style.opacity = '';
                 path.style.transform = ''; path.style.filter = ''; path.style.visibility = '';
                 const randomDelay = baseExitDelay + Math.random() * randomExitRange;
                 maxExitDelay = Math.max(maxExitDelay, randomDelay);
                 const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';
                 setTimeout(() => {
                     path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
                     path.classList.add(exitClass);
                 }, 5);
            });
            if (preloaderBg) {
                 setTimeout(() => {
                     preloaderBg.classList.add('is-exiting-bg');
                 }, baseExitDelay + randomExitRange * 0.2);
            }
            const totalExitTime = maxExitDelay + PRELOADER_PATH_EXIT_DURATION;
            await delay(totalExitTime);
            console.log("Preloader 所有 Path 退場動畫結束。");
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                DOM.containers.preloader.style.display = 'none';
            }
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = ''; path.style.animationDelay = '';
            });
            if (DOM.elements.preloaderSvg) {
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.style.transform = '';
            }
            if (!state.introVisible && DOM.containers.intro) {
                 console.log("激活 Intro 容器...");
                 DOM.containers.intro.classList.add('active');
                 state.introVisible = true;
                 await delay(INTRO_ANIMATION_TOTAL_TIME);
            }
            else { await delay(100); }
            console.log("Intro 轉場完成。"); resolve();
        });
    }
    function preloadAndAnimate() {
        return new Promise(async (resolve, reject) => {
            const startTime = performance.now(); // *** 需要在這裡定義 startTime ***
            if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) { reject(new Error("Preloader 或 SVG 元素未找到。")); return; }
            if (!questions || questions.length === 0) { reject(new Error("問題數據無效。")); return; }
            console.log("顯示 Preloader 並開始動畫...");
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
                 const promise = new Promise((imgResolve) => {
                     const img = new Image();
                     img.onload = () => { loadedCount++; imgResolve(); };
                     img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); loadedCount++; errorOccurred = true; imgResolve(); };
                     img.src = url;
                 });
                 imagePromises.push(promise);
            });
            const preloadStartTime = performance.now();
            await Promise.all(imagePromises);
            state.preloadComplete = true;
            console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);
            const preloadDuration = performance.now() - preloadStartTime;
            // *** initializationStartTime 應從外部傳入或在此處定義 ***
            const estimatedSvgEndTime = startTime + SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG;
            const now = performance.now();
            const remainingDelay = Math.max(0, estimatedSvgEndTime - now);
            console.log(`圖片載入耗時: ${preloadDuration.toFixed(0)}ms`);
            console.log(`等待 SVG 動畫 + 停留剩餘時間: ${remainingDelay.toFixed(0)}ms...`);
            await delay(remainingDelay);
            console.log("Preloader 動畫和延遲完成。"); resolve();
        });
    }
    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        return new Promise(resolve => {
            if (!explosionContainer || !targetElement) {
                console.error("Explosion failed: Missing container or target element."); resolve(); return;
            }
            explosionContainer.innerHTML = '';
            const targetRect = targetElement.getBoundingClientRect();
            // *** 修正：爆炸容器的 offsetParent 可能不是 body，需要正確計算相對位置 ***
            const containerRect = explosionContainer.getBoundingClientRect(); // 使用 getBoundingClientRect 獲取容器位置
            let startX = targetRect.left - containerRect.left + targetRect.width / 2;
            let startY = targetRect.top - containerRect.top + targetRect.height / 2;
            const chars = textToExplode.split('');
            let animationsPending = 0;
            chars.forEach((char) => {
                if (char.trim() === '') return;
                const span = document.createElement('span'); span.textContent = char; span.className = `char-explode`;
                const angle = Math.random() * Math.PI * 2;
                const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
                const radius = Math.random() * baseRadius + 50;
                const translateX = Math.cos(angle) * radius; const translateY = Math.sin(angle) * radius;
                const translateZ = Math.random() * 350 + 250; const rotateZ = (Math.random() - 0.5) * 480;
                const scale = Math.random() * 3.5 + 2.5; const animationDelay = Math.random() * 0.15;
                span.style.left = `${startX}px`; span.style.top = `${startY}px`;
                span.style.setProperty('--tx', `${translateX}px`); span.style.setProperty('--ty', `${translateY}px`);
                span.style.setProperty('--tz', `${translateZ}px`); span.style.setProperty('--rz', `${rotateZ}deg`);
                span.style.setProperty('--sc', `${scale}`); span.style.animationDelay = `${animationDelay}s`;
                span.style.animationDuration = `${EXPLOSION_DURATION}ms`;
                explosionContainer.appendChild(span); animationsPending++;
                span.addEventListener('animationend', () => {
                    // *** 修正：檢查父節點是否存在再移除 ***
                    if (span.parentElement === explosionContainer) {
                       try { explosionContainer.removeChild(span); } catch(e) { /* ignore if already removed */ }
                    }
                    animationsPending--;
                    if (animationsPending === 0) { resolve(); }
                }, { once: true });
            });
             if (animationsPending === 0) { resolve(); }
            setTimeout(() => {
                if (animationsPending > 0) {
                    console.warn("Explosion animation timeout, forcing resolve.");
                    // *** 修正：確保清理時容器還存在 ***
                    if(explosionContainer) explosionContainer.innerHTML = '';
                    resolve();
                }
            }, EXPLOSION_DURATION + 500);
        });
    }

    /**
     * 處理「開始測驗」按鈕的點擊事件 (恢復使用專用爆炸容器)
     */
    async function handleStartTestClick() {
        console.log(`[Click] 開始測驗按鈕被點擊，isBusy: ${state.isBusy}`);
        if (state.isBusy) {
            console.log("正在處理其他操作，請稍候...");
            return;
        }
        state.isBusy = true;
        console.log("[Lock] handleStartTestClick set isBusy = true");

        try {
            // *** 恢復使用 DOM.containers.startBtnExplosion ***
            if (DOM.buttons.start && DOM.elements.startBtnText && DOM.containers.startBtnExplosion) {
                const buttonText = DOM.elements.startBtnText.textContent;
                DOM.elements.startBtnText.classList.add('hidden');

                // *** 不再需要定位主容器，直接使用按鈕自己的容器 ***
                // const buttonRect = DOM.buttons.start.getBoundingClientRect();
                // const parentRect = DOM.containers.explosion.offsetParent ? DOM.containers.explosion.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();
                // DOM.containers.explosion.style.position = 'absolute';
                // DOM.containers.explosion.style.top = `${buttonRect.top - parentRect.top}px`;
                // DOM.containers.explosion.style.left = `${buttonRect.left - parentRect.left}px`;
                // DOM.containers.explosion.style.width = `${buttonRect.width}px`;
                // DOM.containers.explosion.style.height = `${buttonRect.height}px`;

                // *** 恢復調用 triggerExplosion 時傳遞 startBtnExplosion ***
                await triggerExplosion(DOM.buttons.start, buttonText, DOM.containers.startBtnExplosion);
                DOM.buttons.start.classList.add('exploded');

                // *** 不再需要清理主容器樣式 ***
                // DOM.containers.explosion.style.position = '';
                // ...

                await delay(100);
            } else {
                 // 添加錯誤處理，如果找不到開始按鈕的爆炸容器
                 console.error("無法觸發開始按鈕爆炸效果：缺少按鈕、文字或 startBtnExplosion 容器。");
            }

            await switchScreen('intro', 'test');
            await initializeTestScreen();
            state.contentRendered = true;

        } catch (error) {
            console.error("處理開始測驗點擊時出錯:", error);
            await switchScreen('test', 'intro');
        } finally {
            console.log("[Unlock Check] handleStartTestClick finished, isBusy should be handled by the next async step (initializeTestScreen).");
        }
    }

    /**
     * 異步切換顯示的屏幕容器 (修正閃爍問題)
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

            // 1. 移除來源屏幕的 active class，觸發其 CSS 淡出
            fromScreen.classList.remove('active');

            // 2. *** 確保目標屏幕在添加 active 前是可見的 ***
            toScreen.style.visibility = 'visible'; // Make it visible but opacity 0
            await nextFrame(); // Ensure visibility change is registered

            // 3. 添加 active class 觸發目標屏幕的 CSS 淡入
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';

            // --- 更新內部狀態 ---
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            // --- 如果切換回 Intro 頁面，重置相關狀態 ---
            if (toScreenId === 'intro') {
                state.currentQuestionIndex = 0; state.userAnswers = [];
                state.finalScores = {}; state.contentRendered = false;
                if (DOM.buttons.start && DOM.elements.startBtnText) {
                    DOM.buttons.start.classList.remove('exploded');
                    DOM.elements.startBtnText.classList.remove('hidden');
                }
                 // *** 清理 startBtnExplosion 容器內容 ***
                 if(DOM.containers.startBtnExplosion) {
                     DOM.containers.startBtnExplosion.innerHTML = '';
                 }
            }

            // 4. 等待 CSS 過渡動畫完成
            await delay(SCREEN_TRANSITION_DURATION + 50); // 加一點緩衝確保動畫結束

            // 5. *** 確保來源屏幕徹底隱藏 (以防萬一) ***
            if (!fromScreen.classList.contains('active')) {
                 fromScreen.style.visibility = 'hidden';
            }


            console.log(`屏幕切換至 ${toScreenId} 完成`);
            resolve(); // 切換完成
        });
    }

    async function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("無法初始化測驗屏幕，缺少必要元素。"); state.isBusy = false; console.log("[Unlock] initializeTestScreen error, set isBusy = false"); return;
        }
        console.log("初始化測驗屏幕..."); state.currentQuestionIndex = 0; state.userAnswers = []; updateProgressBar(0);
        await displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1); console.log("initializeTestScreen 完成");
    }
    function displayQuestion(index, isInitialDisplay = false) {
        return new Promise(async (resolve) => {
            if (index < 0 || index >= totalQuestions) {
                console.error("無效的問題索引:", index); state.isBusy = false; console.log(`[Unlock] displayQuestion invalid index ${index}, set isBusy = false`); resolve(); return;
            }
            const questionData = questions[index]; const questionNumber = index + 1; console.log(`顯示問題 ${questionNumber}`);
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
            const titlePromise = (async () => {
                if (DOM.elements.questionTitle) {
                     if (!isInitialDisplay) {
                        DOM.elements.questionTitle.classList.add('is-hidden');
                        await delay(10);
                     }
                     DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                     await nextFrame();
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                     await delay(QUESTION_FADE_DURATION);
                }
             })();
            const optionsPromise = (async () => {
                if (DOM.containers.options) {
                    DOM.containers.options.innerHTML = '';
                    allOptions = [];
                    questionData.options.forEach((optionData, optIndex) => {
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
                    await delay(isInitialDisplay ? 150 : 50);
                    await triggerQuestionEnterAnimation();
                } else {
                    console.error("找不到選項容器 #options-container");
                }
            })();
            await Promise.all([bgPromise, titlePromise, optionsPromise]);
            console.log(`問題 ${questionNumber} 顯示完成。`); state.isBusy = false; console.log(`[Unlock] displayQuestion ${questionNumber} finished, set isBusy = false`); resolve();
        });
    }

    /**
     * 處理選項點擊事件 (恢復使用主爆炸容器)
     * @param {Event} event - 點擊或鍵盤事件對象
     */
    async function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        console.log(`[Click] 選項 ${optionIndex + 1} (問題 ${questionIndex + 1}) 被點擊, isBusy: ${state.isBusy}`);
        if (state.isBusy || isNaN(optionIndex) || isNaN(questionIndex) || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            return;
        }

        state.isBusy = true;
        console.log(`[Lock] handleOptionClick set isBusy = true for Q${questionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex;

        if (DOM.elements.testBackground) DOM.elements.testBackground.classList.add('is-hidden');
        if (DOM.elements.questionTitle) DOM.elements.questionTitle.classList.add('is-hidden');

        // *** 定位主爆炸容器到選項位置 ***
        const optionRect = clickedOption.getBoundingClientRect();
        const parentRect = DOM.containers.explosion.offsetParent ? DOM.containers.explosion.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();
        DOM.containers.explosion.style.position = 'absolute';
        DOM.containers.explosion.style.top = `${optionRect.top - parentRect.top}px`;
        DOM.containers.explosion.style.left = `${optionRect.left - parentRect.left}px`;
        DOM.containers.explosion.style.width = `${optionRect.width}px`;
        DOM.containers.explosion.style.height = `${optionRect.height}px`;

        // *** 觸發爆炸，使用主容器 ***
        const explosionPromise = triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);
        triggerQuestionFadeOut(clickedOption); // 同步觸發其他選項淡出

        await explosionPromise; // 等待爆炸完成

        // *** 清理主爆炸容器定位樣式 ***
        DOM.containers.explosion.style.position = '';
        DOM.containers.explosion.style.top = '';
        DOM.containers.explosion.style.left = '';
        DOM.containers.explosion.style.width = '';
        DOM.containers.explosion.style.height = '';

        await delay(QUESTION_FADE_DURATION); // 等待淡出

        try {
            if (state.currentQuestionIndex < totalQuestions - 1) {
                await prepareNextQuestion();
            } else {
                await showResults();
            }
        } catch (error) {
            console.error("處理選項點擊後續步驟時出錯:", error);
            state.isBusy = false;
            console.log("[Unlock] handleOptionClick error in next step, set isBusy = false");
            await switchScreen('test', 'intro');
        }
        console.log("handleOptionClick 流程結束");
    }

    function triggerQuestionFadeOut(clickedOptionElement) {
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
    async function prepareNextQuestion() {
        console.log("準備下一題"); state.currentQuestionIndex++; updateProgressBar(state.currentQuestionIndex + 1);
        await displayQuestion(state.currentQuestionIndex, false);
    }
    function triggerQuestionEnterAnimation() {
        return new Promise(async (resolve) => {
            console.log("觸發問題入場動畫");
            if (!allOptions || allOptions.length === 0) {
                resolve();
                return;
            }

            let maxDelay = 0;
            allOptions.forEach((option, index) => {
                const delay = OPTIONS_ENTER_START_DELAY + index * OPTION_STAGGER_DELAY;
                maxDelay = Math.max(maxDelay, delay);
                option.style.transition = '';
                option.style.transitionDelay = `${delay}ms`;
                option.style.animationDelay = `${delay}ms`;
                option.classList.remove('is-hidden', 'fade-out', 'exploded');
                option.style.pointerEvents = '';
            });

            const totalAnimationTime = maxDelay + OPTION_ENTER_DURATION;
            await delay(totalAnimationTime + 100);

            allOptions.forEach(option => {
                 option.style.transitionDelay = '';
                 option.style.animationDelay = '';
            });

            console.log("問題入場動畫完成");
            resolve();
        });
    }
    function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / totalQuestions) * 100;
             DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
         }
    }
    function calculateResult() {
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
            console.warn("無法確定最高分類型（未知情況），返回默認結果 A");
            return results['A'];
        } catch (error) {
            console.error("計算結果時出錯:", error);
            return results['A'] || null;
        }
    }
    function prepareResultData(resultData) {
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
    async function showResults() {
         console.log("測驗結束，準備顯示結果...");
         try {
             const resultData = calculateResult(); if (!resultData) throw new Error("結果計算返回 null 或 undefined。");
             const dataPrepared = prepareResultData(resultData); if (!dataPrepared) throw new Error("結果數據準備或填充失敗。");
             await switchScreen('test', 'result');
         } catch (error) {
             console.error("顯示結果時出錯:", error); displayInitializationError("無法顯示測驗結果，請重試。"); await delay(2000); await switchScreen('test', 'intro');
         } finally {
             state.isBusy = false; console.log("[Unlock] showResults finished, set isBusy = false");
         }
    }
    function addTraitElement(type, starCount) {
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
    async function copyShareText() {
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
    function fallbackCopyText(text) {
         const textArea = document.createElement("textarea"); textArea.value = text;
         textArea.style.position = 'fixed'; textArea.style.top = '-9999px'; textArea.style.left = '-9999px';
         document.body.appendChild(textArea); textArea.focus(); textArea.select(); textArea.setSelectionRange(0, 99999);
         let success = false;
         try {
             success = document.execCommand('copy');
             if (success) {
                 console.log("分享文本已複製到剪貼板 (execCommand)");
                 if (DOM.buttons.copy) DOM.buttons.copy.textContent = '已複製!';
             } else {
                 console.error('使用 execCommand 複製失敗。');
                 if (DOM.buttons.copy) DOM.buttons.copy.textContent = '複製失敗';
             }
         } catch (err) {
             console.error('無法使用 execCommand 複製:', err);
             if (DOM.buttons.copy) DOM.buttons.copy.textContent = '複製失敗';
         }
         document.body.removeChild(textArea);
    }
    function bindStartButton() {
         if (DOM.buttons.start) {
             DOM.buttons.start.removeEventListener('click', handleStartTestClick);
             DOM.buttons.start.addEventListener('click', handleStartTestClick);
             console.log("開始測驗按鈕事件已綁定。");
         } else {
             console.error("無法綁定開始按鈕事件：按鈕元素未找到。");
             displayInitializationError("無法啟動測驗，關鍵按鈕丟失。");
         }
    }
    function bindOtherButtons() {
         if (DOM.buttons.restart) {
             DOM.buttons.restart.removeEventListener('click', handleRestartClick);
             DOM.buttons.restart.addEventListener('click', handleRestartClick);
         }
         if (DOM.buttons.copy) {
             DOM.buttons.copy.removeEventListener('click', copyShareText);
             DOM.buttons.copy.addEventListener('click', copyShareText);
         }
         console.log("其他按鈕（重新測驗、複製）事件已綁定。");
    }
    async function handleRestartClick() {
         console.log(`[Click] 重新測驗按鈕被點擊, isBusy: ${state.isBusy}`); if (state.isBusy) return;
         state.isBusy = true; console.log("[Lock] handleRestartClick set isBusy = true"); console.log("重新開始測驗...");
         try { await switchScreen('result', 'intro'); }
         catch (error) { console.error("重新測驗時切換屏幕出錯:", error); }
         finally { state.isBusy = false; console.log("[Unlock] handleRestartClick finished, set isBusy = false"); }
    }

    // --- 全局錯誤處理 ---
    window.addEventListener('error', function(event) {
         console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
         if (state.isBusy) { console.warn("因全局錯誤，嘗試解除 isBusy 狀態鎖。"); state.isBusy = false; }
    });
    window.addEventListener('unhandledrejection', function(event) {
         console.error('捕獲到未處理的 Promise rejection:', event.reason);
         if (state.isBusy) { console.warn("因未處理的 Promise rejection，嘗試解除 isBusy 狀態鎖。"); state.isBusy = false; }
    });

    // --- 初始化流程 ---
    console.log("開始執行初始化流程...");
    // const startTime = performance.now(); // startTime 在 preloadAndAnimate 中也用到
    setViewportHeight(); window.addEventListener('resize', setViewportHeight);
    if (!cacheDOMElements()) { console.error("DOM 元素緩存失敗，初始化中止。"); return; }
    try {
        state.isBusy = true; console.log("[Lock] Initialization start, set isBusy = true");
        await preloadAndAnimate(); await triggerIntroTransition();
        bindStartButton(); bindOtherButtons();
        state.isBusy = false; console.log("[Unlock] Initialization finished, set isBusy = false");
        const initializationEndTime = performance.now();
        console.log(`初始化流程完成，總耗時: ${(initializationEndTime - initializationStartTime).toFixed(0)}ms`);
    } catch (error) {
        console.error("初始化過程中發生錯誤:", error);
        displayInitializationError(`初始化失敗: ${error.message || '未知錯誤'}`);
        state.isBusy = false; console.log("[Unlock] Initialization error, set isBusy = false");
    }
    console.log("腳本初始化流程結束。");
});
