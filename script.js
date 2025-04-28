// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false, // General lock for transitions like screen switching, button clicks
        isTransitioning: false, // Specific lock for question-to-question transitions
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
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') { console.error("錯誤：找不到有效的 testData..."); displayInitializationError("無法載入測驗數據。"); return; }
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) { console.error("錯誤：testData.questions 不是有效的陣列或為空。"); displayInitializationError("測驗問題數據格式錯誤。"); return; }
    const questions = testData.questions;
    const results = testData.results || {};
    const traitNames = testData.traitNames || {};

    // --- Constants ---
    // 從 CSS 獲取 Preloader Path 退場動畫時長
    const PRELOADER_PATH_EXIT_DURATION_S = getComputedStyle(document.documentElement).getPropertyValue('--preloader-path-exit-duration').trim() || '0.8s';
    const PRELOADER_PATH_EXIT_DURATION = parseFloat(PRELOADER_PATH_EXIT_DURATION_S.replace('s','')) * 1000 || 800;
    // 重新計算 Preloader 額外延遲 (SVG動畫完成後 + 短暫停留)
    const SVG_BASE_DRAW_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-base-draw-duration').replace('s','')) * 1000 || 2500;
    const SVG_STAGGER_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-stagger-delay').replace('s','')) * 1000 || 150;
    const MAX_STAGGER_STEPS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--svg-max-stagger-steps')) || 4;
    const SVG_ANIMATION_TOTAL_ESTIMATED_TIME = SVG_BASE_DRAW_DURATION + (MAX_STAGGER_STEPS * SVG_STAGGER_DELAY);
    const PRELOADER_PAUSE_AFTER_SVG = 400; // SVG 動畫後的停留時間 (ms)
    const PRELOADER_EXTRA_DELAY = SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG;

    // 從 CSS 獲取 Intro 動畫時間
    const INTRO_FADEIN_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-delay').replace('s','')) * 1000 || 100;
    const INTRO_FADEIN_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-duration').replace('s','')) * 1000 || 1000;
    const INTRO_ANIMATION_TOTAL_TIME = INTRO_FADEIN_DELAY + INTRO_FADEIN_DURATION;

    const SCREEN_TRANSITION_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s','')) * 1000 || 600;
    const EXPLOSION_DURATION = 1000;
    const SVG_GLOW_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-glow-delay').replace('s','')) * 1000 || 3000;


    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }

    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('active');
        } else { document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; }
    }

    function cacheDOMElements() {
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
                     startBtnText: document.querySelector('#start-test .btn-text')
                 },
                 buttons: {
                     start: document.getElementById('start-test'),
                     copy: document.getElementById('copy-btn'),
                     restart: document.getElementById('restart-btn')
                 }
             };
             // Check critical elements
             const criticalElements = [
                 DOM.containers.intro, DOM.containers.test, DOM.containers.result,
                 DOM.containers.preloader, DOM.containers.options, DOM.containers.explosion,
                 DOM.containers.startBtnExplosion, DOM.containers.preloaderSvgContainer,
                 DOM.elements.preloaderSvg, DOM.elements.testBackground, DOM.elements.questionTitle,
                 DOM.elements.startBtnText, DOM.buttons.start
             ];
             // Check SVG Groups exist
             const mainTitleGroup = DOM.elements.preloaderSvg?.querySelector('#main-title-group');
             const engSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#eng-subtitle-group');
             const chnSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#chn-subtitle-group');
             if (!mainTitleGroup || !engSubtitleGroup || !chnSubtitleGroup) {
                 console.warn("警告：未能找到所有的 SVG Group ID (main-title-group, eng-subtitle-group, chn-subtitle-group)。請檢查 index.html。");
             }

             if (criticalElements.some(el => !el)) {
                 console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID。", DOM);
                 const missing = criticalElements.findIndex(el => !el);
                 console.error("Missing element index:", missing);
                 displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                 return false;
             }

             // --- Clone Preloader SVG for Intro Title ---
             if (DOM.elements.preloaderSvg && DOM.containers.intro) {
                 const introTitlePlaceholder = DOM.containers.intro.querySelector('.intro-title-placeholder');
                 if (introTitlePlaceholder) {
                     const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
                     clonedSvg.id = 'intro-title-svg';
                     clonedSvg.classList.remove('glow-active');
                     clonedSvg.style.animation = 'none';
                     clonedSvg.querySelectorAll('path, g').forEach(el => {
                         el.style.animation = 'none';
                         el.style.animationDelay = '0s';
                         el.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                         el.style.transform = '';
                         el.style.filter = '';
                         el.style.opacity = '';
                     });
                     introTitlePlaceholder.innerHTML = '';
                     introTitlePlaceholder.appendChild(clonedSvg);
                     console.log("Intro title SVG 已從 Preloader SVG 複製並插入");
                 } else { console.error("找不到 Intro title placeholder (.intro-title-placeholder)"); }
             } else { console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro container"); }
             // --- End SVG Cloning ---

             console.log("DOM 元素已快取");
             return true;
         } catch (error) {
             console.error("快取 DOM 元素時出錯:", error);
             displayInitializationError("頁面初始化時發生錯誤。");
             return false;
         }
    }

    // !! REVISED Function: triggerIntroTransition (隨機 Path 退場 - 添加 Class)
    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
            console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
            state.isAnimating = false;
            return;
        }
        if (state.isAnimating) {
            console.log("正在轉換 Intro，忽略重複觸發");
            return;
        }

        console.log("開始 Preloader 到 Intro 的轉場 (隨機 Path 退場 - 添加 Class)...");
        state.isAnimating = true; // Lock state

        // 移除光暈 & 入場動畫
        DOM.elements.preloaderSvg.classList.remove('glow-active');
        DOM.elements.preloaderSvg.style.animation = 'none'; // Stop entrance zoom immediately

        // 1. 獲取所有需要參與退場動畫的 Path 元素
        const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
             '#main-title-group .st0, #main-title-group .st1, #main-title-group .st2, #main-title-group .st4, #main-title-group .st5, #eng-subtitle-group path, #chn-subtitle-group path'
        );
        const preloaderBg = DOM.containers.preloader;

        if (pathsToExit.length === 0 && !preloaderBg) {
            console.error("錯誤：找不到任何需要退場的 Preloader Path 或背景。");
             DOM.containers.preloader.classList.remove('active');
             DOM.containers.intro.classList.add('active');
             state.introVisible = true;
             state.isAnimating = false;
             return;
        }
         if (pathsToExit.length === 0) {
            console.warn("警告：未找到 SVG paths 進行退場動畫，將只淡出背景。");
        }

        let maxDelay = 0;
        const baseExitDelay = 0; // 開始退場的基礎延遲 (ms)
        // !! INCREASED RANDOM RANGE !!
        const randomExitRange = 1000; // 隨機延遲的最大範圍 (ms) - 增加到 1000ms

        // 2. 為每個 Path 添加 is-exiting-* class 並設定隨機延遲
        pathsToExit.forEach(path => {
            // 清除可能殘留的繪製動畫 style (如果有的話)
            path.style.animation = '';
            path.style.opacity = ''; // Ensure opacity is not stuck at 0 from drawing
            path.style.visibility = 'visible'; // Ensure visible before starting exit

            const randomDelay = baseExitDelay + Math.random() * randomExitRange;
            maxDelay = Math.max(maxDelay, randomDelay);

            const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';

            // 使用 setTimeout 延遲添加 class
            setTimeout(() => {
                path.classList.add(exitClass);
                 // Apply animation delay directly via style for potentially more reliable timing
                 // Although class is added, setting delay via style overrides CSS delay if any
                 path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
            }, 0); // SetTimeout 0 to queue it after potential reflows

        });

        // 讓背景也淡出 (稍微延遲)
        if(preloaderBg) {
            setTimeout(() => {
                preloaderBg.classList.add('is-exiting-bg');
            }, baseExitDelay + randomExitRange * 0.2);
        }

        // 3. 計算何時所有退場動畫都結束
        // 注意：這裡的 totalExitTime 應該是 (最大隨機延遲 + 動畫本身時長)
        const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
        console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

        // 4. 在所有退場動畫結束後，激活 Intro
        setTimeout(() => {
            console.log("Preloader 所有 Path 退場動畫結束。");
            DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
            // 清理 Path 上的 is-exiting class 和 JS 添加的 style
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = '';
                path.style.animationDelay = '';
                path.style.opacity = '';
                path.style.transform = '';
                path.style.filter = '';
                path.style.visibility = '';
            });
             // 重置 SVG transform and animation state
             DOM.elements.preloaderSvg.style.animation = '';
             DOM.elements.preloaderSvg.style.transform = '';


            // 激活 Intro
            if (!state.introVisible) {
                 console.log("激活 Intro 容器...");
                 DOM.containers.intro.classList.add('active');
                 state.introVisible = true;
            }

            // 5. 解鎖狀態 - 在 Intro 動畫完成後
            const unlockDelay = INTRO_ANIMATION_TOTAL_TIME + 100;
            console.log(`預計在 ${unlockDelay}ms 後解除動畫鎖定`);

            setTimeout(() => {
                state.isAnimating = false; // Unlock state
                console.log("Intro 轉場完成且動畫應已結束，解除鎖定。");
            }, unlockDelay);

        }, totalExitTime); // 等待最長的元素退場時間結束
    }


    // Function: preloadImages (使用重新計算的延遲)
    function preloadImages() {
        if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) {
            console.warn("找不到 preloader 或 preloader SVG...");
            state.preloadComplete = true; bindStartButton(); return;
        }
        if (!questions || questions.length === 0) {
            console.warn("無法預載入圖片：缺少 questions...");
            state.preloadComplete = true; if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active'); bindStartButton(); return;
        }

        console.log("顯示 Preloader...");
        // Ensure any previous exit classes/styles are removed on restart
        DOM.containers.preloader.classList.remove('is-exiting-bg');
        DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
             p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
             p.style.animation = '';
             p.style.animationDelay = '';
             p.style.opacity = '';
             p.style.transform = '';
             p.style.filter = '';
             p.style.visibility = '';
        });
        // Reset SVG entrance animation and glow
        DOM.elements.preloaderSvg.style.animation = '';
        DOM.elements.preloaderSvg.style.transform = '';
        DOM.elements.preloaderSvg.classList.remove('glow-active');

        DOM.containers.preloader.classList.add('active'); // 激活 preloader

        // Start SVG glow after delay
        setTimeout(() => {
            if (DOM.containers.preloader.classList.contains('active') && DOM.elements.preloaderSvg) {
                 console.log("為 preloader SVG 添加光暈效果");
                 DOM.elements.preloaderSvg.classList.add('glow-active');
            }
        }, SVG_GLOW_DELAY);

        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0;
        const totalImages = imageUrls.length;
        let errorOccurred = false;

        function updateProgress(isError = false) {
            loadedCount++;
            if (isError) errorOccurred = true;

            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);

                // 使用重新計算的 PRELOADER_EXTRA_DELAY
                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待 SVG 動畫 + 停留 ${totalDelay.toFixed(0)}ms...`);

                setTimeout(() => {
                    if (DOM.containers.preloader && DOM.containers.preloader.classList.contains('active')) {
                        triggerIntroTransition(); // 觸發包含新退場動畫的轉場
                        bindStartButton();
                    } else {
                        console.log("Preloader no longer active, skipping transition.");
                         if (!state.introVisible && DOM.containers.intro) {
                             DOM.containers.intro.classList.add('active');
                             state.introVisible = true;
                             bindStartButton();
                        }
                    }
                }, totalDelay);
            }
        }

        imageUrls.forEach(url => {
             const img = new Image(); img.src = url;
             img.onload = () => updateProgress(false);
             img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); };
        });
    }

    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        if (!explosionContainer || !targetElement) { console.error("Explosion failed: Missing container or target element."); return; }
        explosionContainer.innerHTML = '';
        let startX = targetElement.offsetWidth / 2;
        let startY = targetElement.offsetHeight / 2;
        textToExplode.split('').forEach((char) => {
            if (char.trim() === '') return;
            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.5);
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 350 + 250;
            const rotateZ = (Math.random() - 0.5) * 480;
            const scale = Math.random() * 3.5 + 2.5;
            const delay = Math.random() * 0.15;
            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;
            explosionContainer.appendChild(span);
            setTimeout(() => { if (span.parentNode === explosionContainer) { explosionContainer.removeChild(span); } }, EXPLOSION_DURATION + delay * 1000 + 300);
        });
    }

    function handleStartTestClick() {
        if (!state.preloadComplete || !state.introVisible || state.isAnimating || state.isTransitioning) {
             console.warn("無法開始：狀態不符或動畫進行中");
             return;
         }
        state.isAnimating = true; state.isTransitioning = true;
        const buttonElement = DOM.buttons.start;
        const textElement = DOM.elements.startBtnText;
        const explosionContainer = DOM.containers.startBtnExplosion;
        const buttonText = textElement ? textElement.textContent : '開始測驗';
        if (!buttonElement || !explosionContainer) {
             console.error("啟動按鈕或爆炸容器缺失");
             state.isAnimating = false; state.isTransitioning = false; return;
         }
        buttonElement.classList.add('exploded'); buttonElement.style.pointerEvents = 'none';
        const buttonRect = buttonElement.getBoundingClientRect();
        const parentRect = explosionContainer.offsetParent ? explosionContainer.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();
        explosionContainer.style.position = 'absolute';
        explosionContainer.style.top = `${buttonRect.top - parentRect.top}px`;
        explosionContainer.style.left = `${buttonRect.left - parentRect.left}px`;
        explosionContainer.style.width = `${buttonRect.width}px`;
        explosionContainer.style.height = `${buttonRect.height}px`;
        requestAnimationFrame(() => {
            triggerExplosion(buttonElement, buttonText, explosionContainer);
            const switchDelay = EXPLOSION_DURATION * 0.8;
            setTimeout(() => {
                switchScreen('intro', 'test');
                setTimeout(() => {
                    buttonElement.classList.remove('exploded'); buttonElement.style.pointerEvents = '';
                    explosionContainer.style.position = '';
                    explosionContainer.style.top = ''; explosionContainer.style.left = '';
                    explosionContainer.style.width = ''; explosionContainer.style.height = '';
                }, SCREEN_TRANSITION_DURATION + 100);
            }, switchDelay);
        });
    }

    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
             console.error(`屏幕切換失敗: ${fromScreenId} -> ${toScreenId}`);
             state.isAnimating = false; state.isTransitioning = false; return;
         }
        if ((state.isAnimating || state.isTransitioning) && fromScreenId !== 'preloader') {
             console.log("忽略屏幕切換：動畫/轉換進行中");
             return;
         }
        console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);
        state.isAnimating = true; state.isTransitioning = true;
        fromScreen.classList.remove('active');
        setTimeout(() => {
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            if (toScreenId === 'test') {
                 initializeTestScreen();
                 state.contentRendered = true;
                 setTimeout(() => { state.isAnimating = false; console.log("屏幕切換至 Test 完成，解除 isAnimating"); }, SCREEN_TRANSITION_DURATION);
            } else {
                 if (toScreenId === 'intro') {
                     state.currentQuestionIndex = 0; state.userAnswers = []; state.finalScores = {};
                     state.contentRendered = false;
                     if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                     if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
                     if(DOM.containers.startBtnExplosion) {
                        DOM.containers.startBtnExplosion.style.position = ''; DOM.containers.startBtnExplosion.style.top = '';
                        DOM.containers.startBtnExplosion.style.left = ''; DOM.containers.startBtnExplosion.style.width = '';
                        DOM.containers.startBtnExplosion.style.height = '';
                     }
                     // Reset path styles on returning to intro
                     DOM.elements.preloaderSvg?.querySelectorAll('path').forEach(p => {
                         p.style.animation = '';
                         p.style.opacity = '';
                         p.style.transform = '';
                         p.style.filter = '';
                         p.style.visibility = '';
                     });
                     DOM.containers.preloader?.classList.remove('is-exiting-bg');
                     // Reset SVG zoom/glow
                     if(DOM.elements.preloaderSvg) {
                        DOM.elements.preloaderSvg.style.animation = '';
                        DOM.elements.preloaderSvg.style.transform = '';
                        DOM.elements.preloaderSvg.classList.remove('glow-active');
                     }
                 }
                 setTimeout(() => {
                     state.isAnimating = false; state.isTransitioning = false;
                     console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定`);
                 }, SCREEN_TRANSITION_DURATION);
            }
        }, SCREEN_TRANSITION_DURATION);
    }

    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) { return; }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0; state.userAnswers = [];
        updateProgressBar(0);
        displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1);
     }

    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) { return; }
        const questionData = questions[index]; const questionNumber = index + 1;
        state.isTransitioning = true;

        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            if (!isInitialDisplay) {
                DOM.elements.testBackground.classList.add('is-hidden');
                setTimeout(() => {
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    requestAnimationFrame(() => { DOM.elements.testBackground.classList.remove('is-hidden'); });
                }, 500);
            } else {
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                DOM.elements.testBackground.classList.remove('is-hidden');
            }
        }
        if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.add('is-hidden');
             setTimeout(() => {
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                 requestAnimationFrame(() => { DOM.elements.questionTitle.classList.remove('is-hidden'); });
             }, isInitialDisplay ? 100 : 500);
        }
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = '';
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option is-hidden'; optionElement.style.transition = 'none';
                optionElement.dataset.text = optionData.text; optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text; optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0;
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
            allOptions = Array.from(DOM.containers.options.querySelectorAll('.option'));
            setTimeout(() => triggerQuestionEnterAnimation(), isInitialDisplay ? 150 : 0);
        } else { state.isTransitioning = false; }
    }

     function handleOptionClick(event) {
         const clickedOption = event.currentTarget;
         const optionIndex = parseInt(clickedOption.dataset.index);
         const questionIndex = state.currentQuestionIndex;
         if (isNaN(optionIndex) || isNaN(questionIndex) || state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) { return; }
         state.isTransitioning = true;
         state.userAnswers[questionIndex] = optionIndex;
         const optionRect = clickedOption.getBoundingClientRect();
         const parentRect = DOM.containers.explosion.offsetParent ? DOM.containers.explosion.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();
         DOM.containers.explosion.style.position = 'absolute';
         DOM.containers.explosion.style.top = `${optionRect.top - parentRect.top}px`;
         DOM.containers.explosion.style.left = `${optionRect.left - parentRect.left}px`;
         DOM.containers.explosion.style.width = `${optionRect.width}px`;
         DOM.containers.explosion.style.height = `${optionRect.height}px`;
         triggerQuestionFadeOut(clickedOption);
         triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);
         const transitionDelay = EXPLOSION_DURATION + 100;
         setTimeout(() => {
             if (state.currentQuestionIndex < questions.length - 1) { prepareNextQuestion(); }
             else { showResults(); }
         }, transitionDelay);
     }

     function triggerQuestionFadeOut(clickedOptionElement) {
        if (DOM.elements.testBackground) { DOM.elements.testBackground.classList.add('is-hidden'); }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.add('is-hidden'); }
        allOptions.forEach(option => {
            option.style.transitionDelay = '';
            if (option === clickedOptionElement) { option.classList.add('exploded'); }
            else { option.classList.add('fade-out'); }
            option.style.pointerEvents = 'none';
        });
     }

     function prepareNextQuestion() {
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1);
        displayQuestion(state.currentQuestionIndex, false);
     }

     function triggerQuestionEnterAnimation() {
         if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.remove('is-hidden'); }
         const optionsEnterStartDelay = 200; const optionStaggerDelay = 80; const optionEnterDuration = 500;
         allOptions.forEach((option, index) => {
             option.style.transition = '';
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
             option.classList.remove('is-hidden', 'fade-out', 'exploded');
             requestAnimationFrame(() => { option.style.pointerEvents = ''; });
         });
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 100;
         setTimeout(() => {
             allOptions.forEach(option => { option.style.transitionDelay = ''; });
             state.isTransitioning = false;
             console.log("問題進場動畫完成，解除 isTransitioning");
         }, finalResetDelay);
    }

     function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / questions.length) * 100;
             DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
         }
    }

    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) { for (let i = 0; i < questions.length; i++) { if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; } }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question?.options?.[answerIndex]?.scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) { if (scores.hasOwnProperty(type)) { scores[type] += optionScores[type]; } }
                }
            });
            state.finalScores = scores;
            const scoreValues = Object.values(scores); const scoreFrequency = {};
            scoreValues.forEach(score => { const roundedScore = Math.round(score * 10) / 10; scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1; });
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) return results["SPECIAL"]; }
            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) { if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); } else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; } }
            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { return results["SPECIAL"]; }
            if (highestTypes.length === 2) {
                const tiebreakQuestionIndex = 8;
                if (state.userAnswers[tiebreakQuestionIndex] === undefined) { return results[highestTypes[0]]; }
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { return results[tiebreakPrimaryType]; }
                else { return results[highestTypes[0]]; }
            }
            return results['A'];
        } catch (error) { console.error("Error calculating result:", error); return results['A']; }
     }

    function prepareResultData(resultData) {
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) { return false; }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) { console.warn("無法計算特質分數"); }
            else if (resultData.title && resultData.title.includes('管理員')) { Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); }
            else { Object.keys(traitNames).forEach(type => { const score = typeScores[type] || 0; let stars = 1; if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2; addTraitElement(type, stars); }); }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            return true;
        } catch (error) { console.error("Error preparing result data:", error); DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; return false; }
     }

    function showResults() {
        if (state.isAnimating || state.isTransitioning) { return; }
        state.isTransitioning = true;
        try {
            const resultData = calculateResult(); if (!resultData) throw new Error("Result calculation failed");
            if (prepareResultData(resultData)) { switchScreen('test', 'result'); }
            else { throw new Error("Result data preparation failed"); }
        } catch (error) {
            console.error("Error showing results:", error); alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            state.isTransitioning = false; state.isAnimating = false;
            switchScreen('test', 'intro');
        }
     }

    function addTraitElement(type, starCount) {
        if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div'); traitElement.className = 'trait-item';
            const traitName = document.createElement('span'); traitName.className = 'trait-name'; traitName.textContent = traitNames[type] || type;
            const traitStars = document.createElement('span'); traitStars.className = 'trait-stars';
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);
            traitElement.appendChild(traitName); traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) { console.error(`Error adding trait ${type}:`, error); }
     }

    function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000); }).catch(err => { fallbackCopyText(textToCopy); });
            } else { fallbackCopyText(textToCopy); }
         } catch (error) { console.error("Copy error:", error); if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }
     }

    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text; textArea.style.position = 'fixed'; textArea.style.left = '-9999px';
        textArea.style.opacity = '0'; textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select(); textArea.setSelectionRange(0, 99999); let success = false;
        try {
            success = document.execCommand('copy');
            if (success) { if(DOM.buttons.copy) { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000); } }
            else { alert('複製失敗，瀏覽器不支援此操作。'); }
        } catch (err) { alert('複製失敗，請手動複製。'); }
        document.body.removeChild(textArea);
     }

    function bindStartButton() {
        if (DOM.buttons.start) {
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("Start button event bound.");
        } else { displayInitializationError("無法啟動測驗，按鈕丟失。"); }
    }

    function bindOtherButtons() {
        if (DOM.buttons.restart) { DOM.buttons.restart.removeEventListener('click', handleRestartClick); DOM.buttons.restart.addEventListener('click', handleRestartClick); }
        if (DOM.buttons.copy) { DOM.buttons.copy.removeEventListener('click', copyShareText); DOM.buttons.copy.addEventListener('click', copyShareText); }
     }

     function handleRestartClick() {
        if (state.isAnimating) { console.log("Animation in progress, cannot restart yet."); return; }
        switchScreen('result', 'intro');
     }

    window.addEventListener('error', function(event) {
         console.error("Global error caught:", event.error, "at:", event.filename, ":", event.lineno);
         state.isAnimating = false;
         state.isTransitioning = false;
    });

    // --- Initialization ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        preloadImages();
        bindOtherButtons();
    } else {
        console.error("DOM element caching failed, initialization incomplete.");
    }

    console.log("Script initialization complete.");
});