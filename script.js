// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");

    // --- 狀態管理 ---
    const state = {
        isAnimating: false,     // 防止動畫重疊
        isTransitioning: false, // 防止轉場時重複點擊
        currentQuestionIndex: 0,
        userAnswers: [],
        preloadComplete: false,
        resultShowing: false,
        finalScores: {}         // 儲存最終分數
    };

    // --- DOM 元素快取 ---
    const DOM = {
        containers: {
            intro: document.getElementById('intro-container'),
            test: document.getElementById('test-container'),
            result: document.getElementById('result-container'),
            preloader: document.getElementById('preloader'),
            options: document.getElementById('options-container'), // 選項容器
            explosion: document.getElementById('explosion-container') // 爆裂容器
        },
        elements: {
            progressFill: document.getElementById('progress-fill'),
            // progressText: document.getElementById('progress-text'), // 如果需要
            questionTitle: document.getElementById('question-title'), // 問題標題
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

    // --- 從 data.js 獲取數據 ---
    // 確保 testData 已定義 (來自 data.js)
    if (typeof testData === 'undefined') {
        console.error("錯誤：找不到 testData，請確保 data.js 已載入。");
        return; // 停止執行
    }
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;

    // --- 輔助函數 ---

    // 設置視口高度
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (error) {
            console.warn("設置視口高度錯誤:", error);
        }
    }

    // 預加載圖片
    function preloadImages() {
        if (!DOM.containers.preloader || !questions || questions.length === 0) return;

        DOM.containers.preloader.classList.add('active');
        const imageUrls = ['./images/Intro.webp']; // 首頁圖
        questions.forEach((_, index) => imageUrls.push(`./images/Q${index + 1}.webp`)); // 問題圖

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
                    // 可以在這裡觸發一些依賴圖片的操作
                }, 300);
            }
        }

        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = updateProgress;
            img.onerror = () => {
                console.warn(`無法載入圖片: ${url}`);
                updateProgress(); // 即使失敗也計數
            };
        });
    }

    // 切換屏幕 (基本淡入淡出)
    function switchScreen(fromScreenId, toScreenId) {
        const fromScreen = DOM.containers[fromScreenId];
        const toScreen = DOM.containers[toScreenId];

        if (!fromScreen || !toScreen) {
            console.error(`切換屏幕失敗: 無效的 ID ${fromScreenId} 或 ${toScreenId}`);
            return;
        }

        console.log(`切換屏幕從 ${fromScreenId} 到 ${toScreenId}...`);

        if (state.isAnimating) return;
        state.isAnimating = true;

        fromScreen.classList.add('fade-out');

        setTimeout(() => {
            fromScreen.classList.remove('active', 'fade-out');
            void toScreen.offsetWidth; // 強制重繪
            toScreen.classList.add('active', 'fade-in');

            // 根據目標屏幕調整 body 滾動
            if (toScreenId === 'result') {
                document.body.style.overflow = 'auto';
                state.resultShowing = true;
            } else {
                document.body.style.overflow = 'hidden';
                state.resultShowing = false;
            }

            // 如果切換到測驗頁，初始化第一個問題
            if (toScreenId === 'test' && !state.contentRendered) {
                 initializeTestScreen(); // 初始化測驗界面
                 state.contentRendered = true;
            }

            setTimeout(() => {
                toScreen.classList.remove('fade-in');
                state.isAnimating = false;
                console.log("屏幕切換完成");
            }, parseFloat(getComputedStyle(toScreen).transitionDuration || '0.6s') * 1000);

        }, parseFloat(getComputedStyle(fromScreen).transitionDuration || '0.6s') * 1000);
    }

    // 更新進度條
    function updateProgressBar(questionNumber) {
        if (!DOM.elements.progressFill) return;
        try {
            const progress = (questionNumber / questions.length) * 100;
            DOM.elements.progressFill.style.width = `${progress}%`;
            // if (DOM.elements.progressText) { ... } // 如果需要更新文字
        } catch (error) {
            console.error("更新進度條出錯:", error);
        }
    }

    // --- 測驗核心邏輯 ---

    // 初始化測驗屏幕 (顯示第一題)
    function initializeTestScreen() {
        console.log("初始化測驗屏幕...");
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        displayQuestion(state.currentQuestionIndex);
        updateProgressBar(1);
    }

    // 顯示指定索引的問題
    function displayQuestion(index) {
        if (index < 0 || index >= questions.length) {
            console.error(`無效的問題索引: ${index}`);
            return;
        }
        const questionData = questions[index];

        // 1. 更新標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.innerText = questionData.question.replace(/^\d+\.\s*/, ''); // 移除題號
            DOM.elements.questionTitle.classList.remove('is-hidden'); // 確保標題可見
            // 清理可能殘留的內聯樣式
            DOM.elements.questionTitle.style.opacity = '';
            DOM.elements.questionTitle.style.filter = '';
            DOM.elements.questionTitle.style.transform = '';
            DOM.elements.questionTitle.style.transition = '';
        }

        // 2. 更新選項
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // 清空舊選項
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option'; // 初始 class
                optionElement.dataset.text = optionData.text; // 存儲原始文本
                optionElement.dataset.index = optIndex; // 存儲選項索引
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button'); // 無障礙性
                optionElement.tabIndex = 0; // 可通過鍵盤聚焦

                // 初始設為可見 (移除 is-hidden)
                optionElement.classList.remove('is-hidden');
                optionElement.style.opacity = '';
                optionElement.style.filter = '';
                option.style.transform = '';
                optionElement.style.transition = '';
                optionElement.style.transitionDelay = '';

                // 添加事件監聽
                optionElement.addEventListener('click', handleOptionClick);
                optionElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOptionClick(e);
                    }
                });

                DOM.containers.options.appendChild(optionElement);
            });
        }
        state.isTransitioning = false; // 確保初始狀態不是轉場中
    }

    // 處理選項點擊
    function handleOptionClick(event) {
        const clickedOption = event.currentTarget;
        const optionIndex = parseInt(clickedOption.dataset.index);
        const questionIndex = state.currentQuestionIndex;

        if (isNaN(optionIndex) || isNaN(questionIndex)) {
            console.error("無法獲取選項或問題索引");
            return;
        }

        if (state.isTransitioning || clickedOption.classList.contains('exploded') || clickedOption.classList.contains('fade-out')) {
            console.log("轉場中，點擊無效");
            return;
        }
        state.isTransitioning = true; // 開始轉場
        console.log(`問題 ${questionIndex + 1} 選擇了選項 ${optionIndex + 1}`);

        // 記錄答案
        state.userAnswers[questionIndex] = optionIndex;

        // --- 觸發淡出和爆裂 ---
        triggerQuestionFadeOut(clickedOption);
        triggerExplosion(clickedOption);

        // --- 計算延遲並準備下一步 ---
        const explosionDuration = 1000; // 與 CSS animation 匹配
        const maxExplosionDelay = 200; // 與 JS 隨機 delay 匹配
        const fadeOutDuration = 500;   // 與 CSS transition 匹配
        const transitionDelay = Math.max(explosionDuration + maxExplosionDelay, fadeOutDuration) + 80; // 等待動畫完成 + 緩衝

        setTimeout(() => {
            if (questionIndex < questions.length - 1) {
                prepareNextQuestion();
            } else {
                console.log("最後一題，準備顯示結果");
                showResults();
            }
        }, transitionDelay);
    }

    // 觸發當前問題內容淡出
    function triggerQuestionFadeOut(clickedOptionElement) {
        // 淡出標題
        if (DOM.elements.questionTitle) {
            DOM.elements.questionTitle.classList.add('is-hidden');
        }
        // 淡出其他選項
        const allCurrentOptions = DOM.containers.options.querySelectorAll('.option');
        allCurrentOptions.forEach(option => {
            if (option !== clickedOptionElement) {
                option.classList.add('fade-out');
            } else {
                option.classList.add('exploded'); // 被點擊的選項用 exploded 效果消失
            }
        });
    }

    // 觸發文字爆裂效果
    function triggerExplosion(clickedOptionElement) {
        if (!DOM.containers.explosion) return;

        const clickRect = clickedOptionElement.getBoundingClientRect();
        const containerRect = DOM.containers.test.getBoundingClientRect(); // 相對 test container 定位
        // 計算相對於 test container 的起始位置
        const startX = clickRect.left - containerRect.left + clickRect.width / 2;
        const startY = clickRect.top - containerRect.top + clickRect.height / 2;

        const originalText = clickedOptionElement.dataset.text || clickedOptionElement.innerText;

        originalText.split('').forEach((char) => {
            if (char.trim() === '') return; // 忽略空白

            const span = document.createElement('span');
            span.textContent = char;
            span.className = `char-explode`;

            // 設定隨機最終狀態
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.min(window.innerWidth, window.innerHeight) * 0.6);
            const translateX = Math.cos(angle) * radius;
            const translateY = Math.sin(angle) * radius;
            const translateZ = Math.random() * 400 + 300;
            const rotateZ = (Math.random() - 0.5) * 540;
            const scale = Math.random() * 4 + 3;
            const delay = Math.random() * 0.2; // 隨機延遲

            // 設置初始位置和 CSS 變數
            span.style.left = `${startX}px`;
            span.style.top = `${startY}px`;
            span.style.setProperty('--tx', `${translateX}px`);
            span.style.setProperty('--ty', `${translateY}px`);
            span.style.setProperty('--tz', `${translateZ}px`);
            span.style.setProperty('--rz', `${rotateZ}deg`);
            span.style.setProperty('--sc', `${scale}`);
            span.style.animationDelay = `${delay}s`;

            DOM.containers.explosion.appendChild(span);

            // 動畫結束後移除元素
            span.addEventListener('animationend', () => {
                span.remove();
            });
        });
    }

    // 準備並顯示下一題
    function prepareNextQuestion() {
        state.currentQuestionIndex++;
        const questionIndex = state.currentQuestionIndex;

        if (questionIndex >= questions.length) {
            console.error("嘗試載入不存在的問題");
            showResults(); // 如果索引超出，直接顯示結果
            return;
        }

        const questionData = questions[questionIndex];
        const newTitleText = questionData.question.replace(/^\d+\.\s*/, '');

        console.log(`載入題目: ${questionIndex + 1}`);

        // --- 1. 更新文本並設置進場前狀態 ---
        if (DOM.elements.questionTitle) {
             DOM.elements.questionTitle.classList.add('is-hidden'); // 確保 hidden
             DOM.elements.questionTitle.innerText = newTitleText; // 更新文本
             // 清理內聯樣式
             DOM.elements.questionTitle.style.transform = '';
             DOM.elements.questionTitle.style.transition = 'none'; // 暫停 transition
        }
        // 更新選項 (先清空再創建)
        if (DOM.containers.options) {
            DOM.containers.options.innerHTML = ''; // 清空舊選項
            questionData.options.forEach((optionData, optIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option is-hidden'; // 初始 class (包含 is-hidden)
                optionElement.dataset.text = optionData.text;
                optionElement.dataset.index = optIndex;
                optionElement.innerText = optionData.text;
                optionElement.setAttribute('role', 'button');
                optionElement.tabIndex = 0;
                // 清理內聯樣式
                optionElement.style.opacity = '';
                optionElement.style.filter = '';
                optionElement.style.transform = '';
                optionElement.style.transition = 'none'; // 暫停 transition
                optionElement.style.transitionDelay = '0s';

                DOM.containers.options.appendChild(optionElement);
            });
            // 更新 allOptions 引用
             allOptions = DOM.containers.options.querySelectorAll('.option');
             // 重新綁定事件 (因為元素已重新創建)
             updateOptionsEventListeners();
        }
         // 清空爆裂容器
        if (DOM.containers.explosion) {
            DOM.containers.explosion.innerHTML = '';
        }

        // --- 2. 觸發進場動畫 ---
        // 觸發標題進場
        const titleEnterDelay = 100; // 標題先進
        setTimeout(() => {
            requestAnimationFrame(() => {
                 if (DOM.elements.questionTitle) {
                    DOM.elements.questionTitle.style.transition = ''; // 恢復 CSS transition
                    DOM.elements.questionTitle.classList.remove('is-hidden');
                    console.log("Title enter triggered");
                 }
            });
        }, titleEnterDelay);

        // 觸發選項 staggered 進場
        const optionsEnterStartDelay = titleEnterDelay + 250; // 標題出現後再稍等
        const optionStaggerDelay = 80; // 選項間隔

        allOptions.forEach((option, index) => {
            option.style.transition = ''; // 恢復 CSS transition
            option.style.transitionDelay = `${optionsEnterStartDelay + index * optionStaggerDelay}ms`;
             requestAnimationFrame(() => {
                option.classList.remove('is-hidden');
             });
        });

        // --- 3. 更新進度條和重置狀態 ---
        updateProgressBar(questionIndex + 1);

        const totalOptionsDelay = (allOptions.length - 1) * optionStaggerDelay;
        const optionEnterDuration = 500; // 與 CSS transition 匹配
        const finalResetDelay = optionsEnterStartDelay + totalOptionsDelay + optionEnterDuration + 80;

        setTimeout(() => {
            console.log("所有進場動畫完成");
            allOptions.forEach(option => {
                option.style.transitionDelay = ''; // 清理 delay
            });
            state.isTransitioning = false; // 允許再次點擊
            console.log("Transition Ended");
        }, finalResetDelay);
    }

    // --- 結果計算與顯示 ---

    // 計算結果
    function calculateResult() {
        try {
            const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
            // 確保答案數量正確
            if (state.userAnswers.length !== questions.length) {
                console.warn(`答案數量 (${state.userAnswers.length}) 與問題數量 (${questions.length}) 不符！`);
                // 可以選擇填充預設答案或返回錯誤
                 for (let i = 0; i < questions.length; i++) {
                     if (state.userAnswers[i] === undefined) state.userAnswers[i] = 0; // 填充 0
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

            state.finalScores = scores; // 儲存分數到狀態
            console.log("最終分數:", state.finalScores);

            // --- 判斷邏輯 (與之前相同) ---
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
                return results[highestTypes[0]]; // 決勝無效，返回第一個
            }
            return results['A']; // 保險

        } catch (error) {
            console.error("計算結果時發生錯誤:", error);
            return results['A']; // 出錯時返回預設
        }
    }

    // 準備結果頁面數據
    function prepareResultData(resultData) {
        if (!resultData || !DOM.elements.resultTitle) return; // 防禦性檢查
        try {
            DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知';
            DOM.elements.resultSubtitle.textContent = resultData.subtitle || '';
            DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。';

            // 填充特質
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = state.finalScores; // 從 state 獲取
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

            // 填充相關書籍
            DOM.elements.similarBooks.innerHTML = (resultData.similar?.length) ? resultData.similar.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';
            DOM.elements.complementaryBooks.innerHTML = (resultData.complementary?.length) ? resultData.complementary.map(book => `<p>${book}</p>`).join('') : '<p>暫無資料</p>';

            // 填充分享文字
            DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle';

            console.log("結果數據準備完成");
        } catch (error) {
            console.error("準備結果數據時出錯:", error);
            DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤";
        }
    }

    // 顯示結果頁面
    function showResults() {
        console.log("顯示結果頁面...");
        state.isTransitioning = false; // 確保轉場標誌重置
        try {
            const resultData = calculateResult();
            prepareResultData(resultData);
            switchScreen('test', 'result'); // 切換到結果屏幕
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("抱歉，顯示結果時發生錯誤，請重試。");
            // 可以嘗試切換回首頁
            switchScreen('test', 'intro');
        }
    }

    // 添加特質元素到結果頁
    function addTraitElement(type, starCount) {
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

    // 複製分享文字
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
    // 備用複製方法
    function fallbackCopyText(text) {
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
    DOM.buttons.start?.addEventListener('click', () => {
        if (!state.preloadComplete) {
             if(DOM.containers.preloader) DOM.containers.preloader.classList.add('active');
             const interval = setInterval(() => {
                 if (state.preloadComplete) {
                     clearInterval(interval);
                     if(DOM.containers.preloader) DOM.containers.preloader.classList.remove('active');
                     setTimeout(() => switchScreen('intro', 'test'), 100);
                 }
             }, 100);
        } else {
             switchScreen('intro', 'test');
        }
    });

    DOM.buttons.restart?.addEventListener('click', () => {
        state.contentRendered = false; // 需要重新渲染測驗界面
        switchScreen('result', 'intro');
        // 清理結果頁面內容 (可選)
        if(DOM.elements.traitsContainer) DOM.elements.traitsContainer.innerHTML = '';
        // 重置進度條
        updateProgressBar(0);
    });

    DOM.buttons.copy?.addEventListener('click', copyShareText);

    // 全局錯誤處理
    window.addEventListener('error', function(event) {
        console.error("捕獲到全局錯誤:", event.error, "來自:", event.filename);
        state.isAnimating = false; // 嘗試恢復狀態
        state.isTransitioning = false;
    });

    // --- 初始化 ---
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    preloadImages(); // 開始預載入

    console.log("腳本初始化完成。");
});
