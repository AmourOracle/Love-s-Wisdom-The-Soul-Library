// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false, // Controls general animation locks (like button clicks during transitions)
        isTransitioning: false, // Controls question transition locks
        currentQuestionIndex: 0,
        userAnswers: [],
        preloadComplete: false,
        introVisible: false, // Track if intro screen *logic* has been activated
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
    const PRELOADER_EXTRA_DELAY = 1500; // Extra time preloader stays visible (ms)
    const PRELOADER_EXIT_DURATION = 1200; // Match CSS --preloader-exit-duration (ms)
    const INTRO_FADEIN_DURATION = 1000; // Match CSS --intro-fadein-duration (ms)
    const SCREEN_TRANSITION_DURATION = 600; // Match CSS --transition-duration (ms)
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
                     startBtnExplosion: document.getElementById('start-btn-explosion-container')
                 },
                 elements: {
                     introBackground: document.querySelector('.intro-background'),
                     introOverlay: document.querySelector('.intro-overlay'),
                     introContent: document.querySelector('.intro-content'),
                     introTitlePlaceholder: document.querySelector('.intro-title-placeholder'),
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
                     preloaderSvg: document.querySelector('#preloader #text'),
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
                 DOM.containers.startBtnExplosion,
                 DOM.elements.introBackground, DOM.elements.introOverlay, DOM.elements.introContent,
                 DOM.elements.introTitlePlaceholder, DOM.elements.preloaderSvg,
                 DOM.elements.testBackground, DOM.elements.questionTitle,
                 DOM.elements.startBtnText,
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
        if (!DOM.containers.preloader || !DOM.containers.intro) {
            console.error("Preloader or Intro container not found for transition.");
            return;
        }

        console.log("開始 Preloader 到 Intro 的轉場...");
        state.isAnimating = true; // Lock state during preloader exit

        // 1. Start preloader exit animation (CSS handles visibility/opacity via class)
        DOM.containers.preloader.classList.add('transitioning-out');

        // 2. Intro container is already display: block, opacity: 0, visibility: hidden via CSS
        // We just need to make it active after the preloader is gone.

        // 3. After preloader exit animation duration, make intro active
        setTimeout(() => {
            console.log("Preloader 動畫結束，移除 Preloader active 狀態，啟動 Intro。");
            DOM.containers.preloader.classList.remove('active', 'transitioning-out');
            // No need to set display: none, CSS handles visibility

            // Make intro container active (CSS handles fade-in via .active class)
            DOM.containers.intro.classList.add('active');
            state.introVisible = true; // Mark intro logic as active

            // Re-enable interaction after intro fades in (use INTRO_FADEIN_DURATION)
            setTimeout(() => {
                 state.isAnimating = false; // Unlock state
                 console.log("Intro 轉場完成。");
            }, INTRO_FADEIN_DURATION); // Wait for intro fade-in to complete

        }, PRELOADER_EXIT_DURATION);
    }


    function preloadImages() {
        if (!DOM.containers?.preloader) { console.warn("找不到 preloader..."); state.preloadComplete = true; bindStartButton(); return; }
        if (!questions || questions.length === 0) { console.warn("無法預載入圖片：缺少 questions..."); state.preloadComplete = true; if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active'); bindStartButton(); return; }

        console.log("顯示 Preloader...");
        DOM.containers.preloader.classList.add('active');

        // Ensure intro starts inactive (CSS handles initial hidden state)
        if (DOM.containers.intro) {
             DOM.containers.intro.classList.remove('active');
        }
        // Ensure other screens are inactive
        if (DOM.containers.test) DOM.containers.test.classList.remove('active');
        if (DOM.containers.result) DOM.containers.result.classList.remove('active');


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

                const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY;
                console.log(`等待額外延遲 ${totalDelay}ms...`);

                setTimeout(() => {
                    triggerIntroTransition(); // Call the transition function
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
        const parentContainer = explosionContainer.offsetParent || document.body;
        const parentRect = parentContainer.getBoundingClientRect();

        const startX = targetRect.left - parentRect.left + targetRect.width / 2;
        const startY = targetRect.top - parentRect.top + targetRect.height / 2;

        textToExplode.split('').forEach((char) => {
            if (char.trim() === '') return;

            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.6);
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 400 + 300;
            const rotateZ = (Math.random() - 0.5) * 540;
            const scale = Math.random() * 4 + 3;
            const delay = Math.random() * 0.2;

            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;

            explosionContainer.appendChild(span);

            // Auto-remove after animation (add a buffer)
            setTimeout(() => {
                if (span.parentNode === explosionContainer) {
                     explosionContainer.removeChild(span);
                }
            }, EXPLOSION_DURATION + delay * 1000 + 500); // Match animation + delay + buffer
        });
        console.log(`文字爆裂已觸發 for: ${textToExplode}`);
    }


    // --- MODIFIED: Start Button Click Handler ---
    function handleStartTestClick() {
        if (!state.preloadComplete || !state.introVisible) {
             console.warn("內容尚未準備好或 Intro 未顯示。");
             return;
        }
        if (state.isAnimating) { console.log("動畫進行中..."); return; }

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
            // Reset button text visibility later
            if (textElement) {
                 setTimeout(() => textElement.classList.remove('hidden'), SCREEN_TRANSITION_DURATION + 100);
            }
            // state.isAnimating will be reset by switchScreen
        }, EXPLOSION_DURATION * 0.8); // Start switch a bit before explosion fully ends
    }

    // --- Screen Switching (Uses CSS .active class for fades) ---
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) { console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`); state.isAnimating = false; return; }
        if (state.isAnimating && fromScreenId !== 'preloader') { // Allow preloader->intro transition
            console.log("屏幕切換已在進行中...");
            return;
        }

        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        state.isAnimating = true; // Lock screen switching

        // Deactivate current screen (CSS handles fade-out)
        fromScreen.classList.remove('active');

        // After the fade-out transition ends, activate the next screen
        setTimeout(() => {
            // Activate next screen (CSS handles fade-in)
            toScreen.classList.add('active');

            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            state.introVisible = (toScreenId === 'intro'); // Update intro visibility state

            if (toScreenId === 'test') {
                 initializeTestScreen(); // Initialize test screen content
                 state.contentRendered = true;
            } else if (toScreenId === 'intro') {
                // Reset test/result states if going back to intro
                state.currentQuestionIndex = 0;
                state.userAnswers = [];
                state.finalScores = {};
                state.contentRendered = false;
                if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
            }

            // Reset animation flag after the *new* screen's fade-in transition
            setTimeout(() => {
                 state.isAnimating = false; // Unlock screen switching
                 console.log("屏幕切換完成");
            }, SCREEN_TRANSITION_DURATION);

        }, SCREEN_TRANSITION_DURATION); // Wait for the 'fromScreen' fade-out
    }

    // --- Test Logic (Mostly Unchanged, but uses generic explosion) ---
    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) {
            console.error("初始化測驗屏幕失敗：缺少必要元素。");
            return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        state.isTransitioning = false;
        displayQuestion(state.currentQuestionIndex, true); // Pass true for initial display
        updateProgressBar(1); // Start with progress for question 1
     }
    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) {
            console.error(`無效的問題索引: ${index}`);
            return;
        }
        const questionData = questions[index];
        const questionNumber = index + 1;
        state.isTransitioning = true; // Lock during question display/transition

        // Update background image
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            // If not initial, fade out the old background first
            if (!isInitialDisplay) {
                DOM.elements.testBackground.classList.add('is-hidden');
                // Wait for fade out before changing image and fading in
                setTimeout(() => {
                    DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                    requestAnimationFrame(() => { // Ensure style is applied before removing class
                        DOM.elements.testBackground.classList.remove('is-hidden');
                    });
                     console.log(`背景設置為: ${imageUrl}`);
                }, 500); // Adjust timing as needed (should match CSS transition)
            } else {
                // For initial display, set immediately
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                DOM.elements.testBackground.classList.remove('is-hidden'); // Ensure it's visible
                console.log(`初始背景設置為: ${imageUrl}`);
            }
        } else { console.error("找不到 test-background"); }

        // Update question title
        if (DOM.elements.questionTitle) {
            // If not initial, hide first, then update and show
            if (!isInitialDisplay) {
                DOM.elements.questionTitle.classList.add('is-hidden');
                setTimeout(() => {
                    DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                    requestAnimationFrame(() => {
                        DOM.elements.questionTitle.style.transition = ''; // Reset potential inline transition
                        DOM.elements.questionTitle.classList.remove('is-hidden');
                    });
                }, 500); // Delay to match background fade
            } else {
                DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
                DOM.elements.questionTitle.classList.remove('is-hidden'); // Ensure visible
            }
        } else { console.error("找不到 questionTitle"); }

        // Update options
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // Clear old options
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option';
                // If not initial, start hidden for staggered animation
                if (!isInitialDisplay) {
                    optionElement.classList.add('is-hidden');
                    optionElement.style.transition = 'none'; // Prevent initial transition flash
                }
                optionElement.dataset.text = optionData.text;
                optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0; // Make it focusable
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
            allOptions = Array.from(DOM.containers.options.querySelectorAll('.option')); // Update the list
        } else { console.error("找不到 options-container"); }

        // Trigger enter animation for non-initial displays
        if (!isInitialDisplay) {
            triggerQuestionEnterAnimation();
        } else {
            // For initial display, unlock transition state immediately
            state.isTransitioning = false;
            console.log("初始問題顯示完成");
        }
    }

    function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        if (isNaN(optionIndex) || isNaN(questionIndex)) {
            console.error("無效的選項或問題索引");
            return;
        }
        // Prevent clicking if already transitioning or if the option is animating out
        if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            console.log("正在轉換問題或選項已點擊...");
            return;
        }

        state.isTransitioning = true; // Lock state
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);
        state.userAnswers[questionIndex] = optionIndex;

        // Fade out current question elements
        triggerQuestionFadeOut(clickedOption);

        // Trigger explosion animation for the clicked option
        triggerExplosion(clickedOption, clickedOption.dataset.text || clickedOption.innerText, DOM.containers.explosion);

        // Determine delay before showing next question/results
        // Wait for explosion animation + a small buffer
        const transitionDelay = EXPLOSION_DURATION + 100;

        setTimeout(() => {
            if (state.currentQuestionIndex < questions.length - 1) {
                prepareNextQuestion();
            } else {
                console.log("最後一題完成，顯示結果");
                showResults(); // This will call switchScreen which handles state.isTransitioning
            }
            // Note: state.isTransitioning is reset inside displayQuestion or showResults flow
        }, transitionDelay);
    }

    function triggerQuestionFadeOut(clickedOptionElement) {
        if (DOM.elements.testBackground) { DOM.elements.testBackground.classList.add('is-hidden'); }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.classList.add('is-hidden'); }

        allOptions.forEach(option => {
            option.style.transitionDelay = ''; // Clear any previous delays
            if (option === clickedOptionElement) {
                // Mark as exploded (CSS handles immediate opacity/scale change)
                option.classList.add('exploded');
            } else {
                // Fade out other options (CSS handles opacity/filter/transform transition)
                option.classList.add('fade-out');
            }
            option.style.pointerEvents = 'none'; // Disable further clicks
        });
        console.log("舊內容淡出已觸發");
     }

    function prepareNextQuestion() {
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        updateProgressBar(state.currentQuestionIndex + 1); // Update progress bar *before* displaying
        displayQuestion(state.currentQuestionIndex, false); // Pass false for non-initial display
     }
    function triggerQuestionEnterAnimation() {
         console.log("觸發新內容進場動畫");
         // Staggered fade-in for options
         const optionsEnterStartDelay = 150; // Delay after title starts appearing
         const optionStaggerDelay = 80;
         const optionEnterDuration = 500; // Match CSS transition duration

         allOptions.forEach((option, index) => {
             // Ensure hidden class is removed and apply delay
             option.style.transition = ''; // Clear potential inline styles
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
             requestAnimationFrame(() => {
                 option.classList.remove('is-hidden');
                 option.style.pointerEvents = ''; // Re-enable pointer events after animation starts
             });
         });

         // Calculate total time for animations to finish
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         // Wait for the last option's animation to complete + buffer
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 100;

         setTimeout(() => {
             console.log("所有進場動畫完成");
             allOptions.forEach(option => {
                 option.style.transitionDelay = ''; // Reset delay for next interaction
             });
             // Reset transition lock
             state.isTransitioning = false;
             console.log("問題轉換完成，解除鎖定。");
         }, finalResetDelay);
    }

    function updateProgressBar(questionNumber) {
         if (DOM.elements.progressFill) {
             const progress = (questionNumber / questions.length) * 100;
             DOM.elements.progressFill.style.width = `${progress}%`;
             console.log(`進度條更新: ${progress.toFixed(0)}%`);
         }
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
                const tiebreakQuestionIndex = 8; // Question 9 is index 8
                if (state.userAnswers[tiebreakQuestionIndex] === undefined) {
                    console.warn("決勝局問題未作答，選擇第一個平局類型");
                    return results[highestTypes[0]];
                }
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                 console.log(`問題 9 選擇的主要類型: ${tiebreakPrimaryType}`);
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) {
                    console.log(`決勝成功: ${tiebreakPrimaryType}`);
                    return results[tiebreakPrimaryType];
                } else {
                    console.log("決勝失敗或主要類型不在平局類型中，選擇第一個平局類型");
                    return results[highestTypes[0]];
                }
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
            else if (resultData.title && resultData.title.includes('管理員')) { Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); } // Special case for admin
            else { Object.keys(traitNames).forEach(type => { const score = typeScores[type] || 0; let stars = 1; if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2; addTraitElement(type, stars); }); }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("結果數據準備完成"); return true;
        } catch (error) { console.error("準備結果數據時出錯:", error); DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; return false; }
     }
    function showResults() {
        console.log("顯示結果頁面...");
        // state.isTransitioning is already true from handleOptionClick
        try {
            const resultData = calculateResult();
            if (!resultData) throw new Error("計算結果失敗");

            if (prepareResultData(resultData)) {
                switchScreen('test', 'result'); // switchScreen handles resetting state.isTransitioning
            } else {
                throw new Error("準備結果數據失敗");
            }
        } catch (error) {
            console.error("顯示結果流程出錯:", error);
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            state.isTransitioning = false; // Unlock if error occurs before switchScreen
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
        } catch (error) { console.error(`添加特質 ${type} 時出錯:`, error); }
     }
    function copyShareText() {
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    DOM.buttons.copy.textContent = '已複製!';
                    setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000);
                }).catch(err => {
                    console.warn('Clipboard API 複製失敗:', err);
                    fallbackCopyText(textToCopy); // Use fallback
                });
            } else {
                fallbackCopyText(textToCopy); // Use fallback for non-secure contexts or older browsers
            }
         } catch (error) {
             console.error("複製操作出錯:", error);
             alert('複製失敗，請手動複製。');
             DOM.buttons.copy.textContent = '複製'; // Reset button text on error
         }
     }
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Make the textarea non-editable and invisible
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px'; // Move off-screen
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', ''); // Prevent keyboard pop-up on mobile

        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices

        let success = false;
        try {
            success = document.execCommand('copy');
            if (success) {
                DOM.buttons.copy.textContent = '已複製!';
                setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000);
            } else {
                 console.error('備用複製方法 (execCommand) 失敗');
                 alert('複製失敗，瀏覽器不支援此操作。');
            }
        } catch (err) {
            console.error('備用複製方法執行時出錯:', err);
            alert('複製失敗，請手動複製。');
        }

        document.body.removeChild(textArea);
     }

    // --- 事件監聽器綁定 ---
    function bindStartButton() {
        if (DOM.buttons.start) {
            // Remove previous listener if any to prevent duplicates
            DOM.buttons.start.removeEventListener('click', handleStartTestClick);
            // Add the listener
            DOM.buttons.start.addEventListener('click', handleStartTestClick);
            console.log("開始按鈕事件已綁定");
        } else {
            console.error("無法綁定開始按鈕事件...");
            displayInitializationError("無法啟動測驗，按鈕丟失。");
        }
    }

    function bindOtherButtons() {
        if (DOM.buttons.restart) {
             DOM.buttons.restart.removeEventListener('click', handleRestartClick); // Use named function
             DOM.buttons.restart.addEventListener('click', handleRestartClick);
             console.log("重新開始按鈕事件已綁定");
        } else { console.error("無法綁定重新開始按鈕。"); }

        if (DOM.buttons.copy) {
             DOM.buttons.copy.removeEventListener('click', copyShareText);
             DOM.buttons.copy.addEventListener('click', copyShareText);
             console.log("複製按鈕事件已綁定");
        } else { console.error("無法綁定複製按鈕。"); }
     }

     // Named handler for restart button
     function handleRestartClick() {
        if (state.isAnimating) {
            console.log("動畫進行中，無法重新開始...");
            return;
        }
        switchScreen('result', 'intro');
     }

    // --- Global Error Handler (Unchanged) ---
    window.addEventListener('error', function(event) {
         console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
         // Attempt to reset state to prevent getting stuck
         state.isAnimating = false;
         state.isTransitioning = false;
         // Consider showing an error message or resetting to intro
         // displayInitializationError("發生意外錯誤，請刷新頁面。");
    });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    if (cacheDOMElements()) {
        preloadImages(); // Starts preloading and the whole sequence
        bindOtherButtons();
    } else {
        console.error("DOM 元素快取失敗，無法繼續初始化。");
    }

    console.log("腳本初始化完成。");
});