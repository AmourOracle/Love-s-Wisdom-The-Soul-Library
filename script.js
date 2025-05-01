// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false, isTransitioning: false, currentQuestionIndex: 0,
        userAnswers: [], preloadComplete: false, introVisible: false,
        resultShowing: false, contentRendered: false, finalScores: {}
    };

    // --- DOM 元素快取 ---
    let DOM = {}; let allOptions = [];

    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') { console.error("錯誤：找不到有效的 testData..."); displayInitializationError("無法載入測驗數據。"); return; }
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) { console.error("錯誤：testData.questions 不是有效的陣列或為空。"); displayInitializationError("測驗問題數據格式錯誤。"); return; }
    const questions = testData.questions; const results = testData.results || {};
    const traitNames = testData.traitNames || {};

    // --- Constants ---
    const PRELOADER_EXTRA_DELAY = 3000;
    const PRELOADER_SVG_EXIT_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preloader-svg-exit-duration').replace('s','')) * 1000 || 1200;
    const PRELOADER_EXIT_DURATION = PRELOADER_SVG_EXIT_DURATION;
    const INTRO_FADEIN_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-fadein-duration').replace('s','')) * 1000 || 1000;
    const SCREEN_TRANSITION_DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration').replace('s','')) * 1000 || 600;
    const SVG_GLOW_DELAY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--svg-glow-delay').replace('s','')) * 1000 || 3000;
    const EARLY_GLOW_TRIGGER_DELAY = 100;
    const INTRO_ACTIVATION_OFFSET = 0;

    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }
    function displayInitializationError(message) {
        const preloaderContent = document.querySelector('.preloader-content');
        if (preloaderContent) { preloaderContent.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; const preloader = document.getElementById('preloader'); if (preloader) preloader.classList.add('active'); } else { document.body.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`; }
    }
    function cacheDOMElements() {
         try {
             DOM = {
                 containers: { intro: document.getElementById('intro-container'), test: document.getElementById('test-container'), result: document.getElementById('result-container'), preloader: document.getElementById('preloader'), options: document.getElementById('options-container'), /* explosion: Removed */ startBtnExplosion: null, /* Removed */ preloaderSvgContainer: document.getElementById('preloader-svg-container'), introTitlePlaceholder: document.querySelector('#intro-container .intro-title-placeholder') },
                 elements: { testBackground: document.getElementById('test-background'), progressFill: document.getElementById('progress-fill'), questionTitle: document.getElementById('question-title'), resultTitle: document.getElementById('result-title'), resultSubtitle: document.getElementById('result-subtitle'), resultDescription: document.getElementById('result-description'), traitsContainer: document.getElementById('traits-container'), similarBooks: document.getElementById('similar-books'), complementaryBooks: document.getElementById('complementary-books'), shareText: document.getElementById('share-text'), preloaderSvg: document.getElementById('preloader-svg'), startBtnText: document.querySelector('#start-test .btn-text'), introTitleSvg: null },
                 buttons: { start: document.getElementById('start-test'), copy: document.getElementById('copy-btn'), restart: document.getElementById('restart-btn') }
             };
             const criticalElements = [ DOM.containers.intro, DOM.containers.test, DOM.containers.result, DOM.containers.preloader, DOM.containers.options, DOM.containers.preloaderSvgContainer, DOM.elements.preloaderSvg, DOM.containers.introTitlePlaceholder, DOM.elements.testBackground, DOM.elements.questionTitle, DOM.elements.startBtnText, DOM.buttons.start ];
             if (criticalElements.some(el => !el)) { console.error("錯誤：未能找到所有必要的 HTML 元素。請檢查 HTML 結構和 ID/Class。", DOM); const missing = criticalElements.findIndex(el => !el); console.error("Missing element index:", missing); displayInitializationError("頁面結構錯誤，無法啟動測驗。"); return false; }
             if (DOM.elements.preloaderSvg && DOM.containers.introTitlePlaceholder) { console.log("準備複製 Preloader SVG 到 Intro..."); try { const clonedSvg = DOM.elements.preloaderSvg.cloneNode(true); clonedSvg.id = 'intro-title-svg'; clonedSvg.classList.remove('glow-active', 'svg-exiting'); DOM.containers.introTitlePlaceholder.innerHTML = ''; DOM.containers.introTitlePlaceholder.appendChild(clonedSvg); DOM.elements.introTitleSvg = clonedSvg; console.log("Intro title SVG 已從 Preloader SVG 複製並插入"); } catch (cloneError) { console.error("複製或插入 SVG 時發生錯誤:", cloneError); if (DOM.containers.introTitlePlaceholder) { DOM.containers.introTitlePlaceholder.innerHTML = '<h1 style="color:red;">Title Clone Error</h1>'; } } } else { console.error("無法複製 SVG：找不到 Preloader SVG 或 Intro title placeholder"); if (DOM.containers.introTitlePlaceholder) { DOM.containers.introTitlePlaceholder.innerHTML = '<h1 style="color:red;">Title Error</h1>'; } }
             console.log("DOM 元素已快取"); return true;
         } catch (error) { console.error("快取 DOM 元素時出錯:", error); displayInitializationError("頁面初始化時發生錯誤。"); return false; }
    }

    function triggerIntroTransition() {
        if (!DOM.containers.preloader || !DOM.containers.intro || !DOM.elements.preloaderSvg || !DOM.containers.introTitlePlaceholder) { console.error("Preloader/Intro/SVG/Title placeholder not found for transition."); state.isAnimating = false; return; }
        if (state.isAnimating) { console.log("正在轉換 Intro，忽略重複觸發"); return; }
        console.log("開始 Preloader 到 Intro 的轉場 (滑動效果)..."); state.isAnimating = true;
        if (DOM.elements.preloaderSvg) { DOM.elements.preloaderSvg.classList.add('svg-exiting'); console.log("觸發 Preloader SVG 退場動畫 (.svg-exiting added)"); }
        if (DOM.containers.preloader) { DOM.containers.preloader.classList.add('transitioning-out'); console.log("觸發 Preloader 容器淡出 (.transitioning-out added)"); }
        if (DOM.containers.intro && !DOM.containers.intro.classList.contains('active')) { console.log(`立即激活 Intro 容器`); DOM.containers.intro.classList.add('active'); state.introVisible = true; }
        setTimeout(() => {
            console.log("Preloader 動畫結束，清理 Preloader class");
            if (DOM.containers.preloader) { DOM.containers.preloader.classList.remove('active', 'transitioning-out'); }
            if (DOM.elements.preloaderSvg) { DOM.elements.preloaderSvg.classList.remove('svg-exiting', 'glow-active'); }
            if (DOM.containers.intro && !DOM.containers.intro.classList.contains('active')) { console.warn("Intro container was not active after preloader exit, activating now."); DOM.containers.intro.classList.add('active'); state.introVisible = true; }
            let latestIntroAnimEndTime = 0;
            try {
                const titlePlaceholder = DOM.containers.introTitlePlaceholder; const cardBody = DOM.containers.intro.querySelector('.card-body'); const cardFooter = DOM.containers.intro.querySelector('.card-footer'); let maxEndTime = 0;
                [titlePlaceholder, cardBody, cardFooter].forEach(el => { if (el) { const styles = getComputedStyle(el); const delay = parseFloat(styles.animationDelay.replace('s','')) * 1000 || 0; const duration = parseFloat(styles.animationDuration.replace('s','')) * 1000 || 0; const endTime = INTRO_ACTIVATION_OFFSET + delay + duration; if (endTime > maxEndTime) { maxEndTime = endTime; } } });
                latestIntroAnimEndTime = maxEndTime; console.log("Calculated latest intro animation end time:", latestIntroAnimEndTime);
            } catch(e) { console.warn("Error getting intro animation timing, using estimate.", e); latestIntroAnimEndTime = INTRO_ACTIVATION_OFFSET + (PRELOADER_SVG_EXIT_DURATION * 0.7) + INTRO_FADEIN_DURATION; }
            const timeToWaitAfterPreloaderExit = Math.max(0, latestIntroAnimEndTime - PRELOADER_EXIT_DURATION); console.log(`Waiting additional ${timeToWaitAfterPreloaderExit}ms after preloader exit to unlock state.`);
            setTimeout(() => { state.isAnimating = false; console.log("Intro 內容動畫應已完成，解除鎖定。"); }, timeToWaitAfterPreloaderExit + 100);
        }, PRELOADER_EXIT_DURATION);
    }

    function preloadImages() {
        if (!DOM.containers?.preloader || !DOM.elements.preloaderSvg) { console.warn("找不到 preloader 或 preloader SVG..."); state.preloadComplete = true; bindStartButton(); return; }
        if (!questions || questions.length === 0) { console.warn("無法預載入圖片：缺少 questions..."); state.preloadComplete = true; if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active'); bindStartButton(); return; }
        console.log("顯示 Preloader...");
        if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('transitioning-out');
        if (DOM.elements.preloaderSvg) { DOM.elements.preloaderSvg.classList.remove('glow-active', 'svg-exiting'); }
        if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
        if (DOM.containers.intro) DOM.containers.intro.classList.remove('active'); if (DOM.containers.test) DOM.containers.test.classList.remove('active'); if (DOM.containers.result) DOM.containers.result.classList.remove('active');
        setTimeout(() => { if (DOM.containers.preloader && DOM.containers.preloader.classList.contains('active') && DOM.elements.preloaderSvg) { console.log(`在 ${EARLY_GLOW_TRIGGER_DELAY}ms 後提早觸發 SVG 放大 (添加 .glow-active)`); DOM.elements.preloaderSvg.classList.add('glow-active'); } }, EARLY_GLOW_TRIGGER_DELAY);
        const imageUrls = ['./images/Intro.webp']; questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`)); let loadedCount = 0; const totalImages = imageUrls.length; let errorOccurred = false;
        function updateProgress(isError = false) { loadedCount++; if (isError) errorOccurred = true; if (loadedCount >= totalImages) { state.preloadComplete = true; console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`); const totalDelay = errorOccurred ? 500 : PRELOADER_EXTRA_DELAY; console.log(`等待額外延遲 ${totalDelay}ms...`); setTimeout(() => { if (DOM.containers.preloader && DOM.containers.preloader.classList.contains('active')) { triggerIntroTransition(); bindStartButton(); } else { console.log("Preloader no longer active, skipping transition."); } }, totalDelay); } }
        imageUrls.forEach(url => { const img = new Image(); img.src = url; img.onload = () => updateProgress(false); img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); }; });
    }

    // triggerExplosion 函數已移除

    function handleStartTestClick() {
        console.log("handleStartTestClick triggered (Simplified).");
        if (!state.preloadComplete || !state.introVisible) { console.warn("內容尚未準備好或 Intro 未顯示。"); return; }
        const buttonElement = DOM.buttons.start; if (!buttonElement) { console.error("Start button not found!"); return; }
        if (state.isAnimating || state.isTransitioning) { console.log("動畫或屏幕轉換進行中..."); return; }
        console.log("Start button clicked, switching screen...");
        switchScreen('intro', 'test');
    }

    function switchScreen(fromScreenId, toScreenId) {
        console.log(`Attempting to switch screen from ${fromScreenId} to ${toScreenId}`);
        const fromScreen = DOM.containers[fromScreenId]; const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) { console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`); state.isAnimating = false; state.isTransitioning = false; return; }
        if (state.isAnimating && fromScreenId !== 'preloader') { console.log("屏幕切換已在進行中... 忽略重複請求"); return; }
        if (state.isTransitioning && fromScreenId === 'test') { console.log("問題切換進行中... 忽略重複請求"); return; }
        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`); state.isAnimating = true; state.isTransitioning = true;
        fromScreen.classList.remove('active');
        setTimeout(() => {
            console.log(`Adding .active to ${toScreenId}`);
            toScreen.classList.add('active'); document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result'); state.introVisible = (toScreenId === 'intro');
            if (toScreenId === 'test') { initializeTestScreen(); state.contentRendered = true; }
            else if (toScreenId === 'intro') {
                state.currentQuestionIndex = 0; state.userAnswers = []; state.finalScores = {}; state.contentRendered = false;
                if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = ''; if(DOM.elements.progressFill) DOM.elements.progressFill.style.width = '0%';
            }
            const unlockDelay = (fromScreenId === 'preloader') ? 100 : SCREEN_TRANSITION_DURATION;
            setTimeout(() => {
                 state.isAnimating = false;
                 // isTransitioning 由 displayQuestion 或 switchScreen(-> result) 自己解除
                 if (toScreenId === 'intro') { // 從 Result 返回 Intro 時需要解鎖 isTransitioning
                      state.isTransitioning = false;
                 }
                 console.log(`屏幕切換完成，解除 isAnimating 鎖定。當前屏幕: ${toScreenId}`);
            }, unlockDelay);
        }, SCREEN_TRANSITION_DURATION);
    }

    // --- Test Logic (無動畫) ---
     function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) { console.error("初始化測驗屏幕失敗：缺少必要元素。"); return; }
        console.log("初始化測驗屏幕 (無動畫)..."); state.currentQuestionIndex = 0; state.userAnswers = []; state.isTransitioning = false; updateProgressBar(0); displayQuestion(state.currentQuestionIndex, true); updateProgressBar(1);
     }
     function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) { console.error(`無效的問題索引: ${index}`); state.isTransitioning = false; return; }
        const questionData = questions[index]; const questionNumber = index + 1;
        // isTransitioning 在 handleOptionClick 中設置為 true，在此處結束時設置為 false
        if (DOM.elements.testBackground) { const imageUrl = `./images/Q${questionNumber}.webp`; DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`; }
        if (DOM.elements.questionTitle) { DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, ''); }
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = '';
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div'); optionElement.className = 'option';
                optionElement.dataset.text = optionData.text; optionElement.dataset.index = optIndex; optionElement.innerText = optionData.text; optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0; optionElement.addEventListener('click', handleOptionClick); optionElement.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); } });
                DOM.containers.options.appendChild(optionElement);
            });
            allOptions = Array.from(DOM.containers.options.querySelectorAll('.option'));
            console.log(`問題 ${questionNumber} 和選項已顯示`);
            requestAnimationFrame(() => { state.isTransitioning = false; console.log("isTransitioning 解鎖 (displayQuestion)"); });
        } else { console.error("找不到 options-container"); state.isTransitioning = false; }
    }
     function handleOptionClick(event) {
         const clickedOption = event.currentTarget; const optionIndex = parseInt(clickedOption.dataset.index); const questionIndex = state.currentQuestionIndex;
         console.log(`Option clicked: Q${questionIndex + 1}, Option ${optionIndex + 1}`);
         if (isNaN(optionIndex) || isNaN(questionIndex)) { console.error("無效的選項或問題索引"); return; }
         if (state.isTransitioning) { console.log("正在處理上一個點擊或問題轉換..."); return; }
         state.isTransitioning = true;
         console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1} (無動畫)`);
         state.userAnswers[questionIndex] = optionIndex;
         if (state.currentQuestionIndex < questions.length - 1) {
             console.log("準備顯示下一個問題...");
             prepareNextQuestion();
         } else {
             console.log("最後一題完成，準備顯示結果...");
             showResults();
         }
     }
     // **移除** triggerQuestionFadeOut, triggerQuestionEnterAnimation
     function prepareNextQuestion() {
        state.currentQuestionIndex++; console.log(`準備顯示問題 ${state.currentQuestionIndex + 1} (無動畫)`); updateProgressBar(state.currentQuestionIndex + 1); displayQuestion(state.currentQuestionIndex, false);
     }
     function updateProgressBar(questionNumber) { if (DOM.elements.progressFill) { const progress = (questionNumber / questions.length) * 100; DOM.elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`; } }

    // --- Result Logic ---
    function calculateResult() { console.log("Calculating result..."); try { const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 }; if (state.userAnswers.length !== questions.length) { console.warn(`Answers (${state.userAnswers.length}) mismatch questions (${questions.length})! Padding...`); for (let i = 0; i < questions.length; i++) { if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; } } state.userAnswers.forEach((answerIndex, questionIndex) => { const question = questions[questionIndex]; if (question?.options?.[answerIndex]?.scores) { const optionScores = question.options[answerIndex].scores; for (const type in optionScores) { if (scores.hasOwnProperty(type)) { scores[type] += optionScores[type]; } } } else { console.warn(`Invalid data for Q${questionIndex + 1}, Option ${answerIndex}, skipping score.`); } }); state.finalScores = scores; console.log("Final Scores:", state.finalScores); const scoreValues = Object.values(scores); const scoreFrequency = {}; scoreValues.forEach(score => { const roundedScore = Math.round(score * 10) / 10; scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1; }); for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) { console.log("SPECIAL result condition (4+ same scores)"); return results["SPECIAL"]; } } let maxScore = -Infinity; let highestTypes = []; for (const type in scores) { if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); } else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; } } console.log("Highest type(s):", highestTypes, "Score:", maxScore); if (highestTypes.length === 1) { return results[highestTypes[0]]; } if (highestTypes.length >= 3) { console.log("SPECIAL result condition (3+ tied max scores)"); return results["SPECIAL"]; } if (highestTypes.length === 2) { console.log("Tiebreaker needed (2 types tied)"); const tiebreakQuestionIndex = 8; if (state.userAnswers[tiebreakQuestionIndex] === undefined) { console.warn("Tiebreaker question unanswered, selecting first tied type."); return results[highestTypes[0]]; } const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex]; const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary; console.log(`Tiebreaker Q9 primary type: ${tiebreakPrimaryType}`); if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { console.log(`Tiebreaker success: ${tiebreakPrimaryType}`); return results[tiebreakPrimaryType]; } else { console.log("Tiebreaker failed or type not in tie, selecting first tied type."); return results[highestTypes[0]]; } } console.warn("Scoring logic fallback, returning default A"); return results['A']; } catch (error) { console.error("Error calculating result:", error); return results['A']; } }
    function prepareResultData(resultData) { console.log("Preparing result data..."); if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) { console.error("Failed to prepare result data: Missing DOM elements."); return false; } try { DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知'; DOM.elements.resultSubtitle.textContent = resultData.subtitle || ''; DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。'; DOM.elements.traitsContainer.innerHTML = ''; const typeScores = state.finalScores; if (!typeScores || Object.keys(typeScores).length === 0) { console.warn("Cannot get final scores for traits."); } else if (resultData.title && resultData.title.includes('管理員')) { Object.keys(traitNames).forEach(type => addTraitElement(type, 3)); } else { Object.keys(traitNames).forEach(type => { const score = typeScores[type] || 0; let stars = 1; if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2; addTraitElement(type, stars); }); } DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>'; DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>'; DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle'; console.log("Result data prepared."); return true; } catch (error) { console.error("Error preparing result data:", error); DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; return false; } }
    // *** 修改: 移除 showResults 開頭的狀態檢查 ***
    function showResults() {
        console.log("顯示結果頁面...");
        /*
        if (state.isAnimating || state.isTransitioning) {
             console.log("Cannot show results while animating or transitioning.");
             return;
        }
        */
        try {
            console.log("Calling calculateResult...");
            const resultData = calculateResult();
            if (!resultData) throw new Error("Result calculation failed");
            console.log("Calling prepareResultData...");
            if (prepareResultData(resultData)) {
                console.log("Result data prepared successfully, calling switchScreen...");
                switchScreen('test', 'result'); // switchScreen 會處理狀態鎖
            } else {
                throw new Error("Result data preparation failed");
            }
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            state.isTransitioning = false; state.isAnimating = false; // 手動解鎖
            switchScreen('test', 'intro');
        }
     }
    function addTraitElement(type, starCount) { if (!DOM.elements.traitsContainer) return; try { const traitElement = document.createElement('div'); traitElement.className = 'trait-item'; const traitName = document.createElement('span'); traitName.className = 'trait-name'; traitName.textContent = traitNames[type] || type; const traitStars = document.createElement('span'); traitStars.className = 'trait-stars'; const validStars = Math.max(0, Math.min(5, Math.round(starCount))); traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars); traitElement.appendChild(traitName); traitElement.appendChild(traitStars); DOM.elements.traitsContainer.appendChild(traitElement); } catch (error) { console.error(`Error adding trait ${type}:`, error); } }
    function copyShareText() { if (!DOM.elements.shareText || !DOM.buttons.copy) return; try { const textToCopy = DOM.elements.shareText.textContent; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(() => { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); }).catch(err => { console.warn('Clipboard API copy failed:', err); fallbackCopyText(textToCopy); }); } else { fallbackCopyText(textToCopy); } } catch (error) { console.error("Copy operation error:", error); alert('複製失敗，請手動複製。'); DOM.buttons.copy.textContent = '複製'; } }
    function fallbackCopyText(text) { const textArea = document.createElement("textarea"); textArea.value = text; textArea.style.position = 'fixed'; textArea.style.left = '-9999px'; textArea.style.opacity = '0'; textArea.setAttribute('readonly', ''); document.body.appendChild(textArea); textArea.select(); textArea.setSelectionRange(0, 99999); let success = false; try { success = document.execCommand('copy'); if (success) { DOM.buttons.copy.textContent = '已複製!'; setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000); } else { console.error('Fallback copy (execCommand) failed'); alert('複製失敗，瀏覽器不支援此操作。'); } } catch (err) { console.error('Fallback copy error:', err); alert('複製失敗，請手動複製。'); } document.body.removeChild(textArea); }

    // --- Event Listeners ---
     function bindStartButton() { if (DOM.buttons.start) { DOM.buttons.start.removeEventListener('click', handleStartTestClick); DOM.buttons.start.addEventListener('click', handleStartTestClick); console.log("Start button event bound."); } else { console.error("Failed to bind start button event."); displayInitializationError("無法啟動測驗，按鈕丟失。"); } }
     function bindOtherButtons() { if (DOM.buttons.restart) { DOM.buttons.restart.removeEventListener('click', handleRestartClick); DOM.buttons.restart.addEventListener('click', handleRestartClick); console.log("Restart button event bound."); } else { console.error("Cannot bind restart button."); } if (DOM.buttons.copy) { DOM.buttons.copy.removeEventListener('click', copyShareText); DOM.buttons.copy.addEventListener('click', copyShareText); console.log("Copy button event bound."); } else { console.error("Cannot bind copy button."); } }
     function handleRestartClick() { if (state.isAnimating) { console.log("Animation in progress, cannot restart yet."); return; } switchScreen('result', 'intro'); }

    // --- Global Error Handler ---
     window.addEventListener('error', function(event) { console.error("Global error caught:", event.error, "at:", event.filename, ":", event.lineno); state.isAnimating = false; state.isTransitioning = false; });

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