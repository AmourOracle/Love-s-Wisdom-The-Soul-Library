// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false, // 通用動畫鎖 (畫面切換、按鈕點擊等)
        isTransitioning: false, // 特定轉換鎖 (問題切換、Intro 轉場等)
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
    const PRELOADER_PATH_EXIT_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preloader-path-exit-duration').replace('s','')) * 1000 || 800;
    const SVG_BASE_DRAW_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-base-draw-duration').replace('s','')) * 1000 || 2500;
    const SVG_STAGGER_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-stagger-delay').replace('s','')) * 1000 || 150;
    const MAX_STAGGER_STEPS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--svg-max-stagger-steps')) || 4;
    const SVG_ANIMATION_TOTAL_ESTIMATED_TIME = SVG_BASE_DRAW_DURATION + (MAX_STAGGER_STEPS * SVG_STAGGER_DELAY);
    const PRELOADER_PAUSE_AFTER_SVG = 400;
    const PRELOADER_EXTRA_DELAY = SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG;
    const INTRO_FADEIN_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-delay').replace('s','')) * 1000 || 100;
    const INTRO_FADEIN_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-duration').replace('s','')) * 1000 || 1000;
    const INTRO_ANIMATION_TOTAL_TIME = INTRO_FADEIN_DELAY + INTRO_FADEIN_DURATION;
    const SCREEN_TRANSITION_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s','')) * 1000 || 600;
    const EXPLOSION_DURATION = 1000; // 雖然簡化了按鈕，但選項點擊仍使用
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
                     startBtnExplosion: document.getElementById('start-btn-explosion-container'), // 雖然簡化，但保留DOM引用
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
                     startBtnText: document.querySelector('#start-test .btn-text') // 雖然簡化，但保留DOM引用
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

    // !! REVISED Function: triggerIntroTransition
    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
            console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
            state.isAnimating = false;
            return;
        }
        if (state.isAnimating || state.isTransitioning) { // 檢查兩個鎖
            console.log("正在轉換 Intro，忽略重複觸發");
            return;
        }

        console.log("開始 Preloader 到 Intro 的轉場 (隨機 Path 退場 - 添加 Class)...");
        state.isAnimating = true; // Lock state
        state.isTransitioning = true; // 同時鎖定轉換狀態

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
             DOM.containers.preloader.style.display = 'none'; // 直接隱藏
             DOM.containers.intro.classList.add('active');
             state.introVisible = true;
             state.isAnimating = false;
             state.isTransitioning = false; // 解鎖
             return;
        }
         if (pathsToExit.length === 0) {
            console.warn("警告：未找到 SVG paths 進行退場動畫，將只淡出背景。");
        }

        let maxDelay = 0;
        const baseExitDelay = 0;
        const randomExitRange = 1000;

        // 2. 為每個 Path 添加 is-exiting-* class 並設定隨機延遲
        pathsToExit.forEach(path => {
            path.style.animation = ''; path.style.opacity = '';
            path.style.transform = ''; path.style.filter = '';
            path.style.visibility = '';

            const randomDelay = baseExitDelay + Math.random() * randomExitRange;
            maxDelay = Math.max(maxDelay, randomDelay);
            const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';

            setTimeout(() => {
                path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
                path.classList.add(exitClass);
            }, 5);
        });

        // 背景淡出
        if(preloaderBg) {
            setTimeout(() => {
                preloaderBg.classList.add('is-exiting-bg');
            }, baseExitDelay + randomExitRange * 0.2);
        }

        // 3. 計算何時所有退場動畫都結束
        const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
        console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

        // 4. 在所有退場動畫結束後，激活 Intro
        setTimeout(() => {
            console.log("Preloader 所有 Path 退場動畫結束。");
            if (DOM.containers.preloader) { // 檢查存在
                 DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                 DOM.containers.preloader.style.display = 'none'; // *** 新增：確保徹底隱藏 ***
            }
            // 清理 Path 上的 is-exiting class 和 JS 添加的 style
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = ''; path.style.animationDelay = '';
                path.style.opacity = ''; path.style.transform = '';
                path.style.filter = ''; path.style.visibility = '';
            });
             // 重置 SVG transform and animation state
             if(DOM.elements.preloaderSvg) { // 檢查存在
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.style.transform = '';
             }

            // 激活 Intro
            if (!state.introVisible && DOM.containers.intro) { // 檢查存在
                 console.log("激活 Intro 容器...");
                 DOM.containers.intro.classList.add('active');
                 state.introVisible = true;
            }

            // 5. 解鎖狀態 - 在 Intro 動畫完成後 (確保解鎖)
            const unlockDelay = INTRO_ANIMATION_TOTAL_TIME + 100; // 給Intro動畫一點緩衝時間
            console.log(`[DEBUG] 預計在 ${unlockDelay}ms 後解除狀態鎖。目前狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);

            setTimeout(() => {
                console.log("[DEBUG] 嘗試解除狀態鎖 (來自 triggerIntroTransition)...");
                console.log(`[DEBUG] 解鎖前狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);

                // *** 關鍵修正：同時解除 isAnimating 和 isTransitioning ***
                state.isAnimating = false;
                state.isTransitioning = false;

                console.log(`[DEBUG] 解鎖後狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
                console.log("Intro 轉場完成且動畫應已結束，解除鎖定。");
            }, unlockDelay); // 在 Intro 動畫時間後再解鎖

        }, totalExitTime); // 等待 Preloader 退場動畫結束
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
        // Ensure reset on restart
        if(DOM.containers.preloader) {
            DOM.containers.preloader.classList.remove('is-exiting-bg');
            DOM.containers.preloader.style.display = ''; // *** 新增：重設 display ***
        }
        if (DOM.elements.preloaderSvg) {
            DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
                 p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                 p.style.animation = ''; p.style.animationDelay = '';
                 p.style.opacity = ''; p.style.transform = '';
                 p.style.filter = ''; p.style.visibility = '';
            });
            DOM.elements.preloaderSvg.style.animation = '';
            DOM.elements.preloaderSvg.style.transform = '';
            DOM.elements.preloaderSvg.classList.remove('glow-active');
        }

        DOM.containers.preloader.classList.add('active'); // 激活 preloader

        // Start SVG glow after delay
        setTimeout(() => {
            if (DOM.containers.preloader?.classList.contains('active') && DOM.elements.preloaderSvg) {
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

                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待 SVG 動畫 + 停留 ${totalDelay.toFixed(0)}ms...`);

                setTimeout(() => {
                    if (DOM.containers.preloader?.classList.contains('active')) {
                        triggerIntroTransition(); // 觸發包含新退場動畫和正確解鎖的轉場
                        bindStartButton();
                    } else {
                        console.log("Preloader no longer active, skipping transition.");
                         if (!state.introVisible && DOM.containers.intro) {
                             DOM.containers.intro.classList.add('active');
                             state.introVisible = true;
                             // 即使跳過轉場，也要確保狀態解鎖
                             state.isAnimating = false;
                             state.isTransitioning = false;
                             console.log("直接顯示 Intro，解除鎖定。");
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

    // 雖然簡化了按鈕，但選項點擊仍使用
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

    // *** 簡化後的按鈕點擊處理函數 ***
    function handleStartTestClick() {
        // 檢查：確保圖片預載入完成、Intro 可見，且沒有其他動畫或轉場正在進行
        if (!state.preloadComplete || !state.introVisible || state.isAnimating || state.isTransitioning) {
             console.warn("無法開始：狀態不符或動畫進行中 (preloadComplete:", state.preloadComplete, ", introVisible:", state.introVisible, ", isAnimating:", state.isAnimating, ", isTransitioning:", state.isTransitioning, ")");
             return; // 如果條件不符，則不執行後續操作
         }

        console.log("開始按鈕被點擊，準備切換畫面...");

        // 設置狀態旗標，表示即將開始轉場
        state.isAnimating = true;
        state.isTransitioning = true; // 開始轉場時，兩個都鎖定

        // 直接調用畫面切換函數，從 'intro' 切換到 'test'
        switchScreen('intro', 'test');
    }
    // *** 結束簡化後的按鈕點擊處理函數 ***

    // !! REVISED Function: switchScreen (加強解鎖邏輯)
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
             console.error(`屏幕切換失敗: ${fromScreenId} -> ${toScreenId}`);
             state.isAnimating = false; state.isTransitioning = false; return;
         }
        // 這裡的檢查可能需要保留，以防止在切換過程中再次觸發切換
        if ((state.isAnimating || state.isTransitioning) && fromScreenId !== 'preloader') {
             console.log("忽略屏幕切換：動畫/轉換進行中");
             return;
         }
        console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);
        // 開始切換前鎖定狀態 (如果之前沒有鎖定)
        state.isAnimating = true;
        state.isTransitioning = true;

        fromScreen.classList.remove('active'); // 開始隱藏舊屏幕

        // 等待 CSS 過渡動畫時間
        setTimeout(() => {
            toScreen.classList.add('active'); // 顯示新屏幕
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            // 根據目標屏幕執行特定邏輯
            if (toScreenId === 'test') {
                 initializeTestScreen(); // 初始化測驗界面
                 state.contentRendered = true;
                 // 在 test 屏幕動畫完成後解鎖 (注意: initializeTestScreen 內部有自己的 isTransitioning 控制)
                 // 這裡主要解除 isAnimating
                 setTimeout(() => {
                     state.isAnimating = false;
                     // isTransitioning 由 initializeTestScreen -> displayQuestion -> triggerQuestionEnterAnimation 控制
                     console.log("屏幕切換至 Test 完成，解除 isAnimating (isTransitioning 由問題動畫控制)");
                 }, SCREEN_TRANSITION_DURATION); // 等待 test 屏幕的 CSS 過渡完成
            } else if (toScreenId === 'intro') {
                 // 重置狀態和界面元素
                 state.currentQuestionIndex = 0; state.userAnswers = []; state.finalScores = {};
                 state.contentRendered = false;
                 if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                 if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
                 if(DOM.containers.startBtnExplosion) { // 重置爆炸容器樣式 (雖然簡化但保留)
                    DOM.containers.startBtnExplosion.style.position = ''; DOM.containers.startBtnExplosion.style.top = '';
                    DOM.containers.startBtnExplosion.style.left = ''; DOM.containers.startBtnExplosion.style.width = '';
                    DOM.containers.startBtnExplosion.style.height = '';
                 }
                 // Reset preloader display style for potential restart
                 if(DOM.containers.preloader) {
                     DOM.containers.preloader.style.display = ''; // *** 確保重設 display ***
                 }
                 // 重置 Preloader SVG 樣式 (如果需要重新顯示 Preloader 的話)
                 DOM.elements.preloaderSvg?.querySelectorAll('path').forEach(p => {
                     p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                     p.style.animation = ''; p.style.animationDelay = '';
                     p.style.opacity = ''; p.style.transform = '';
                     p.style.filter = ''; p.style.visibility = '';
                 });
                 DOM.containers.preloader?.classList.remove('is-exiting-bg');
                 if(DOM.elements.preloaderSvg) {
                    DOM.elements.preloaderSvg.style.animation = '';
                    DOM.elements.preloaderSvg.style.transform = '';
                    DOM.elements.preloaderSvg.classList.remove('glow-active');
                 }
                 // 解鎖狀態 (切換回 Intro 時，確保兩個都解鎖)
                 setTimeout(() => {
                     state.isAnimating = false;
                     state.isTransitioning = false;
                     console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定`);
                 }, SCREEN_TRANSITION_DURATION); // 等待 intro 屏幕的 CSS 過渡完成
            } else {
                 // 其他屏幕 (如 result) 切換完成後解鎖
                 setTimeout(() => {
                     state.isAnimating = false;
                     state.isTransitioning = false;
                     console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定`);
                 }, SCREEN_TRANSITION_DURATION); // 等待目標屏幕的 CSS 過渡完成
            }
        }, SCREEN_TRANSITION_DURATION); // 等待舊屏幕的 CSS 過渡完成
    }

    // (initializeTestScreen, displayQuestion, handleOptionClick, etc. ... 保持不變)
    // ... 省略其他未修改的函數 ...

    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) { return; }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0; state.userAnswers = [];
        updateProgressBar(0); // 重置進度條
        displayQuestion(state.currentQuestionIndex, true); // 顯示第一題 (標記為首次顯示)
        updateProgressBar(1); // 更新進度條到第一題
     }

    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) {
            console.error("無效的問題索引:", index);
            return;
        }
        const questionData = questions[index];
        const questionNumber = index + 1;
        console.log(`顯示問題 ${questionNumber}`);
        state.isTransitioning = true; // 開始問題轉換

        // 更新背景圖片
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            if (!isInitialDisplay) {
                // 非首次顯示，先隱藏再更換背景，然後淡入
                DOM.elements.testBackground.classList.add('is-hidden');
                setTimeout(() => {
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    requestAnimationFrame(() => { DOM.elements.testBackground.classList.remove('is-hidden'); });
                }, 500); // 等待隱藏動畫
            } else {
                // 首次顯示，直接設置背景並顯示
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                DOM.elements.testBackground.classList.remove('is-hidden');
            }
        }

        // 更新問題標題
        if (DOM.elements.questionTitle) {
             // 先隱藏
             DOM.elements.questionTitle.classList.add('is-hidden');
             // 延遲更新文本並顯示
             setTimeout(() => {
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, ''); // 移除前面的數字
                 requestAnimationFrame(() => { DOM.elements.questionTitle.classList.remove('is-hidden'); });
             }, isInitialDisplay ? 100 : 500); // 首次顯示延遲短，後續延遲長
        }

        // 生成選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // 清空舊選項
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option is-hidden'; // 初始隱藏
                optionElement.style.transition = 'none'; // 初始移除過渡效果，防止閃爍
                optionElement.dataset.text = optionData.text; // 存儲文本用於爆炸效果
                optionElement.dataset.index = optIndex; // 存儲選項索引
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0; // 使其可通過鍵盤聚焦
                // 綁定事件監聽器
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
            // 獲取所有新生成的選項元素
            allOptions = Array.from(DOM.containers.options.querySelectorAll('.option'));
            // 觸發選項入場動畫
            setTimeout(() => triggerQuestionEnterAnimation(), isInitialDisplay ? 150 : 0); // 首次顯示稍微延遲
        } else {
            state.isTransitioning = false; // 如果沒有選項容器，直接解除鎖定
            console.error("找不到選項容器 #options-container");
        }
    }

     function handleOptionClick(event) {
         const clickedOption = event.currentTarget;
         const optionIndex = parseInt(clickedOption.dataset.index);
         const questionIndex = state.currentQuestionIndex;

         // 防止重複點擊或在轉換過程中點擊
         if (isNaN(optionIndex) || isNaN(questionIndex) || state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
             console.log("忽略選項點擊：狀態不符或動畫進行中");
             return;
         }

         console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
         state.isTransitioning = true; // 開始轉換
         state.userAnswers[questionIndex] = optionIndex; // 記錄答案

         // 定位爆炸效果容器
         const optionRect = clickedOption.getBoundingClientRect();
         const parentRect = DOM.containers.explosion.offsetParent ? DOM.containers.explosion.offsetParent.getBoundingClientRect() : document.body.getBoundingClientRect();
         DOM.containers.explosion.style.position = 'absolute';
         DOM.containers.explosion.style.top = `${optionRect.top - parentRect.top}px`;
         DOM.containers.explosion.style.left = `${optionRect.left - parentRect.left}px`;
         DOM.containers.explosion.style.width = `${optionRect.width}px`;
         DOM.containers.explosion.style.height = `${optionRect.height}px`;

         // 觸發當前問題的退場動畫和爆炸效果
         triggerQuestionFadeOut(clickedOption);
         triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);

         // 在爆炸效果和退場動畫大致結束後，處理下一題或顯示結果
         const transitionDelay = EXPLOSION_DURATION + 100; // 略長於爆炸動畫時間
         setTimeout(() => {
             if (state.currentQuestionIndex < questions.length - 1) {
                 prepareNextQuestion(); // 準備下一題
             }
             else {
                 showResults(); // 顯示結果
             }
             // 清理爆炸容器位置信息
             DOM.containers.explosion.style.position = '';
             DOM.containers.explosion.style.top = '';
             DOM.containers.explosion.style.left = '';
             DOM.containers.explosion.style.width = '';
             DOM.containers.explosion.style.height = '';
         }, transitionDelay);
     }

     // 觸發當前問題元素（背景、標題、選項）的退場動畫
     function triggerQuestionFadeOut(clickedOptionElement) {
        console.log("觸發問題退場動畫");
        if (DOM.elements.testBackground) { DOM.elements.testBackground.classList.add('is-hidden'); }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.add('is-hidden'); }
        // 處理所有選項
        allOptions.forEach(option => {
            option.style.transitionDelay = ''; // 清除入場延遲
            if (option === clickedOptionElement) {
                option.classList.add('exploded'); // 被點擊的選項使用 exploded 效果
            } else {
                option.classList.add('fade-out'); // 其他選項使用 fade-out 效果
            }
            option.style.pointerEvents = 'none'; // 禁用指針事件
        });
     }

     // 準備並顯示下一題
     function prepareNextQuestion() {
        console.log("準備下一題");
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1); // 更新進度條
        displayQuestion(state.currentQuestionIndex, false); // 顯示下一題 (非首次)
     }

     // 觸發新問題元素的入場動畫
     function triggerQuestionEnterAnimation() {
         console.log("觸發問題入場動畫");
         // 標題入場
         if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.remove('is-hidden');
         }
         // 選項錯開入場
         const optionsEnterStartDelay = 200; // 選項開始入場的延遲
         const optionStaggerDelay = 80;    // 每個選項之間的入場延遲
         const optionEnterDuration = 500;   // 選項入場動畫時長 (CSS中定義)

         allOptions.forEach((option, index) => {
             option.style.transition = ''; // 確保使用CSS定義的過渡
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`; // 設置錯開延遲
             option.classList.remove('is-hidden', 'fade-out', 'exploded'); // 移除隱藏和退場樣式
             requestAnimationFrame(() => { option.style.pointerEvents = ''; }); // 恢復指針事件
         });

         // 計算總延遲，並在所有動畫結束後解除 isTransitioning 鎖
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 100; // 加一點緩衝

         setTimeout(() => {
             // 清除為入場動畫設置的 transition-delay
             allOptions.forEach(option => { option.style.transitionDelay = ''; });
             state.isTransitioning = false; // 解除問題轉換鎖
             console.log("問題進場動畫完成，解除 isTransitioning");
         }, finalResetDelay);
    }

     // 更新進度條顯示
     function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / questions.length) * 100;
             DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
         }
    }

    // 計算測驗結果
    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            // 如果用戶未完成所有題目，用默認值填充（這裡假設未選為0分影響，或者可以設為特定索引）
            if (state.userAnswers.length !== questions.length) {
                console.warn("用戶答案數量與問題數量不符，可能未完成測驗。");
                for (let i = 0; i < questions.length; i++) {
                    if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; // 或其他默認處理
                }
            }
            // 計算分數
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question?.options?.[answerIndex]?.scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) {
                        if (scores.hasOwnProperty(type)) {
                            scores[type] += optionScores[type];
                        }
                    }
                } else {
                     console.warn(`問題 ${questionIndex + 1} 的選項 ${answerIndex + 1} 缺少分數數據。`);
                }
            });
            state.finalScores = scores; // 保存最終分數
            console.log("計算出的原始分數:", scores);

            // 特殊結果判斷 (分數集中)
            const scoreValues = Object.values(scores);
            const scoreFrequency = {};
            scoreValues.forEach(score => {
                const roundedScore = Math.round(score * 10) / 10; // 處理可能的浮點數精度問題
                scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1;
            });
            console.log("分數頻率:", scoreFrequency);
            for (const score in scoreFrequency) {
                if (scoreFrequency[score] >= 4) { // 如果有4個或以上特質分數相同
                    console.log("觸發特殊結果：分數高度集中");
                    return results["SPECIAL"];
                }
            }

            // 找出最高分
            let maxScore = -Infinity;
            let highestTypes = [];
            for (const type in scores) {
                if (Math.abs(scores[type] - maxScore) < 0.01) { // 處理浮點數比較
                    highestTypes.push(type);
                } else if (scores[type] > maxScore) {
                    maxScore = scores[type];
                    highestTypes = [type];
                }
            }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);

            // 處理結果
            if (highestTypes.length === 1) {
                return results[highestTypes[0]]; // 單一最高分
            }
            if (highestTypes.length >= 3) { // 三個或以上同分，特殊結果
                console.log("觸發特殊結果：多個類型同為最高分 (>=3)");
                return results["SPECIAL"];
            }
            if (highestTypes.length === 2) { // 兩個同分，需要 tie-breaker
                console.log("兩個類型同為最高分，使用 Tie-breaker...");
                const tiebreakQuestionIndex = 8; // 第9題 (索引為8) 作為 tie-breaker
                if (state.userAnswers[tiebreakQuestionIndex] === undefined) {
                    console.warn("Tie-breaker 問題未回答，默認選擇第一個最高分類型");
                    return results[highestTypes[0]]; // 如果 tie-breaker 問題未回答，默認返回第一個
                }
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) {
                    console.log("Tie-breaker 解決，結果為:", tiebreakPrimaryType);
                    return results[tiebreakPrimaryType]; // tie-breaker 答案的主要類型是最高分之一
                } else {
                    console.log("Tie-breaker 未解決或無效，默認選擇第一個最高分類型");
                    return results[highestTypes[0]]; // tie-breaker 答案的主要類型不是最高分之一，或無 primary 屬性，默認返回第一個
                }
            }
            // 預防性：如果所有邏輯都未返回，返回默認結果 A
            console.warn("無法確定最高分類型，返回默認結果 A");
            return results['A'];
        } catch (error) {
            console.error("計算結果時出錯:", error);
            return results['A']; // 出錯時返回默認結果
        }
     }

    // 準備結果頁面的數據並填充到 DOM
    function prepareResultData(resultData) {
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
             console.error("準備結果數據失敗：缺少必要的 DOM 元素或結果數據。");
             return false;
        }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            // 清空舊特質
            DOM.elements.traitsContainer.innerHTML = '';
            // 顯示特質分數
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法顯示特質分數：缺少分數數據");
            } else if (resultData.title && resultData.title.includes('管理員')) {
                // 特殊結果顯示所有特質為中等
                Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); // 假設3星為中等
            } else {
                // 根據分數計算星級
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0;
                    let stars = 1; // 默認1星
                    if (score >= 7) stars = 5;
                    else if (score >= 5) stars = 4;
                    else if (score >= 3) stars = 3;
                    else if (score >= 1) stars = 2;
                    addTraitElement(type, stars);
                });
            }
            // 填充相似和互補書籍
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            // 填充分享文本
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';

            console.log("結果數據已準備並填充到頁面");
            return true;
        } catch (error) {
            console.error("準備結果數據時發生錯誤:", error);
            if (DOM.elements.resultTitle) DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤";
            return false;
        }
     }

    // 計算結果並切換到結果屏幕
    function showResults() {
        console.log("測驗結束，準備顯示結果...");
        // 確保不在轉換中
        if (state.isAnimating || state.isTransitioning) {
            console.warn("忽略顯示結果：動畫/轉換進行中");
            return;
        }
        state.isTransitioning = true; // 開始顯示結果的轉換過程

        try {
            const resultData = calculateResult(); // 計算結果
            if (!resultData) {
                throw new Error("結果計算失敗，返回了無效數據");
            }
            // 準備結果數據並填充 DOM
            if (prepareResultData(resultData)) {
                // 切換到結果屏幕
                switchScreen('test', 'result');
            } else {
                throw new Error("結果數據準備或填充失敗");
            }
        } catch (error) {
            console.error("顯示結果時出錯:", error);
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            // 出錯時嘗試回退到 Intro 頁面
            state.isTransitioning = false; // 解除鎖定以便切換
            state.isAnimating = false;
            switchScreen('test', 'intro');
        }
        // 注意：狀態解鎖由 switchScreen 處理
     }

    // 添加一個特質及其星級到結果頁面
    function addTraitElement(type, starCount) {
        if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';

            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            traitName.textContent = traitNames[type] || type; // 使用 traitNames 中的名稱

            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            const validStars = Math.max(0, Math.min(5, Math.round(starCount))); // 確保星數在0-5之間
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars); // 生成星號

            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error(`添加特質 ${type} 時出錯:`, error);
        }
     }

    // 複製分享文本到剪貼板
    function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) { // 優先使用 Clipboard API
                navigator.clipboard.writeText(textToCopy).then(() => {
                    DOM.buttons.copy.textContent = '已複製!';
                    setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000); // 2秒後恢復按鈕文字
                }).catch(err => {
                    console.warn("Clipboard API 複製失敗:", err);
                    fallbackCopyText(textToCopy); // 失敗時嘗試舊方法
                });
            } else {
                fallbackCopyText(textToCopy); // 不支持 Clipboard API 時使用舊方法
            }
         } catch (error) {
             console.error("複製分享文本時出錯:", error);
             if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; // 出錯時恢復按鈕文字
         }
     }

    // 舊版瀏覽器的複製文本方法
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // 避免在屏幕上顯示
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', ''); // 設置為只讀避免觸發鍵盤
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices

        let success = false;
        try {
            success = document.execCommand('copy');
            if (success) {
                if(DOM.buttons.copy) {
                    DOM.buttons.copy.textContent = '已複製!';
                    setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000);
                }
            } else {
                alert('複製失敗，您的瀏覽器可能不支援此操作。');
            }
        } catch (err) {
            console.error("fallbackCopyText 錯誤:", err);
            alert('複製失敗，請手動複製文本。');
        }
        document.body.removeChild(textArea); // 移除臨時元素
     }

    // 綁定開始按鈕事件
    function bindStartButton() {
        if (DOM.buttons.start) {
            // 先移除舊的監聽器，防止重複綁定
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            // 綁定新的監聽器
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("開始測驗按鈕事件已綁定。");
        } else {
            console.error("無法綁定開始按鈕事件：按鈕元素未找到。");
            displayInitializationError("無法啟動測驗，關鍵按鈕丟失。");
        }
    }

    // 綁定其他按鈕事件 (複製、重新開始)
    function bindOtherButtons() {
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

     // 處理重新開始按鈕點擊
     function handleRestartClick() {
        // 防止在動畫過程中觸發
        if (state.isAnimating || state.isTransitioning) {
            console.log("動畫/轉換進行中，暫時無法重新開始。");
            return;
        }
        console.log("重新開始測驗...");
        switchScreen('result', 'intro'); // 從結果頁切換回介紹頁
     }

    // 全局錯誤處理
    window.addEventListener('error', function(event) {
         console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
         // 嘗試解除狀態鎖，防止卡死
         state.isAnimating = false;
         state.isTransitioning = false;
         // 可以在這裡添加更友好的用戶提示
    });
    window.addEventListener('unhandledrejection', function(event) {
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        state.isAnimating = false;
        state.isTransitioning = false;
    });


    // --- Initialization ---
    console.log("開始初始化...");
    setViewportHeight(); // 設置視口高度變量
    window.addEventListener('resize', setViewportHeight); // 監聽窗口大小變化

    if (cacheDOMElements()) { // 緩存 DOM 元素
        preloadImages(); // 預載入圖片並處理 Preloader 動畫和轉場
        bindOtherButtons(); // 綁定複製和重新開始按鈕
        // 注意：bindStartButton 會在 preloadImages 完成後被調用
    } else {
        console.error("DOM 元素緩存失敗，初始化中止。");
    }

    console.log("腳本初始化流程結束。");
});