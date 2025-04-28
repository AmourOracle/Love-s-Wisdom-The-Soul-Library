// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false,
        isTransitioning: false,
        currentQuestionIndex: 0,
        userAnswers: [],
        preloadComplete: false,
        introVisible: false,
        resultShowing: false,
        contentRendered: false,
        finalScores: {},
        // lastLockTime: null, // 從上個版本移除，使用 lockStartTime
        lockStartTime: null // 新增：用於全局狀態檢查的時間戳
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
    // (保持不變)
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

    // 使用上個版本修改後的 triggerIntroTransition，確保解鎖邏輯
    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
            console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
            state.isAnimating = false; state.isTransitioning = false;
            return;
        }
        if (state.isAnimating || state.isTransitioning) {
            console.log("正在轉換 Intro，忽略重複觸發");
            return;
        }
        console.log("開始 Preloader 到 Intro 的轉場...");
        state.isAnimating = true; state.isTransitioning = true;
        state.lockStartTime = new Date().getTime(); // 更新鎖定時間

        DOM.elements.preloaderSvg.classList.remove('glow-active');
        DOM.elements.preloaderSvg.style.animation = 'none';

        const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
             '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path'
        );
        const preloaderBg = DOM.containers.preloader;

        if (pathsToExit.length === 0 && !preloaderBg) {
            console.error("錯誤：找不到任何需要退場的 Preloader Path 或背景。");
             if (DOM.containers.preloader) {
                 DOM.containers.preloader.classList.remove('active');
                 DOM.containers.preloader.style.display = 'none';
             }
             if (DOM.containers.intro) DOM.containers.intro.classList.add('active');
             state.introVisible = true;
             state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
             return;
        }
         if (pathsToExit.length === 0) { /* ... */ }

        let maxDelay = 0;
        const baseExitDelay = 0;
        const randomExitRange = 1000;

        pathsToExit.forEach(path => { /* ... path 退場動畫 ... */
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

        if(preloaderBg) { /* ... 背景淡出 ... */
             setTimeout(() => {
                 preloaderBg.classList.add('is-exiting-bg');
             }, baseExitDelay + randomExitRange * 0.2);
        }

        const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
        console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

        setTimeout(() => { /* ... Preloader 退場後執行 ... */
             console.log("Preloader 所有 Path 退場動畫結束。");
             if (DOM.containers.preloader) {
                  DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                  DOM.containers.preloader.style.display = 'none';
             }
             pathsToExit.forEach(path => { /* ... 清理 Path 樣式 ... */
                 path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                 path.style.animation = ''; path.style.animationDelay = '';
                 path.style.opacity = ''; path.style.transform = '';
                 path.style.filter = ''; path.style.visibility = '';
             });
              if(DOM.elements.preloaderSvg) { /* ... 重置 SVG 樣式 ... */
                 DOM.elements.preloaderSvg.style.animation = '';
                 DOM.elements.preloaderSvg.style.transform = '';
              }
             if (!state.introVisible && DOM.containers.intro) { /* ... 激活 Intro ... */
                  console.log("激活 Intro 容器...");
                  DOM.containers.intro.classList.add('active');
                  state.introVisible = true;
             }
        }, totalExitTime);

        // 使用單一的計時器確保解鎖
        const totalTransitionTime = totalExitTime + INTRO_ANIMATION_TOTAL_TIME + 100;
        console.log(`[修復] 預計在 ${totalTransitionTime}ms 後執行最終解鎖 (來自 triggerIntroTransition)`);
        setTimeout(() => {
            if (state.isAnimating || state.isTransitioning) {
                 console.log("[修復] 確保解除所有狀態鎖 (來自 triggerIntroTransition 計時器)...");
                 state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null; // 解鎖並重置時間戳
                 console.log(`[修復] 解鎖後狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
            } else {
                console.log("[修復] 狀態已被提前解除，無需操作 (來自 triggerIntroTransition 計時器)");
            }
        }, totalTransitionTime);
    }

    // 使用上個版本修改後的 preloadImages，包含全局安全計時器
    function preloadImages() {
        if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) { /* ... */ return; }
        if (!questions || questions.length === 0) { /* ... */ return; }
        console.log("顯示 Preloader...");
        // 重置樣式...
        if(DOM.containers.preloader) {
            DOM.containers.preloader.classList.remove('is-exiting-bg');
            DOM.containers.preloader.style.display = '';
        }
        if (DOM.elements.preloaderSvg) {
             DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
                  p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                  p.style.animation = ''; p.style.animationDelay = ''; p.style.opacity = '';
                  p.style.transform = ''; p.style.filter = ''; p.style.visibility = '';
             });
             DOM.elements.preloaderSvg.style.animation = '';
             DOM.elements.preloaderSvg.style.transform = '';
             DOM.elements.preloaderSvg.classList.remove('glow-active');
        }
        DOM.containers.preloader.classList.add('active');
        setTimeout(() => { /* ... 添加光暈 ... */ }, SVG_GLOW_DELAY);

        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0; const totalImages = imageUrls.length; let errorOccurred = false;

        function updateProgress(isError = false) {
            loadedCount++; if (isError) errorOccurred = true;
            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);
                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待 SVG 動畫 + 停留 ${totalDelay.toFixed(0)}ms...`);
                setTimeout(() => {
                    if (DOM.containers.preloader?.classList.contains('active')) {
                        triggerIntroTransition(); bindStartButton();
                    } else { /* ... 直接顯示 Intro ... */
                        console.log("Preloader no longer active, skipping transition.");
                         if (!state.introVisible && DOM.containers.intro) {
                             DOM.containers.intro.classList.add('active');
                             state.introVisible = true;
                             state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
                             console.log("直接顯示 Intro，解除鎖定。");
                             bindStartButton();
                        }
                    }
                }, totalDelay);
            }
        }
        imageUrls.forEach(url => { /* ... 載入圖片 ... */
            const img = new Image(); img.src = url;
            img.onload = () => updateProgress(false);
            img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); };
        });

        // 全局安全計時器
        setTimeout(() => {
            if (state.isAnimating || state.isTransitioning) {
                console.log("[全局安全機制] 預載入後20秒仍有狀態鎖，強制解除");
                state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
            }
        }, 20000);
    }

    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        // (保持不變)
        if (!explosionContainer || !targetElement) { console.error("Explosion failed: Missing container or target element."); return; }
        explosionContainer.innerHTML = '';
        let startX = targetElement.offsetWidth / 2; let startY = targetElement.offsetHeight / 2;
        textToExplode.split('').forEach((char) => {
            if (char.trim() === '') return;
            const span = document.createElement('span'); span.textContent = char; span.className = `char-explode`;
            const angle = Math.random() * Math.PI * 2; const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.5);
            const translateX = Math.cos(angle) * radius; const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 350 + 250; const rotateZ = (Math.random() - 0.5) * 480;
            const scale = Math.random() * 3.5 + 2.5; const delay = Math.random() * 0.15;
            span.style.left = `${startX}px`; span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`); span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`); span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`); span.style.animationDelay = `${delay}s`;
            explosionContainer.appendChild(span);
            setTimeout(() => { if (span.parentNode === explosionContainer) { explosionContainer.removeChild(span); } }, EXPLOSION_DURATION + delay * 1000 + 300);
        });
    }

    // *** 使用者提供的修改後的 handleStartTestClick ***
    // 替換整個 handleStartTestClick 函數，使其更加健壯
    function handleStartTestClick() {
        console.log("[診斷] 開始按鈕被點擊，當前狀態：", {
            preloadComplete: state.preloadComplete,
            introVisible: state.introVisible,
            isAnimating: state.isAnimating,
            isTransitioning: state.isTransitioning
        });

        // 強制重置狀態鎖 - 這是關鍵修復
        console.log("[診斷] 強制重置 isAnimating 和 isTransitioning 為 false");
        state.isAnimating = false;
        state.isTransitioning = false;

        // 確保其他必要狀態設置正確
        if (!state.preloadComplete) {
            console.warn("[診斷] preloadComplete 為 false，強制設為 true");
            state.preloadComplete = true;
        }
        if (!state.introVisible) {
             console.warn("[診斷] introVisible 為 false，強制設為 true");
             state.introVisible = true;
             if (DOM.containers.intro) DOM.containers.intro.classList.add('active'); // 確保 DOM 同步
        }

        console.log("[診斷] 已重置狀態鎖，準備切換畫面");

        // 切換到測驗頁面前再次加鎖
        state.isAnimating = true;
        state.isTransitioning = true;
        state.lockStartTime = new Date().getTime(); // 更新鎖定時間戳

        // 直接調用畫面切換函數
        switchScreen('intro', 'test');
    }

    // *** 使用者提供的修改後的 switchScreen ***
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
             console.error(`屏幕切換失敗: ${fromScreenId} -> ${toScreenId}`);
             state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null; return;
         }

        console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);
        // 確保設置鎖狀態和時間戳
        state.isAnimating = true; state.isTransitioning = true;
        state.lockStartTime = new Date().getTime();

        fromScreen.classList.remove('active');

        setTimeout(() => {
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            if (toScreenId === 'test') {
                 initializeTestScreen();
                 state.contentRendered = true;
                 // isTransitioning 由 test 內部管理，這裡主要解 isAnimating
                 setTimeout(() => {
                    if(state.isAnimating){
                        console.log(`屏幕切換至 Test 完成，解除 isAnimating (來自 switchScreen)`);
                        state.isAnimating = false;
                        // state.lockStartTime = null; // isTransitioning 可能還在鎖，先不重置時間戳
                    }
                 }, SCREEN_TRANSITION_DURATION);
            } else if (toScreenId === 'intro') {
                 state.currentQuestionIndex = 0; state.userAnswers = []; /* ... */
                 if(DOM.containers.preloader) DOM.containers.preloader.style.display = '';
                 /* ... 重置 SVG 樣式 ... */
                 setTimeout(() => {
                    if(state.isAnimating || state.isTransitioning){
                         console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定 (來自 switchScreen)`);
                         state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
                    }
                 }, SCREEN_TRANSITION_DURATION);
            } else { // result
                 setTimeout(() => {
                    if(state.isAnimating || state.isTransitioning){
                         console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定 (來自 switchScreen)`);
                         state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
                    }
                 }, SCREEN_TRANSITION_DURATION);
            }
        }, SCREEN_TRANSITION_DURATION);

        // *** 添加在 setTimeout 最後的額外保障機制 ***
        // 使用較長的時間確保動畫都跑完
        const safeUnlockDelay = SCREEN_TRANSITION_DURATION * 2 + 100; // 增加到 2 倍過渡時間 + 緩衝
        console.log(`[診斷] 預計在 ${safeUnlockDelay}ms 後執行 switchScreen 安全解鎖檢查`);
        setTimeout(() => {
            const targetScreenActive = DOM.containers[toScreenId]?.classList.contains('active');

            if (!targetScreenActive) {
                console.log("[診斷] 目標頁面未正確激活，嘗試強制激活");
                // 強制激活目標頁面
                if (DOM.containers[toScreenId]) {
                    // 確保其他頁面都隱藏
                    Object.values(DOM.containers).forEach(container => {
                        if (container && container !== DOM.containers[toScreenId]) {
                            container.classList.remove('active');
                        }
                    });
                    DOM.containers[toScreenId].classList.add('active');
                }

                // 如果是測驗頁面，確保初始化
                if (toScreenId === 'test' && !state.contentRendered) {
                    console.log("[診斷] 強制初始化測驗界面");
                    initializeTestScreen(); // 可能會再次觸發 isTransitioning 鎖定
                    state.contentRendered = true;
                }
            }

            // 再次確保狀態解鎖 (如果不是 test 頁面，或者 test 頁面已渲染完成)
            if (state.isAnimating || (state.isTransitioning && toScreenId !== 'test')) {
                 console.log("[診斷] SwitchScreen 安全機制觸發解鎖");
                 state.isAnimating = false;
                 state.isTransitioning = false; // 解鎖 transition，除非是 test 頁面內部動畫
                 state.lockStartTime = null;
                 console.log(`[診斷] 安全機制解鎖後狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
            } else if (state.isAnimating) {
                 console.log("[診斷] SwitchScreen 安全機制僅解除 isAnimating");
                 state.isAnimating = false;
            }

        }, safeUnlockDelay); // 使用計算出的安全延遲
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
        if (index < 0 || index >= questions.length) { console.error("無效的問題索引:", index); return; }
        const questionData = questions[index]; const questionNumber = index + 1;
        console.log(`顯示問題 ${questionNumber}`);
        state.isTransitioning = true; // 開始問題轉換
        state.lockStartTime = new Date().getTime(); // 記錄鎖定時間

        if (DOM.elements.testBackground) { /* ... 更新背景 ... */
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
        if (DOM.elements.questionTitle) { /* ... 更新標題 ... */
             DOM.elements.questionTitle.classList.add('is-hidden');
             setTimeout(() => {
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                 requestAnimationFrame(() => { DOM.elements.questionTitle.classList.remove('is-hidden'); });
             }, isInitialDisplay ? 100 : 500);
        }
        if (DOM.containers.options) { /* ... 生成選項 ... */
            DOM.containers.options.innerHTML = '';
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
                optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
            allOptions = Array.from(DOM.containers.options.querySelectorAll('.option'));
            setTimeout(() => triggerQuestionEnterAnimation(), isInitialDisplay ? 150 : 0);
        } else { state.isTransitioning = false; state.lockStartTime = null; console.error("找不到選項容器 #options-container"); }
    }

     function handleOptionClick(event) {
         const clickedOption = event.currentTarget;
         const optionIndex = parseInt(clickedOption.dataset.index);
         const questionIndex = state.currentQuestionIndex;
         if (isNaN(optionIndex) || isNaN(questionIndex) || state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) { return; }
         console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
         state.isTransitioning = true; state.lockStartTime = new Date().getTime();
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
             DOM.containers.explosion.style.position = ''; /* ... 清理爆炸容器樣式 ... */
             DOM.containers.explosion.style.top = '';
             DOM.containers.explosion.style.left = '';
             DOM.containers.explosion.style.width = '';
             DOM.containers.explosion.style.height = '';
         }, transitionDelay);
     }

     function triggerQuestionFadeOut(clickedOptionElement) {
        console.log("觸發問題退場動畫");
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
        console.log("準備下一題");
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1);
        displayQuestion(state.currentQuestionIndex, false);
     }

    // *** 使用者提供的修改後的 triggerQuestionEnterAnimation ***
    function triggerQuestionEnterAnimation() {
        console.log("觸發問題入場動畫");
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.classList.remove('is-hidden');
        }
        const optionsEnterStartDelay = 200;
        const optionStaggerDelay = 80;
        const optionEnterDuration = 500; // 假設 CSS 動畫時間

        allOptions.forEach((option, index) => {
            option.style.transition = '';
            option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
            option.classList.remove('is-hidden', 'fade-out', 'exploded');
            requestAnimationFrame(() => { option.style.pointerEvents = ''; });
        });

        // 修改解鎖機制，添加額外的安全保障
        const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
        const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 100;

        // 主要解鎖計時器
        console.log(`[診斷] 預計在 ${finalResetDelay}ms 後解除 isTransitioning (來自 triggerQuestionEnterAnimation)`);
        setTimeout(() => {
            allOptions.forEach(option => { option.style.transitionDelay = ''; });
            if(state.isTransitioning){ // 檢查是否還需解鎖
                state.isTransitioning = false;
                state.lockStartTime = null; // 重置時間戳
                console.log("[診斷] 問題進場動畫完成，解除 isTransitioning");
            }
        }, finalResetDelay);

        // 添加備份解鎖計時器，確保一定解鎖
        const backupDelay = finalResetDelay + 1000; // 比主計時器晚1秒
        console.log(`[診斷] 預計在 ${backupDelay}ms 後執行備份解鎖檢查 (來自 triggerQuestionEnterAnimation)`);
        setTimeout(() => {
            if (state.isTransitioning) {
                console.log("[診斷] 備份解鎖：檢測到持續鎖定狀態，強制解除 isTransitioning");
                state.isTransitioning = false;
                state.lockStartTime = null; // 重置時間戳
            }
        }, backupDelay);
    }

     function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / questions.length) * 100;
             DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
         }
    }

    function calculateResult() { /* ... (保持不變) ... */
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) { /* ... */ }
            state.userAnswers.forEach((answerIndex, questionIndex) => { /* ... */ });
            state.finalScores = scores; console.log("計算出的原始分數:", scores);
            const scoreValues = Object.values(scores); const scoreFrequency = {};
            scoreValues.forEach(score => { /* ... */ });
            console.log("分數頻率:", scoreFrequency);
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) { /* ... */ return results["SPECIAL"]; } }
            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) { /* ... */ }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);
            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { /* ... */ return results["SPECIAL"]; }
            if (highestTypes.length === 2) { /* ... tie-breaker ... */ }
            console.warn("無法確定最高分類型，返回默認結果 A"); return results['A'];
        } catch (error) { console.error("計算結果時出錯:", error); return results['A']; }
    }
    function prepareResultData(resultData) { /* ... (保持不變) ... */
         if (!resultData || !DOM.elements.resultTitle /* ... */) { return false; }
         try {
             DOM.elements.resultTitle.textContent = /* ... */;
             DOM.elements.resultSubtitle.textContent = /* ... */;
             DOM.elements.resultDescription.textContent = /* ... */;
             DOM.elements.traitsContainer.innerHTML = '';
             const typeScores = state.finalScores;
             if (!typeScores || Object.keys(typeScores).length === 0) { /* ... */ }
             else if (resultData.title && resultData.title.includes('管理員')) { /* ... */ }
             else { Object.keys(traitNames).forEach(type => { /* ... */ }); }
             DOM.elements.similarBooks.innerHTML = /* ... */;
             DOM.elements.complementaryBooks.innerHTML = /* ... */;
             DOM.elements.shareText.textContent = /* ... */;
             console.log("結果數據已準備並填充到頁面"); return true;
         } catch (error) { console.error("準備結果數據時發生錯誤:", error); /* ... */; return false; }
    }
    function showResults() { /* ... (保持不變) ... */
         console.log("測驗結束，準備顯示結果...");
         if (state.isAnimating || state.isTransitioning) { return; }
         state.isTransitioning = true; state.lockStartTime = new Date().getTime();
         try {
             const resultData = calculateResult(); if (!resultData) throw new Error("結果計算失敗");
             if (prepareResultData(resultData)) { switchScreen('test', 'result'); }
             else { throw new Error("結果數據準備失敗"); }
         } catch (error) { /* ... */ state.isTransitioning = false; state.isAnimating = false; state.lockStartTime = null; switchScreen('test', 'intro'); }
    }
    function addTraitElement(type, starCount) { /* ... (保持不變) ... */
         if (!DOM.elements.traitsContainer) return;
         try {
             const traitElement = document.createElement('div'); traitElement.className = 'trait-item';
             const traitName = document.createElement('span'); traitName.className = 'trait-name'; traitName.textContent = traitNames[type] || type;
             const traitStars = document.createElement('span'); traitStars.className = 'trait-stars';
             const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
             traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);
             traitElement.appendChild(traitName); traitElement.appendChild(traitStars);
             DOM.elements.traitsContainer.appendChild(traitElement);
         } catch (error) { console.error(`添加特質 ${type} 時出錯:`, error); }
    }
    function copyShareText() { /* ... (保持不變) ... */
         if (!DOM.elements.shareText || !DOM.buttons.copy) return;
          try {
             const textToCopy = DOM.elements.shareText.textContent;
             if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(() => { /* ... */ }).catch(err => { fallbackCopyText(textToCopy); }); }
             else { fallbackCopyText(textToCopy); }
          } catch (error) { console.error("複製分享文本時出錯:", error); if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }
    }
    function fallbackCopyText(text) { /* ... (保持不變) ... */
         const textArea = document.createElement("textarea"); /* ... */ document.body.appendChild(textArea);
         textArea.select(); textArea.setSelectionRange(0, 99999); let success = false;
         try { success = document.execCommand('copy'); /* ... */ } catch (err) { /* ... */ }
         document.body.removeChild(textArea);
    }
    function bindStartButton() { /* ... (保持不變) ... */
         if (DOM.buttons.start) { DOM.buttons.start.removeEventListener('click', handleStartTestClick); DOM.buttons.start.addEventListener('click', handleStartTestClick); console.log("開始測驗按鈕事件已綁定。"); }
         else { console.error("無法綁定開始按鈕事件：按鈕元素未找到。"); displayInitializationError("無法啟動測驗，關鍵按鈕丟失。"); }
    }
    function bindOtherButtons() { /* ... (保持不變) ... */
         if (DOM.buttons.restart) { DOM.buttons.restart.removeEventListener('click', handleRestartClick); DOM.buttons.restart.addEventListener('click', handleRestartClick); }
         if (DOM.buttons.copy) { DOM.buttons.copy.removeEventListener('click', copyShareText); DOM.buttons.copy.addEventListener('click', copyShareText); }
         console.log("其他按鈕事件已綁定。");
    }
     function handleRestartClick() { /* ... (保持不變) ... */
         if (state.isAnimating || state.isTransitioning) { return; }
         console.log("重新開始測驗..."); switchScreen('result', 'intro');
     }

    window.addEventListener('error', function(event) { /* ... (保持不變) ... */
        console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
        state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
    });
    window.addEventListener('unhandledrejection', function(event) { /* ... (保持不變) ... */
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        state.isAnimating = false; state.isTransitioning = false; state.lockStartTime = null;
    });

    // --- Initialization ---
    console.log("開始初始化...");
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        preloadImages(); // *** 調用修改後的 preloadImages ***
        bindOtherButtons();
    } else {
        console.error("DOM 元素緩存失敗，初始化中止。");
    }

    // *** 添加全局狀態自我修復機制 ***
    window.setInterval(function() {
        // 檢查是否長時間鎖定（超過5秒）
        const currentTime = new Date().getTime();
        if (state.lockStartTime && (currentTime - state.lockStartTime > 5000) &&
            (state.isAnimating || state.isTransitioning)) {

            console.log("[診斷] 檢測到長時間狀態鎖，自動修復");
            state.isAnimating = false;
            state.isTransitioning = false;
            state.lockStartTime = null; // 重置時間戳

            // 檢查當前顯示頁面並嘗試恢復
            if (DOM.containers.intro?.classList.contains('active')) {
                // 如果在介紹頁面，確保開始按鈕可點擊
                console.log("[診斷] 自動修復：確保 Intro 狀態正確");
                state.introVisible = true;
                state.preloadComplete = true; // 假設此時預載入已完成
            } else if (DOM.containers.test?.classList.contains('active') && !state.contentRendered) {
                // 如果在測驗頁面但未渲染內容，嘗試重新初始化
                 console.log("[診斷] 自動修復：嘗試重新初始化 Test 界面");
                initializeTestScreen();
                state.contentRendered = true; // 標記已渲染
            } else if (DOM.containers.test?.classList.contains('active') && state.isTransitioning) {
                 // 如果卡在測驗頁面的題目轉換中
                 console.log("[診斷] 自動修復：強制解除 Test 界面轉換鎖");
                 state.isTransitioning = false; // 強制解除題目轉換鎖
            }
        }

        // 如果沒有鎖定，確保 lockStartTime 是 null
        if (!state.isAnimating && !state.isTransitioning && state.lockStartTime) {
             state.lockStartTime = null;
        }
         // 記錄鎖定開始時間 (如果剛被鎖定且之前沒有記錄)
         // 這段邏輯已被移到觸發鎖定的地方 (如 switchScreen, handleStartTestClick 等)
         // if ((state.isAnimating || state.isTransitioning) && !state.lockStartTime) {
         //     state.lockStartTime = currentTime;
         // }

    }, 1000); // 每秒檢查一次

    console.log("腳本初始化流程結束。");
});