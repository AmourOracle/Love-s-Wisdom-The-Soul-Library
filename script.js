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
        introVisible: false, // NEW: Track if intro has been faded in
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
    const PRELOADER_EXTRA_DELAY = 1500; // NEW: Extra time preloader stays visible (ms)
    const PRELOADER_EXIT_DURATION = 1200; // Match CSS --preloader-exit-duration (ms)
    const INTRO_FADEIN_DELAY = 800; // Match CSS --intro-fadein-delay (ms)
    const INTRO_FADEIN_DURATION = 1000; // Match CSS --intro-fadein-duration (ms)
    const EXPLOSION_DURATION = 1000; // Match CSS animation duration

    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }

    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red;">${message}</p>`;
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
                     startBtnExplosion: document.getElementById('start-btn-explosion-container') // NEW Cache
                 },
                 elements: {
                     introBackground: document.querySelector('.intro-background'), // NEW
                     introOverlay: document.querySelector('.intro-overlay'), // NEW
                     introContent: document.querySelector('.intro-content'), // NEW
                     introTitlePlaceholder: document.querySelector('.intro-title-placeholder'), // NEW
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
                     preloaderProgress: document.getElementById('preloader-progress'),
                     preloaderSvg: document.querySelector('#preloader #text'), // NEW Cache SVG
                     startBtnText: document.querySelector('#start-test .btn-text') // NEW Cache button text span
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
                 DOM.containers.startBtnExplosion, // NEW
                 DOM.elements.introBackground, DOM.elements.introOverlay, DOM.elements.introContent, // NEW
                 DOM.elements.introTitlePlaceholder, DOM.elements.preloaderSvg, // NEW
                 DOM.elements.testBackground, DOM.elements.questionTitle,
                 DOM.elements.startBtnText, // NEW
                 DOM.buttons.start
             ];
             if (criticalElements.some(el => !el)) {
                 console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID/Class。", DOM);
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

    // --- NEW: Function to trigger the transition from preloader to intro ---
    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro) return;

        console.log("開始 Preloader 到 Intro 的轉場...");
        state.isAnimating = true; // Mark global animation state

        // 1. Start preloader exit animation
        DOM.containers.preloader.classList.add('transitioning-out');

        // 2. Simultaneously start making the intro container ready
        // Make intro container 'block' but keep it transparent initially
        DOM.containers.intro.style.display = 'block';
        DOM.containers.intro.style.opacity = '0'; // Ensure it starts transparent

        // 3. After preloader exit animation duration, hide preloader and fade in intro
        setTimeout(() => {
            console.log("Preloader 動畫結束，隱藏 Preloader，淡入 Intro。");
            DOM.containers.preloader.classList.remove('active', 'transitioning-out');
            DOM.containers.preloader.style.display = 'none'; // Fully hide

            // Trigger intro fade-in (CSS handles the actual animation via the .visible class)
            DOM.containers.intro.classList.add('visible');

            // Re-enable interaction after intro fades in
            setTimeout(() => {
                 state.isAnimating = false;
                 state.introVisible = true; // Mark intro as visible
                 console.log("Intro 轉場完成。");
            }, INTRO_FADEIN_DURATION); // Wait for intro fade-in to complete

        }, PRELOADER_EXIT_DURATION);
    }


    function preloadImages() {
        if (!DOM.containers?.preloader) { console.warn("找不到 preloader..."); state.preloadComplete = true; bindStartButton(); return; }
        if (!questions || questions.length === 0) { console.warn("無法預載入圖片：缺少 questions..."); state.preloadComplete = true; if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active'); bindStartButton(); return; }

        console.log("Preloader element:", DOM.containers.preloader);
        DOM.containers.preloader.classList.add('active');
        console.log("Preloader .active class added.");

        // Ensure intro starts hidden
        if (DOM.containers.intro) {
             DOM.containers.intro.classList.remove('visible');
             DOM.containers.intro.style.opacity = '0';
             DOM.containers.intro.style.display = 'none'; // Keep it non-interactive initially
        }

        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0;
        const totalImages = imageUrls.length;
        let errorOccurred = false;

        function updateProgress(isError = false) {
            loadedCount++;
            if (isError) errorOccurred = true;
            const progress = Math.round((loadedCount / totalImages) * 100);
            if (DOM.elements.preloaderProgress) { DOM.elements.preloaderProgress.textContent = `${progress}%`; }

            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);

                // --- MODIFIED: Add extra delay before starting transition ---
                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待額外延遲 ${totalDelay}ms...`);

                setTimeout(() => {
                    triggerIntroTransition(); // NEW: Call the transition function
                    bindStartButton(); // Bind button after preloading ensures it's ready
                }, totalDelay);
            }
        }
        imageUrls.forEach(url => {
             const img = new Image(); img.src = url;
             img.onload = () => updateProgress(false);
             img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); };
        });
    }

    // --- MODIFIED: Generic Explosion Function ---
    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        if (!explosionContainer || !targetElement) {
            console.error("Explosion failed: Missing container or target element.");
            return;
        }

        explosionContainer.innerHTML = ''; // Clear previous explosions
        const targetRect = targetElement.getBoundingClientRect();
        // Get the container relative to which the explosion is positioned (might be different for button vs options)
        const parentContainer = explosionContainer.offsetParent || document.body; // Fallback to body
        const parentRect = parentContainer.getBoundingClientRect();

        // Calculate start position relative to the parent container
        // Use center of the target element
        const startX = targetRect.left - parentRect.left + targetRect.width / 2;
        const startY = targetRect.top - parentRect.top + targetRect.height / 2;

        textToExplode.split('').forEach((char) => {
            if (char.trim() === '') return; // Skip whitespace

            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`; // Use the same class

            // Randomize explosion parameters (same logic as before)
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.6);
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 400 + 300;
            const rotateZ = (Math.random() - 0.5) * 540;
            const scale = Math.random() * 4 + 3;
            const delay = Math.random() * 0.2;

            // Set initial position and custom properties for animation
            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;

            explosionContainer.appendChild(span);

            span.addEventListener('animationend', () => { span.remove(); });
        });
        console.log(`文字爆裂已觸發 for: ${textToExplode}`);
    }


    // --- MODIFIED: Start Button Click Handler ---
    function handleStartTestClick() {
        if (!state.preloadComplete || !state.introVisible) {
             console.warn("內容尚未準備好。");
             // Optionally show preloader again if clicked too early after refresh
             // if(!state.preloadComplete && DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
             return;
        }
        if (state.isAnimating || state.isTransitioning) { console.log("動畫或轉場進行中..."); return; }

        state.isAnimating = true; // Prevent double clicks

        const buttonElement = DOM.buttons.start;
        const textElement = DOM.elements.startBtnText;
        const explosionContainer = DOM.containers.startBtnExplosion;
        const buttonText = textElement ? textElement.textContent : '開始測驗';

        if (textElement) {
            textElement.classList.add('hidden'); // Hide original text
        }

        // Trigger explosion
        triggerExplosion(buttonElement, buttonText, explosionContainer);

        // Wait for explosion animation to mostly finish before switching screen
        setTimeout(() => {
            switchScreen('intro', 'test');
            // Reset button text visibility for next time (optional)
            if (textElement) {
                 // Delay reset slightly after screen switch starts
                 setTimeout(() => textElement.classList.remove('hidden'), 500);
            }
             state.isAnimating = false; // Allow screen switching animation
        }, EXPLOSION_DURATION * 0.8); // Start switch a bit before explosion fully ends
    }

    // --- Screen Switching (Simplified - Assumes CSS handles fades) ---
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) { console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`); state.isAnimating = false; return; }

        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        state.isAnimating = true;

        // Fade out current screen
        fromScreen.classList.remove('visible'); // Use 'visible' class if defined, or just change opacity
        fromScreen.style.opacity = '0';
        // Use transitionend or setTimeout to hide it after fade
        setTimeout(() => {
            fromScreen.style.display = 'none';

            // Show and fade in next screen
            toScreen.style.display = 'block';
            requestAnimationFrame(() => { // Ensure display:block is applied first
                 toScreen.style.opacity = '1';
                 toScreen.classList.add('visible'); // Add visible class if used for animation
            });


            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');

            if (toScreenId === 'test') {
                 initializeTestScreen(); // Initialize test screen content
                 state.contentRendered = true;
            }

            // Reset animation flag after fade-in transition
            const transitionDuration = parseFloat(getComputedStyle(toScreen).transitionDuration) * 1000 || 600;
            setTimeout(() => {
                 state.isAnimating = false;
                 console.log("屏幕切換完成");
            }, transitionDuration);

        }, 600); // Match fade-out duration
    }

    // --- Test Logic (Mostly Unchanged, but uses generic explosion) ---
    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) return;
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0; state.userAnswers = []; state.isTransitioning = false;
        displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1);
     }
    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) return;
        const questionData = questions[index]; const questionNumber = index + 1;

        // 更新背景圖
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            if (!isInitialDisplay) { DOM.elements.testBackground.classList.add('is-hidden'); }
            setTimeout(() => {
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                requestAnimationFrame(() => { DOM.elements.testBackground.classList.remove('is-hidden'); });
                 console.log(`背景設置為: ${imageUrl}`);
            }, isInitialDisplay ? 0 : 500);
        } else { console.error("找不到 test-background"); }

        // 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.remove('is-hidden');
            DOM.elements.questionTitle.style.transition = 'none';
        } else { console.error("找不到 questionTitle"); }

        // 更新選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = '';
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option';
                if (!isInitialDisplay) { optionElement.classList.add('is-hidden'); optionElement.style.transition = 'none'; }
                optionElement.dataset.text = optionData.text; optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button'); optionElement.tabIndex = 0;
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
             allOptions = DOM.containers.options.querySelectorAll('.option');
        } else { console.error("找不到 options-container"); }

        if (!isInitialDisplay) { triggerQuestionEnterAnimation(); }
        else { state.isTransitioning = false; console.log("初始問題顯示完成"); }
    }

    function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        if (isNaN(optionIndex) || isNaN(questionIndex)) return;
        if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) return;

        state.isTransitioning = true;
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex;

        triggerQuestionFadeOut(clickedOption);

        // Use the generic explosion function
        triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);

        const fadeOutDuration = 500;
        const transitionDelay = EXPLOSION_DURATION + 100; // Wait for explosion + buffer

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
        if (DOM.elements.testBackground) { DOM.elements.testBackground.classList.add('is-hidden'); }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.add('is-hidden'); }
        const currentOptions = DOM.containers.options.querySelectorAll('.option');
        currentOptions.forEach(option => {
            option.style.transitionDelay = '';
            if (option === clickedOptionElement) { option.classList.add('exploded'); }
            else { option.classList.add('fade-out'); }
        });
        console.log("舊內容淡出已觸發");
     }
    // Removed original triggerExplosion - now uses generic one

    function prepareNextQuestion() {
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        displayQuestion(state.currentQuestionIndex);
     }
    function triggerQuestionEnterAnimation() {
         console.log("觸發新內容進場動畫");
         // 標題進場
         const titleEnterDelay = 100;
         setTimeout(() => {
             requestAnimationFrame(() => {
                  if (DOM.elements.questionTitle) {
                     DOM.elements.questionTitle.style.transition = '';
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                     console.log("標題進場");
                  }
             });
         }, titleEnterDelay);
         // 選項 staggered 進場
         const optionsEnterStartDelay = titleEnterDelay + 250; const optionStaggerDelay = 80;
         allOptions.forEach((option, index) => {
             option.style.transition = '';
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
              requestAnimationFrame(() => { option.classList.remove('is-hidden'); });
         });
         // 計算完成時間並重置狀態
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay; const optionEnterDuration = 500;
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 80;
         setTimeout(() => {
             console.log("所有進場動畫完成");
             allOptions.forEach(option => { option.style.transitionDelay = ''; option.style.pointerEvents = ''; });
              if(DOM.elements.questionTitle) { DOM.elements.questionTitle.style.pointerEvents = ''; }
             updateProgressBar(state.currentQuestionIndex + 1); // 更新進度條
             state.isTransitioning = false; console.log("轉場結束");
         }, finalResetDelay);
    }

    // --- 結果計算與顯示 ---
    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) {
                console.warn(`答案數量 (${state.userAnswers.length}) 與問題數量 (${questions.length}) 不符！正在填充預設值...`);
                 for (let i = 0; i < questions.length; i++) { if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; }
            }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question && question.options && answerIndex >= 0 && answerIndex < question.options.length && question.options[answerIndex].scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) { if (scores.hasOwnProperty(type)) { scores[type] += optionScores[type]; } }
                } else { console.warn(`問題 ${questionIndex + 1} 或選項索引 ${answerIndex} 的數據無效，跳過計分。`); }
            });
            state.finalScores = scores; console.log("最終分數:", state.finalScores);
            const scoreValues = Object.values(scores); const scoreFrequency = {};
            scoreValues.forEach(score => { const roundedScore = Math.round(score * 10) / 10; scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1; });
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) { console.log("檢測到 SPECIAL 結果條件（4+ 個相同分數）"); return results["SPECIAL"]; } }
            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) { if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); } else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; } }
             console.log("最高分類型:", highestTypes, "分數:", maxScore);
            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { console.log("檢測到 SPECIAL 結果條件（3+ 個最高分相同）"); return results["SPECIAL"]; }
            if (highestTypes.length === 2) {
                 console.log("檢測到雙重平局，使用問題 9 的主要類型進行決勝");
                const tiebreakQuestionIndex = 8; const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                 console.log(`問題 9 選擇的主要類型: ${tiebreakPrimaryType}`);
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { console.log(`決勝成功: ${tiebreakPrimaryType}`); return results[tiebreakPrimaryType]; }
                else { console.log("決勝失敗或主要類型不在平局類型中，選擇第一個平局類型"); return results[highestTypes[0]]; }
            }
            console.warn("計分邏輯未覆蓋所有情況，返回預設結果 A"); return results['A'];
        } catch (error) { console.error("計算結果時發生錯誤:", error); return results['A']; }
     }
    function prepareResultData(resultData) {
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) { console.error("準備結果數據失敗：缺少 DOM 元素。"); return false; }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) { console.warn("無法獲取最終分數來顯示特質。"); }
            else if (resultData.title && resultData.title.includes('管理員')) { Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); }
            else { Object.keys(traitNames).forEach(type => { const score = typeScores[type] || 0; let stars = 1; if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2; addTraitElement(type, stars); }); }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("結果數據準備完成"); return true;
        } catch (error) { console.error("準備結果數據時出錯:", error); DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; return false; }
     }
    function showResults() {
        console.log("顯示結果頁面..."); state.isTransitioning = false;
        try {
            const resultData = calculateResult(); if (!resultData) throw new Error("計算結果失敗");
            if (prepareResultData(resultData)) { switchScreen('test', 'result'); }
            else { throw new Error("準備結果數據失敗"); }
        } catch (error) { console.error("顯示結果流程出錯:", error); alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`); switchScreen('test', 'intro'); }
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
        } catch (error) { console.error(`添加特質 ${type} 時出錯:`, error); }
     }
    function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); }).catch(err => { console.warn('Clipboard API 複製失敗:', err); fallbackCopyText(textToCopy); });
            } else { fallbackCopyText(textToCopy); }
         } catch (error) { console.error("複製操作出錯:", error); alert('複製失敗，請手動複製。'); }
     }
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea"); textArea.value = text;
        textArea.style.position = 'fixed'; textArea.style.opacity = '0'; document.body.appendChild(textArea);
        textArea.select();
        try { document.execCommand('copy'); DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); }
        catch (err) { console.error('備用複製方法失敗:', err); alert('複製失敗，請手動複製。'); }
        document.body.removeChild(textArea);
     }

    // --- 事件監聽器綁定 ---
    function bindStartButton() {
        if (DOM.buttons.start) {
            if (!DOM.buttons.start.dataset.listenerAttached) {
                DOM.buttons.start.addEventListener('click', handleStartTestClick); // Use NEW handler
                DOM.buttons.start.dataset.listenerAttached = 'true';
                console.log("開始按鈕事件已綁定");
            }
        } else { console.error("無法綁定開始按鈕事件..."); displayInitializationError("無法啟動測驗，按鈕丟失。"); }
    }

    function bindOtherButtons() {
        if (DOM.buttons.restart) {
             if (!DOM.buttons.restart.dataset.listenerAttached) {
                 DOM.buttons.restart.addEventListener('click', () => { state.contentRendered = false; switchScreen('result', 'intro'); if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = ''; updateProgressBar(0); });
                 DOM.buttons.restart.dataset.listenerAttached = 'true'; console.log("重新開始按鈕事件已綁定");
             }
        } else { console.error("無法綁定重新開始按鈕。"); }
        if (DOM.buttons.copy) {
             if (!DOM.buttons.copy.dataset.listenerAttached) {
                DOM.buttons.copy.addEventListener('click', copyShareText); DOM.buttons.copy.dataset.listenerAttached = 'true'; console.log("複製按鈕事件已綁定");
             }
        } else { console.error("無法綁定複製按鈕。"); }
     }

    // --- Global Error Handler (Unchanged) ---
    window.addEventListener('error', function(event) {
         console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
         state.isAnimating = false; state.isTransitioning = false;
    });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        preloadImages(); // Starts preloading and the whole sequence
        bindOtherButtons();
    }

    console.log("腳本初始化完成。");
});