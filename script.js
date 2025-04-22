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
        resultShowing: false,
        contentRendered: false,
        finalScores: {}
    };

    // --- DOM 元素快取 ---
    let DOM = {};
    let allOptions = [];

    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined') {
        console.error("錯誤：找不到 testData。");
        document.body.innerHTML = '<p style="color: red; padding: 20px;">載入測驗數據失敗，請檢查 data.js 文件。</p>';
        return;
    }
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;

    // --- 輔助函數 ---
    function setViewportHeight() {
        try { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
        catch (error) { console.warn("設置視口高度錯誤:", error); }
    }

    function cacheDOMElements() {
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
                preloaderProgress: document.getElementById('preloader-progress')
            },
            buttons: {
                start: document.getElementById('start-test'),
                copy: document.getElementById('copy-btn'),
                restart: document.getElementById('restart-btn')
            }
        };
        if (!DOM.containers.intro || !DOM.containers.test || !DOM.containers.result || !DOM.buttons.start || !DOM.elements.testBackground) {
            console.error("錯誤：未能找到必要的 HTML 元素。"); return false;
        }
        console.log("DOM 元素已快取"); return true;
    }

    function preloadImages() {
        if (!DOM.containers.preloader || !questions || questions.length === 0) {
             console.warn("無法預載入圖片。"); state.preloadComplete = true;
             if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active');
             bindStartButton(); return;
        }
        DOM.containers.preloader.classList.add('active');
        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));
        let loadedCount = 0; const totalImages = imageUrls.length;
        function updateProgress() {
            loadedCount++;
            const progress = Math.round((loadedCount / totalImages) * 100);
            if (DOM.elements.preloaderProgress) DOM.elements.preloaderProgress.textContent = `${progress}%`;
            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                setTimeout(() => {
                    if (DOM.containers.preloader) DOM.containers.preloader.classList.remove('active');
                    console.log("圖片預載入完成"); bindStartButton();
                }, 300);
            }
        }
        imageUrls.forEach(url => {
            const img = new Image(); img.src = url; img.onload = updateProgress;
            img.onerror = () => { console.warn(`圖片載入失敗: ${url}`); updateProgress(); };
        });
    }

    function switchScreen(fromScreenId, toScreenId) {
        if (!DOM.containers || Object.keys(DOM).length === 0) return;
        const fromScreen = DOM.containers[fromScreenId]; const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) { console.error(`切換屏幕失敗: ID ${fromScreenId} 或 ${toScreenId} 無效`); state.isAnimating = false; return; }
        if (state.isAnimating) return; state.isAnimating = true;
        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        fromScreen.classList.add('fade-out');
        setTimeout(() => {
            fromScreen.classList.remove('active', 'fade-out'); void toScreen.offsetWidth;
            toScreen.classList.add('active', 'fade-in');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            if (toScreenId === 'test' && !state.contentRendered) {
                 initializeTestScreen(); state.contentRendered = true;
            } else if (toScreenId === 'test' && state.contentRendered) {
                initializeTestScreen(); // 確保重置
            }
            setTimeout(() => { toScreen.classList.remove('fade-in'); state.isAnimating = false; console.log("屏幕切換完成"); }, 600);
        }, 600);
    }

    function updateProgressBar(questionNumber) {
        if (!DOM.elements.progressFill || !questions) return;
        const currentQ = Math.max(1, Math.min(questionNumber, questions.length + 1)); // 允許顯示到 n+1
        // --- 修正：進度條計算應該基於當前問題索引 ---
        const progress = ((state.currentQuestionIndex) / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        console.log(`進度條更新到: 問題 ${state.currentQuestionIndex + 1}, ${progress.toFixed(1)}%`);
    }

    // --- 測驗核心邏輯 ---
    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options || !DOM.elements.testBackground) return;
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0; state.userAnswers = []; state.isTransitioning = false;
        displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1); // 初始進度
    }

    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) return;
        const questionData = questions[index]; const questionNumber = index + 1;

        // 1. 更新背景圖
        if (DOM.elements.testBackground) {
            const imageUrl = `./images/Q${questionNumber}.webp`;
            // --- 修改：使用 is-hidden class 控制淡入淡出 ---
            if (!isInitialDisplay) {
                DOM.elements.testBackground.classList.add('is-hidden'); // 先隱藏
            }
            // 使用 setTimeout 確保樣式先生效再換圖和移除 hidden
            setTimeout(() => {
                DOM.elements.testBackground.style.backgroundImage = `url('${imageUrl}')`;
                // 確保在下一幀移除 hidden 以觸發動畫
                requestAnimationFrame(() => {
                    DOM.elements.testBackground.classList.remove('is-hidden');
                });
                 console.log(`背景設置為: ${imageUrl}`);
            }, isInitialDisplay ? 0 : 50); // 初始顯示不延遲
        } else { console.error("找不到 test-background"); }

        // 2. 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.remove('is-hidden');
            DOM.elements.questionTitle.style.transition = 'none';
        } else { console.error("找不到 questionTitle"); }

        // 3. 更新選項
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

        // --- 修正：在轉場延遲後才更新進度條 ---
        // updateProgressBar(questionIndex + 2); // 移除此處更新

        const explosionDuration = 1000; const maxExplosionDelay = 200; const fadeOutDuration = 500;
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 100;

        setTimeout(() => {
            if (state.currentQuestionIndex < questions.length - 1) {
                prepareNextQuestion();
            } else {
                console.log("最後一題完成，顯示結果");
                showResults(); // 調用顯示結果函數
            }
        }, transitionDelay);
    }

    function triggerQuestionFadeOut(clickedOptionElement) {
        // --- 修改：同時觸發背景淡出 ---
        if (DOM.elements.testBackground) {
            DOM.elements.testBackground.classList.add('is-hidden');
        }
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.classList.add('is-hidden');
        }
        const currentOptions = DOM.containers.options.querySelectorAll('.option');
        currentOptions.forEach(option => {
            option.style.transitionDelay = '';
            if (option === clickedOptionElement) { option.classList.add('exploded'); }
            else { option.classList.add('fade-out'); }
        });
        console.log("舊內容淡出已觸發");
    }

    function triggerExplosion(clickedOptionElement) { /* ... (保持不變) ... */ }

    function prepareNextQuestion() {
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        displayQuestion(state.currentQuestionIndex); // 更新內容並設為 hidden
    }

    function triggerQuestionEnterAnimation() {
         console.log("觸發新內容進場動畫");
         // 背景進場 (已在 displayQuestion 中處理)

         // 標題進場
         const titleEnterDelay = 100;
         setTimeout(() => {
             requestAnimationFrame(() => {
                  if (DOM.elements.questionTitle) {
                     DOM.elements.questionTitle.style.transition = ''; // 恢復 CSS transition
                     DOM.elements.questionTitle.classList.remove('is-hidden');
                     console.log("標題進場");
                  }
             });
         }, titleEnterDelay);

         // 選項 staggered 進場
         const optionsEnterStartDelay = titleEnterDelay + 250;
         const optionStaggerDelay = 80;
         allOptions.forEach((option, index) => {
             option.style.transition = ''; // 恢復 CSS transition
             option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
              requestAnimationFrame(() => {
                 option.classList.remove('is-hidden');
              });
         });

         // 計算完成時間並重置狀態
         const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
         const optionEnterDuration = 500;
         const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 80;

         setTimeout(() => {
             console.log("所有進場動畫完成");
             allOptions.forEach(option => {
                 option.style.transitionDelay = '';
                 option.style.pointerEvents = '';
             });
              if(DOM.elements.questionTitle) {
                 DOM.elements.questionTitle.style.pointerEvents = '';
             }
             // --- 修正：在動畫完成後更新進度條 ---
             updateProgressBar(state.currentQuestionIndex + 1);
             state.isTransitioning = false; // 允許再次點擊
             console.log("轉場結束");
         }, finalResetDelay);
    }


    // --- 結果計算與顯示 ---
    function calculateResult() { /* ... (保持不變) ... */ }
    function prepareResultData(resultData) {
         // --- 修正：增加更多檢查 ---
        if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) {
            console.error("準備結果數據失敗：缺少必要的 DOM 元素。");
            return false; // 返回失敗狀態
        }
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores;
            if (resultData.title && resultData.title.includes('管理員')) {
                Object.keys(traitNames).forEach(type => addTraitElement(type, 3));
            } else {
                Object.keys(traitNames).forEach(type => {
                    const score = typeScores[type] || 0;
                    let stars = 1;
                    if (score >= 7) stars = 5; else if (score >= 5) stars = 4; else if (score >= 3) stars = 3; else if (score >= 1) stars = 2;
                    addTraitElement(type, stars);
                });
            }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("結果數據準備完成");
            return true; // 返回成功狀態
        } catch (error) {
            console.error("準備結果數據時出錯:", error);
            DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤";
            return false; // 返回失敗狀態
        }
     }
    function showResults() {
        console.log("顯示結果頁面...");
        state.isTransitioning = false;
        try {
            const resultData = calculateResult();
            if (!resultData) throw new Error("計算結果失敗");
            // --- 修正：確保 prepareResultData 成功才切換 ---
            if (prepareResultData(resultData)) {
                switchScreen('test', 'result');
            } else {
                 throw new Error("準備結果數據失敗");
            }
        } catch (error) {
            console.error("顯示結果流程出錯:", error);
            // --- 修改：顯示更具體的錯誤給用戶 ---
            alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
            switchScreen('test', 'intro');
        }
     }
    function addTraitElement(type, starCount) { /* ... (保持不變) ... */ }
    function copyShareText() { /* ... (保持不變) ... */ }
    function fallbackCopyText(text) { /* ... (保持不變) ... */ }

    // --- 事件監聽器綁定 ---
    function bindStartButton() {
        if (DOM.buttons.start) {
            const newButton = DOM.buttons.start.cloneNode(true);
            DOM.buttons.start.parentNode.replaceChild(newButton, DOM.buttons.start);
            DOM.buttons.start = newButton;
            DOM.buttons.start.addEventListener('click', () => {
                if (!state.preloadComplete) {
                     console.warn("圖片尚未載入完成。");
                     if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
                     return;
                }
                switchScreen('intro', 'test');
            });
            console.log("開始按鈕事件已綁定");
        } else { console.error("無法綁定開始按鈕。"); }
    }
    function bindOtherButtons() {
        if (DOM.buttons.restart) {
             const newRestartButton = DOM.buttons.restart.cloneNode(true);
             DOM.buttons.restart.parentNode.replaceChild(newRestartButton, DOM.buttons.restart);
             DOM.buttons.restart = newRestartButton;
             DOM.buttons.restart.addEventListener('click', () => {
                state.contentRendered = false;
                switchScreen('result', 'intro');
                if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                updateProgressBar(0); // 重置進度條
            });
            console.log("重新開始按鈕事件已綁定");
        } else { console.error("無法綁定重新開始按鈕。"); }
        if (DOM.buttons.copy) {
             const newCopyButton = DOM.buttons.copy.cloneNode(true);
             DOM.buttons.copy.parentNode.replaceChild(newCopyButton, DOM.buttons.copy);
             DOM.buttons.copy = newCopyButton;
            DOM.buttons.copy.addEventListener('click', copyShareText);
            console.log("複製按鈕事件已綁定");
        } else { console.error("無法綁定複製按鈕。"); }
    }
    window.addEventListener('error', function(event) { /* ... (保持不變) ... */ });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    if (cacheDOMElements()) {
        preloadImages();
        bindOtherButtons();
    } else {
        document.body.innerHTML = '<p style="color: red; padding: 20px;">頁面初始化失敗，請檢查 HTML 結構。</p>';
    }
    console.log("腳本初始化完成。");
});
