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
        contentRendered: false, // 新增，標記測驗內容是否已渲染
        finalScores: {}
    };

    // --- DOM 元素快取 ---
    // 延遲獲取，確保元素已存在
    let DOM = {};
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
        // 檢查關鍵元素是否存在
        if (!DOM.containers.intro || !DOM.containers.test || !DOM.containers.result || !DOM.buttons.start) {
            console.error("錯誤：未能找到必要的 HTML 元素 (intro/test/result container 或 start button)。請檢查 HTML 結構和 ID。");
            // 可以考慮顯示錯誤訊息給用戶
            return false;
        }
        return true;
    }


    // --- 從 data.js 獲取數據 ---
    if (typeof testData === 'undefined') {
        console.error("錯誤：找不到 testData。");
        return;
    }
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;

    // --- 輔助函數 ---
    function setViewportHeight() { /* ... (保持不變) ... */ }

    // 預加載圖片
    function preloadImages() {
        // --- 修改：在 cacheDOMElements 後執行 ---
        if (!DOM.containers.preloader || !questions || questions.length === 0) {
             console.warn("Preloader 或 questions 數據未就緒，無法預載入。");
             // 即使無法預載，也要標記完成，避免阻塞流程
             state.preloadComplete = true;
             // 嘗試手動隱藏 preloader (如果存在)
             const preloader = document.getElementById('preloader');
             if (preloader) preloader.classList.remove('active');
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
                    // 嘗試綁定開始按鈕事件 (確保在預載完成後綁定)
                    bindStartButton();
                }, 300);
            }
        }

        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            // --- 修改：更詳細的錯誤處理 ---
            img.onload = updateProgress;
            img.onerror = () => {
                console.warn(`圖片載入失敗: ${url}`);
                updateProgress(); // 即使失敗也計數，避免卡住
            };
        });
    }

    // 切換屏幕函數
    function switchScreen(fromScreenId, toScreenId) {
        // --- 修改：確保 DOM 已快取 ---
        if (!DOM.containers || Object.keys(DOM).length === 0) {
             console.error("DOM 尚未快取，無法切換屏幕。");
             return;
        }
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];
        if (!fromScreen || !toScreen) {
            console.error(`切換屏幕失敗: 無效的 ID ${fromScreenId} 或 ${toScreenId}`);
            state.isAnimating = false; // 重置狀態
            return;
        }
        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);
        if (state.isAnimating) return;
        state.isAnimating = true;
        fromScreen.classList.add('fade-out');
        setTimeout(() => {
            fromScreen.classList.remove('active', 'fade-out');
            void toScreen.offsetWidth;
            toScreen.classList.add('active', 'fade-in');
            document.body.style.overflow = (toScreenId === 'result') ? 'auto' : 'hidden';
            state.resultShowing = (toScreenId === 'result');
            // --- 修改：確保測驗界面只初始化一次 ---
            if (toScreenId === 'test' && !state.contentRendered) {
                 initializeTestScreen();
                 state.contentRendered = true;
            } else if (toScreenId === 'test' && state.contentRendered) {
                // 如果是從結果頁返回測驗頁，可能需要重置測驗狀態或顯示特定界面
                // 目前的邏輯是直接顯示上次的狀態，如果需要重置，需調用 initializeTestScreen
                // 或者，如果 restart 按鈕總是返回 intro，則這裡不需要特殊處理
                console.log("返回已渲染的測驗屏幕");
                state.isTransitioning = false; // 確保可以交互
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
         // --- 修改：增加 DOM 元素檢查 ---
        if (!DOM.elements.progressFill || !questions) return;
        const progress = Math.min(100, (questionNumber / questions.length) * 100);
        DOM.elements.progressFill.style.width = `${progress}%`;
    }

    // --- 測驗核心邏輯 ---

    // 初始化測驗屏幕
    function initializeTestScreen() {
        // --- 修改：確保 DOM 已快取 ---
        if (!DOM.elements.questionTitle || !DOM.containers.options) {
            console.error("無法初始化測驗屏幕，缺少標題或選項容器。");
            return;
        }
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        displayQuestion(state.currentQuestionIndex, true); // 初始顯示
        updateProgressBar(1);
    }

    // 顯示指定索引的問題
    function displayQuestion(index, isInitialDisplay = false) {
        if (index < 0 || index >= questions.length) return;
        const questionData = questions[index];

        // 1. 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionTitle.classList.remove('is-hidden'); // 初始或進場後移除 hidden
            // 清理內聯樣式
            DOM.elements.questionTitle.style.opacity = '';
            DOM.elements.questionTitle.style.filter = '';
            DOM.elements.questionTitle.style.transform = '';
            DOM.elements.questionTitle.style.transition = '';
        } else {
             console.error("找不到 questionTitle 元素");
        }

        // 2. 更新選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // 清空
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option'; // 初始 class
                if (!isInitialDisplay) {
                    optionElement.classList.add('is-hidden'); // 非初始則先隱藏
                }
                optionElement.dataset.text = optionData.text;
                optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0;
                // 清理內聯樣式
                optionElement.style.opacity = '';
                optionElement.style.filter = '';
                optionElement.style.transform = '';
                optionElement.style.transition = '';
                optionElement.style.transitionDelay = '';

                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick(e); }
                });
                DOM.containers.options.appendChild(optionElement);
            });
             allOptions = DOM.containers.options.querySelectorAll('.option'); // 更新引用
        } else {
             console.error("找不到 options-container 元素");
        }

        // 觸發進場動畫 (如果不是初始顯示)
        if (!isInitialDisplay) {
            triggerQuestionEnterAnimation();
        } else {
             state.isTransitioning = false; // 初始顯示完成
             console.log("初始問題顯示完成");
        }
    }

    // 處理選項點擊
    function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        if (isNaN(optionIndex) || isNaN(questionIndex)) return;

        if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            console.log("轉場中，點擊無效");
            return;
        }
        state.isTransitioning = true;
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);

        state.userAnswers[questionIndex] = optionIndex;

        triggerQuestionFadeOut(clickedOption);
        triggerExplosion(clickedOption);

        const explosionDuration = 1000;
        const maxExplosionDelay = 200;
        const fadeOutDuration = 500;
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 100; // 增加緩衝

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
        if (!DOM.containers.explosion || !DOM.containers.test) return; // 增加檢查
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
            // 設定隨機最終狀態...
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

    // 準備下一題 (只更新數據和狀態)
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
                 option.style.pointerEvents = ''; // 恢復點擊
             });
              if(DOM.elements.questionTitle) {
                 DOM.elements.questionTitle.style.pointerEvents = '';
             }
             state.isTransitioning = false; // 允許再次點擊
             console.log("轉場結束");
         }, finalResetDelay);
    }


    // --- 結果計算與顯示 (保持不變) ---
    function calculateResult() { /* ... (省略) ... */
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            if (state.userAnswers.length !== questions.length) {
                console.warn(`答案數量 (${state.userAnswers.length}) 與問題數量 (${questions.length}) 不符！`);
                 for (let i = 0; i < questions.length; i++) {
                     if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0;
                 }
            }
            state.userAnswers.forEach((answerIndex, questionIndex) => {
                const question = questions[questionIndex];
                if (question?.options?.[answerIndex]?.scores) {
                    const optionScores = question.options[answerIndex].scores;
                    for (const type in optionScores) {
                        if (scores.hasOwnProperty(type)) {
                            scores[type] += optionScores[type];
                        }
                    }
                }
            });
            state.finalScores = scores;
            console.log("最終分數:", state.finalScores);
            const scoreValues = Object.values(scores);
            const scoreFrequency = {};
            scoreValues.forEach(score => {
                const roundedScore = Math.round(score * 10) / 10;
                scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1;
            });
            for (const score in scoreFrequency) { if (scoreFrequency[score] >= 4) return results["SPECIAL"]; }
            let maxScore = -Infinity;
            let highestTypes = [];
            for (const type in scores) {
                if (Math.abs(scores[type] - maxScore) < 0.01) { highestTypes.push(type); }
                else if (scores[type] > maxScore) { maxScore = scores[type]; highestTypes = [type]; }
            }
            if (highestTypes.length === 1) return results[highestTypes[0]];
            if (highestTypes.length >= 3) return results["SPECIAL"];
            if (highestTypes.length === 2) {
                const tiebreakQuestionIndex = 8;
                const tiebreakAnswerIndex = state.userAnswers[tiebreakQuestionIndex];
                const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary;
                if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { return results[tiebreakPrimaryType]; }
                return results[highestTypes[0]];
            }
            return results['A'];
        } catch (error) {
            console.error("計算結果時發生錯誤:", error);
            return results['A'];
        }
     }
    function prepareResultData(resultData) { /* ... (省略) ... */
        if (!resultData || !DOM.elements.resultTitle) return;
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
                    if (score >= 7) stars = 5;
                    else if (score >= 5) stars = 4;
                    else if (score >= 3) stars = 3;
                    else if (score >= 1) stars = 2;
                    addTraitElement(type, stars);
                });
            }
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';
            console.log("結果數據準備完成");
        } catch (error) {
            console.error("準備結果數據時出錯:", error);
            DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤";
        }
     }
    function showResults() { /* ... (省略) ... */
        console.log("顯示結果頁面...");
        state.isTransitioning = false;
        try {
            const resultData = calculateResult();
            prepareResultData(resultData);
            switchScreen('test', 'result');
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("抱歉，顯示結果時發生錯誤，請重試。");
            switchScreen('test', 'intro');
        }
     }
    function addTraitElement(type, starCount) { /* ... (省略) ... */
        if (!DOM.elements.traitsContainer) return;
        try {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';
            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            traitName.textContent = traitNames[type] || type;
            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            const validStars = Math.max(0, Math.min(5, Math.round(starCount)));
            traitStars.textContent = '★'.repeat(validStars) + '☆'.repeat(5 - validStars);
            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error(`添加特質 ${type} 時出錯:`, error);
        }
     }
    function copyShareText() { /* ... (省略) ... */
        if (!DOM.elements.shareText || !DOM.buttons.copy) return;
         try {
            const textToCopy = DOM.elements.shareText.textContent;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    DOM.buttons.copy.textContent = '已複製!';
                    setTimeout(() => { DOM.buttons.copy.textContent = '複製'; }, 2000);
                }).catch(err => {
                    console.warn('Clipboard API 複製失敗:', err);
                    fallbackCopyText(textToCopy);
                });
            } else {
                fallbackCopyText(textToCopy);
            }
         } catch (error) {
             console.error("複製操作出錯:", error);
             alert('複製失敗，請手動複製。');
         }
     }
    function fallbackCopyText(text) { /* ... (省略) ... */
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = 'fixed'; textArea.style.opacity = '0';
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

    // --- 事件監聽器綁定 ---

    // 綁定開始按鈕事件 (延遲到 DOM 快取和預載入後)
    function bindStartButton() {
        if (DOM.buttons.start) {
            DOM.buttons.start.addEventListener('click', () => {
                // 再次檢查預載狀態
                if (!state.preloadComplete) {
                     console.warn("圖片尚未載入完成，請稍候...");
                     if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active'); // 確保顯示 preloader
                     return;
                }
                switchScreen('intro', 'test');
            });
            console.log("開始按鈕事件已綁定");
        } else {
            console.error("無法綁定開始按鈕事件：按鈕未找到。");
        }
    }

    // --- 修改：將按鈕綁定移到 DOMContentLoaded 內部，並在 preloadImages 完成後調用 ---
    // DOM.buttons.start?.addEventListener('click', ...) // 移除此處的直接綁定

    DOM.buttons.restart?.addEventListener('click', () => {
        state.contentRendered = false;
        switchScreen('result', 'intro');
        if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
        updateProgressBar(0);
    });
    DOM.buttons.copy?.addEventListener('click', copyShareText);
    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
        state.isAnimating = false;
        state.isTransitioning = false;
    });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    // --- 修改：先快取 DOM，再預載入圖片 ---
    if (cacheDOMElements()) {
        preloadImages(); // 開始預載入
        // 如果預載入失敗或不需要預載入，也要綁定按鈕
        if (!DOM.containers.preloader) {
             bindStartButton();
        }
    }

    console.log("腳本初始化完成。");
});
