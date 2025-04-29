// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', async function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isBusy: false, // 單一狀態鎖，取代 isAnimating 和 isTransitioning
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
    let allOptions = []; // 用於快取當前問題的所有選項元素

    // --- 從 data.js 獲取數據 ---
    // 檢查 testData 是否有效
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') {
        console.error("錯誤：找不到有效的 testData...");
        displayInitializationError("無法載入測驗數據。");
        return; // 終止執行
    }
    // 檢查 questions 陣列是否有效
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) {
        console.error("錯誤：testData.questions 不是有效的陣列或為空。");
        displayInitializationError("測驗問題數據格式錯誤。");
        return; // 終止執行
    }
    const questions = testData.questions;
    const results = testData.results || {};
    const traitNames = testData.traitNames || {};
    const totalQuestions = questions.length;

    // --- 常數 (從 CSS 變數讀取) ---
    // 輔助函數：從 CSS 變數讀取時間（秒）並轉換為毫秒
    function getCssTimeInMillis(variableName, defaultValue = 0) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) {
                return parseFloat(value.replace('s', '')) * 1000;
            }
        } catch (e) {
            console.warn(`無法讀取 CSS 變數 ${variableName}:`, e);
        }
        return defaultValue;
    }
    // 輔助函數：從 CSS 變數讀取整數
    function getCssInt(variableName, defaultValue = 0) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) {
                return parseInt(value);
            }
        } catch (e) {
            console.warn(`無法讀取 CSS 變數 ${variableName}:`, e);
        }
        return defaultValue;
    }

    // 動畫與轉場時間常數 (單位: 毫秒)
    const PRELOADER_PATH_EXIT_DURATION = getCssTimeInMillis('--preloader-path-exit-duration', 800);
    const SVG_BASE_DRAW_DURATION = getCssTimeInMillis('--svg-base-draw-duration', 2500);
    const SVG_STAGGER_DELAY = getCssTimeInMillis('--svg-stagger-delay', 150);
    const MAX_STAGGER_STEPS = getCssInt('--svg-max-stagger-steps', 4);
    const SVG_ANIMATION_TOTAL_ESTIMATED_TIME = SVG_BASE_DRAW_DURATION + (MAX_STAGGER_STEPS * SVG_STAGGER_DELAY);
    const PRELOADER_PAUSE_AFTER_SVG = 400; // SVG 動畫完成後的額外停留時間
    const PRELOADER_EXTRA_DELAY = SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG; // 預載入完成後到開始轉場的總延遲
    const INTRO_FADEIN_DELAY = getCssTimeInMillis('--intro-fadein-delay', 100);
    const INTRO_FADEIN_DURATION = getCssTimeInMillis('--intro-fadein-duration', 1000);
    const INTRO_ANIMATION_TOTAL_TIME = INTRO_FADEIN_DELAY + INTRO_FADEIN_DURATION; // Intro 頁面元素淡入總時間
    const SCREEN_TRANSITION_DURATION = getCssTimeInMillis('--transition-duration', 600); // 畫面轉換時間
    const EXPLOSION_DURATION = 1000; // 爆炸動畫持續時間
    const SVG_GLOW_DELAY = getCssTimeInMillis('--svg-glow-delay', 3000); // SVG 光暈效果延遲
    const QUESTION_FADE_DURATION = 500; // 問題標題/背景淡出入時間
    const OPTIONS_ENTER_START_DELAY = 200; // 選項入場起始延遲
    const OPTION_STAGGER_DELAY = 80; // 選項入場交錯延遲
    const OPTION_ENTER_DURATION = 500; // 選項入場動畫時間 (CSS 中定義)

    // --- 輔助函數 ---

    /**
     * 設置 CSS 變數 --vh，用於移動端瀏覽器高度計算
     */
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (e) {
            console.warn("設置視口高度錯誤:", e);
        }
    }

    /**
     * 顯示初始化錯誤訊息
     * @param {string} message - 要顯示的錯誤訊息
     */
    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('active'); // 確保 Preloader 可見
        } else {
            // 極端情況下，如果連 preloader 都找不到
            document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
        }
    }

    /**
     * 快取常用的 DOM 元素，提高效能
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

            // 檢查關鍵元素是否存在
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
                console.error("Missing element index:", missing, criticalElements[missing]); // Log the missing element itself
                displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                return false;
            }

            // 檢查 SVG Group 是否存在
            const mainTitleGroup = DOM.elements.preloaderSvg?.querySelector('#main-title-group');
            const engSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#eng-subtitle-group');
            const chnSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#chn-subtitle-group');
            if (!mainTitleGroup || !engSubtitleGroup || !chnSubtitleGroup) {
                console.warn("警告：未能找到所有的 SVG Group ID (main-title-group, eng-subtitle-group, chn-subtitle-group)。請檢查 index.html。");
                // 非致命錯誤，繼續執行
            }

            // --- 複製 Preloader SVG 到 Intro Title ---
            if (DOM.elements.preloaderSvg && DOM.elements.introTitlePlaceholder) {
                const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
                clonedSvg.id = 'intro-title-svg';
                // 清理 Preloader 動畫相關樣式和 class
                clonedSvg.classList.remove('glow-active');
                clonedSvg.style.animation = 'none';
                clonedSvg.style.transform = ''; // 清除可能的 transform
                clonedSvg.querySelectorAll('path, g').forEach(el => {
                    el.style.animation = 'none';
                    el.style.animationDelay = '0s';
                    el.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                    el.style.transform = '';
                    el.style.filter = '';
                    el.style.opacity = ''; // 確保路徑可見
                    el.style.strokeDashoffset = '0'; // 確保路徑已繪製
                    el.style.fillOpacity = '1'; // 確保填色可見
                    el.style.visibility = 'visible';
                });
                DOM.elements.introTitlePlaceholder.innerHTML = ''; // 清空容器
                DOM.elements.introTitlePlaceholder.appendChild(clonedSvg);
                console.log("Intro title SVG 已從 Preloader SVG 複製並插入");
            } else {
                console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro title placeholder");
                // 可以考慮在這裡也返回 false 或顯示錯誤
            }
            // --- End SVG Cloning ---

            console.log("DOM 元素已快取");
            return true;
        } catch (error) {
            console.error("快取 DOM 元素時出錯:", error);
            displayInitializationError("頁面初始化時發生錯誤。");
            return false;
        }
    }

    /**
     * 異步延遲函數
     * @param {number} ms - 延遲的毫秒數
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 等待下一個動畫幀
     * @returns {Promise<void>}
     */
    function nextFrame() {
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
                resolve(); // 即使失敗也要 resolve
                return;
            }

            // 移除光暈和入口動畫（如果還在的話）
            DOM.elements.preloaderSvg.classList.remove('glow-active');
            DOM.elements.preloaderSvg.style.animation = 'none'; // 停止所有 SVG 動畫

            const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
                '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path'
            );
            const preloaderBg = DOM.containers.preloader;

            if (pathsToExit.length === 0 && !preloaderBg) {
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
            const baseExitDelay = 0; // 可以設為 0，讓動畫立即開始
            const randomExitRange = 1000; // 隨機延遲範圍

            // 觸發路徑退場動畫
            pathsToExit.forEach(path => {
                // 清理可能殘留的樣式
                path.style.animation = '';
                path.style.opacity = '';
                path.style.transform = '';
                path.style.filter = '';
                path.style.visibility = '';
                const randomDelay = baseExitDelay + Math.random() * randomExitRange;
                maxDelay = Math.max(maxDelay, randomDelay);
                const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';
                // 使用 setTimeout 觸發動畫，確保樣式清理先生效
                setTimeout(() => {
                    path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
                    path.classList.add(exitClass);
                }, 5); // 短暫延遲
            });

            // 觸發背景淡出
            if (preloaderBg) {
                setTimeout(() => {
                    preloaderBg.classList.add('is-exiting-bg');
                }, baseExitDelay + randomExitRange * 0.2); // 背景稍微延遲開始淡出
            }

            // 計算總退場時間
            const totalExitTime = maxDelay + PRELOADER_PATH_EXIT_DURATION;
            console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

            // 等待退場動畫完成
            await delay(totalExitTime);

            console.log("Preloader 所有 Path 退場動畫結束。");
            // 隱藏 Preloader 並清理樣式
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                DOM.containers.preloader.style.display = 'none'; // 確保隱藏
            }
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = '';
                path.style.animationDelay = '';
                // 保留 opacity: 0, visibility: hidden 由動畫 class 控制
            });
            if (DOM.elements.preloaderSvg) {
                DOM.elements.preloaderSvg.style.animation = ''; // 清理 SVG 整體動畫
                DOM.elements.preloaderSvg.style.transform = '';
            }

            // 激活 Intro 容器（如果尚未顯示）
            if (!state.introVisible && DOM.containers.intro) {
                console.log("激活 Intro 容器...");
                DOM.containers.intro.classList.add('active'); // 觸發 Intro 的 CSS 過渡
                state.introVisible = true;
                // 等待 Intro 頁面自身的淡入動畫完成
                await delay(INTRO_ANIMATION_TOTAL_TIME); // 等待 Intro 元素淡入
            } else {
                 await delay(100); // 如果 Intro 已顯示，給一點緩衝時間
            }

            console.log("Intro 轉場完成。");
            resolve(); // 轉場流程結束
        });
    }

    /**
     * 預載入圖片和執行 Preloader 動畫
     * @returns {Promise<void>} 當所有資源載入且 Preloader 動畫完成後 resolve
     */
    function preloadAndAnimate() {
        return new Promise(async (resolve, reject) => {
            if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) {
                reject(new Error("Preloader 或 SVG 元素未找到。"));
                return;
            }
            if (!questions || questions.length === 0) {
                reject(new Error("問題數據無效。"));
                return;
            }

            console.log("顯示 Preloader...");
            // 重置 Preloader 樣式
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('is-exiting-bg');
                DOM.containers.preloader.style.display = ''; // 確保可見
                DOM.containers.preloader.classList.add('active'); // 激活 Preloader
            }
            if (DOM.elements.preloaderSvg) {
                // 重置 SVG 路徑樣式以準備繪製動畫
                DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
                    p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                    p.style.animation = ''; // 清除舊動畫
                    p.style.animationDelay = '';
                    p.style.opacity = '0'; // 初始隱藏，讓動畫控制顯示
                    p.style.strokeDashoffset = '1500'; // 重置繪製起點
                    p.style.fillOpacity = '0';
                    p.style.visibility = 'visible'; // 確保路徑本身是可見的
                });
                 // 重新觸發 SVG 繪製動畫 (通過重新設置 class 或 style)
                 // 這裡假設 CSS 中 .preloader.active #preloader-svg path 會自動觸發動畫
                 // 如果不行，需要 JS 手動添加觸發 class 或延遲後設置 animation-play-state
                await nextFrame(); // 等待一幀確保樣式應用
                DOM.elements.preloaderSvg.style.animation = ''; // 清除舊的整體動畫
                DOM.elements.preloaderSvg.classList.remove('glow-active');
                // 觸發入口縮放動畫
                DOM.elements.preloaderSvg.style.animation = `preloaderEntranceZoom ${SVG_ANIMATION_TOTAL_ESTIMATED_TIME}ms ease-out forwards`;

                // 延遲添加光暈效果
                setTimeout(() => {
                    if (DOM.containers.preloader?.classList.contains('active')) { // 檢查 Preloader 是否還在
                        DOM.elements.preloaderSvg?.classList.add('glow-active');
                    }
                }, SVG_GLOW_DELAY);
            }

            const imageUrls = ['./images/Intro.webp'];
            questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
            let loadedCount = 0;
            const totalImages = imageUrls.length;
            let errorOccurred = false;
            const imagePromises = [];

            console.log(`開始預載入 ${totalImages} 張圖片...`);
            imageUrls.forEach(url => {
                const promise = new Promise((imgResolve, imgReject) => {
                    const img = new Image();
                    img.onload = () => {
                        // console.log(`圖片載入成功: ${url}`);
                        loadedCount++;
                        imgResolve();
                    };
                    img.onerror = () => {
                        console.warn(`圖片載入失敗: ${url}`);
                        loadedCount++;
                        errorOccurred = true;
                        imgResolve(); // 即使失敗也 resolve，避免阻塞流程
                    };
                    img.src = url;
                });
                imagePromises.push(promise);
            });

            // 等待所有圖片處理完成
            await Promise.all(imagePromises);
            state.preloadComplete = true;
            console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);

            // 等待 SVG 動畫和額外延遲
            const remainingDelay = PRELOADER_EXTRA_DELAY - (performance.now() - startTime); // 計算還需等待多久
            console.log(`等待 SVG 動畫 + 停留 ${Math.max(0, remainingDelay).toFixed(0)}ms...`);
            await delay(Math.max(0, remainingDelay)); // 確保至少等待 PRELOADER_EXTRA_DELAY

            console.log("Preloader 動畫和延遲完成。");
            resolve(); // 預載入和動畫流程結束
        });
    }


    /**
     * 觸發元素內文字的爆炸效果
     * @param {HTMLElement} targetElement - 觸發爆炸的目標元素
     * @param {string} textToExplode - 要爆炸的文字
     * @param {HTMLElement} explosionContainer - 容納爆炸粒子的容器
     * @returns {Promise<void>} 爆炸動畫完成時 resolve
     */
    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        return new Promise(resolve => {
            if (!explosionContainer || !targetElement) {
                console.error("Explosion failed: Missing container or target element.");
                resolve();
                return;
            }
            explosionContainer.innerHTML = ''; // 清空舊粒子

            // 計算起始位置（相對於 explosionContainer）
            const targetRect = targetElement.getBoundingClientRect();
            const containerRect = explosionContainer.getBoundingClientRect();
            let startX = targetRect.left - containerRect.left + targetRect.width / 2;
            let startY = targetRect.top - containerRect.top + targetRect.height / 2;

            const chars = textToExplode.split('');
            let animationsPending = 0;

            chars.forEach((char) => {
                if (char.trim() === '') return; // 忽略空白字符

                const span = document.createElement('span');
                span.textContent = char;
                span.className = `char-explode`; // 應用 CSS 動畫

                // 計算隨機運動參數
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.4) + 50; // 調整爆炸半徑
                const translateX = Math.cos(angle) * radius;
                const translateY = Math.sin(angle) * radius;
                const translateZ = Math.random() * 300 + 200; // 調整 Z 軸距離
                const rotateZ = (Math.random() - 0.5) * 480; // 調整旋轉角度
                const scale = Math.random() * 2.5 + 1.5; // 調整縮放比例
                const animationDelay = Math.random() * 0.15; // 隨機延遲

                // 設置 CSS 變數和樣式
                span.style.left = `${startX}px`;
                span.style.top = `${startY}px`;
                span.style.setProperty('--tx', `${translateX}px`);
                span.style.setProperty('--ty', `${translateY}px`);
                span.style.setProperty('--tz', `${translateZ}px`);
                span.style.setProperty('--rz', `${rotateZ}deg`);
                span.style.setProperty('--sc', `${scale}`);
                span.style.animationDelay = `${animationDelay}s`;

                explosionContainer.appendChild(span);
                animationsPending++;

                // 動畫結束後移除元素
                span.addEventListener('animationend', () => {
                    if (span.parentNode === explosionContainer) {
                        explosionContainer.removeChild(span);
                    }
                    animationsPending--;
                    if (animationsPending === 0) {
                        // console.log("Explosion animation complete.");
                        resolve(); // 所有粒子動畫結束後 resolve
                    }
                }, { once: true }); // 確保事件只觸發一次
            });

             // 如果沒有任何字符需要爆炸，立即 resolve
             if (animationsPending === 0) {
                 resolve();
             }

            // 添加一個超時保險，以防 animationend 事件未觸發
            setTimeout(() => {
                if (animationsPending > 0) {
                    console.warn("Explosion animation timeout, forcing resolve.");
                    explosionContainer.innerHTML = ''; // 清理殘留粒子
                    resolve();
                }
            }, EXPLOSION_DURATION + 500); // 比最長動畫時間稍長
        });
    }


    /**
     * 處理開始測驗按鈕點擊事件
     */
    async function handleStartTestClick() {
        if (state.isBusy) {
            console.log("正在處理其他操作，請稍候...");
            return;
        }
        state.isBusy = true; // 設置狀態鎖
        console.log("開始測驗按鈕被點擊");

        try {
            // 觸發按鈕文字爆炸效果
            if (DOM.buttons.start && DOM.elements.startBtnText && DOM.containers.startBtnExplosion) {
                const buttonText = DOM.elements.startBtnText.textContent;
                DOM.elements.startBtnText.classList.add('hidden'); // 隱藏原文字
                await triggerExplosion(DOM.buttons.start, buttonText, DOM.containers.startBtnExplosion);
                DOM.buttons.start.classList.add('exploded'); // 讓按鈕本身也消失 (可選)
            }

            // 切換到測驗畫面
            await switchScreen('intro', 'test');
            initializeTestScreen(); // 初始化測驗畫面內容和第一個問題
            state.contentRendered = true;

        } catch (error) {
            console.error("處理開始測驗點擊時出錯:", error);
            // 可以選擇顯示錯誤訊息或回退到 intro 頁面
            await switchScreen('test', 'intro'); // 嘗試回退
        } finally {
            // state.isBusy = false; // 解鎖狀態 - 由 initializeTestScreen 內部解鎖
            console.log("handleStartTestClick 流程結束");
        }
    }

    /**
     * 切換顯示的屏幕容器
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
                resolve(); // 即使失敗也要 resolve
                return;
            }

            console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);

            // 隱藏來源屏幕
            fromScreen.classList.remove('active');

            // 等待來源屏幕的 CSS 過渡完成
            await delay(SCREEN_TRANSITION_DURATION);

            // 顯示目標屏幕
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden'; // 控制滾動條

            // 更新狀態
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            // 如果切換到 Intro，重置測驗狀態和按鈕
            if (toScreenId === 'intro') {
                state.currentQuestionIndex = 0;
                state.userAnswers = [];
                state.finalScores = {};
                state.contentRendered = false;
                // 重置開始按鈕狀態 (如果之前爆炸了)
                if (DOM.buttons.start && DOM.elements.startBtnText) {
                    DOM.buttons.start.classList.remove('exploded');
                    DOM.elements.startBtnText.classList.remove('hidden');
                }
                // 重置 Preloader 狀態以便下次使用 (可選)
                // if(DOM.containers.preloader) DOM.containers.preloader.style.display = '';
            }

            // 等待目標屏幕的 CSS 過渡完成
            await delay(SCREEN_TRANSITION_DURATION);

            console.log(`屏幕切換至 ${toScreenId} 完成`);
            resolve(); // 切換完成
        });
    }

    /**
     * 初始化測驗屏幕，顯示第一個問題
     */
    async function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("無法初始化測驗屏幕，缺少必要元素。");
            state.isBusy = false; // 確保解鎖
            return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        updateProgressBar(0); // 重置進度條
        await displayQuestion(state.currentQuestionIndex, true); // 顯示第一個問題並等待動畫
        updateProgressBar(1); // 更新進度條到第一題
        // displayQuestion 內部會處理 isBusy 的解鎖
    }

    /**
     * 顯示指定索引的問題及其選項
     * @param {number} index - 問題的索引 (0-based)
     * @param {boolean} [isInitialDisplay=false] - 是否為測驗開始時的第一次顯示
     * @returns {Promise<void>} 問題和選項入場動畫完成時 resolve
     */
    function displayQuestion(index, isInitialDisplay = false) {
        return new Promise(async (resolve) => {
            if (index < 0 || index >= totalQuestions) {
                console.error("無效的問題索引:", index);
                resolve(); // 即使失敗也要 resolve
                return;
            }
            const questionData = questions[index];
            const questionNumber = index + 1;
            console.log(`顯示問題 ${questionNumber}`);

            // --- 更新背景圖片 ---
            if (DOM.elements.testBackground) {
                const imageUrl = `./images/Q${questionNumber}.webp`;
                if (!isInitialDisplay) {
                    // 先淡出舊背景
                    DOM.elements.testBackground.classList.add('is-hidden');
                    await delay(QUESTION_FADE_DURATION); // 等待淡出完成
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    await nextFrame(); // 等待樣式應用
                    // 淡入新背景
                    DOM.elements.testBackground.classList.remove('is-hidden');
                    // 背景淡入不需要額外等待，與標題和選項並行
                } else {
                    // 初始顯示，直接設置背景並淡入
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    DOM.elements.testBackground.classList.remove('is-hidden'); // 確保可見
                }
            }

            // --- 更新問題標題 ---
            if (DOM.elements.questionTitle) {
                 if (!isInitialDisplay) {
                    DOM.elements.questionTitle.classList.add('is-hidden');
                    await delay(QUESTION_FADE_DURATION / 2); // 標題淡出快一點
                 }
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, ''); // 移除問題編號
                 await nextFrame();
                 DOM.elements.questionTitle.classList.remove('is-hidden'); // 觸發淡入
                 if (!isInitialDisplay) {
                    await delay(QUESTION_FADE_DURATION); // 等待標題淡入
                 }
            }

            // --- 生成並顯示選項 ---
            if (DOM.containers.options) {
                DOM.containers.options.innerHTML = ''; // 清空舊選項
                allOptions = []; // 清空快取的選項元素

                questionData.options.forEach((optionData, optIndex) => {
                    const optionElement = document.createElement('div');
                    optionElement.className = 'option is-hidden'; // 初始隱藏，準備入場動畫
                    optionElement.style.transition = 'none'; // 暫時禁用 CSS 過渡，以便 JS 控制入場
                    optionElement.dataset.text = optionData.text;
                    optionElement.dataset.index = optIndex;
                    optionElement.innerText = optionData.text;
                    optionElement.setAttribute('role', 'button');
                    optionElement.tabIndex = 0; // 允許鍵盤聚焦

                    // 綁定事件監聽器
                    optionElement.addEventListener('click', handleOptionClick);
                    optionElement.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); // 防止頁面滾動
                            handleOptionClick(e);
                        }
                    });

                    DOM.containers.options.appendChild(optionElement);
                    allOptions.push(optionElement); // 加入快取
                });

                // 等待標題動畫（如果是非初始顯示）或短暫延遲後，觸發選項入場
                await delay(isInitialDisplay ? 150 : 0);
                await triggerQuestionEnterAnimation(); // 等待選項入場動畫完成

            } else {
                console.error("找不到選項容器 #options-container");
            }

            console.log(`問題 ${questionNumber} 顯示完成。`);
            state.isBusy = false; // *** 解鎖狀態 ***
            resolve(); // 問題顯示流程結束
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

        // 防止重複點擊或在動畫過程中點擊
        if (state.isBusy || isNaN(optionIndex) || isNaN(questionIndex) || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            return;
        }

        state.isBusy = true; // *** 設置狀態鎖 ***
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex; // 記錄答案

        // --- 執行退場動畫 ---
        // 1. 觸發問題標題和背景淡出
        if (DOM.elements.testBackground) DOM.elements.testBackground.classList.add('is-hidden');
        if (DOM.elements.questionTitle) DOM.elements.questionTitle.classList.add('is-hidden');

        // 2. 觸發選項淡出和爆炸
        const explosionPromise = triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);
        triggerQuestionFadeOut(clickedOption); // 同步觸發其他選項淡出

        // 等待爆炸動畫和淡出效果完成 (取較長者，這裡假設爆炸時間為主)
        await explosionPromise;
        await delay(QUESTION_FADE_DURATION); // 給淡出一些時間

        // --- 清理爆炸容器樣式 (可選，如果需要復用) ---
        if (DOM.containers.explosion) {
             DOM.containers.explosion.innerHTML = ''; // 確保清空
        }

        // --- 決定下一步 ---
        if (state.currentQuestionIndex < totalQuestions - 1) {
            // 前往下一題
            await prepareNextQuestion();
        } else {
            // 顯示結果
            await showResults();
        }

        // 下一步操作完成後，狀態鎖會在相應的函數內部解除 (displayQuestion 或 switchScreen)
        // 因此這裡不需要解除 state.isBusy
        console.log("handleOptionClick 流程結束");
    }

    /**
     * 觸發當前問題選項的退場動畫
     * @param {HTMLElement} clickedOptionElement - 被點擊的選項元素
     */
    function triggerQuestionFadeOut(clickedOptionElement) {
        console.log("觸發問題退場動畫");
        allOptions.forEach(option => {
            option.style.transitionDelay = ''; // 清除可能存在的入場延遲
            option.style.pointerEvents = 'none'; // 禁用交互
            if (option === clickedOptionElement) {
                option.classList.add('exploded'); // 標記為已爆炸 (視覺上透明)
            } else {
                option.classList.add('fade-out'); // 其他選項淡出
            }
        });
        // 注意：這個函數是同步的，它僅僅是添加 CSS class
        // 實際的動畫持續時間由 CSS 控制，調用者需要 await 適當的延遲
    }

    /**
     * 準備並顯示下一題
     * @returns {Promise<void>} 下一題顯示完成時 resolve
     */
    async function prepareNextQuestion() {
        console.log("準備下一題");
        state.currentQuestionIndex++;
        updateProgressBar(state.currentQuestionIndex + 1); // 更新進度條
        await displayQuestion(state.currentQuestionIndex, false); // 顯示下一題並等待動畫
        // isBusy 狀態由 displayQuestion 內部解除
    }

    /**
     * 觸發當前問題選項的入場動畫
     * @returns {Promise<void>} 所有選項入場動畫完成時 resolve
     */
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
                option.style.transition = ''; // 確保使用 CSS 動畫
                option.style.transitionDelay = `${delay}ms`;
                // 移除隱藏和退場 class，觸發入場動畫
                option.classList.remove('is-hidden', 'fade-out', 'exploded');
                option.style.pointerEvents = ''; // 恢復交互
            });

            // 等待最長的延遲 + 選項動畫時間
            const totalAnimationTime = maxDelay + OPTION_ENTER_DURATION;
            await delay(totalAnimationTime + 100); // 加一點緩衝

            // 清理延遲樣式
            allOptions.forEach(option => { option.style.transitionDelay = ''; });

            console.log("問題入場動畫完成");
            resolve();
        });
    }

    /**
     * 更新進度條顯示
     * @param {number} questionNumber - 當前的問題編號 (1-based)
     */
    function updateProgressBar(questionNumber) {
        if (DOM.elements.progressFill) {
            const progress = (questionNumber / totalQuestions) * 100;
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        }
    }

    /**
     * 計算測驗結果
     * @returns {object | null} 返回對應的結果對象，或在特殊情況下返回 null 或特殊標識
     */
    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== totalQuestions) {
                console.error("錯誤：答案數量與問題數量不符！");
                return results['A'] || null; // 返回預設結果或 null
            }

            // 累加分數
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const questionData = questions[questionIndex];
                if (questionData && questionData.options && questionData.options[answerIndex] && questionData.options[answerIndex].scores) {
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

            state.finalScores = scores; // 保存計算出的分數
            console.log("計算出的原始分數:", scores);

            // --- 判斷結果類型 ---
            const scoreValues = Object.values(scores);
            const scoreFrequency = {}; // 統計每個分數出現的次數

            // 計算每個分數的頻率（用於判斷 SPECIAL 結果）
            scoreValues.forEach(score => {
                // 將分數轉換為字符串作為 key，處理浮點數精度問題
                const scoreKey = score.toFixed(2); // 保留兩位小數
                scoreFrequency[scoreKey] = (scoreFrequency[scoreKey] || 0) + 1;
            });
            console.log("分數頻率 (key 為分數):", scoreFrequency);

            // 檢查是否有 4 個或更多相同的分數值 (SPECIAL 條件)
            for (const scoreKey in scoreFrequency) {
                if (scoreFrequency[scoreKey] >= 4) {
                    console.log("觸發 SPECIAL 結果（分數高度相似）");
                    return results["SPECIAL"];
                }
            }

            // 找出最高分及其對應的類型
            let maxScore = -Infinity;
            let highestTypes = [];
            for (const type in scores) {
                if (scores[type] > maxScore) {
                    maxScore = scores[type];
                    highestTypes = [type]; // 新的最高分，重置類型列表
                } else if (scores[type] === maxScore) {
                    highestTypes.push(type); // 分數相同，添加到列表
                }
            }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);

            // --- 處理結果 ---
            if (highestTypes.length === 1) {
                // 只有一個最高分，直接返回對應結果
                return results[highestTypes[0]];
            } else if (highestTypes.length >= 3) {
                 // 三個或更多類型平分最高，返回 SPECIAL
                 console.log("觸發 SPECIAL 結果（多個類型平分最高）");
                 return results["SPECIAL"];
            } else if (highestTypes.length === 2) {
                // 兩個類型平分最高，進行 tie-breaker
                console.log(`兩個類型平分最高: ${highestTypes.join(', ')}，執行 tie-breaker...`);
                // Tie-breaker 邏輯：選擇在問題選項中 'primary' 屬性出現次數更多的那個類型
                let primaryCount = { [highestTypes[0]]: 0, [highestTypes[1]]: 0 };
                state.userAnswers.forEach((answerIndex, questionIndex) => {
                    const primaryType = questions[questionIndex]?.options[answerIndex]?.primary;
                    if (primaryType && primaryCount.hasOwnProperty(primaryType)) {
                        primaryCount[primaryType]++;
                    }
                });
                console.log("Primary 出現次數:", primaryCount);
                if (primaryCount[highestTypes[0]] > primaryCount[highestTypes[1]]) {
                    console.log(`Tie-breaker: ${highestTypes[0]} 勝出`);
                    return results[highestTypes[0]];
                } else if (primaryCount[highestTypes[1]] > primaryCount[highestTypes[0]]) {
                    console.log(`Tie-breaker: ${highestTypes[1]} 勝出`);
                    return results[highestTypes[1]];
                } else {
                    // 如果 primary 次數也相同，隨機選擇一個或返回 SPECIAL
                    console.log("Tie-breaker 平手，返回 SPECIAL 結果");
                    return results["SPECIAL"];
                }
            } else {
                // 理論上不應到達這裡，但作為保險
                console.warn("無法確定最高分類型，返回默認結果 A");
                return results['A'];
            }

        } catch (error) {
            console.error("計算結果時出錯:", error);
            return results['A'] || null; // 返回預設結果或 null
        }
    }

    /**
     * 將計算出的結果數據填充到結果頁面的 DOM 元素中
     * @param {object} resultData - 計算得出的結果對象
     * @returns {boolean} 是否成功填充數據
     */
    function prepareResultData(resultData) {
        // 檢查結果數據和必要的 DOM 元素是否存在
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
            console.error("準備結果數據失敗：缺少結果數據或必要的 DOM 元素。");
            return false;
        }

        try {
            // 填充標題、副標題和描述
            DOM.elements.resultTitle.textContent = resultData.title || "你的靈魂之書是：";
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || "";
            DOM.elements.resultDescription.textContent = resultData.description || "發生了一些錯誤，無法顯示描述。";

            // --- 填充書本特質 ---
            DOM.elements.traitsContainer.innerHTML = ''; // 清空舊特質
            const typeScores = state.finalScores;

            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法顯示特質：缺少分數數據。");
                 DOM.elements.traitsContainer.innerHTML = '<p>無法計算特質分數。</p>';
            } else if (resultData.title && resultData.title.includes('管理員')) {
                 // 特殊結果：顯示固定文本或所有特質滿分
                 const specialTrait = document.createElement('div');
                 specialTrait.className = 'trait-item';
                 specialTrait.textContent = "能夠理解並欣賞所有情感類型";
                 DOM.elements.traitsContainer.appendChild(specialTrait);
                 // 或者遍歷所有特質並顯示滿分
                 // Object.keys(traitNames).forEach(type => addTraitElement(type, 5));
            } else {
                // 根據分數計算星級並顯示
                const maxScoreValue = Math.max(...Object.values(typeScores)); // 找到最高分值用於歸一化（可選）
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0;
                    // 將分數映射到 0-5 星級 (這裡使用簡單線性映射，可調整)
                    // 假設最高分為 5 分左右對應 5 星
                    const starCount = Math.max(0, Math.min(5, Math.round(score * 1.2))); // 稍微放大分數影響
                    addTraitElement(type, starCount);
                });
            }

            // --- 填充相似和互補書籍 ---
            function populateBookList(element, books) {
                element.innerHTML = ''; // 清空
                if (Array.isArray(books) && books.length > 0) {
                    const ul = document.createElement('ul');
                    books.forEach(bookText => {
                        const li = document.createElement('li');
                        li.textContent = bookText;
                        ul.appendChild(li);
                    });
                    element.appendChild(ul);
                } else {
                    element.innerHTML = '<p>暫無相關書籍推薦。</p>';
                }
            }
            populateBookList(DOM.elements.similarBooks, resultData.similar);
            populateBookList(DOM.elements.complementaryBooks, resultData.complementary);

            // --- 填充分享文本 ---
            DOM.elements.shareText.textContent = resultData.shareText || "快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle";

            console.log("結果數據已準備並填充到頁面");
            return true;
        } catch (error) {
            console.error("準備結果數據時發生錯誤:", error);
            // 可以嘗試填充默認錯誤信息
            DOM.elements.resultTitle.textContent = "發生錯誤";
            DOM.elements.resultDescription.textContent = "無法顯示結果，請稍後再試。";
            return false;
        }
    }

    /**
     * 顯示最終的測驗結果頁面
     * @returns {Promise<void>} 結果頁面顯示完成時 resolve
     */
    async function showResults() {
        console.log("測驗結束，準備顯示結果...");
        // isBusy 鎖應在 handleOptionClick 中設置

        try {
            const resultData = calculateResult(); // 計算結果
            if (!resultData) {
                throw new Error("結果計算返回 null 或 undefined。");
            }

            // 填充結果數據到 DOM
            const dataPrepared = prepareResultData(resultData);
            if (!dataPrepared) {
                throw new Error("結果數據準備或填充失敗。");
            }

            // 切換到結果屏幕
            await switchScreen('test', 'result');

        } catch (error) {
            console.error("顯示結果時出錯:", error);
            // 顯示錯誤信息或回退
            displayInitializationError("無法顯示測驗結果，請重試。");
            await delay(2000); // 短暫顯示錯誤
            await switchScreen('test', 'intro'); // 嘗試回退到首頁
        } finally {
            state.isBusy = false; // *** 解鎖狀態 ***
            console.log("showResults 流程結束");
        }
    }

    /**
     * 向結果頁面添加一個特質及其星級評分
     * @param {string} type - 特質類型 (A, B, C, D, E)
     * @param {number} starCount - 星級數量 (0-5)
     */
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
            const validStars = Math.max(0, Math.min(5, Math.round(starCount))); // 確保星數在 0-5 之間
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars); // 生成星號

            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error(`添加特質 ${type} 時出錯:`, error);
        }
    }

    /**
     * 複製分享文本到剪貼板
     */
    async function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;

        const textToCopy = DOM.elements.shareText.textContent;
        const copyButton = DOM.buttons.copy;
        const originalButtonText = copyButton.textContent;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                // 使用現代 Clipboard API
                await navigator.clipboard.writeText(textToCopy);
                console.log("分享文本已複製到剪貼板 (Clipboard API)");
                copyButton.textContent = '已複製!';
            } else {
                // 使用舊版 document.execCommand 作為備選
                fallbackCopyText(textToCopy);
                // fallbackCopyText 內部會處理按鈕文字
            }
        } catch (error) {
            console.error("複製分享文本時出錯:", error);
            copyButton.textContent = '複製失敗';
        } finally {
            // 短暫顯示提示後恢復按鈕文字
            setTimeout(() => {
                copyButton.textContent = originalButtonText;
            }, 2000);
        }
    }

    /**
     * 使用 document.execCommand 的備選複製方法
     * @param {string} text - 要複製的文本
     */
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // 樣式設置，使其在視圖外且不影響佈局
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices

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

    /**
     * 綁定開始測驗按鈕的事件監聽器
     */
    function bindStartButton() {
        if (DOM.buttons.start) {
            // 先移除舊監聽器，防止重複綁定
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            // 綁定新的監聽器
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("開始測驗按鈕事件已綁定。");
        } else {
            console.error("無法綁定開始按鈕事件：按鈕元素未找到。");
            displayInitializationError("無法啟動測驗，關鍵按鈕丟失。");
        }
    }

    /**
     * 綁定結果頁面的按鈕事件監聽器
     */
    function bindOtherButtons() {
        if (DOM.buttons.restart) {
            DOM.buttons.restart.removeEventListener('click', handleRestartClick); // 防重複
            DOM.buttons.restart.addEventListener('click', handleRestartClick);
        }
        if (DOM.buttons.copy) {
            DOM.buttons.copy.removeEventListener('click', copyShareText); // 防重複
            DOM.buttons.copy.addEventListener('click', copyShareText);
        }
        console.log("其他按鈕事件已綁定。");
    }

    /**
     * 處理重新測驗按鈕點擊事件
     */
    async function handleRestartClick() {
        if (state.isBusy) return; // 防止在轉換過程中點擊
        state.isBusy = true; // 設置鎖
        console.log("重新開始測驗...");
        try {
            await switchScreen('result', 'intro'); // 切換回首頁
        } catch (error) {
            console.error("重新測驗時切換屏幕出錯:", error);
        } finally {
            state.isBusy = false; // *** 解鎖狀態 ***
        }
    }

    // --- 全局錯誤處理 ---
    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
        // 嘗試解除狀態鎖，以防錯誤導致鎖死
        if (state.isBusy) {
            console.warn("因全局錯誤，嘗試解除 isBusy 狀態鎖。");
            state.isBusy = false;
        }
        // 可以選擇顯示一個友好的錯誤提示給用戶
        // displayInitializationError("發生意外錯誤，請刷新頁面重試。");
    });

    window.addEventListener('unhandledrejection', function(event) {
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        if (state.isBusy) {
            console.warn("因未處理的 Promise rejection，嘗試解除 isBusy 狀態鎖。");
            state.isBusy = false;
        }
        // displayInitializationError("發生異步錯誤，請刷新頁面重試。");
    });

    // --- 初始化流程 ---
    console.log("開始初始化...");
    const startTime = performance.now(); // 記錄開始時間

    setViewportHeight(); // 設置視口高度
    window.addEventListener('resize', setViewportHeight); // 監聽窗口大小變化

    if (!cacheDOMElements()) {
        console.error("DOM 元素緩存失敗，初始化中止。");
        return; // 終止執行
    }

    // 執行異步初始化流程
    try {
        state.isBusy = true; // 設置初始鎖
        await preloadAndAnimate(); // 等待資源載入和 Preloader 動畫
        await triggerIntroTransition(); // 等待 Preloader 退場和 Intro 顯示
        bindStartButton(); // 綁定開始按鈕
        bindOtherButtons(); // 綁定其他按鈕
        state.isBusy = false; // *** 解鎖狀態 ***
        const endTime = performance.now();
        console.log(`初始化完成，總耗時: ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
        console.error("初始化過程中發生錯誤:", error);
        displayInitializationError(`初始化失敗: ${error.message || '未知錯誤'}`);
        state.isBusy = false; // 確保解鎖
    }

    // 移除舊的 setInterval 檢查機制，因為 Promise 流程控制更可靠
    console.log("腳本初始化流程結束。");
});
