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
        lastLockTime: null // 新增：用於追蹤狀態鎖定的時間戳
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

    // *** 使用者提供的修改後的 triggerIntroTransition ***
    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
            console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
            state.isAnimating = false; state.isTransitioning = false; // 確保解鎖
            return;
        }
        // 檢查是否已在動畫中
        if (state.isAnimating || state.isTransitioning) {
            console.log("正在轉換 Intro，忽略重複觸發");
            return;
        }

        console.log("開始 Preloader 到 Intro 的轉場...");
        state.isAnimating = true;
        state.isTransitioning = true;
        state.lastLockTime = new Date().getTime(); // 記錄鎖定時間

        // 移除光暈 & 入場動畫
        DOM.elements.preloaderSvg.classList.remove('glow-active');
        DOM.elements.preloaderSvg.style.animation = 'none';

        const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
             '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path' // 簡化選擇器
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
             state.isAnimating = false; state.isTransitioning = false; // 解鎖
             return;
        }
         if (pathsToExit.length === 0) {
            console.warn("警告：未找到 SVG paths 進行退場動畫，將只淡出背景。");
        }

        let maxDelay = 0;
        const baseExitDelay = 0;
        const randomExitRange = 1000;

        // Path 退場動畫
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

        const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
        console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

        // 在 Preloader 退場後執行
        setTimeout(() => {
            console.log("Preloader 所有 Path 退場動畫結束。");
            if (DOM.containers.preloader) {
                 DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                 DOM.containers.preloader.style.display = 'none'; // 確保隱藏
            }
            // 清理 Path 樣式
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = ''; path.style.animationDelay = '';
                path.style.opacity = ''; path.style.transform = '';
                path.style.filter = ''; path.style.visibility = '';
            });
            // 重置 SVG 樣式
             if(DOM.elements.preloaderSvg) {
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.style.transform = '';
             }

            // 激活 Intro
            if (!state.introVisible && DOM.containers.intro) {
                 console.log("激活 Intro 容器...");
                 DOM.containers.intro.classList.add('active');
                 state.introVisible = true;
            }
        }, totalExitTime);

        // *** 修改后的解鎖邏輯：使用單一的計時器確保解鎖 ***
        const totalTransitionTime = totalExitTime + INTRO_ANIMATION_TOTAL_TIME + 100; // Preloader退場 + Intro入場 + 緩衝
        console.log(`[修復] 預計在 ${totalTransitionTime}ms 後執行最終解鎖`);

        setTimeout(() => {
            // 檢查是否仍然需要解鎖
            if (state.isAnimating || state.isTransitioning) {
                 console.log("[修復] 確保解除所有狀態鎖 (來自 triggerIntroTransition 計時器)...");
                 console.log(`[修復] 解鎖前狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
                 state.isAnimating = false;
                 state.isTransitioning = false;
                 console.log(`[修復] 解鎖後狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
            } else {
                console.log("[修復] 狀態已被提前解除，無需操作 (來自 triggerIntroTransition 計時器)");
            }
        }, totalTransitionTime);
    }

    // *** 使用者提供的修改後的 preloadImages ***
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
        // 重置樣式
        if(DOM.containers.preloader) {
            DOM.containers.preloader.classList.remove('is-exiting-bg');
            DOM.containers.preloader.style.display = '';
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
        DOM.containers.preloader.classList.add('active');
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
                        triggerIntroTransition(); // *** 調用修改後的轉場函數 ***
                        bindStartButton();
                    } else {
                        console.log("Preloader no longer active, skipping transition.");
                         if (!state.introVisible && DOM.containers.intro) {
                             DOM.containers.intro.classList.add('active');
                             state.introVisible = true;
                             state.isAnimating = false; state.isTransitioning = false; // 確保解鎖
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

        // *** 添加全局計時器，確保無論如何在合理時間後解除所有鎖 ***
        setTimeout(() => {
            if (state.isAnimating || state.isTransitioning) {
                console.log("[全局安全機制] 預載入後20秒仍有狀態鎖，強制解除");
                state.isAnimating = false;
                state.isTransitioning = false;
            }
        }, 20000); // 20秒後強制解除
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

    // *** 使用者提供的修改後的 handleStartTestClick ***
    function handleStartTestClick() {
        console.log("開始按鈕被點擊，準備切換畫面...");

        // 判斷條件優化，增加更詳細的日誌輸出
        if (!state.preloadComplete) {
            console.warn("點擊無效：圖片預載尚未完成");
            // 強行設置為完成，嘗試恢復功能 (注意：這可能隱藏問題)
            state.preloadComplete = true;
            console.log("[修復嘗試] 強制設定 preloadComplete = true");
        }

        if (!state.introVisible) {
            console.warn("點擊無效：介紹頁面未顯示");
            // 強行將介紹頁面設為可見 (注意：這可能隱藏問題)
            state.introVisible = true;
             if (DOM.containers.intro) DOM.containers.intro.classList.add('active'); // 同步 DOM
             console.log("[修復嘗試] 強制設定 introVisible = true");
        }

        // 關鍵修改：如果發現鎖定狀態過長，則強制解除
        const currentTime = new Date().getTime();
        if (state.isAnimating || state.isTransitioning) {
            const lockTime = state.lastLockTime ? (currentTime - state.lastLockTime) : 0;
            console.warn(`點擊時發現狀態鎖，已鎖定時間: ${lockTime}ms`);

            // 如果鎖定時間超過10秒 (10000ms)，強制解除鎖定
            if (lockTime > 10000) { // 檢查 lockTime > 0 確保 lastLockTime 有效
                console.log("[緊急修復] 強制解除長時間狀態鎖");
                state.isAnimating = false;
                state.isTransitioning = false;
            } else {
                // 如果鎖定時間不長，仍然阻止點擊
                 console.log("狀態鎖仍在短時間內，點擊無效");
                 return;
            }
        }

        // 設置鎖定狀態和時間戳
        console.log("設置狀態鎖並準備切換屏幕...");
        state.isAnimating = true;
        state.isTransitioning = true;
        state.lastLockTime = currentTime; // 更新最後鎖定時間

        // 切換到測驗頁面
        switchScreen('intro', 'test');
    }

    // *** 使用者提供的修改後的 switchScreen ***
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
             console.error(`屏幕切換失敗: ${fromScreenId} -> ${toScreenId}`);
             state.isAnimating = false; state.isTransitioning = false; return;
         }

        // 這裡的檢查很重要，防止動畫過程中重複觸發
        if ((state.isAnimating || state.isTransitioning) && fromScreenId !== 'preloader') {
             const lockTime = state.lastLockTime ? (new Date().getTime() - state.lastLockTime) : 0;
             console.log(`忽略屏幕切換：動畫/轉換進行中 (已鎖定 ${lockTime}ms)`);
             return;
         }
        console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);
        state.isAnimating = true; state.isTransitioning = true;
        state.lastLockTime = new Date().getTime(); // 記錄鎖定時間

        fromScreen.classList.remove('active');

        // 基本轉場時間後的操作
        setTimeout(() => {
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            if (toScreenId === 'test') {
                 initializeTestScreen();
                 state.contentRendered = true;
                 // Test 屏幕的 isTransitioning 由其內部動畫管理，這裡主要解 isAnimating
                 setTimeout(() => {
                     if (state.isAnimating) { // 檢查是否仍需解鎖
                         console.log(`屏幕切換至 Test 完成，解除 isAnimating (來自 switchScreen)`);
                         state.isAnimating = false;
                     }
                 }, SCREEN_TRANSITION_DURATION);
            } else if (toScreenId === 'intro') {
                 // 重置操作
                 state.currentQuestionIndex = 0; state.userAnswers = []; state.finalScores = {};
                 state.contentRendered = false;
                 if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                 if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
                 if(DOM.containers.startBtnExplosion) {
                    DOM.containers.startBtnExplosion.style.position = ''; DOM.containers.startBtnExplosion.style.top = '';
                    DOM.containers.startBtnExplosion.style.left = ''; DOM.containers.startBtnExplosion.style.width = '';
                    DOM.containers.startBtnExplosion.style.height = '';
                 }
                 if(DOM.containers.preloader) DOM.containers.preloader.style.display = '';
                 // 重置 Preloader SVG 樣式
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
                 // 解鎖
                 setTimeout(() => {
                     if (state.isAnimating || state.isTransitioning) {
                         console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定 (來自 switchScreen)`);
                         state.isAnimating = false; state.isTransitioning = false;
                     }
                 }, SCREEN_TRANSITION_DURATION);
            } else { // 其他屏幕 (result)
                 setTimeout(() => {
                     if (state.isAnimating || state.isTransitioning) {
                         console.log(`屏幕切換至 ${toScreenId} 完成，解除鎖定 (來自 switchScreen)`);
                         state.isAnimating = false; state.isTransitioning = false;
                     }
                 }, SCREEN_TRANSITION_DURATION);
            }
        }, SCREEN_TRANSITION_DURATION);

        // *** 添加額外的安全機制：確保在最長的預期轉場時間後解除所有鎖 ***
        const maxExpectedTransitionTime = SCREEN_TRANSITION_DURATION * 2 + 1000; // 舊屏隱藏+新屏顯示+緩衝
        console.log(`[安全機制] 預計在 ${maxExpectedTransitionTime}ms 後檢查並解除可能遺留的狀態鎖`);
        setTimeout(() => {
            if (state.isAnimating || state.isTransitioning) {
                console.log("[安全機制] 確保解除可能遺留的狀態鎖 (來自 switchScreen 安全計時器)");
                console.log(`[安全機制] 解鎖前狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
                state.isAnimating = false;
                state.isTransitioning = false;
                console.log(`[安全機制] 解鎖後狀態: isAnimating=${state.isAnimating}, isTransitioning=${state.isTransitioning}`);
            }
        }, maxExpectedTransitionTime);
    }

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
        state.lastLockTime = new Date().getTime(); // 記錄鎖定時間

        // 更新背景圖片
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

        // 更新問題標題
        if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.add('is-hidden');
             setTimeout(() => {
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                 requestAnimationFrame(() => { DOM.elements.questionTitle.classList.remove('is-hidden'); });
             }, isInitialDisplay ? 100 : 500);
        }

        // 生成選項
        if (DOM.containers.options) {
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
        } else {
            state.isTransitioning = false; // 如果沒有選項容器，直接解除鎖定
            console.error("找不到選項容器 #options-container");
        }
    }

     function handleOptionClick(event) {
         const clickedOption = event.currentTarget;
         const optionIndex = parseInt(clickedOption.dataset.index);
         const questionIndex = state.currentQuestionIndex;

         if (isNaN(optionIndex) || isNaN(questionIndex) || state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
             console.log("忽略選項點擊：狀態不符或動畫進行中");
             return;
         }

         console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
         state.isTransitioning = true; // 開始轉換
         state.lastLockTime = new Date().getTime(); // 記錄鎖定時間
         state.userAnswers[questionIndex] = optionIndex; // 記錄答案

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
             if (state.currentQuestionIndex < questions.length - 1) {
                 prepareNextQuestion();
             }
             else {
                 showResults();
             }
             DOM.containers.explosion.style.position = ''; DOM.containers.explosion.style.top = '';
             DOM.containers.explosion.style.left = ''; DOM.containers.explosion.style.width = '';
             DOM.containers.explosion.style.height = '';
         }, transitionDelay);
     }

     function triggerQuestionFadeOut(clickedOptionElement) {
        console.log("觸發問題退場動畫");
        if (DOM.elements.testBackground) { DOM.elements.testBackground.classList.add('is-hidden'); }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.add('is-hidden'); }
        allOptions.forEach(option => {
            option.style.transitionDelay = '';
            if (option === clickedOptionElement) {
                option.classList.add('exploded');
            } else {
                option.classList.add('fade-out');
            }
            option.style.pointerEvents = 'none';
        });
     }

     function prepareNextQuestion() {
        console.log("準備下一題");
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1);
        displayQuestion(state.currentQuestionIndex, false);
     }

     function triggerQuestionEnterAnimation() {
         console.log("觸發問題入場動畫");
         if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.remove('is-hidden');
         }
         const optionsEnterStartDelay = 200;
         const optionStaggerDelay = 80;
         const optionEnterDuration = 500;

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
             // 確保解除轉換鎖
             if (state.isTransitioning) {
                 console.log("問題進場動畫完成，解除 isTransitioning");
                 state.isTransitioning = false;
             }
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
            if (state.userAnswers.length !== questions.length) {
                console.warn("用戶答案數量與問題數量不符，可能未完成測驗。");
                for (let i = 0; i < questions.length; i++) {
                    if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0;
                }
            }
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
            state.finalScores = scores;
            console.log("計算出的原始分數:", scores);

            const scoreValues = Object.values(scores);
            const scoreFrequency = {};
            scoreValues.forEach(score => {
                const roundedScore = Math.round(score * 10) / 10;
                scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1;
            });
            console.log("分數頻率:", scoreFrequency);
            for (const score in scoreFrequency) {
                if (scoreFrequency[score] >= 4) {
                    console.log("觸發特殊結果：分數高度集中");
                    return results["SPECIAL"];
                }
            }

            let maxScore = -Infinity;
            let highestTypes = [];
            for (const type in scores) {
                if (Math.abs(scores[type] - maxScore) < 0.01) {
                    highestTypes.push(type);
                } else if (scores[type] > maxScore) {
                    maxScore = scores[type];
                    highestTypes = [type];
                }
            }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);

            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { console.log("觸發特殊結果：多個類型同為最高分 (>=3)"); return results["SPECIAL"]; }
            if (highestTypes.length === 2) {
                console.log("兩個類型同為最高分，使用 Tie-breaker...");
                const tiebreakQuestionIndex = 8;
                if (state.userAnswers[tiebreakQuestionIndex] === undefined) {
                    console.warn("Tie-breaker 問題未回答，默認選擇第一個最高分類型");
                    return results[highestTypes[0]];
                }
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) {
                    console.log("Tie-breaker 解決，結果為:", tiebreakPrimaryType);
                    return results[tiebreakPrimaryType];
                } else {
                    console.log("Tie-breaker 未解決或無效，默認選擇第一個最高分類型");
                    return results[highestTypes[0]];
                }
            }
            console.warn("無法確定最高分類型，返回默認結果 A");
            return results['A'];
        } catch (error) {
            console.error("計算結果時出錯:", error);
            return results['A'];
        }
     }

    function prepareResultData(resultData) {
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
             console.error("準備結果數據失敗：缺少必要的 DOM 元素或結果數據。");
             return false;
        }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法顯示特質分數：缺少分數數據");
            } else if (resultData.title && resultData.title.includes('管理員')) {
                Object.keys(traitNames).forEach(type => addTraitElement(type, 3));
            } else {
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0;
                    let stars = 1;
                    if (score >= 7) stars = 5;
                    else if (score >= 5) stars = 4;
                    else if (score >= 3) stars = 3;
                    else if (score >= 1) stars = 2;
                    addTraitElement(type, stars);
                });
            }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("結果數據已準備並填充到頁面");
            return true;
        } catch (error) {
            console.error("準備結果數據時發生錯誤:", error);
            if (DOM.elements.resultTitle) DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤";
            return false;
        }
     }

    function showResults() {
        console.log("測驗結束，準備顯示結果...");
        if (state.isAnimating || state.isTransitioning) {
            console.warn("忽略顯示結果：動畫/轉換進行中");
            return;
        }
        state.isTransitioning = true; // 開始顯示結果的轉換過程
        state.lastLockTime = new Date().getTime(); // 記錄鎖定時間

        try {
            const resultData = calculateResult();
            if (!resultData) { throw new Error("結果計算失敗，返回了無效數據"); }
            if (prepareResultData(resultData)) {
                switchScreen('test', 'result');
            } else { throw new Error("結果數據準備或填充失敗"); }
        } catch (error) {
            console.error("顯示結果時出錯:", error);
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            state.isTransitioning = false; state.isAnimating = false;
            switchScreen('test', 'intro');
        }
    }

    function addTraitElement(type, starCount) {
        if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';
            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            traitName.textContent = traitNames[type] || type;
            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);
            traitElement.appendChild(traitName); traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) { console.error(`添加特質 ${type} 時出錯:`, error); }
     }

    function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    DOM.buttons.copy.textContent = '已複製!';
                    setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000);
                }).catch(err => { fallbackCopyText(textToCopy); });
            } else { fallbackCopyText(textToCopy); }
         } catch (error) { console.error("複製分享文本時出錯:", error); if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }
     }

    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = 'fixed'; textArea.style.left = '-9999px';
        textArea.style.opacity = '0'; textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select(); textArea.setSelectionRange(0, 99999);
        let success = false;
        try {
            success = document.execCommand('copy');
            if (success) { if(DOM.buttons.copy) { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { if(DOM.buttons.copy) DOM.buttons.copy.textContent = '複製'; }, 2000); } }
            else { alert('複製失敗，您的瀏覽器可能不支援此操作。'); }
        } catch (err) { console.error("fallbackCopyText 錯誤:", err); alert('複製失敗，請手動複製文本。'); }
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
        console.log("其他按鈕事件已綁定。");
     }

     function handleRestartClick() {
        if (state.isAnimating || state.isTransitioning) {
            console.log("動畫/轉換進行中，暫時無法重新開始。");
            return;
        }
        console.log("重新開始測驗...");
        switchScreen('result', 'intro');
     }

    window.addEventListener('error', function(event) {
         console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
         state.isAnimating = false; state.isTransitioning = false;
    });
    window.addEventListener('unhandledrejection', function(event) {
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        state.isAnimating = false; state.isTransitioning = false;
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

    console.log("腳本初始化流程結束。");
});