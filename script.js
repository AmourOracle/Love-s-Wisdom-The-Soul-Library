// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false,     // 防止屏幕切換動畫重疊
        isTransitioning: false, // 防止問題轉場時重複點擊
        currentQuestionIndex: 0,
        userAnswers: [],
        preloadComplete: false,
        resultShowing: false,
        contentRendered: false,
        finalScores: {}
    };

    // --- DOM 元素快取 ---
    let DOM = {}; // 在 DOMContentLoaded 後填充
    let allOptions = []; // 選項元素的引用數組

    // --- 從 data.js 獲取數據 ---
    // 確保 testData 已定義
    if (typeof testData === 'undefined' || !testData || typeof testData !== 'object') {
        console.error("錯誤：找不到有效的 testData。請確保 data.js 正確載入且格式正確。");
        displayInitializationError("無法載入測驗數據。");
        return; // 停止執行
    }
    // 確保 questions 是陣列且不為空
    if (!Array.isArray(testData.questions) || testData.questions.length === 0) {
        console.error("錯誤：testData.questions 不是有效的陣列或為空。");
        displayInitializationError("測驗問題數據格式錯誤。");
        return;
    }
    const questions = testData.questions;
    const results = testData.results || {}; // 提供預設空物件
    const traitNames = testData.traitNames || {}; // 提供預設空物件

    // --- 輔助函數 ---
    function setViewportHeight() { try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); } catch (e) { console.warn("設置視口高度錯誤:", e); } }

    // 顯示初始化錯誤訊息
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
                containers: { intro: document.getElementById('intro-container'), test: document.getElementById('test-container'), result: document.getElementById('result-container'), preloader: document.getElementById('preloader'), options: document.getElementById('options-container'), explosion: document.getElementById('explosion-container') },
                elements: { testBackground: document.getElementById('test-background'), progressFill: document.getElementById('progress-fill'), questionTitle: document.getElementById('question-title'), resultTitle: document.getElementById('result-title'), resultSubtitle: document.getElementById('result-subtitle'), resultDescription: document.getElementById('result-description'), traitsContainer: document.getElementById('traits-container'), similarBooks: document.getElementById('similar-books'), complementaryBooks: document.getElementById('complementary-books'), shareText: document.getElementById('share-text'), preloaderProgress: document.getElementById('preloader-progress') },
                buttons: { start: document.getElementById('start-test'), copy: document.getElementById('copy-btn'), restart: document.getElementById('restart-btn') }
            };
            // 檢查關鍵元素
            if (!DOM.containers.intro || !DOM.containers.test || !DOM.containers.result || !DOM.buttons.start || !DOM.elements.testBackground || !DOM.containers.options || !DOM.elements.questionTitle) {
                 console.error("錯誤：未能找到所有必要的 HTML 元素。");
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

    // 預加載圖片
    function preloadImages() {
        // --- 修改：確保 DOM 已快取 ---
        if (!DOM.containers?.preloader) {
            console.warn("找不到 preloader 元素，跳過預載入。");
            state.preloadComplete = true;
            bindStartButton(); // 直接綁定按鈕
            return;
        }
        if (!questions || questions.length === 0) {
             console.warn("無法預載入圖片：缺少 questions 數據。"); state.preloadComplete = true;
             DOM.containers.preloader.classList.remove('active'); bindStartButton(); return;
        }

        DOM.containers.preloader.classList.add('active');
        const imageUrls = ['./images/Intro.webp']; questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0; const totalImages = imageUrls.length; let errorOccurred = false;

        function updateProgress(isError = false) {
            loadedCount++; if (isError) errorOccurred = true;
            const progress = Math.round((loadedCount / totalImages) * 100);
            if (DOM.elements.preloaderProgress) DOM.elements.preloaderProgress.textContent = `${progress}%`;
            if (loadedCount >= totalImages) {
                state.preloadComplete = true; const delay = errorOccurred ? 500 : 300;
                setTimeout(() => {
                    if (DOM.containers.preloader) DOM.containers.preloader.classList.remove('active');
                    console.log(`圖片預載入處理完成 ${errorOccurred ? '（有錯誤）' : ''}`);
                    bindStartButton(); // *** 在預載入處理完成後綁定按鈕 ***
                }, delay);
            }
        }
        imageUrls.forEach(url => { const img = new Image(); img.src = url; img.onload = () => updateProgress(false); img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(true); }; });
    }

    // 切換屏幕函數
    function switchScreen(fromScreenId, toScreenId) {
        if (!DOM.containers || Object.keys(DOM).length === 0) return;
        const fromScreen = DOM.containers[fromScreenId]; const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) { console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`); state.isAnimating = false; return; }
        if (state.isAnimating) return; state.isAnimating = true; console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        fromScreen.classList.add('fade-out');
        setTimeout(() => {
            fromScreen.classList.remove('active', 'fade-out'); void toScreen.offsetWidth; toScreen.classList.add('active', 'fade-in');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden'; state.resultShowing = (toScreenId === 'result');
            if (toScreenId === 'test') {
                 initializeTestScreen(); // 每次進入都初始化
                 state.contentRendered = true; // 標記已渲染
            }
            setTimeout(() => { toScreen.classList.remove('fade-in'); state.isAnimating = false; console.log("屏幕切換完成"); }, 600);
        }, 600);
    }

    // 更新進度條
    function updateProgressBar(questionNumber) {
        if (!DOM.elements.progressFill || !questions) return;
        const currentQIndex = Math.max(0, Math.min(questionNumber - 1, questions.length)); // 從 0 計算索引
        const progress = (currentQIndex / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        console.log(`進度條更新到: 問題 ${currentQIndex + 1}, ${progress.toFixed(1)}%`);
    }

    // --- 測驗核心邏輯 ---
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
        triggerExplosion(clickedOption);

        const explosionDuration = 1000; const maxExplosionDelay = 200; const fadeOutDuration = 500;
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 100;

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

    function triggerExplosion(clickedOptionElement) {
        if (!DOM.containers.explosion || !DOM.containers.test) return;
        DOM.containers.explosion.innerHTML = '';
        const clickRect = clickedOptionElement.getBoundingClientRect();
        const containerRect = DOM.containers.test.getBoundingClientRect();
        const startX = clickRect.left - containerRect.left + clickRect.width / 2;
        const startY = clickRect.top - containerRect.top + clickRect.height / 2;
        const originalText = clickedOptionElement.dataset.text || clickedOptionElement.innerText;
        originalText.split('').forEach((char) => {
            if (char.trim() === '') return;
            const span = document.createElement('span'); span.textContent = char; span.className = `char-explode`;
            const angle = Math.random() * Math.PI * 2; const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.6);
            const translateX = Math.cos(angle) * radius; const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 400 + 300; const rotateZ = (Math.random() - 0.5) * 540;
            const scale = Math.random() * 4 + 3; const delay = Math.random() * 0.2;
            span.style.left = `${startX}px`; span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`); span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`); span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`); span.style.animationDelay = `${delay}s`;
            DOM.containers.explosion.appendChild(span); span.addEventListener('animationend', () => { span.remove(); });
        });
        console.log("文字爆裂已觸發");
    }

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
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) return results["SPECIAL"]; }
            let maxScore = -Infinity; let highestTypes = [];
            for (const type in scores) { if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); } else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; } }
            if (highestTypes.length === 1) return results[highestTypes[0]];
            if (highestTypes.length >= 3) return results["SPECIAL"];
            if (highestTypes.length === 2) {
                const tiebreakQuestionIndex = 8; const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { return results[tiebreakPrimaryType]; }
                return results[highestTypes[0]];
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
            // --- 修改：確保只綁定一次 ---
            if (!DOM.buttons.start.dataset.listenerAttached) {
                DOM.buttons.start.addEventListener('click', () => {
                    if (!state.preloadComplete) { console.warn("圖片尚未載入完成。"); if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active'); return; }
                    if (state.isAnimating) { console.log("屏幕切換中..."); return; }
                    switchScreen('intro', 'test');
                });
                DOM.buttons.start.dataset.listenerAttached = 'true';
                console.log("開始按鈕事件已綁定");
            }
        } else { console.error("無法綁定開始按鈕事件：按鈕未找到。"); displayInitializationError("無法啟動測驗，按鈕丟失。"); }
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
    window.addEventListener('error', function(event) { console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename); state.isAnimating = false; state.isTransitioning = false; });

    // --- 初始化 ---
    setViewportHeight(); window.addEventListener('resize', setViewportHeight);
    if (cacheDOMElements()) { // *** 確保快取成功 ***
        preloadImages(); // 開始預載入
        bindOtherButtons(); // 綁定結果頁按鈕
        // bindStartButton 會在 preloadImages 完成後調用
    } else {
        // displayInitializationError 已在 cacheDOMElements 中調用
    }
    console.log("腳本初始化完成。");
});
