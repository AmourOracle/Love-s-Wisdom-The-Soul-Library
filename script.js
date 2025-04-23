// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false,     // 防止屏幕切換動畫重疊
        isTransitioning: false, // 防止問題轉場時重複點擊
        currentQuestionIndex: 0,
        userAnswers: [],
        // --- 修改：移除 preloadComplete，改用 loadingFinished 和 minTimeElapsed ---
        // preloadComplete: false,
        loadingFinished: false, // 新增：標記資源是否載入完成
        minTimeElapsed: false,  // 新增：標記是否已達到最小顯示時間
        loadStartTime: null,    // 新增：記錄預載入開始時間
        resultShowing: false,
        contentRendered: false,
        finalScores: {}
    };

    // --- DOM 元素快取 ---
    let DOM = {}; // 在 DOMContentLoaded 後填充
    let allOptions = []; // 選項元素的引用數組

    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') {
        console.error("錯誤：找不到有效的 testData。請確保 data.js 正確載入且格式正確。");
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

    // --- 新增：最小預載入時間設定 ---
    const MIN_LOADING_TIME = 2500; // 最小時間 (毫秒)

    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }

    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red;">${message}</p>`;
            const preloader = document.getElementById('preloader');
            if(preloader) preloader.classList.add('active');
        } else {
            document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
        }
    }

    // 快取 DOM 元素
    function cacheDOMElements() {
         try {
             DOM = {
                containers: {
                    intro: document.getElementById('intro-container'),
                    test: document.getElementById('test-container'),
                    result: document.getElementById('result-container'),
                    preloader: document.getElementById('preloader'),
                    options: document.getElementById('options-container'),
                    explosion: document.getElementById('explosion-container')
                },
                elements: {
                    preloaderProgress: document.getElementById('preloader-progress'), // 修改：從 buttons 移到 elements
                    introTitleSVG: document.getElementById('intro-title-svg'),         // 新增
                    introCardBackground: document.querySelector('#intro-container .card-background'), // 新增
                    introCardContent: document.querySelector('#intro-container .card-content'),      // 新增
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
                },
                buttons: {
                    start: document.getElementById('start-test'),
                    startButtonText: document.querySelector('#start-test .button-text'), // 新增：按鈕內的文字 span
                    copy: document.getElementById('copy-btn'),
                    restart: document.getElementById('restart-btn')
                }
            };
            // 檢查關鍵元素
            const requiredElements = [
                DOM.containers.intro, DOM.containers.test, DOM.containers.result,
                DOM.containers.preloader, DOM.containers.options, DOM.containers.explosion,
                DOM.elements.preloaderProgress, DOM.elements.introTitleSVG, DOM.elements.introCardBackground,
                DOM.elements.introCardContent, DOM.elements.testBackground, DOM.elements.questionTitle,
                DOM.buttons.start, DOM.buttons.startButtonText
            ];
            if (requiredElements.some(el => !el)) {
                 console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 ID 和 class 是否正確。缺失的元素可能包括:", requiredElements.map((el, i) => el ? '' : ['intro','test','result','preloader','options','explosion','preloaderProgress','introTitleSVG','introCardBackground','introCardContent','testBackground','questionTitle','start','startButtonText'][i]).filter(Boolean).join(', '));
                 displayInitializationError("頁面結構錯誤，無法啟動測驗。");
                 return false;
            }
            console.log("DOM 元素已快取");
            return true;
         } catch (error) {
             console.error("快取 DOM 元素時出錯:", error);
             displayInitializationError("頁面初始化時發生錯誤。");
             return false;
         }
    }

    // --- 預載入邏輯 (修改) ---
    function preloadResources() {
        if (!DOM.containers?.preloader) {
            console.warn("找不到 preloader 元素，跳過預載入。");
            state.loadingFinished = true;
            state.minTimeElapsed = true; // 跳過預載入，直接認為時間已到
            bindStartButton();
            return;
        }
        if (!questions || questions.length === 0) {
             console.warn("無法預載入資源：缺少 questions 數據。");
             state.loadingFinished = true;
             state.minTimeElapsed = true;
             DOM.containers.preloader.classList.remove('active');
             bindStartButton();
             return;
        }

        // --- 修改：確保 preloader 可見並設定開始時間 ---
        DOM.containers.preloader.classList.add('active');
        DOM.containers.preloader.style.display = 'flex'; // 確保 display 不是 none
        state.loadStartTime = Date.now(); // 設定開始時間
        console.log("Preloader 已啟動，開始預載入資源...");

        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0;
        const totalResources = imageUrls.length; // 將來可加入字體、音頻等
        let errorOccurred = false;

        function resourceLoaded(isError = false) {
            loadedCount++;
            if (isError) errorOccurred = true;
            const progress = Math.round((loadedCount / totalResources) * 100);
            updateProgress(progress); // 使用新的進度更新函數

            if (loadedCount >= totalResources) {
                console.log(`資源預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);
                state.loadingFinished = true;
                checkLoadingComplete(); // 檢查是否達到最小時間
            }
        }

        imageUrls.forEach(url => {
             const img = new Image();
             img.src = url;
             img.onload = () => resourceLoaded(false);
             img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); resourceLoaded(true); };
        });

        // --- 新增：設置最小時間檢查計時器 ---
        setTimeout(() => {
             console.log("最小顯示時間已到達");
             state.minTimeElapsed = true;
             checkLoadingComplete(); // 再次檢查，如果資源此時也載入完成則觸發
        }, MIN_LOADING_TIME);
    }

    // --- 新增：更新進度函數 ---
    function updateProgress(percentage) {
        if (DOM.elements.preloaderProgress) {
            DOM.elements.preloaderProgress.textContent = `${Math.round(percentage)}%`;
        }
    }

    // --- 新增：檢查載入是否完全完成 (資源 + 時間) ---
    function checkLoadingComplete() {
        if (!DOM.containers?.preloader) return; // 如果 preloader 不存在則退出

        const elapsedTime = Date.now() - state.loadStartTime;
        // 確保 state.minTimeElapsed 在時間到達後被正確設置 (由 setTimeout 設置)
        // state.minTimeElapsed = elapsedTime >= MIN_LOADING_TIME; // 不再在此計算，依賴 setTimeout

        console.log(`檢查完成狀態: loadingFinished=${state.loadingFinished}, minTimeElapsed=${state.minTimeElapsed}`);

        // 只有當資源載入完成且最小時間已到，才隱藏 preloader
        if (state.loadingFinished && state.minTimeElapsed && DOM.containers.preloader.classList.contains('active')) {
             hidePreloaderAndShowIntro();
        }
        // 注意：如果資源先載入完成但時間未到，setTimeout 會在時間到達後再次調用此函數
        // 如果時間先到但資源未完成，resourceLoaded 中的最後一次調用會再次檢查此函數
    }

    // --- 新增：隱藏 Preloader 並顯示 Intro (觸發 CSS 動畫) ---
    function hidePreloaderAndShowIntro() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.introTitleSVG || !DOM.elements.introCardBackground || !DOM.elements.introCardContent) {
            console.error("無法顯示 Intro：缺少必要的 DOM 元素。");
            // 可以嘗試直接顯示 intro container 作為備用
            if (DOM.containers.intro) DOM.containers.intro.classList.add('active');
            bindStartButton(); // 確保按鈕可點擊
            return;
        }

        if (DOM.containers.preloader.classList.contains('active')) {
            console.log("隱藏 Preloader，開始 Intro 序列...");
            DOM.containers.preloader.classList.remove('active'); // 觸發 CSS fade-out

            // 使用 setTimeout 等待 CSS fade-out 完成 (0.5s)
            setTimeout(() => {
                if (DOM.containers.preloader) {
                    DOM.containers.preloader.style.display = 'none'; // 完全隱藏
                }

                // 啟動 Intro 容器 (使其 display: block/flex 但 opacity: 0)
                DOM.containers.intro.classList.add('active');

                // 確保元素初始 opacity 為 0 (CSS 應該已處理，但可再次確認)
                DOM.elements.introTitleSVG.style.opacity = 0;
                DOM.elements.introCardBackground.style.opacity = 0;
                DOM.elements.introCardContent.style.opacity = 0;

                // 強制瀏覽器重新計算樣式，以確保 transition 生效
                void DOM.containers.intro.offsetWidth;

                // 依序觸發淡入 (利用 CSS transition-delay)
                // 延遲應該在 CSS 中設定好，這裡只需將 opacity 設為 1
                 console.log("觸發 Intro 元素淡入...");
                DOM.elements.introTitleSVG.style.opacity = 1;       // CSS delay 0.5s
                DOM.elements.introCardBackground.style.opacity = 1; // CSS delay 1.0s
                DOM.elements.introCardContent.style.opacity = 1;    // CSS delay 1.5s

                bindStartButton(); // 確保 Intro 顯示後按鈕可點擊

            }, 500); // 匹配 CSS 中 preloader 的 fade-out 時間
        } else {
             // 如果 preloader 已經被移除 active class，確保 start 按鈕是綁定的
             bindStartButton();
        }
    }


    // 切換屏幕函數 (保留現有)
    function switchScreen(fromScreenId, toScreenId) {
        // ... (保留現有的 switchScreen 完整函數) ...
        if (!DOM.containers || Object.keys(DOM).length === 0) return;
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
             console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`);
             state.isAnimating = false; return;
        }
        if (state.isAnimating) return;
        state.isAnimating = true;
        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        fromScreen.classList.add('fade-out');

        setTimeout(() => {
            fromScreen.classList.remove('active', 'fade-out');
            void toScreen.offsetWidth; // Trigger reflow
            toScreen.classList.add('active', 'fade-in');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            if (toScreenId === 'test') {
                 initializeTestScreen();
                 state.contentRendered = true;
            } else if (toScreenId === 'intro') {
                // --- 新增：確保返回 Intro 時元素狀態正確 ---
                resetIntroScreenVisuals();
            }
            setTimeout(() => {
                 toScreen.classList.remove('fade-in');
                 state.isAnimating = false;
                 console.log("屏幕切換完成");
            }, 600); // Corresponds to fade-in duration
        }, 600); // Corresponds to fade-out duration
    }

     // --- 新增：重置 Intro 頁面視覺效果的函數 ---
     function resetIntroScreenVisuals() {
        if (DOM.elements.introTitleSVG) DOM.elements.introTitleSVG.style.opacity = 1;
        if (DOM.elements.introCardBackground) DOM.elements.introCardBackground.style.opacity = 1;
        if (DOM.elements.introCardContent) DOM.elements.introCardContent.style.opacity = 1;
        if (DOM.buttons.startButtonText) {
            DOM.buttons.startButtonText.classList.remove('bursting');
            DOM.buttons.startButtonText.style.opacity = 1; // 確保文字可見
        }
        console.log("Intro 畫面視覺效果已重置");
    }

    // 更新進度條 (保留現有)
    function updateProgressBar(questionNumber) {
        // ... (保留現有的 updateProgressBar 完整函數) ...
        if (!DOM.elements.progressFill || !questions) return;
        const currentQIndex = Math.max(0, Math.min(questionNumber - 1, questions.length));
        const progress = (currentQIndex / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        console.log(`進度條更新到: 問題 ${currentQIndex + 1}, ${progress.toFixed(1)}%`);
    }

    // --- 測驗核心邏輯 (保留大部分現有) ---
    function initializeTestScreen() {
        // ... (保留現有的 initializeTestScreen 完整函數) ...
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) return;
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        state.isTransitioning = false;
        displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1);
    }

    function displayQuestion(index, isInitialDisplay = false) {
        // ... (保留現有的 displayQuestion 完整函數) ...
        if (index < 0 || index >= questions.length) return;
        const questionData = questions[index];
        const questionNumber = index + 1;

        // 更新背景圖
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            if (!isInitialDisplay) {
                DOM.elements.testBackground.classList.add('is-hidden');
            }
            setTimeout(() => {
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                requestAnimationFrame(() => { // Use rAF for smoother transition
                     DOM.elements.testBackground.classList.remove('is-hidden');
                });
                console.log(`背景設置為: ${imageUrl}`);
            }, isInitialDisplay ? 0 : 500); // Delay fade-in for non-initial questions
        } else { console.error("找不到 test-background"); }

        // 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.remove('is-hidden');
            DOM.elements.questionTitle.style.transition = 'none'; // Prevent transition on initial display
        } else { console.error("找不到 questionTitle"); }

        // 更新選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // Clear previous options
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option';
                if (!isInitialDisplay) {
                     optionElement.classList.add('is-hidden');
                     optionElement.style.transition = 'none'; // Prepare for staggered animation
                }
                optionElement.dataset.text = optionData.text;
                optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0; // Make focusable
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault(); // Prevent page scroll on space
                         handleOptionClick(e);
                     }
                });
                DOM.containers.options.appendChild(optionElement);
            });
            allOptions = DOM.containers.options.querySelectorAll('.option'); // Update the reference
        } else { console.error("找不到 options-container"); }

        if (!isInitialDisplay) {
            triggerQuestionEnterAnimation();
        } else {
            state.isTransitioning = false; // Allow clicks immediately for the first question
            console.log("初始問題顯示完成");
        }
    }

    function handleOptionClick(event) {
        // ... (保留現有的 handleOptionClick 完整函數) ...
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        if (isNaN(optionIndex) || isNaN(questionIndex)) return;
        if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) return; // Prevent multiple clicks or clicking faded options

        state.isTransitioning = true; // Prevent further clicks during transition
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex;

        triggerQuestionFadeOut(clickedOption); // Fade out old question elements
        triggerExplosion(clickedOption);      // Trigger text explosion

        // Calculate delay needed before showing the next question or results
        const explosionDuration = 1000; // Match CSS animation duration
        const maxExplosionDelay = 200;  // Max random delay in CSS
        const fadeOutDuration = 500;    // Match fade-out duration
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 100; // Add a small buffer

        setTimeout(() => {
            if (state.currentQuestionIndex < questions.length - 1) {
                prepareNextQuestion();
            } else {
                console.log("最後一題完成，顯示結果");
                showResults();
            }
        }, transitionDelay);
    }

    function triggerQuestionFadeOut(clickedOptionElement) {
        // ... (保留現有的 triggerQuestionFadeOut 完整函數) ...
        // Fade out background
        if (DOM.elements.testBackground) {
            DOM.elements.testBackground.classList.add('is-hidden');
        }
        // Fade out title
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.classList.add('is-hidden');
        }
        // Fade out options
        const currentOptions = DOM.containers.options.querySelectorAll('.option');
        currentOptions.forEach(option => {
            option.style.transitionDelay = ''; // Clear any enter delay
            if (option === clickedOptionElement) {
                 option.classList.add('exploded'); // Special quick fade for the clicked one
            } else {
                 option.classList.add('fade-out'); // Standard fade for others
            }
        });
        console.log("舊內容淡出已觸發");
    }

    function triggerExplosion(clickedOptionElement) {
        // ... (保留現有的 triggerExplosion 完整函數) ...
        if (!DOM.containers.explosion || !DOM.containers.test) return;

        DOM.containers.explosion.innerHTML = ''; // Clear previous explosions
        const clickRect = clickedOptionElement.getBoundingClientRect();
        const containerRect = DOM.containers.test.getBoundingClientRect();

        // Calculate start position relative to the test container
        const startX = clickRect.left - containerRect.left + clickRect.width / 2;
        const startY = clickRect.top - containerRect.top + clickRect.height / 2;

        const originalText = clickedOptionElement.dataset.text || clickedOptionElement.innerText;

        originalText.split('').forEach((char) => {
            if (char.trim() === '') return; // Skip whitespace

            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`;

            // Randomize explosion parameters
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.6); // Adjust radius based on viewport
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 400 + 300; // Depth
            const rotateZ = (Math.random() - 0.5) * 540; // Rotation
            const scale = Math.random() * 4 + 3; // Scale
            const delay = Math.random() * 0.2; // Stagger start time slightly

            // Set initial position and custom properties for animation
            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;

            DOM.containers.explosion.appendChild(span);

            // Clean up exploded characters after animation ends
            span.addEventListener('animationend', () => {
                 span.remove();
            });
        });
        console.log("文字爆裂已觸發");
    }

    function prepareNextQuestion() {
        // ... (保留現有的 prepareNextQuestion 完整函數) ...
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        displayQuestion(state.currentQuestionIndex); // Display next question, isInitialDisplay defaults to false
    }

    function triggerQuestionEnterAnimation() {
        // ... (保留現有的 triggerQuestionEnterAnimation 完整函數) ...
         console.log("觸發新內容進場動畫");
         // Title fade-in
         const titleEnterDelay = 100; // Start title slightly after background starts appearing
         setTimeout(() => {
             requestAnimationFrame(() => {
                 if (DOM.elements.questionTitle) {
                     DOM.elements.questionTitle.style.transition = ''; // Reset transition
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                     console.log("標題進場");
                 }
             });
         }, titleEnterDelay);

         // Options staggered fade-in
         const optionsEnterStartDelay = titleEnterDelay + 250; // Start options after title is mostly visible
         const optionStaggerDelay = 80; // Delay between each option appearing

         allOptions.forEach((option, index) => {
             option.style.transition = ''; // Reset transition if any
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
             // Use rAF ensures the style is applied before removing the class
             requestAnimationFrame(() => {
                 option.classList.remove('is-hidden');
             });
         });

         // Calculate when the last option's animation should finish and reset state
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         const optionEnterDuration = 500; // Match the transition duration in CSS
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 80; // Add buffer

         setTimeout(() => {
             console.log("所有進場動畫完成");
             // Clean up transition delays and re-enable pointer events
             allOptions.forEach(option => {
                 option.style.transitionDelay = '';
                 option.style.pointerEvents = ''; // Re-enable clicks
             });
             if(DOM.elements.questionTitle) {
                 DOM.elements.questionTitle.style.pointerEvents = ''; // Re-enable title interaction if needed
             }
             updateProgressBar(state.currentQuestionIndex + 1); // Update progress after showing new question
             state.isTransitioning = false; // Allow clicks again
             console.log("轉場結束");
         }, finalResetDelay);
    }

    // --- 結果計算與顯示 (保留現有) ---
    function calculateResult() {
        // ... (保留現有的 calculateResult 完整函數) ...
         try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) {
                console.warn(`答案數量 (${state.userAnswers.length}) 與問題數量 (${questions.length}) 不符！正在填充預設值...`);
                 // Fill missing answers with default (e.g., index 0)
                 for (let i = 0; i < questions.length; i++) {
                     if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0;
                 }
            }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question && question.options && answerIndex >= 0 && answerIndex < question.options.length && question.options[answerIndex].scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) {
                        if (scores.hasOwnProperty(type)) {
                            scores[type] += optionScores[type];
                        }
                    }
                } else {
                    console.warn(`問題 ${questionIndex + 1} 或選項索引 ${answerIndex} 的數據無效，跳過計分。`);
                }
            });
            state.finalScores = scores;
            console.log("最終分數:", state.finalScores);

            // Check for SPECIAL result (if 4 or more scores are identical)
            const scoreValues = Object.values(scores);
            const scoreFrequency = {};
            scoreValues.forEach(score => {
                const roundedScore = Math.round(score * 10) / 10; // Round to one decimal place for comparison
                scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1;
            });
            for (const score in scoreFrequency) {
                if (scoreFrequency[score] >= 4) {
                    console.log("檢測到 SPECIAL 結果條件（4+ 個相同分數）");
                    return results["SPECIAL"];
                }
            }

            // Find highest score(s)
            let maxScore = -Infinity;
            let highestTypes = [];
            for (const type in scores) {
                 // Use a small tolerance for floating point comparisons
                 if (Math.abs(scores[type] - maxScore) < 0.01) {
                     highestTypes.push(type);
                 } else if (scores[type] > maxScore) {
                     maxScore = scores[type];
                     highestTypes = [type]; // Reset with the new highest
                 }
            }

            console.log("最高分類型:", highestTypes, "分數:", maxScore);

            // Determine final result type based on highest score(s)
            if (highestTypes.length === 1) {
                return results[highestTypes[0]]; // Unique highest score
            } else if (highestTypes.length >= 3) {
                console.log("檢測到 SPECIAL 結果條件（3+ 個最高分相同）");
                return results["SPECIAL"]; // Tie between 3 or more
            } else if (highestTypes.length === 2) {
                // Tie-breaker logic using question 9's PRIMARY type
                console.log("檢測到雙重平局，使用問題 9 的主要類型進行決勝");
                const tiebreakQuestionIndex = 8; // Index for question 9
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                console.log(`問題 9 選擇的主要類型: ${tiebreakPrimaryType}`);

                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) {
                     console.log(`決勝成功: ${tiebreakPrimaryType}`);
                     return results[tiebreakPrimaryType]; // Tie-breaker successful
                } else {
                     console.log("決勝失敗或主要類型不在平局類型中，選擇第一個平局類型");
                     return results[highestTypes[0]]; // Default to the first tied type if tie-breaker fails
                }
            } else {
                // Should not happen if scores object is not empty
                console.warn("計分邏輯未覆蓋所有情況，返回預設結果 A");
                return results['A']; // Fallback
            }
        } catch (error) {
            console.error("計算結果時發生錯誤:", error);
            return results['A']; // Return default result on error
        }
    }

    function prepareResultData(resultData) {
        // ... (保留現有的 prepareResultData 完整函數) ...
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
            console.error("準備結果數據失敗：缺少 DOM 元素。"); return false;
        }
        try {
            // Set Title, Subtitle, Description
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';

            // Set Traits
            DOM.elements.traitsContainer.innerHTML = ''; // Clear previous traits
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) {
                console.warn("無法獲取最終分數來顯示特質。");
            } else if (resultData.title && resultData.title.includes('管理員')) {
                // Special case for "靈魂圖書管理員" - give all traits 3 stars
                Object.keys(traitNames).forEach(type => addTraitElement(type, 3));
            } else {
                // Normal case - calculate stars based on score
                Object.keys(traitNames).forEach(type => {
                     const score = typeScores[type] || 0;
                     let stars = 1; // Default 1 star
                     if (score >= 7) stars = 5;
                     else if (score >= 5) stars = 4;
                     else if (score >= 3) stars = 3;
                     else if (score >= 1) stars = 2;
                     addTraitElement(type, stars);
                });
            }


            // Set Similar and Complementary Books
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';

            // Set Share Text
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';

            console.log("結果數據準備完成");
            return true;
        } catch (error) {
            console.error("準備結果數據時出錯:", error);
            DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; // Display error to user
            return false;
        }
    }

    function showResults() {
        // ... (保留現有的 showResults 完整函數) ...
        console.log("顯示結果頁面...");
        state.isTransitioning = false; // Reset transition state
        try {
            const resultData = calculateResult();
            if (!resultData) { throw new Error("計算結果失敗"); }

            if (prepareResultData(resultData)) {
                 switchScreen('test', 'result'); // Switch to result screen if data prepared successfully
            } else {
                 throw new Error("準備結果數據失敗");
            }
        } catch (error) {
            console.error("顯示結果流程出錯:", error);
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            switchScreen('test', 'intro'); // Go back to intro on error
        }
    }

    function addTraitElement(type, starCount) {
        // ... (保留現有的 addTraitElement 完整函數) ...
         if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';

            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            traitName.textContent = traitNames[type] || type; // Use trait name from data.js or fallback to type key

            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            // Ensure starCount is within 0-5
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);

            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error(`添加特質 ${type} 時出錯:`, error);
        }
    }

    function copyShareText() {
        // ... (保留現有的 copyShareText 完整函數) ...
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            // Use Clipboard API if available (more modern and secure)
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                     DOM.buttons.copy.textContent = '已複製!';
                     setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000);
                }).catch(err => {
                     console.warn('Clipboard API 複製失敗:', err);
                     fallbackCopyText(textToCopy); // Fallback for browsers that don't support it well
                });
            } else {
                fallbackCopyText(textToCopy); // Use fallback for non-secure contexts or older browsers
            }
         } catch (error) {
            console.error("複製操作出錯:", error);
            alert('複製失敗，請手動複製。');
         }
    }

    function fallbackCopyText(text) {
        // ... (保留現有的 fallbackCopyText 完整函數) ...
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Make the textarea invisible and out of viewport
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            DOM.buttons.copy.textContent = '已複製!';
            setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000);
        } catch (err) {
            console.error('備用複製方法失敗:', err);
            alert('複製失敗，請手動複製。');
        }
        document.body.removeChild(textArea);
    }


    // --- 事件監聽器綁定 (修改) ---
    function bindStartButton() {
        if (!DOM.buttons.start) {
            console.error("無法綁定開始按鈕事件：按鈕未找到。");
            displayInitializationError("無法啟動測驗，按鈕丟失。");
            return;
        }
        if (!DOM.buttons.startButtonText) {
            console.error("無法綁定開始按鈕事件：按鈕文字 span 未找到。");
            // Fallback: still bind the button but without animation
        }

        if (!DOM.buttons.start.dataset.listenerAttached) { // Prevent multiple bindings
            DOM.buttons.start.addEventListener('click', () => {
                // --- 修改：移除 preloadComplete 檢查，因為 hidePreloaderAndShowIntro 會確保資源載入完成 ---
                // if (!state.loadingFinished || !state.minTimeElapsed) {
                //     console.warn("資源尚未載入完成或未達最小顯示時間。");
                //     // 可以選擇顯示 preloader 或禁用按鈕
                //     if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
                //     return;
                // }
                if (state.isAnimating) { console.log("屏幕切換中..."); return; }

                // --- 修改：執行爆裂動畫，然後切換屏幕 ---
                if (DOM.buttons.startButtonText) {
                    console.log("觸發按鈕文字爆裂動畫...");
                    DOM.buttons.startButtonText.classList.add('bursting');

                    // 等待動畫結束 (動畫時長在 CSS 中定義為 0.5s)
                    DOM.buttons.startButtonText.addEventListener('animationend', () => {
                        console.log("按鈕文字動畫結束，切換到測驗屏幕");
                        // 確保在動畫結束回調中只執行一次切換
                        if (!state.isAnimating) { // 再次檢查 isAnimating 狀態
                           switchScreen('intro', 'test');
                        }

                        // 重置文字狀態 (稍作延遲，允許屏幕切換開始)
                        setTimeout(() => {
                            if (DOM.buttons.startButtonText) {
                                DOM.buttons.startButtonText.classList.remove('bursting');
                                // 如果 CSS animation-fill-mode 不是 forwards，可能需要手動重設 opacity
                                // DOM.buttons.startButtonText.style.opacity = 1;
                                console.log("按鈕文字狀態已重置");
                            }
                        }, 50); // 短延遲

                    }, { once: true }); // 確保監聽器只觸發一次

                } else {
                    // 如果找不到文字 span，直接切換屏幕
                    console.warn("找不到按鈕文字 span，直接切換屏幕");
                    switchScreen('intro', 'test');
                }
            });
            DOM.buttons.start.dataset.listenerAttached = 'true'; // Mark as attached
            console.log("開始按鈕事件已綁定 (包含爆裂動畫)");
        }
    }

    function bindOtherButtons() {
        // --- 修改：Restart 按鈕現在應該調用修改後的 switchScreen ---
        if (DOM.buttons.restart) {
             if (!DOM.buttons.restart.dataset.listenerAttached) {
                 DOM.buttons.restart.addEventListener('click', () => {
                     if (state.isAnimating) return; // 防止動畫中重複點擊
                     state.contentRendered = false;
                     switchScreen('result', 'intro'); // 會自動調用 resetIntroScreenVisuals
                     if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                     updateProgressBar(0);
                 });
                 DOM.buttons.restart.dataset.listenerAttached = 'true';
                 console.log("重新開始按鈕事件已綁定");
             }
        } else { console.error("無法綁定重新開始按鈕。"); }

        // --- 保留：複製按鈕綁定 ---
        if (DOM.buttons.copy) {
             if (!DOM.buttons.copy.dataset.listenerAttached) {
                DOM.buttons.copy.addEventListener('click', copyShareText);
                DOM.buttons.copy.dataset.listenerAttached = 'true';
                console.log("複製按鈕事件已綁定");
             }
        } else { console.error("無法綁定複製按鈕。"); }
    }

    // Global error handler (保留現有)
    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
        state.isAnimating = false;
        state.isTransitioning = false;
    });

    // --- 初始化 (修改) ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        // --- 修改：調用新的資源預載入函數 ---
        preloadResources();
        bindOtherButtons();
        // bindStartButton() 將在 preloadResources 完成後 (hidePreloaderAndShowIntro內部) 被調用
    }

    // --- 修改：移除舊的 DOMContentLoaded 啟動 preloader 邏輯 ---
    // document.addEventListener('DOMContentLoaded', () => {
    //     document.querySelectorAll('.screen-container').forEach(sc => sc.classList.remove('active'));
    //     preloader.classList.add('active');
    //     preloader.style.display = 'flex';
    //     loadStartTime = Date.now();
    // });
    // ↑↑↑ 這部分邏輯已移至 preloadResources 函數開頭 ↑↑↑

    console.log("腳本初始化流程已啟動。");
});