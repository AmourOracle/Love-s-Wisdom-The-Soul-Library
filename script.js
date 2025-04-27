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
    const PRELOADER_EXTRA_DELAY = 1500;
    const PRELOADER_EXIT_DURATION = 1200;
    const INTRO_FADEIN_DURATION = 1000;
    const SCREEN_TRANSITION_DURATION = 600; // Matches CSS --transition-duration
    const EXPLOSION_DURATION = 1000; // Matches CSS explodeForwardBlur animation
    // Get timing from CSS variables - ensure they are defined in :root
    const SVG_GLOW_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-glow-delay').replace('s','')) * 1000 || 3000;


    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }

    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) {
            preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; // Show error in preloader
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('active'); // Make sure preloader is visible
        } else { document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; } // Fallback
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
                     preloaderSvgContainer: document.getElementById('preloader-svg-container') // Reference container
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
                     preloaderSvg: document.getElementById('preloader-svg'), // Use correct ID
                     startBtnText: document.querySelector('#start-test .btn-text')
                     // No need to cache preloader-progress or preloader-text as they are removed/unused
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
                 // Removed preloader-progress from checks
             ];
             if (criticalElements.some(el => !el)) {
                 console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID/Class。", DOM);
                 // Find which element is missing
                 const missing = criticalElements.findIndex(el => !el);
                 console.error("Missing element index:", missing, "Check corresponding key in DOM cache setup.");
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

    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro) {
            console.error("Preloader or Intro container not found for transition.");
            return;
        }
        if (state.isAnimating) return; // Prevent transition if already animating

        console.log("開始 Preloader 到 Intro 的轉場...");
        state.isAnimating = true; // Lock state

        // Start preloader exit animation (CSS handles it)
        DOM.containers.preloader.classList.add('transitioning-out');

        // After preloader exit animation duration, remove preloader active state and make intro active
        setTimeout(() => {
            console.log("Preloader 動畫結束，移除 Preloader active 狀態，啟動 Intro。");
            DOM.containers.preloader.classList.remove('active', 'transitioning-out');
            DOM.containers.preloader.classList.remove('glow-active'); // Remove glow class if present

            // Activate intro screen (CSS handles fade-in)
            DOM.containers.intro.classList.add('active');
            state.introVisible = true; // Mark intro as logically visible

            // Unlock state after intro fade-in is complete
            setTimeout(() => {
                 state.isAnimating = false; // Unlock state
                 console.log("Intro 轉場完成。");
            }, INTRO_FADEIN_DURATION);

        }, PRELOADER_EXIT_DURATION);
    }

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
        // Reset preloader state if needed
        DOM.containers.preloader.classList.remove('transitioning-out');
        DOM.elements.preloaderSvg.classList.remove('glow-active');
        DOM.containers.preloader.classList.add('active'); // Show preloader

        // Ensure other screens start inactive
        if (DOM.containers.intro) DOM.containers.intro.classList.remove('active');
        if (DOM.containers.test) DOM.containers.test.classList.remove('active');
        if (DOM.containers.result) DOM.containers.result.classList.remove('active');

        // Add glow effect after a delay based on CSS variable
        setTimeout(() => {
            // Check if preloader is still active before adding glow
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

        function updateProgress(isError = false) { // Renamed from updatePreloaderProgress
            loadedCount++;
            if (isError) errorOccurred = true;
            // No need to update text content anymore
            // const progress = Math.round((loadedCount / totalImages) * 100);

            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);

                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待額外延遲 ${totalDelay}ms...`);

                setTimeout(() => {
                    triggerIntroTransition();
                    bindStartButton();
                }, totalDelay);
            }
        }

        // Start image loading
        imageUrls.forEach(url => {
             const img = new Image(); img.src = url;
             img.onload = () => updateProgress(false);
             img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); };
        });
    }

    function triggerExplosion(targetElement, textToExplode, explosionContainer) {
        if (!explosionContainer || !targetElement) {
            console.error("Explosion failed: Missing container or target element.");
            return;
        }

        explosionContainer.innerHTML = ''; // Clear previous
        let startX, startY;

        // Calculate start position based on container type
        if (explosionContainer.id === 'start-btn-explosion-container') {
            // Position relative to the button itself (container is positioned via style)
            startX = targetElement.offsetWidth / 2;
            startY = targetElement.offsetHeight / 2;
        } else {
            // Position relative to the test container for options
            const targetRect = targetElement.getBoundingClientRect();
            const parentRect = explosionContainer.offsetParent.getBoundingClientRect();
            startX = targetRect.left - parentRect.left + targetRect.width / 2;
            startY = targetRect.top - parentRect.top + targetRect.height / 2;
        }

        textToExplode.split('').forEach((char) => {
            if (char.trim() === '') return;

            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.5); // Slightly smaller radius
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 350 + 250; // Slightly adjusted Z
            const rotateZ = (Math.random() - 0.5) * 480; // Slightly adjusted rotation
            const scale = Math.random() * 3.5 + 2.5; // Slightly adjusted scale
            const delay = Math.random() * 0.15; // Slightly reduced delay variation

            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;

            explosionContainer.appendChild(span);

            setTimeout(() => {
                if (span.parentNode === explosionContainer) {
                     explosionContainer.removeChild(span);
                }
            }, EXPLOSION_DURATION + delay * 1000 + 300); // Reduced buffer
        });
        console.log(`文字爆裂已觸發 for: ${textToExplode}`);
    }

    function handleStartTestClick() {
        if (!state.preloadComplete || !state.introVisible) {
             console.warn("內容尚未準備好或 Intro 未顯示。");
             return;
        }
        if (state.isAnimating) { console.log("動畫進行中..."); return; }

        console.log("Start button clicked");
        state.isAnimating = true; // Lock state

        const buttonElement = DOM.buttons.start;
        const textElement = DOM.elements.startBtnText;
        const explosionContainer = DOM.containers.startBtnExplosion;
        const buttonText = textElement ? textElement.textContent : '開始測驗';

        if (!buttonElement || !explosionContainer) {
            console.error("Start button or explosion container missing!");
            state.isAnimating = false; return;
        }

        if (textElement) { textElement.classList.add('hidden'); }

        // --- Position the explosion container dynamically ---
        const buttonRect = buttonElement.getBoundingClientRect();
        const footerRect = buttonElement.offsetParent.getBoundingClientRect(); // Get .card-footer rect
        explosionContainer.style.position = 'absolute'; // Ensure it's absolute
        explosionContainer.style.top = `${buttonRect.top - footerRect.top}px`;
        explosionContainer.style.left = `${buttonRect.left - footerRect.left}px`;
        explosionContainer.style.width = `${buttonRect.width}px`;
        explosionContainer.style.height = `${buttonRect.height}px`;
        // --- End positioning ---

        // Use rAF to ensure styles are applied before triggering explosion
        requestAnimationFrame(() => {
            console.log("Triggering start button explosion");
            triggerExplosion(buttonElement, buttonText, explosionContainer);

             // Wait for explosion animation before switching screen
             setTimeout(() => {
                 console.log("Switching from intro to test after explosion delay");
                 switchScreen('intro', 'test'); // switchScreen will unlock state.isAnimating
                 if (textElement) {
                      setTimeout(() => textElement.classList.remove('hidden'), SCREEN_TRANSITION_DURATION + 100);
                 }
             }, EXPLOSION_DURATION * 0.8); // Start switch slightly before explosion ends
        });
    }

    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
            console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`);
            state.isAnimating = false; // Unlock if error
            return;
        }
        // Allow switching if animating from preloader OR if not currently animating
        if (state.isAnimating && fromScreenId !== 'preloader') {
            console.log("屏幕切換已在進行中... 忽略重複請求");
            return;
        }

        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        state.isAnimating = true; // Lock

        fromScreen.classList.remove('active');

        setTimeout(() => {
            toScreen.classList.add('active');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro');

            if (toScreenId === 'test') {
                 initializeTestScreen();
                 state.contentRendered = true;
            } else if (toScreenId === 'intro') {
                // Reset test/result states
                state.currentQuestionIndex = 0;
                state.userAnswers = [];
                state.finalScores = {};
                state.contentRendered = false;
                if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
                 if(DOM.containers.startBtnExplosion) { // Reset explosion container style
                    DOM.containers.startBtnExplosion.style.top = '0';
                    DOM.containers.startBtnExplosion.style.left = '0';
                    DOM.containers.startBtnExplosion.style.width = '100%';
                    DOM.containers.startBtnExplosion.style.height = '100%';
                 }
            }

            // Unlock state after the new screen's fade-in is complete
            setTimeout(() => {
                 state.isAnimating = false;
                 console.log(`屏幕切換完成，當前屏幕: ${toScreenId}`);
            }, SCREEN_TRANSITION_DURATION);

        }, SCREEN_TRANSITION_DURATION); // Wait for the fromScreen fade-out
    }

    // --- Test Logic (Refined) ---
    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("初始化測驗屏幕失敗：缺少必要元素。"); return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        state.isTransitioning = false; // Reset question transition lock
        updateProgressBar(0); // Reset progress bar initially
        displayQuestion(state.currentQuestionIndex, true); // Display first question
        updateProgressBar(1); // Set progress for first question
     }

    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) { console.error(`無效的問題索引: ${index}`); return; }
        const questionData = questions[index];
        const questionNumber = index + 1;
        state.isTransitioning = true; // Lock

        // Update background
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            if (!isInitialDisplay) {
                DOM.elements.testBackground.classList.add('is-hidden');
                setTimeout(() => {
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    requestAnimationFrame(() => { DOM.elements.testBackground.classList.remove('is-hidden'); });
                    console.log(`背景設置為: ${imageUrl}`);
                }, 500);
            } else {
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                DOM.elements.testBackground.classList.remove('is-hidden');
                console.log(`初始背景設置為: ${imageUrl}`);
            }
        }

        // Update Title
        if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.add('is-hidden'); // Always hide before changing
             // Use timeout for smooth transition even for initial display
             setTimeout(() => {
                 DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                 requestAnimationFrame(() => {
                     DOM.elements.questionTitle.style.transition = ''; // Ensure transitions apply
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                 });
             }, isInitialDisplay ? 100 : 500); // Shorter delay for initial display
        }

        // Update Options
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = '';
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option is-hidden'; // Start hidden
                optionElement.style.transition = 'none'; // Prevent initial transition
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
            // Trigger enter animation after a brief delay
             setTimeout(() => triggerQuestionEnterAnimation(), isInitialDisplay ? 150 : 0);
        } else {
             console.error("找不到 options-container");
             state.isTransitioning = false; // Unlock if options container missing
        }
    }

     function handleOptionClick(event) {
         const clickedOption = event.currentTarget;
         const optionIndex = parseInt(clickedOption.dataset.index);
         const questionIndex = state.currentQuestionIndex;

         if (isNaN(optionIndex) || isNaN(questionIndex)) return;
         // Use question transition lock
         if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
             console.log("正在轉換問題或選項已點擊..."); return;
         }

         state.isTransitioning = true; // Lock
         console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
         state.userAnswers[questionIndex] = optionIndex;

         triggerQuestionFadeOut(clickedOption);
         triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);

         const transitionDelay = EXPLOSION_DURATION + 100;

         setTimeout(() => {
             if (state.currentQuestionIndex < questions.length - 1) {
                 prepareNextQuestion();
             } else {
                 console.log("最後一題完成，顯示結果");
                 showResults();
             }
             // state.isTransitioning is reset by displayQuestion or showResults
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
        console.log("舊內容淡出已觸發");
     }

     function prepareNextQuestion() {
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        updateProgressBar(state.currentQuestionIndex + 1);
        displayQuestion(state.currentQuestionIndex, false); // Non-initial display
     }

     function triggerQuestionEnterAnimation() {
         console.log("觸發新內容進場動畫");
         // Ensure title is visible (it fades in via its own timeout in displayQuestion)
         if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.remove('is-hidden');
         }

         const optionsEnterStartDelay = 200; // Delay slightly more
         const optionStaggerDelay = 80;
         const optionEnterDuration = 500;

         allOptions.forEach((option, index) => {
             option.style.transition = ''; // Ensure CSS transitions apply
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
             requestAnimationFrame(() => { // Use rAF for smoother start
                 option.classList.remove('is-hidden');
                 option.style.pointerEvents = '';
             });
         });

         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 100;

         setTimeout(() => {
             console.log("所有進場動畫完成");
             allOptions.forEach(option => { option.style.transitionDelay = ''; });
             state.isTransitioning = false; // Unlock question transition
             console.log("問題轉換完成，解除鎖定。");
         }, finalResetDelay);
    }

     function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / questions.length) * 100;
             DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`; // Clamp between 0-100
             // console.log(`進度條更新: ${progress.toFixed(0)}%`); // Optional log
         }
    }

    // --- Result Logic (Unchanged) ---
    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) {
                 console.warn(`Answers (${state.userAnswers.length}) mismatch questions (${questions.length})! Padding...`);
                 for (let i = 0; i < questions.length; i++) { if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; }
            }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question?.options?.[answerIndex]?.scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) { if (scores.hasOwnProperty(type)) { scores[type] += optionScores[type]; } }
                } else { console.warn(`Invalid data for Q${questionIndex + 1}, Option ${answerIndex}, skipping score.`); }
            });
            state.finalScores = scores; console.log("Final Scores:", state.finalScores);
            const scoreValues = Object.values(scores); const scoreFrequency = {};
            scoreValues.forEach(score => { const roundedScore = Math.round(score * 10) / 10; scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1; });
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) { console.log("SPECIAL result condition (4+ same scores)"); return results["SPECIAL"]; } }
            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) { if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); } else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; } }
             console.log("Highest type(s):", highestTypes, "Score:", maxScore);
            if (highestTypes.length === 1) { return results[highestTypes[0]]; }
            if (highestTypes.length >= 3) { console.log("SPECIAL result condition (3+ tied max scores)"); return results["SPECIAL"]; }
            if (highestTypes.length === 2) {
                 console.log("Tiebreaker needed (2 types tied)");
                const tiebreakQuestionIndex = 8;
                if (state.userAnswers[tiebreakQuestionIndex] === undefined) { console.warn("Tiebreaker question unanswered, selecting first tied type."); return results[highestTypes[0]]; }
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                 console.log(`Tiebreaker Q9 primary type: ${tiebreakPrimaryType}`);
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { console.log(`Tiebreaker success: ${tiebreakPrimaryType}`); return results[tiebreakPrimaryType]; }
                else { console.log("Tiebreaker failed or type not in tie, selecting first tied type."); return results[highestTypes[0]]; }
            }
            console.warn("Scoring logic fallback, returning default A"); return results['A'];
        } catch (error) { console.error("Error calculating result:", error); return results['A']; }
     }
    function prepareResultData(resultData) { /* (Unchanged) */
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) { console.error("Failed to prepare result data: Missing DOM elements."); return false; }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (!typeScores || Object.keys(typeScores).length === 0) { console.warn("Cannot get final scores for traits."); }
            else if (resultData.title && resultData.title.includes('管理員')) { Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); }
            else { Object.keys(traitNames).forEach(type => { const score = typeScores[type] || 0; let stars = 1; if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2; addTraitElement(type, stars); }); }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("Result data prepared."); return true;
        } catch (error) { console.error("Error preparing result data:", error); DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; return false; }
     }
    function showResults() { /* (Unchanged) */
        console.log("顯示結果頁面...");
        if (state.isAnimating) { console.log("Cannot show results while animating."); return; } // Check global lock
        state.isTransitioning = true; // Lock question transition state before switching
        try {
            const resultData = calculateResult(); if (!resultData) throw new Error("Result calculation failed");
            if (prepareResultData(resultData)) {
                switchScreen('test', 'result'); // switchScreen handles state unlock
            } else { throw new Error("Result data preparation failed"); }
        } catch (error) {
            console.error("Error showing results:", error); alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            state.isTransitioning = false; // Ensure unlock on error
            state.isAnimating = false; // Ensure global lock is also released on error before switch
            switchScreen('test', 'intro');
        }
     }
    function addTraitElement(type, starCount) { /* (Unchanged) */
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
    function copyShareText() { /* (Unchanged) */
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); }).catch(err => { console.warn('Clipboard API copy failed:', err); fallbackCopyText(textToCopy); });
            } else { fallbackCopyText(textToCopy); }
         } catch (error) { console.error("Copy operation error:", error); alert('複製失敗，請手動複製。'); DOM.buttons.copy.textContent = '複製'; }
     }
    function fallbackCopyText(text) { /* (Unchanged) */
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = 'fixed'; textArea.style.left = '-9999px'; textArea.style.opacity = '0'; textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select(); textArea.setSelectionRange(0, 99999);
        let success = false;
        try {
            success = document.execCommand('copy');
            if (success) { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); }
            else { console.error('Fallback copy (execCommand) failed'); alert('複製失敗，瀏覽器不支援此操作。'); }
        } catch (err) { console.error('Fallback copy error:', err); alert('複製失敗，請手動複製。'); }
        document.body.removeChild(textArea);
     }

    // --- Event Listeners ---
    function bindStartButton() { /* (Unchanged) */
        if (DOM.buttons.start) {
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("Start button event bound.");
        } else { console.error("Failed to bind start button event."); displayInitializationError("無法啟動測驗，按鈕丟失。"); }
    }
    function bindOtherButtons() { /* (Unchanged) */
        if (DOM.buttons.restart) { DOM.buttons.restart.removeEventListener('click', handleRestartClick); DOM.buttons.restart.addEventListener('click', handleRestartClick); console.log("Restart button event bound."); }
        else { console.error("Cannot bind restart button."); }
        if (DOM.buttons.copy) { DOM.buttons.copy.removeEventListener('click', copyShareText); DOM.buttons.copy.addEventListener('click', copyShareText); console.log("Copy button event bound."); }
        else { console.error("Cannot bind copy button."); }
     }
     function handleRestartClick() { /* (Unchanged) */
        if (state.isAnimating) { console.log("Animation in progress, cannot restart yet."); return; }
        switchScreen('result', 'intro');
     }

    // --- Global Error Handler ---
    window.addEventListener('error', function(event) { /* (Unchanged) */
         console.error("Global error caught:", event.error, "at:", event.filename, ":", event.lineno);
         state.isAnimating = false; state.isTransitioning = false;
    });

    // --- Initialization ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        preloadImages(); // Starts preloading and the whole sequence
        bindOtherButtons();
    } else {
        console.error("DOM element caching failed, initialization incomplete.");
    }

    console.log("Script initialization complete.");
});