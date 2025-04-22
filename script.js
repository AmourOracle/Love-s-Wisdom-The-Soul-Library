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
    let DOM = {}; // 在 DOMContentLoaded 後填充

    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined') {
        console.error("錯誤：找不到 testData。請確保 data.js 在 script.js 之前載入。");
        // 可以在頁面上顯示錯誤提示
        document.body.innerHTML = '<p style="color: red; padding: 20px;">載入測驗數據失敗，請檢查 data.js 文件。</p>';
        return;
    }
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;

    // --- 輔助函數 ---
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (error) { console.warn("設置視口高度錯誤:", error); }
    }

    // 快取 DOM 元素
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
                start: document.getElementById('start-test'), // *** 確保 ID 正確 ***
                copy: document.getElementById('copy-btn'),
                restart: document.getElementById('restart-btn')
            }
        };
        // 檢查關鍵元素
        if (!DOM.containers.intro || !DOM.containers.test || !DOM.containers.result || !DOM.buttons.start) {
            console.error("錯誤：未能找到必要的 HTML 元素。");
            return false;
        }
        console.log("DOM 元素已快取");
        return true;
    }

    // 預加載圖片
    function preloadImages() {
        if (!DOM.containers.preloader || !questions || questions.length === 0) {
             console.warn("無法預載入圖片：缺少 preloader 或 questions 數據。");
             state.preloadComplete = true; // 標記完成以繼續
             if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active');
             bindStartButton(); // 嘗試綁定按鈕
             return;
        }

        DOM.containers.preloader.classList.add('active');
        const imageUrls = ['./images/Intro.webp'];
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`));

        let loadedCount = 0;
        const totalImages = imageUrls.length;

        function updateProgress() {
            loadedCount++;
            const progress = Math.round((loadedCount / totalImages) * 100);
            if (DOM.elements.preloaderProgress) {
                DOM.elements.preloaderProgress.textContent = `${progress}%`;
            }
            if (loadedCount >= totalImages) {
                state.preloadComplete = true;
                setTimeout(() => {
                    if (DOM.containers.preloader) {
                        DOM.containers.preloader.classList.remove('active');
                    }
                    console.log("圖片預載入完成");
                    bindStartButton(); // *** 在預載完成後綁定按鈕 ***
                }, 300);
            }
        }

        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = updateProgress;
            img.onerror = () => {
                console.warn(`圖片載入失敗: ${url}`);
                updateProgress();
            };
        });
    }

    // 切換屏幕函數
    function switchScreen(fromScreenId, toScreenId) {
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
            void toScreen.offsetWidth;
            toScreen.classList.add('active', 'fade-in');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            if (toScreenId === 'test' && !state.contentRendered) {
                 initializeTestScreen();
                 state.contentRendered = true;
            } else if (toScreenId === 'test' && state.contentRendered) {
                state.isTransitioning = false; // 返回測驗頁時確保可交互
            }
            setTimeout(() => {
                toScreen.classList.remove('fade-in');
                state.isAnimating = false;
                console.log("屏幕切換完成");
            }, 600);
        }, 600);
    }

    // 更新進度條
    function updateProgressBar(questionNumber) {
        if (!DOM.elements.progressFill || !questions) return;
        const progress = Math.min(100, (questionNumber / questions.length) * 100);
        DOM.elements.progressFill.style.width = `${progress}%`;
    }

    // --- 測驗核心邏輯 ---

    // 初始化測驗屏幕
    function initializeTestScreen() {
        if (!DOM.elements.questionTitle || !DOM.containers.options) {
            console.error("無法初始化測驗屏幕：缺少元素。"); return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        displayQuestion(state.currentQuestionIndex, true);
        updateProgressBar(1);
    }

    // 顯示指定索引的問題
    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) return;
        const questionData = questions[index];

        // 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.remove('is-hidden');
            DOM.elements.questionTitle.style.transition = 'none'; // 避免進場動畫
        } else { console.error("找不到 questionTitle"); }

        // 更新選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = '';
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option'; // 初始 class
                if (!isInitialDisplay) {
                    optionElement.classList.add('is-hidden'); // 非初始先隱藏
                    optionElement.style.transition = 'none'; // 避免進場動畫
                }
                optionElement.dataset.text = optionData.text;
                optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0;
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); }
                });
                DOM.containers.options.appendChild(optionElement);
            });
             allOptions = DOM.containers.options.querySelectorAll('.option');
        } else { console.error("找不到 options-container"); }

        // 觸發進場動畫 (如果不是初始顯示)
        if (!isInitialDisplay) {
            triggerQuestionEnterAnimation();
        } else {
             state.isTransitioning = false;
             console.log("初始問題顯示完成");
        }
    }

    // 處理選項點擊
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
        const explosionDuration = 1000;
        const maxExplosionDelay = 200;
        const fadeOutDuration = 500;
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 100;
        setTimeout(() => {
            if (questionIndex < questions.length - 1) {
                prepareNextQuestion();
            } else {
                showResults();
            }
        }, transitionDelay);
    }

    // 觸發當前問題內容淡出
    function triggerQuestionFadeOut(clickedOptionElement) {
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.classList.add('is-hidden');
        }
        allOptions.forEach(option => {
            option.style.transitionDelay = ''; // 清除進場延遲
            if (option === clickedOptionElement) {
                option.classList.add('exploded');
            } else {
                option.classList.add('fade-out');
            }
        });
        console.log("舊內容淡出已觸發");
    }

    // 觸發文字爆裂效果
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
            DOM.containers.explosion.appendChild(span);
            span.addEventListener('animationend', () => { span.remove(); });
        });
        console.log("文字爆裂已觸發");
    }

    // 準備下一題
    function prepareNextQuestion() {
        state.currentQuestionIndex++;
        console.log(`準備顯示問題 ${state.currentQuestionIndex + 1}`);
        displayQuestion(state.currentQuestionIndex); // 顯示新問題（初始為 hidden）
    }

    // 觸發新問題內容進場動畫
    function triggerQuestionEnterAnimation() {
         console.log("觸發新內容進場動畫");
         // 背景進場 (如果需要)
         // requestAnimationFrame(() => { setTimeout(() => { backgroundPlaceholder.classList.remove('is-entering'); }, 50); });

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
         const optionEnterDuration = 500; // 與 CSS transition 匹配
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
             state.isTransitioning = false;
             console.log("轉場結束");
         }, finalResetDelay);
    }


    // --- 結果計算與顯示 (保持不變) ---
    function calculateResult() { /* ... (省略) ... */ }
    function prepareResultData(resultData) { /* ... (省略) ... */ }
    function showResults() { /* ... (省略) ... */ }
    function addTraitElement(type, starCount) { /* ... (省略) ... */ }
    function copyShareText() { /* ... (省略) ... */ }
    function fallbackCopyText(text) { /* ... (省略) ... */ }

    // --- 事件監聽器綁定 ---

    // 綁定開始按鈕事件
    function bindStartButton() {
        if (DOM.buttons.start) {
            DOM.buttons.start.addEventListener('click', () => {
                if (!state.preloadComplete) {
                     console.warn("圖片尚未載入完成，請稍候...");
                     if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
                     return;
                }
                switchScreen('intro', 'test');
            });
            console.log("開始按鈕事件已綁定");
        } else {
            console.error("無法綁定開始按鈕事件：按鈕未找到。");
            // 可以考慮顯示錯誤給用戶
            // alert("無法啟動測驗，請刷新頁面。");
        }
    }

    // --- 修改：確保其他按鈕也延遲綁定 ---
    function bindOtherButtons() {
        if (DOM.buttons.restart) {
             DOM.buttons.restart.addEventListener('click', () => {
                state.contentRendered = false;
                switchScreen('result', 'intro');
                if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
                updateProgressBar(0); // 重置進度條為 0
            });
            console.log("重新開始按鈕事件已綁定");
        } else {
             console.error("無法綁定重新開始按鈕。");
        }

        if (DOM.buttons.copy) {
            DOM.buttons.copy.addEventListener('click', copyShareText);
            console.log("複製按鈕事件已綁定");
        } else {
             console.error("無法綁定複製按鈕。");
        }
    }


    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
        state.isAnimating = false;
        state.isTransitioning = false;
    });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    // --- 修改：確保 DOM 快取成功後再執行後續操作 ---
    if (cacheDOMElements()) {
        preloadImages(); // 開始預載入
        bindOtherButtons(); // 綁定結果頁按鈕
        // bindStartButton 會在 preloadImages 完成後調用
    }

    console.log("腳本初始化完成。");
});
