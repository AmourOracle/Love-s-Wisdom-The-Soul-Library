// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', async function() {
    // 記錄初始化開始時間，用於追蹤總耗時
    const initializationStartTime = performance.now();
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    // 使用單一物件來管理應用程式的狀態
    const state = {
        isBusy: false, // 全局狀態鎖，防止在動畫或轉換過程中觸發新操作
        currentQuestionIndex: 0, // 當前顯示問題的索引 (0-based)
        userAnswers: [], // 儲存使用者選擇的答案索引
        preloadComplete: false, // 圖片是否預載入完成
        introVisible: false, // Intro 頁面是否可見
        resultShowing: false, // 結果頁面是否顯示
        contentRendered: false, // 測驗內容（問題）是否已渲染
        finalScores: {} // 儲存最終計算出的各類型分數
    };

    // --- DOM 元素快取 ---
    // 快取常用的 DOM 元素，避免重複查詢，提高效能
    let DOM = {};
    let allOptions = []; // 用於快取當前問題的所有選項元素

    // --- 從 data.js 獲取數據 ---
    // 檢查全域變數 testData 是否存在且有效
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') {
        console.error("錯誤：找不到有效的 testData 全域變數。請確保 data.js 已正確載入。");
        displayInitializationError("無法載入測驗數據。");
        return; // 終止執行
    }
    // 檢查 testData.questions 陣列是否有效
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) {
        console.error("錯誤：testData.questions 不是有效的陣列或為空。");
        displayInitializationError("測驗問題數據格式錯誤。");
        return; // 終止執行
    }
    // 將數據賦值給常數以便使用
    const questions = testData.questions;
    const results = testData.results || {}; // 結果數據，提供預設空物件
    const traitNames = testData.traitNames || {}; // 特質名稱，提供預設空物件
    const totalQuestions = questions.length; // 問題總數

    // --- 常數 (從 CSS 變數讀取) ---
    // 輔助函數：從 CSS :root 變數讀取時間值（秒）並轉換為毫秒
    function getCssTimeInMillis(variableName, defaultValue = 0) {
        try {
            // 獲取 CSS 變數值
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) {
                // 移除 's' 單位並轉換為浮點數，再乘以 1000
                return parseFloat(value.replace('s', '')) * 1000;
            }
        } catch (e) {
            // 如果讀取失敗，打印警告並返回預設值
            console.warn(`無法讀取 CSS 變數 ${variableName}:`, e);
        }
        return defaultValue;
    }
    // 輔助函數：從 CSS :root 變數讀取整數值
    function getCssInt(variableName, defaultValue = 0) {
        try {
            // 獲取 CSS 變數值
            const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
            if (value) {
                // 直接轉換為整數
                return parseInt(value);
            }
        } catch (e) {
            // 如果讀取失敗，打印警告並返回預設值
            console.warn(`無法讀取 CSS 變數 ${variableName}:`, e);
        }
        return defaultValue;
    }

    // 定義動畫和轉場時間相關的常數 (單位: 毫秒)
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
    const EXPLOSION_DURATION = getCssTimeInMillis('--explosion-duration', 1000); // 爆炸動畫持續時間 (從 CSS 讀取)
    const SVG_GLOW_DELAY = getCssTimeInMillis('--svg-glow-delay', 3000); // SVG 光暈效果延遲
    const QUESTION_FADE_DURATION = 500; // 問題標題/背景淡出入時間
    const OPTIONS_ENTER_START_DELAY = 200; // 選項入場起始延遲
    const OPTION_STAGGER_DELAY = 80; // 選項入場交錯延遲
    const OPTION_ENTER_DURATION = 500; // 選項入場動畫時間 (假設值，應與 CSS 匹配)

    // --- 輔助函數 ---

    /**
     * 設置 CSS 變數 --vh，用於解決移動端瀏覽器地址欄高度變化問題
     */
    function setViewportHeight() {
        try {
            // 計算 1vh 對應的像素值
            let vh = window.innerHeight * 0.01;
            // 設置 CSS 變數
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (e) {
            console.warn("設置視口高度錯誤:", e);
        }
    }

    /**
     * 在 Preloader 或頁面上顯示初始化錯誤訊息
     * @param {string} message - 要顯示的錯誤訊息
     */
    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            // 如果 Preloader 內容區存在，在此顯示錯誤
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            // 確保 Preloader 是可見的
            if (preloader) preloader.classList.add('active');
        } else {
            // 極端情況下，如果連 Preloader 都找不到，直接修改 body 內容
            document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
        }
    }

    /**
     * 快取常用的 DOM 元素，減少重複查詢，提高效能
     * @returns {boolean} 是否成功快取所有必要元素
     */
    function cacheDOMElements() {
        try {
            // 將獲取的元素儲存在 DOM 物件中
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

            // 定義必須存在的關鍵元素列表
            const criticalElements = [
                DOM.containers.intro, DOM.containers.test, DOM.containers.result,
                DOM.containers.preloader, DOM.containers.options, DOM.containers.explosion,
                DOM.containers.startBtnExplosion, DOM.containers.preloaderSvgContainer,
                DOM.elements.preloaderSvg, DOM.elements.testBackground, DOM.elements.questionTitle,
                DOM.elements.startBtnText, DOM.buttons.start, DOM.elements.introTitlePlaceholder
            ];

            // 檢查是否有任何關鍵元素未找到
            if (criticalElements.some(el => !el)) {
                console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID。", DOM);
                const missingIndex = criticalElements.findIndex(el => !el);
                // 打印缺失元素的索引和預期 ID（如果可能）
                console.error(`缺失元素的索引: ${missingIndex}`);
                displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                return false; // 快取失敗
            }

            // 檢查 SVG Group 是否存在 (非致命錯誤)
            const mainTitleGroup = DOM.elements.preloaderSvg?.querySelector('#main-title-group');
            const engSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#eng-subtitle-group');
            const chnSubtitleGroup = DOM.elements.preloaderSvg?.querySelector('#chn-subtitle-group');
            if (!mainTitleGroup || !engSubtitleGroup || !chnSubtitleGroup) {
                console.warn("警告：未能找到所有的 SVG Group ID (main-title-group, eng-subtitle-group, chn-subtitle-group)。請檢查 index.html。");
            }

            // --- 複製 Preloader SVG 到 Intro Title Placeholder ---
            // 確保 Preloader SVG 和目標容器都存在
            if (DOM.elements.preloaderSvg && DOM.elements.introTitlePlaceholder) {
                // 深度複製 SVG 節點
                const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true);
                clonedSvg.id = 'intro-title-svg'; // 設置新的 ID
                // 清理 Preloader 動畫相關的 class 和 style
                clonedSvg.classList.remove('glow-active');
                clonedSvg.style.animation = 'none';
                clonedSvg.style.transform = ''; // 清除可能的 transform
                // 遍歷所有子元素 (path, g) 清理樣式
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
                // 清空 placeholder 並插入複製的 SVG
                DOM.elements.introTitlePlaceholder.innerHTML = '';
                DOM.elements.introTitlePlaceholder.appendChild(clonedSvg);
                console.log("Intro title SVG 已從 Preloader SVG 複製並插入");
            } else {
                console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro title placeholder");
                // 根據需求，這裡也可以返回 false 或顯示錯誤
            }
            // --- End SVG Cloning ---

            console.log("DOM 元素已成功快取");
            return true; // 快取成功
        } catch (error) {
            console.error("快取 DOM 元素時發生錯誤:", error);
            displayInitializationError("頁面初始化時發生錯誤。");
            return false; // 快取失敗
        }
    }

    /**
     * 異步延遲函數，返回一個在指定毫秒數後 resolve 的 Promise
     * @param {number} ms - 延遲的毫秒數
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 等待瀏覽器的下一個動畫幀，返回一個 Promise
     * @returns {Promise<void>}
     */
    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }


    /**
     * 執行 Preloader 退場動畫，並在完成後顯示 Intro 頁面
     * @returns {Promise<void>} 當 Intro 頁面完全顯示時 resolve
     */
    function triggerIntroTransition() {
        return new Promise(async (resolve) => {
            console.log("開始 Preloader 到 Intro 的轉場...");
            // 檢查必要的 DOM 元素
            if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg) {
                console.error("Preloader, Intro container, or Preloader SVG not found for transition.");
                resolve(); // 即使失敗也要 resolve，避免阻塞
                return;
            }

            // --- 修復 Preloader 退場動畫頓點 ---
            // 獲取 SVG 當前的 transform 狀態 (應為 scale(1.05))
            const currentTransform = window.getComputedStyle(DOM.elements.preloaderSvg).transform;
            // 停止入口動畫，但保留其最終 transform 狀態
            DOM.elements.preloaderSvg.style.animation = 'none';
            // 顯式設置 transform，確保退場動畫從正確的縮放比例開始
            DOM.elements.preloaderSvg.style.transform = currentTransform !== 'none' ? currentTransform : 'scale(1.05)';
            // 移除可能存在的光暈效果
            DOM.elements.preloaderSvg.classList.remove('glow-active');

            // 獲取所有需要退場的 SVG 路徑
            const pathsToExit = DOM.elements.preloaderSvg.querySelectorAll(
                '#main-title-group path, #eng-subtitle-group path, #chn-subtitle-group path'
            );
            const preloaderBg = DOM.containers.preloader; // Preloader 背景元素

            // 如果沒有元素需要退場，直接處理
            if (pathsToExit.length === 0 && !preloaderBg) {
                console.warn("警告：找不到任何需要退場的 Preloader Path 或背景。直接顯示 Intro。");
                if (DOM.containers.preloader) {
                    DOM.containers.preloader.classList.remove('active');
                    DOM.containers.preloader.style.display = 'none'; // 確保隱藏
                }
                if (DOM.containers.intro) DOM.containers.intro.classList.add('active'); // 顯示 Intro
                state.introVisible = true;
                resolve(); // 完成
                return;
            }

            let maxExitDelay = 0; // 記錄最長的隨機延遲時間
            const baseExitDelay = 0; // 可以從 0 開始
            const randomExitRange = 800; // 隨機延遲的最大範圍 (毫秒)

            // 為每個路徑添加隨機延遲和退場動畫 class
            pathsToExit.forEach(path => {
                // 清理可能殘留的樣式
                path.style.animation = ''; path.style.opacity = '';
                path.style.transform = ''; path.style.filter = ''; path.style.visibility = '';
                // 計算隨機延遲
                const randomDelay = baseExitDelay + Math.random() * randomExitRange;
                maxExitDelay = Math.max(maxExitDelay, randomDelay); // 更新最大延遲
                // 隨機選擇一種退場動畫效果
                const exitClass = Math.random() < 0.5 ? 'is-exiting-scale-up' : 'is-exiting-scale-down';
                // 使用 setTimeout 確保樣式清理先生效，再添加動畫 class
                setTimeout(() => {
                    path.style.animationDelay = `${randomDelay.toFixed(0)}ms`;
                    path.classList.add(exitClass);
                }, 5); // 短暫延遲
            });

            // 觸發背景淡出動畫
            if (preloaderBg) {
                // 背景淡出稍微延遲開始，增加層次感
                setTimeout(() => {
                    preloaderBg.classList.add('is-exiting-bg');
                }, baseExitDelay + randomExitRange * 0.2);
            }

            // 計算所有退場動畫完成所需的總時間
            const totalExitTime = maxExitDelay + PRELOADER_PATH_EXIT_DURATION;
            console.log(`所有 Preloader Path 預計在 ${totalExitTime.toFixed(0)}ms 後完成退場動畫`);

            // 等待所有退場動畫完成
            await delay(totalExitTime);

            console.log("Preloader 所有 Path 退場動畫結束。");
            // 隱藏 Preloader 容器並清理樣式
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('active', 'is-exiting-bg');
                DOM.containers.preloader.style.display = 'none'; // 確保徹底隱藏
            }
            // 清理路徑上的動畫 class 和延遲
            pathsToExit.forEach(path => {
                path.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down');
                path.style.animation = ''; path.style.animationDelay = '';
            });
            // 清理 SVG 整體的動畫和 transform
            if (DOM.elements.preloaderSvg) {
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.style.transform = '';
            }

            // 激活 Intro 容器（如果尚未顯示）並等待其入場動畫
            if (!state.introVisible && DOM.containers.intro) {
                console.log("激活 Intro 容器...");
                DOM.containers.intro.classList.add('active'); // 觸發 Intro 的 CSS 過渡
                state.introVisible = true;
                // 等待 Intro 頁面自身的淡入動畫完成
                await delay(INTRO_ANIMATION_TOTAL_TIME);
            } else {
                 // 如果 Intro 已顯示，給一點緩衝時間
                 await delay(100);
            }

            console.log("Intro 轉場完成。");
            resolve(); // 整個轉場流程結束
        });
    }

    /**
     * 預載入所有需要的圖片資源，並執行 Preloader 的 SVG 動畫
     * @returns {Promise<void>} 當所有圖片載入且 Preloader 動畫播放完畢後 resolve
     */
    function preloadAndAnimate() {
        return new Promise(async (resolve, reject) => {
            // 檢查必要的 DOM 元素
            if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) {
                reject(new Error("Preloader 或 SVG 元素未找到，無法執行預載入動畫。"));
                return;
            }
            // 檢查問題數據
            if (!questions || questions.length === 0) {
                reject(new Error("問題數據無效，無法確定預載入圖片。"));
                return;
            }

            console.log("顯示 Preloader 並開始動畫...");
            // --- 重置 Preloader 狀態 ---
            if (DOM.containers.preloader) {
                DOM.containers.preloader.classList.remove('is-exiting-bg'); // 移除退場 class
                DOM.containers.preloader.style.display = ''; // 確保 Preloader 容器可見
                DOM.containers.preloader.classList.add('active'); // 激活 Preloader
            }
            // --- 重置 SVG 狀態以準備動畫 ---
            if (DOM.elements.preloaderSvg) {
                // 重置所有路徑的樣式
                DOM.elements.preloaderSvg.querySelectorAll('path').forEach(p => {
                    p.classList.remove('is-exiting-scale-up', 'is-exiting-scale-down'); // 移除退場 class
                    p.style.animation = ''; // 清除舊動畫
                    p.style.animationDelay = '';
                    p.style.opacity = '0'; // 初始完全透明
                    p.style.strokeDashoffset = '1500'; // 重置繪製動畫起點
                    p.style.fillOpacity = '0'; // 初始無填充
                    p.style.visibility = 'visible'; // 確保路徑本身可見，由動畫控制 opacity
                });
                // 等待瀏覽器下一幀，確保樣式重置生效
                await nextFrame();
                // 清除 SVG 整體的舊動畫和 class
                DOM.elements.preloaderSvg.style.animation = '';
                DOM.elements.preloaderSvg.classList.remove('glow-active');
                // 觸發 SVG 入口縮放動畫 (CSS 中應定義 @keyframes preloaderEntranceZoom)
                // 確保動畫設置為 forwards 以保持最終狀態
                DOM.elements.preloaderSvg.style.animation = `preloaderEntranceZoom ${SVG_ANIMATION_TOTAL_ESTIMATED_TIME}ms ease-out forwards`;

                // 在適當延遲後添加光暈效果 (CSS 中應定義 @keyframes glow 和 fadeInGlow)
                setTimeout(() => {
                    // 再次檢查 Preloader 是否仍然處於 active 狀態
                    if (DOM.containers.preloader?.classList.contains('active')) {
                        DOM.elements.preloaderSvg?.classList.add('glow-active');
                    }
                }, SVG_GLOW_DELAY);
            }

            // --- 預載入圖片 ---
            const imageUrls = ['./images/Intro.webp']; // 首頁背景圖
            // 添加所有問題的背景圖
            questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));

            let loadedCount = 0; // 已載入圖片計數
            const totalImages = imageUrls.length; // 總圖片數
            let errorOccurred = false; // 標記是否有圖片載入失敗
            const imagePromises = []; // 儲存每個圖片載入的 Promise

            console.log(`開始預載入 ${totalImages} 張圖片...`);
            // 為每張圖片創建一個載入 Promise
            imageUrls.forEach(url => {
                const promise = new Promise((imgResolve) => { // 簡化：不使用 imgReject
                    const img = new Image();
                    img.onload = () => {
                        loadedCount++;
                        imgResolve(); // 載入成功
                    };
                    img.onerror = () => {
                        console.warn(`圖片載入失敗: ${url}`);
                        loadedCount++;
                        errorOccurred = true; // 標記錯誤
                        imgResolve(); // 即使失敗也 resolve，避免阻塞流程
                    };
                    img.src = url; // 開始載入
                });
                imagePromises.push(promise);
            });

            // 記錄圖片預載入開始時間
            const preloadStartTime = performance.now();
            // 等待所有圖片載入（或失敗）完成
            await Promise.all(imagePromises);
            state.preloadComplete = true; // 標記預載入完成
            const preloadDuration = performance.now() - preloadStartTime; // 計算預載入耗時
            console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}，耗時: ${preloadDuration.toFixed(0)}ms`);

            // --- 等待 SVG 動畫和額外延遲 ---
            // 計算 SVG 動畫預計結束的時間點
            const estimatedSvgEndTime = initializationStartTime + SVG_ANIMATION_TOTAL_ESTIMATED_TIME + PRELOADER_PAUSE_AFTER_SVG;
            const currentTime = performance.now(); // 當前時間
            // 計算還需要等待的時間（確保不為負數）
            const remainingDelay = Math.max(0, estimatedSvgEndTime - currentTime);

            console.log(`等待 SVG 動畫 + 停留剩餘時間: ${remainingDelay.toFixed(0)}ms...`);
            // 等待剩餘的時間
            await delay(remainingDelay);

            console.log("Preloader 動畫和延遲完成。");
            resolve(); // 整個預載入和動畫流程結束
        });
    }


    /**
     * 觸發元素內文字的爆炸效果 (恢復原始參數)
     * @param {HTMLElement} targetElement - 觸發爆炸的目標元素
     * @param {string} textToExplode - 要爆炸的文字
     * @param {HTMLElement} explosionContainer - 容納爆炸粒子的容器
     * @returns {Promise<void>} 爆炸動畫完成時 resolve
     */
    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        return new Promise(resolve => {
            // 檢查必要的元素
            if (!explosionContainer || !targetElement) {
                console.error("Explosion failed: Missing container or target element.");
                resolve(); return;
            }
            // 清空舊的粒子
            explosionContainer.innerHTML = '';

            // 計算爆炸起始點（目標元素中心，相對於爆炸容器）
            const targetRect = targetElement.getBoundingClientRect();
            const containerRect = explosionContainer.getBoundingClientRect();
            let startX = targetRect.left - containerRect.left + targetRect.width / 2;
            let startY = targetRect.top - containerRect.top + targetRect.height / 2;

            const chars = textToExplode.split(''); // 將文字拆分成字符陣列
            let animationsPending = 0; // 計數器，追蹤還有多少粒子動畫未完成

            // 為每個非空白字符創建粒子並設置動畫
            chars.forEach((char) => {
                if (char.trim() === '') return; // 忽略空白字符

                const span = document.createElement('span');
                span.textContent = char;
                span.className = `char-explode`; // 應用 CSS 動畫 class

                // --- 恢復原始的、較大的爆炸效果參數 ---
                const angle = Math.random() * Math.PI * 2; // 隨機角度
                // 使用視窗大小計算基礎半徑，使效果更分散
                const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.4; // 原始較大半徑
                const radius = Math.random() * baseRadius + 50; // 隨機半徑
                const translateX = Math.cos(angle) * radius; // X 軸位移
                const translateY = Math.sin(angle) * radius; // Y 軸位移
                const translateZ = Math.random() * 350 + 250; // 原始較大 Z 軸距離
                const rotateZ = (Math.random() - 0.5) * 480; // 原始較大旋轉角度
                const scale = Math.random() * 3.5 + 2.5; // 原始較大縮放比例
                const animationDelay = Math.random() * 0.15; // 隨機動畫延遲

                // 設置粒子的初始位置和動畫參數 (通過 CSS 變數)
                span.style.left = `${startX}px`; span.style.top = `${startY}px`;
                span.style.setProperty('--tx', `${translateX}px`);
                span.style.setProperty('--ty', `${translateY}px`);
                span.style.setProperty('--tz', `${translateZ}px`);
                span.style.setProperty('--rz', `${rotateZ}deg`);
                span.style.setProperty('--sc', `${scale}`);
                span.style.animationDelay = `${animationDelay}s`;
                // 設置動畫持續時間 (從常數讀取)
                span.style.animationDuration = `${EXPLOSION_DURATION}ms`;

                // 將粒子添加到容器中
                explosionContainer.appendChild(span);
                animationsPending++; // 增加待完成動畫計數

                // 監聽動畫結束事件
                span.addEventListener('animationend', () => {
                    // 動畫結束後從 DOM 中移除粒子
                    if (span.parentNode === explosionContainer) {
                        explosionContainer.removeChild(span);
                    }
                    animationsPending--; // 減少待完成動畫計數
                    // 如果所有粒子動畫都結束了，resolve Promise
                    if (animationsPending === 0) {
                        resolve();
                    }
                }, { once: true }); // 確保事件只觸發一次
            });

             // 如果原始文本就沒有可爆炸的字符，立即 resolve
             if (animationsPending === 0) {
                 resolve();
             }

            // 添加一個超時保險機制，以防 animationend 事件因某些原因未觸發
            setTimeout(() => {
                if (animationsPending > 0) {
                    console.warn("Explosion animation timeout, forcing resolve.");
                    explosionContainer.innerHTML = ''; // 強制清空容器
                    resolve(); // 強制 resolve
                }
            // 超時時間設為動畫持續時間加上一個緩衝值
            }, EXPLOSION_DURATION + 500);
        });
    }


    /**
     * 處理「開始測驗」按鈕的點擊事件
     */
    async function handleStartTestClick() {
        // 記錄點擊事件和當前的 isBusy 狀態
        console.log(`[Click] 開始測驗按鈕被點擊，isBusy: ${state.isBusy}`);
        // 如果當前正忙，直接返回，防止重複觸發
        if (state.isBusy) {
            console.log("正在處理其他操作，請稍候...");
            return;
        }
        // 設置狀態鎖，表示開始處理操作
        state.isBusy = true;
        console.log("[Lock] handleStartTestClick set isBusy = true");

        try {
            // 檢查必要的按鈕和容器是否存在
            if (DOM.buttons.start && DOM.elements.startBtnText && DOM.containers.startBtnExplosion) {
                // 獲取按鈕文字
                const buttonText = DOM.elements.startBtnText.textContent;
                // 隱藏原始文字
                DOM.elements.startBtnText.classList.add('hidden');
                // 觸發按鈕文字的爆炸效果，並等待其完成
                await triggerExplosion(DOM.buttons.start, buttonText, DOM.containers.startBtnExplosion);
                // 讓按鈕本身也消失或標記為已爆炸狀態（可選）
                DOM.buttons.start.classList.add('exploded');
                // 短暫延遲，讓爆炸效果更明顯
                await delay(100);
            }

            // 切換屏幕從 Intro 到 Test，並等待切換動畫完成
            await switchScreen('intro', 'test');
            // 初始化測驗屏幕（顯示第一題等），並等待其完成
            await initializeTestScreen();
            // 標記測驗內容已渲染
            state.contentRendered = true;

        } catch (error) {
            // 捕獲處理過程中的任何錯誤
            console.error("處理開始測驗點擊時出錯:", error);
            // 嘗試回退到 Intro 屏幕
            await switchScreen('test', 'intro');
        } finally {
            // 注意：isBusy 狀態鎖的解除由 initializeTestScreen 或 showResults 內部處理
            // 這裡不需要解除，以確保後續流程正確執行
            console.log("[Unlock Check] handleStartTestClick finished, isBusy should be handled by the next async step (initializeTestScreen).");
        }
    }

    /**
     * 異步切換顯示的屏幕容器
     * @param {string} fromScreenId - 要隱藏的屏幕 ID ('intro', 'test', 'result')
     * @param {string} toScreenId - 要顯示的屏幕 ID ('intro', 'test', 'result')
     * @returns {Promise<void>} 屏幕切換動畫完成時 resolve
     */
    function switchScreen(fromScreenId, toScreenId) {
        return new Promise(async (resolve) => {
            // 獲取來源和目標屏幕元素
            const fromScreen = DOM.containers[fromScreenId];
            const toScreen = DOM.containers[toScreenId];

            // 檢查元素是否存在
            if (!fromScreen || !toScreen) {
                console.error(`屏幕切換失敗: 找不到 ${fromScreenId} 或 ${toScreenId}`);
                resolve(); // 即使失敗也要 resolve
                return;
            }

            console.log(`切換屏幕: ${fromScreenId} -> ${toScreenId}`);

            // --- 執行切換 ---
            // 1. 移除來源屏幕的 active class，觸發其 CSS 淡出
            fromScreen.classList.remove('active');
            // 2. *立即* 添加目標屏幕的 active class，觸發其 CSS 淡入
            toScreen.classList.add('active');
            // 3. 根據目標屏幕決定是否顯示滾動條
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';

            // --- 更新內部狀態 ---
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            // --- 如果切換回 Intro 頁面，重置相關狀態 ---
            if (toScreenId === 'intro') {
                state.currentQuestionIndex = 0; // 重置問題索引
                state.userAnswers = []; // 清空答案
                state.finalScores = {}; // 清空分數
                state.contentRendered = false; // 標記內容未渲染
                // 恢復開始按鈕的狀態
                if (DOM.buttons.start && DOM.elements.startBtnText) {
                    DOM.buttons.start.classList.remove('exploded'); // 移除爆炸樣式
                    DOM.elements.startBtnText.classList.remove('hidden'); // 顯示文字
                }
            }

            // 等待 CSS 過渡動畫完成 (由 --transition-duration 定義)
            await delay(SCREEN_TRANSITION_DURATION);

            console.log(`屏幕切換至 ${toScreenId} 完成`);
            resolve(); // 屏幕切換流程結束
        });
    }

    /**
     * 異步初始化測驗屏幕，顯示第一個問題
     */
    async function initializeTestScreen() {
        // 檢查必要的 DOM 元素
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("無法初始化測驗屏幕，缺少必要元素。");
            // 確保在出錯時解除狀態鎖
            state.isBusy = false;
            console.log("[Unlock] initializeTestScreen error, set isBusy = false");
            return;
        }
        console.log("初始化測驗屏幕...");
        // 重置測驗狀態
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        updateProgressBar(0); // 將進度條重置為 0
        // 異步顯示第一個問題，並等待其完成
        // displayQuestion 函數內部會負責在動畫完成後解除 isBusy 鎖
        await displayQuestion(state.currentQuestionIndex, true);
        // 更新進度條到第一個問題的位置
        updateProgressBar(1);
        console.log("initializeTestScreen 完成");
        // isBusy 的解鎖由 displayQuestion 處理
    }

    /**
     * 異步顯示指定索引的問題及其選項，並處理入場動畫
     * @param {number} index - 問題的索引 (0-based)
     * @param {boolean} [isInitialDisplay=false] - 是否為測驗開始時的第一次顯示
     * @returns {Promise<void>} 問題和選項入場動畫完成時 resolve，並在此函數內解除 isBusy 鎖
     */
    function displayQuestion(index, isInitialDisplay = false) {
        return new Promise(async (resolve) => {
            // 檢查問題索引是否有效
            if (index < 0 || index >= totalQuestions) {
                console.error("無效的問題索引:", index);
                // 確保在出錯時解除狀態鎖
                state.isBusy = false;
                console.log(`[Unlock] displayQuestion invalid index ${index}, set isBusy = false`);
                resolve(); // 即使失敗也要 resolve
                return;
            }
            // 獲取當前問題數據
            const questionData = questions[index];
            const questionNumber = index + 1; // 轉換為 1-based 編號
            console.log(`顯示問題 ${questionNumber}`);

            // --- 並行動畫：背景、標題、選項 ---
            // 異步更新背景圖片
            const bgPromise = (async () => {
                if (DOM.elements.testBackground) {
                    const imageUrl = `./images/Q${questionNumber}.webp`; // 構造圖片 URL
                    if (!isInitialDisplay) {
                        // 非初始顯示：先淡出舊背景
                        DOM.elements.testBackground.classList.add('is-hidden');
                        await delay(QUESTION_FADE_DURATION); // 等待淡出
                        DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`; // 設置新背景
                        await nextFrame(); // 等待樣式應用
                        DOM.elements.testBackground.classList.remove('is-hidden'); // 觸發淡入
                    } else {
                        // 初始顯示：直接設置並確保可見
                        DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                        DOM.elements.testBackground.classList.remove('is-hidden');
                    }
                    // 背景淡入不需要額外等待，與其他動畫並行
                }
            })();

            // 異步更新問題標題
            const titlePromise = (async () => {
                if (DOM.elements.questionTitle) {
                    // 非初始顯示時先淡出舊標題
                    if (!isInitialDisplay) {
                        DOM.elements.questionTitle.classList.add('is-hidden');
                        await delay(10); // 短暫延遲確保 class 生效
                    }
                    // 更新標題文字 (移除前面的數字編號)
                    DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                    await nextFrame(); // 確保文字更新到 DOM
                    // 移除 is-hidden class，觸發 CSS 淡入和位移動畫
                    DOM.elements.questionTitle.classList.remove('is-hidden');
                    // 等待標題入場動畫完成
                    await delay(QUESTION_FADE_DURATION);
                }
            })();

            // 異步生成並顯示選項
            const optionsPromise = (async () => {
                if (DOM.containers.options) {
                    DOM.containers.options.innerHTML = ''; // 清空舊選項
                    allOptions = []; // 清空選項快取

                    // 遍歷選項數據，創建 DOM 元素
                    questionData.options.forEach((optionData, optIndex) => {
                        const optionElement = document.createElement('div');
                        optionElement.className = 'option is-hidden'; // 初始隱藏，準備入場
                        optionElement.style.transition = 'none'; // 暫時禁用 CSS 過渡
                        optionElement.dataset.text = optionData.text; // 儲存文字用於爆炸效果
                        optionElement.dataset.index = optIndex; // 儲存索引
                        optionElement.innerText = optionData.text; // 設置顯示文字
                        optionElement.setAttribute('role', 'button'); // 設置 ARIA 角色
                        optionElement.tabIndex = 0; // 允許鍵盤聚焦

                        // 綁定點擊和鍵盤事件監聽器
                        optionElement.addEventListener('click', handleOptionClick);
                        optionElement.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault(); // 防止空格鍵滾動頁面
                                handleOptionClick(e); // 觸發點擊處理
                            }
                        });

                        DOM.containers.options.appendChild(optionElement); // 添加到容器
                        allOptions.push(optionElement); // 加入快取
                    });

                    // 短暫延遲後觸發選項入場動畫
                    await delay(isInitialDisplay ? 150 : 50);
                    // 等待所有選項的交錯入場動畫完成
                    await triggerQuestionEnterAnimation();

                } else {
                    console.error("找不到選項容器 #options-container");
                }
            })();

            // 等待所有並行動畫（背景、標題、選項）大致完成
            await Promise.all([bgPromise, titlePromise, optionsPromise]);

            console.log(`問題 ${questionNumber} 顯示完成。`);
            // *** 在所有入場動畫完成後，解除狀態鎖 ***
            state.isBusy = false;
            console.log(`[Unlock] displayQuestion ${questionNumber} finished, set isBusy = false`);
            resolve(); // 問題顯示流程結束
        });
    }


    /**
     * 處理選項點擊事件
     * @param {Event} event - 點擊或鍵盤事件對象
     */
    async function handleOptionClick(event) {
        const clickedOption = event.currentTarget; // 被點擊的選項元素
        const optionIndex = parseInt(clickedOption.dataset.index); // 獲取選項索引
        const questionIndex = state.currentQuestionIndex; // 獲取當前問題索引

        // 記錄點擊事件和 isBusy 狀態
        console.log(`[Click] 選項 ${optionIndex + 1} (問題 ${questionIndex + 1}) 被點擊, isBusy: ${state.isBusy}`);
        // 防止在處理過程中重複點擊或點擊已處理的選項
        if (state.isBusy || isNaN(optionIndex) || isNaN(questionIndex) || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            return;
        }

        // *** 設置狀態鎖 ***
        state.isBusy = true;
        console.log(`[Lock] handleOptionClick set isBusy = true for Q${questionIndex + 1}`);
        // 記錄使用者答案
        state.userAnswers[questionIndex] = optionIndex;

        // --- 執行當前問題的退場動畫 ---
        // 1. 淡出背景和問題標題
        if (DOM.elements.testBackground) DOM.elements.testBackground.classList.add('is-hidden');
        if (DOM.elements.questionTitle) DOM.elements.questionTitle.classList.add('is-hidden');

        // 2. 觸發被點擊選項的爆炸效果，並等待其完成
        const explosionPromise = triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);
        // 3. 同步觸發其他選項的淡出效果 (添加 CSS class)
        triggerQuestionFadeOut(clickedOption);

        // 等待爆炸動畫完成，並額外等待一段時間讓淡出效果也完成
        await explosionPromise;
        await delay(QUESTION_FADE_DURATION); // 等待淡出時間

        // 清理爆炸效果容器（可選，如果需要復用）
        if (DOM.containers.explosion) {
            DOM.containers.explosion.innerHTML = '';
        }

        // --- 決定下一步：顯示下一題或顯示結果 ---
        try {
            if (state.currentQuestionIndex < totalQuestions - 1) {
                // 如果還有下一題，準備並顯示下一題
                // prepareNextQuestion 內部會調用 displayQuestion，並由 displayQuestion 解鎖 isBusy
                await prepareNextQuestion();
            } else {
                // 如果是最後一題，顯示結果
                // showResults 內部會負責解鎖 isBusy
                await showResults();
            }
        } catch (error) {
            // 如果在準備下一題或顯示結果時出錯
            console.error("處理選項點擊後續步驟時出錯:", error);
            // 確保解除狀態鎖
            state.isBusy = false;
            console.log("[Unlock] handleOptionClick error in next step, set isBusy = false");
            // 嘗試回退到首頁
            await switchScreen('test', 'intro');
        }
        // isBusy 的解鎖由 prepareNextQuestion 或 showResults 負責
        console.log("handleOptionClick 流程結束");
    }

    /**
     * 觸發當前問題所有選項的退場動畫（為被點擊的添加 exploded，其他的添加 fade-out）
     * @param {HTMLElement} clickedOptionElement - 被點擊的選項元素
     */
    function triggerQuestionFadeOut(clickedOptionElement) {
        console.log("觸發問題退場動畫");
        // 遍歷當前問題的所有選項元素
        allOptions.forEach(option => {
            option.style.transitionDelay = ''; // 清除可能存在的入場延遲
            option.style.pointerEvents = 'none'; // 禁用交互
            // 根據是否為被點擊的選項，添加不同的 CSS class
            if (option === clickedOptionElement) {
                option.classList.add('exploded'); // 標記為已爆炸 (視覺上變透明或縮小)
            } else {
                option.classList.add('fade-out'); // 其他選項淡出
            }
        });
        // 注意：此函數僅添加 class，實際動畫由 CSS 控制
    }

    /**
     * 異步準備並顯示下一題
     * @returns {Promise<void>} 下一題顯示完成時 resolve
     */
    async function prepareNextQuestion() {
        // isBusy 鎖應由調用者 (handleOptionClick) 設置
        console.log("準備下一題");
        // 增加問題索引
        state.currentQuestionIndex++;
        // 更新進度條
        updateProgressBar(state.currentQuestionIndex + 1);
        // 異步顯示下一題，displayQuestion 會在完成後解鎖 isBusy
        await displayQuestion(state.currentQuestionIndex, false);
    }

    /**
     * 觸發當前問題選項的入場動畫（交錯效果）
     * @returns {Promise<void>} 所有選項入場動畫完成時 resolve
     */
    function triggerQuestionEnterAnimation() {
        return new Promise(async (resolve) => {
            console.log("觸發問題入場動畫");
            // 檢查是否有選項需要處理
            if (!allOptions || allOptions.length === 0) {
                resolve(); // 如果沒有選項，直接完成
                return;
            }

            let maxDelay = 0; // 記錄最長的動畫延遲時間
            // 遍歷所有選項，設置入場動畫延遲
            allOptions.forEach((option, index) => {
                const delay = OPTIONS_ENTER_START_DELAY + index * OPTION_STAGGER_DELAY;
                maxDelay = Math.max(maxDelay, delay); // 更新最大延遲
                option.style.transition = ''; // 確保使用 CSS 動畫而非過渡
                option.style.transitionDelay = `${delay}ms`; // 設置 CSS 過渡延遲（將被動畫延遲覆蓋，但保留以防萬一）
                option.style.animationDelay = `${delay}ms`; // 設置 CSS 動畫延遲
                // 移除隱藏和退場相關的 class，觸發 CSS 中定義的入場動畫
                option.classList.remove('is-hidden', 'fade-out', 'exploded');
                option.style.pointerEvents = ''; // 恢復選項的交互性
            });

            // 計算動畫總時間（最長延遲 + 單個選項動畫時長）
            const totalAnimationTime = maxDelay + OPTION_ENTER_DURATION;
            // 等待動畫完成，並增加一點緩衝時間
            await delay(totalAnimationTime + 100);

            // 動畫完成後，清理選項上的延遲樣式
            allOptions.forEach(option => {
                 option.style.transitionDelay = '';
                 option.style.animationDelay = ''; // 也清理動畫延遲
            });

            console.log("問題入場動畫完成");
            resolve(); // 所有選項入場完成
        });
    }

    /**
     * 更新頂部進度條的顯示寬度
     * @param {number} questionNumber - 當前的問題編號 (1-based)
     */
    function updateProgressBar(questionNumber) {
        if (DOM.elements.progressFill) {
            // 計算進度百分比
            const progress = (questionNumber / totalQuestions) * 100;
            // 設置進度條填充元素的寬度，限制在 0% 到 100% 之間
            DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        }
    }

    /**
     * 根據使用者答案計算最終的測驗結果類型
     * @returns {object | null} 返回 data.js 中定義的結果對象，或在無法確定時返回預設結果或 null
     */
    function calculateResult() {
        try {
            // 初始化各類型分數
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            // 檢查答案數量是否正確
            if (state.userAnswers.length !== totalQuestions) {
                console.error("錯誤：答案數量與問題數量不符！");
                return results['A'] || null; // 返回預設結果 A 或 null
            }

            // --- 累加分數 ---
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const questionData = questions[questionIndex];
                // 檢查問題、選項和分數數據是否存在
                if (questionData?.options?.[answerIndex]?.scores) {
                    const optionScores = questionData.options[answerIndex].scores;
                    // 遍歷該選項的所有分數，累加到總分
                    for (const type in optionScores) {
                        if (scores.hasOwnProperty(type)) { // 確保類型有效
                            scores[type] += optionScores[type];
                        }
                    }
                } else {
                    // 如果數據缺失，打印警告
                    console.warn(`警告：問題 ${questionIndex + 1} 的選項 ${answerIndex + 1} 分數數據缺失。`);
                }
            });

            // 保存最終計算出的分數到 state
            state.finalScores = scores;
            console.log("計算出的原始分數:", scores);

            // --- 判斷結果類型 ---
            const scoreValues = Object.values(scores); // 獲取所有分數值
            const scoreFrequency = {}; // 用於統計每個分數值出現的次數

            // 計算分數頻率，用於判斷 SPECIAL 結果（分數高度相似）
            scoreValues.forEach(score => {
                const scoreKey = score.toFixed(2); // 使用保留兩位小數的字符串作為 key
                scoreFrequency[scoreKey] = (scoreFrequency[scoreKey] || 0) + 1;
            });
            console.log("分數頻率 (key 為分數):", scoreFrequency);

            // 檢查是否有 4 個或更多相同的分數值
            for (const scoreKey in scoreFrequency) {
                if (scoreFrequency[scoreKey] >= 4) {
                    console.log("觸發 SPECIAL 結果（分數高度相似）");
                    return results["SPECIAL"]; // 返回特殊結果
                }
            }

            // --- 找出最高分和對應的類型 ---
            let maxScore = -Infinity; // 初始化最高分
            let highestTypes = []; // 儲存最高分對應的類型
            for (const type in scores) {
                if (scores[type] > maxScore) {
                    // 發現新的最高分
                    maxScore = scores[type];
                    highestTypes = [type]; // 重置最高分類型列表
                } else if (scores[type] === maxScore) {
                    // 分數與當前最高分相同，添加到列表
                    highestTypes.push(type);
                }
            }
            console.log("最高分類型:", highestTypes, "最高分:", maxScore);

            // --- 根據最高分情況返回結果 ---
            if (highestTypes.length === 1) {
                // 只有一個最高分類型
                return results[highestTypes[0]];
            } else if (highestTypes.length >= 3) {
                 // 三個或更多類型平分最高，返回 SPECIAL
                 console.log("觸發 SPECIAL 結果（多個類型平分最高）");
                 return results["SPECIAL"];
            } else if (highestTypes.length === 2) {
                // 兩個類型平分最高，執行 tie-breaker 邏輯
                console.log(`兩個類型平分最高: ${highestTypes.join(', ')}，執行 tie-breaker...`);
                // Tie-breaker：比較兩個類型在使用者選擇的選項中作為 'primary' 屬性出現的次數
                let primaryCount = { [highestTypes[0]]: 0, [highestTypes[1]]: 0 };
                state.userAnswers.forEach((answerIndex, questionIndex) => {
                    // 獲取使用者選擇選項的 primary 類型
                    const primaryType = questions[questionIndex]?.options[answerIndex]?.primary;
                    // 如果 primary 類型是平分的兩個類型之一，則計數加一
                    if (primaryType && primaryCount.hasOwnProperty(primaryType)) {
                        primaryCount[primaryType]++;
                    }
                });
                console.log("Primary 出現次數:", primaryCount);
                // 比較 primary 出現次數
                if (primaryCount[highestTypes[0]] > primaryCount[highestTypes[1]]) {
                    console.log(`Tie-breaker: ${highestTypes[0]} 勝出`);
                    return results[highestTypes[0]];
                } else if (primaryCount[highestTypes[1]] > primaryCount[highestTypes[0]]) {
                    console.log(`Tie-breaker: ${highestTypes[1]} 勝出`);
                    return results[highestTypes[1]];
                } else {
                    // 如果 primary 次數也相同，則返回 SPECIAL 結果
                    console.log("Tie-breaker 平手，返回 SPECIAL 結果");
                    return results["SPECIAL"];
                }
            } else {
                // 理論上不應執行到此，作為保險返回預設結果
                console.warn("無法確定最高分類型（未知情況），返回默認結果 A");
                return results['A'];
            }

        } catch (error) {
            console.error("計算結果時出錯:", error);
            return results['A'] || null; // 出錯時返回預設結果 A 或 null
        }
    }

    /**
     * 將計算出的結果數據填充到結果頁面的對應 DOM 元素中
     * @param {object} resultData - 計算得出的結果對象 (來自 data.js)
     * @returns {boolean} 是否成功填充數據
     */
    function prepareResultData(resultData) {
        // 檢查結果數據和必要的 DOM 元素是否存在
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
            console.error("準備結果數據失敗：缺少結果數據或必要的 DOM 元素。");
            return false; // 填充失敗
        }

        try {
            // 填充標題、副標題和描述
            DOM.elements.resultTitle.textContent = resultData.title || "你的靈魂之書是："; // 提供預設值
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || "";
            DOM.elements.resultDescription.textContent = resultData.description || "發生了一些錯誤，無法顯示描述。";

            // --- 填充書本特質 ---
            DOM.elements.traitsContainer.innerHTML = ''; // 清空舊特質
            const typeScores = state.finalScores; // 獲取計算出的分數

            // 檢查分數數據是否存在
            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法顯示特質：缺少分數數據。");
                 DOM.elements.traitsContainer.innerHTML = '<p>無法計算特質分數。</p>';
            } else if (resultData.title && resultData.title.includes('管理員')) {
                 // 特殊結果 "靈魂圖書管理員" 的處理
                 const specialTrait = document.createElement('div');
                 specialTrait.className = 'trait-item';
                 specialTrait.textContent = "能夠理解並欣賞所有情感類型"; // 顯示固定文本
                 DOM.elements.traitsContainer.appendChild(specialTrait);
            } else {
                // 正常結果：根據分數計算星級並顯示
                // 找到最高分值，用於歸一化計算星級（可選，使星級更具相對性）
                const maxScoreValue = Math.max(...Object.values(typeScores));
                // 遍歷所有特質類型 (A, B, C, D, E)
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0; // 獲取該類型的分數
                    // 將分數映射到 0-5 星 (這裡使用簡單線性映射，可根據需要調整)
                    // 假設最高分 5 分左右對應 5 星，稍微放大分數影響
                    const starCount = Math.max(0, Math.min(5, Math.round(score * 1.2)));
                    // 添加特質元素到頁面
                    addTraitElement(type, starCount);
                });
            }

            // --- 填充相似和互補書籍列表 ---
            // 輔助函數，用於生成書籍列表的 HTML
            function populateBookList(element, books) {
                element.innerHTML = ''; // 清空舊列表
                if (Array.isArray(books) && books.length > 0) {
                    const ul = document.createElement('ul');
                    books.forEach(bookText => {
                        const li = document.createElement('li');
                        li.textContent = bookText; // 設置列表項文字
                        ul.appendChild(li);
                    });
                    element.appendChild(ul); // 將列表添加到指定元素
                } else {
                    // 如果沒有書籍數據，顯示提示信息
                    element.innerHTML = '<p>暫無相關書籍推薦。</p>';
                }
            }
            // 調用輔助函數填充列表
            populateBookList(DOM.elements.similarBooks, resultData.similar);
            populateBookList(DOM.elements.complementaryBooks, resultData.complementary);

            // --- 填充分享文本 ---
            DOM.elements.shareText.textContent = resultData.shareText || "快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle"; // 提供預設分享文本

            console.log("結果數據已準備並填充到頁面");
            return true; // 填充成功
        } catch (error) {
            console.error("準備結果數據時發生錯誤:", error);
            // 嘗試在頁面上顯示錯誤信息
            DOM.elements.resultTitle.textContent = "發生錯誤";
            DOM.elements.resultDescription.textContent = "無法顯示結果，請稍後再試。";
            return false; // 填充失敗
        }
    }

    /**
     * 異步顯示最終的測驗結果頁面
     * @returns {Promise<void>} 結果頁面顯示完成時 resolve
     */
    async function showResults() {
        // isBusy 鎖應由調用者 (handleOptionClick) 設置
        console.log("測驗結束，準備顯示結果...");
        try {
            // 1. 計算結果
            const resultData = calculateResult();
            if (!resultData) {
                throw new Error("結果計算返回 null 或 undefined。");
            }
            // 2. 將結果數據填充到 DOM
            const dataPrepared = prepareResultData(resultData);
            if (!dataPrepared) {
                throw new Error("結果數據準備或填充失敗。");
            }
            // 3. 切換到結果屏幕，並等待動畫完成
            await switchScreen('test', 'result');

        } catch (error) {
            // 捕獲計算、填充或切換過程中的錯誤
            console.error("顯示結果時出錯:", error);
            // 顯示錯誤提示給用戶
            displayInitializationError("無法顯示測驗結果，請重試。");
            // 等待一段時間讓用戶看到錯誤
            await delay(2000);
            // 嘗試回退到首頁
            await switchScreen('test', 'intro');
        } finally {
            // *** 無論成功或失敗，最終都要解除狀態鎖 ***
            state.isBusy = false;
            console.log("[Unlock] showResults finished, set isBusy = false");
        }
    }

    /**
     * 向結果頁面的特質容器中添加一個特質及其星級評分
     * @param {string} type - 特質類型 (A, B, C, D, E)
     * @param {number} starCount - 星級數量 (0-5)
     */
    function addTraitElement(type, starCount) {
        // 檢查容器是否存在
        if (!DOM.elements.traitsContainer) return;
        try {
            // 創建特質項目的容器 div
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';

            // 創建顯示特質名稱的 span
            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            // 從 traitNames 中獲取名稱，如果找不到則直接使用類型字母
            traitName.textContent = traitNames[type] || type;

            // 創建顯示星級的 span
            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            // 確保星數在 0 到 5 之間
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            // 生成實心星和空心星字符串
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);

            // 將名稱和星級添加到特質項目容器
            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            // 將特質項目容器添加到頁面上的總容器
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error(`添加特質 ${type} 時出錯:`, error);
        }
    }

    /**
     * 異步複製分享文本到使用者剪貼板
     */
    async function copyShareText() {
        // 檢查必要的元素是否存在
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;

        const textToCopy = DOM.elements.shareText.textContent; // 獲取要複製的文本
        const copyButton = DOM.buttons.copy; // 獲取按鈕元素
        const originalButtonText = copyButton.textContent; // 保存按鈕原始文字

        try {
            // 優先使用現代、安全的 Clipboard API (需要 HTTPS 或 localhost)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
                console.log("分享文本已複製到剪貼板 (Clipboard API)");
                copyButton.textContent = '已複製!'; // 提示用戶複製成功
            } else {
                // 如果 Clipboard API 不可用，使用舊的 document.execCommand 作為備選
                console.log("Clipboard API 不可用，嘗試使用 fallback 方法。");
                fallbackCopyText(textToCopy); // 調用備選方法
            }
        } catch (error) {
            // 捕獲複製過程中可能發生的錯誤
            console.error("複製分享文本時出錯:", error);
            copyButton.textContent = '複製失敗'; // 提示用戶複製失敗
        } finally {
            // 無論成功或失敗，在 2 秒後恢復按鈕的原始文字
            setTimeout(() => {
                copyButton.textContent = originalButtonText;
            }, 2000);
        }
    }

    /**
     * 使用 document.execCommand 的備選複製方法（兼容性較好，但可能被瀏覽器限制）
     * @param {string} text - 要複製的文本
     */
    function fallbackCopyText(text) {
        // 創建一個臨時的 textarea 元素
        const textArea = document.createElement("textarea");
        textArea.value = text; // 將文本放入 textarea

        // 設置樣式，使其在視圖外且不影響頁面佈局
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';

        // 將 textarea 添加到頁面
        document.body.appendChild(textArea);
        // 選中 textarea 中的文本
        textArea.focus();
        textArea.select();
        // 嘗試選中所有內容（兼容移動設備）
        textArea.setSelectionRange(0, 99999);

        let success = false;
        try {
            // 執行複製命令
            success = document.execCommand('copy');
            if (success) {
                console.log("分享文本已複製到剪貼板 (execCommand)");
                if (DOM.buttons.copy) DOM.buttons.copy.textContent = '已複製!';
            } else {
                console.error('使用 execCommand 複製失敗。');
                if (DOM.buttons.copy) DOM.buttons.copy.textContent = '複製失敗';
            }
        } catch (err) {
            // 捕獲執行命令時的錯誤
            console.error('無法使用 execCommand 複製:', err);
            if (DOM.buttons.copy) DOM.buttons.copy.textContent = '複製失敗';
        }

        // 從頁面移除臨時的 textarea
        document.body.removeChild(textArea);
    }

    /**
     * 綁定「開始測驗」按鈕的點擊事件監聽器
     */
    function bindStartButton() {
        if (DOM.buttons.start) {
            // 先移除可能存在的舊監聽器，防止重複綁定導致多次觸發
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            // 綁定新的監聽器
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("開始測驗按鈕事件已綁定。");
        } else {
            // 如果按鈕元素未找到，記錄錯誤並顯示初始化錯誤
            console.error("無法綁定開始按鈕事件：按鈕元素未找到。");
            displayInitializationError("無法啟動測驗，關鍵按鈕丟失。");
        }
    }

    /**
     * 綁定結果頁面的「重新測驗」和「複製」按鈕的事件監聽器
     */
    function bindOtherButtons() {
        // 綁定重新測驗按鈕
        if (DOM.buttons.restart) {
            DOM.buttons.restart.removeEventListener('click', handleRestartClick); // 防重複
            DOM.buttons.restart.addEventListener('click', handleRestartClick);
        }
        // 綁定複製按鈕
        if (DOM.buttons.copy) {
            DOM.buttons.copy.removeEventListener('click', copyShareText); // 防重複
            DOM.buttons.copy.addEventListener('click', copyShareText);
        }
        console.log("其他按鈕（重新測驗、複製）事件已綁定。");
    }

    /**
     * 處理「重新測驗」按鈕的點擊事件
     */
    async function handleRestartClick() {
        // 記錄點擊事件和 isBusy 狀態
        console.log(`[Click] 重新測驗按鈕被點擊, isBusy: ${state.isBusy}`);
        // 如果當前正忙，直接返回
        if (state.isBusy) return;
        // 設置狀態鎖
        state.isBusy = true;
        console.log("[Lock] handleRestartClick set isBusy = true");
        console.log("重新開始測驗...");
        try {
            // 切換屏幕從 Result 回到 Intro，並等待完成
            await switchScreen('result', 'intro');
        } catch (error) {
            // 捕獲切換屏幕時的錯誤
            console.error("重新測驗時切換屏幕出錯:", error);
        } finally {
            // *** 無論成功或失敗，最終都要解除狀態鎖 ***
            state.isBusy = false;
            console.log("[Unlock] handleRestartClick finished, set isBusy = false");
        }
    }

    // --- 全局錯誤處理 ---
    // 監聽未捕獲的同步錯誤
    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "發生在:", event.filename, ":", event.lineno);
        // 嘗試解除狀態鎖，以防錯誤導致應用卡死
        if (state.isBusy) {
            console.warn("因全局錯誤，嘗試解除 isBusy 狀態鎖。");
            state.isBusy = false;
        }
        // 可以在此處添加更友好的用戶提示，例如彈出一個提示框
        // displayInitializationError("發生意外錯誤，建議刷新頁面重試。");
    });

    // 監聽未處理的 Promise rejection (異步錯誤)
    window.addEventListener('unhandledrejection', function(event) {
        console.error('捕獲到未處理的 Promise rejection:', event.reason);
        // 嘗試解除狀態鎖
        if (state.isBusy) {
            console.warn("因未處理的 Promise rejection，嘗試解除 isBusy 狀態鎖。");
            state.isBusy = false;
        }
        // displayInitializationError("發生異步錯誤，建議刷新頁面重試。");
    });

    // --- 初始化流程 ---
    console.log("開始執行初始化流程...");

    // 1. 設置視口高度單位，並監聽 resize 事件
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    // 2. 快取 DOM 元素
    if (!cacheDOMElements()) {
        // 如果關鍵元素缺失，則無法繼續初始化
        console.error("DOM 元素緩存失敗，初始化中止。");
        return; // 終止腳本執行
    }

    // 3. 執行異步的預載入和動畫流程
    try {
        // 設置初始狀態鎖
        state.isBusy = true;
        console.log("[Lock] Initialization start, set isBusy = true");
        // 等待圖片預載入和 Preloader 動畫完成
        await preloadAndAnimate();
        // 等待 Preloader 退場和 Intro 頁面顯示完成
        await triggerIntroTransition();
        // 綁定按鈕事件
        bindStartButton();
        bindOtherButtons();
        // *** 初始化完成後，解除狀態鎖 ***
        state.isBusy = false;
        console.log("[Unlock] Initialization finished, set isBusy = false");
        // 記錄初始化總耗時
        const initializationEndTime = performance.now();
        console.log(`初始化流程完成，總耗時: ${(initializationEndTime - initializationStartTime).toFixed(0)}ms`);
    } catch (error) {
        // 捕獲初始化過程中的任何錯誤
        console.error("初始化過程中發生錯誤:", error);
        // 顯示錯誤信息給用戶
        displayInitializationError(`初始化失敗: ${error.message || '未知錯誤'}`);
        // 確保解除狀態鎖
        state.isBusy = false;
        console.log("[Unlock] Initialization error, set isBusy = false");
    }

    console.log("腳本初始化流程結束。");
});
