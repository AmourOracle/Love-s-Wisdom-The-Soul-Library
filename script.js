// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 圖片緩存 - 簡化圖片管理
    const imageCache = {};
    
    // 狀態標記 - 防止並發動畫和操作
    let isAnimating = false;
    let contentRendered = false;
    let resultShowing = false; // 添加结果页面状态标记
    let preloadComplete = false; // 预加载完成标记
    
    // 保存元素引用，避免重複獲取
    const DOM = {
        containers: {
            intro: document.getElementById('intro-container'),
            test: document.getElementById('test-container'),
            result: document.getElementById('result-container'),
            preloader: document.getElementById('preloader')
        },
        elements: {
            parallaxWrapper: document.getElementById('parallax-wrapper'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
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
    
    // 從 data.js 獲取測驗數據
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;
    
    // 跟踪當前問題索引和用戶選擇
    let currentQuestionIndex = 0;
    const userAnswers = [];
    
    // 設置視口高度 - 確保移動設備上正確顯示100vh
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (error) {
            console.warn("設置視口高度錯誤:", error);
        }
    }
    
    // 在初始化和窗口大小調整時設置視口高度
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    
    // 預加載所有問題圖片
    function preloadAllImages() {
        // 顯示預加載指示器
        DOM.containers.preloader.classList.add('active');
        
        const totalImages = questions.length + 1; // +1 是首頁圖片
        let loadedImages = 0;
        
        // 更新進度函數
        function updateProgress() {
            loadedImages++;
            const progress = Math.round((loadedImages / totalImages) * 100);
            if (DOM.elements.preloaderProgress) {
                DOM.elements.preloaderProgress.textContent = `${progress}%`;
            }
            
            if (loadedImages >= totalImages) {
                preloadComplete = true;
                setTimeout(() => {
                    if (DOM.containers.preloader) {
                        DOM.containers.preloader.classList.remove('active');
                    }
                }, 500);
            }
        }
        
        // 預加載首頁圖片
        const introImg = new Image();
        introImg.src = './images/Intro.webp';
        introImg.onload = updateProgress;
        introImg.onerror = updateProgress; // 即使失敗也算作完成了一個
        
        // 預加載所有問題圖片
        for (let i = 1; i <= questions.length; i++) {
            const img = new Image();
            img.src = `./images/Q${i}.webp`;
            imageCache[i] = img;
            
            img.onload = updateProgress;
            img.onerror = updateProgress; // 即使失敗也算作完成了一個
        }
    }
    
    // 立即開始預加載所有圖片
    preloadAllImages();
    
    // 重置动画和状态标记的辅助函数
    function resetAnimationState() {
        console.log("重置动画状态...");
        isAnimating = false;
    }
    
    // 优化的屏幕切换函数 - 穩健可靠的實現
    function switchScreen(fromScreen, toScreen) {
        console.log(`切換屏幕從 ${fromScreen.id} 到 ${toScreen.id}...`);
        
        // 防止重複觸發
        if (isAnimating) {
            console.log("動畫進行中，忽略切換請求");
            return;
        }
        
        // 設置動畫狀態
        isAnimating = true;
        
        try {
            // 添加淡出動畫類
            fromScreen.classList.add('fade-out');
            
            // 使用較長的延遲確保動畫完成
            setTimeout(() => {
                // 切換屏幕
                fromScreen.classList.remove('active', 'fade-out');
                
                // 強制重排，確保渲染更新
                void toScreen.offsetWidth;
                
                // 顯示目標屏幕
                toScreen.classList.add('active', 'fade-in');
                
                // 如果是切換到測驗頁面，確保視差滾動內容已經初始化
                if (toScreen.id === 'test-container') {
                    // 測驗頁面需要禁止滾動
                    document.body.style.overflow = 'hidden';
                    
                    // 如果還沒有初始化內容
                    if (!contentRendered) {
                        console.log("初始化視差滾動測驗...");
                        initParallaxTest();
                        contentRendered = true;
                    }
                }
                
                // 如果是切換到結果頁面，設置相應狀態
                if (toScreen.id === 'result-container') {
                    resultShowing = true;
                    // 結果頁面需要滾動
                    document.body.style.overflow = 'auto';
                } else {
                    resultShowing = false;
                }
                
                // 動畫完成後清理狀態
                setTimeout(() => {
                    toScreen.classList.remove('fade-in');
                    resetAnimationState();
                    console.log("屏幕切換完成，狀態已重置");
                }, 600);
            }, 600); // 確保有足夠時間完成淡出動畫
        } catch (error) {
            console.error("屏幕切換出錯:", error);
            
            // 出錯時確保基本功能可用
            fromScreen.classList.remove('active', 'fade-out');
            toScreen.classList.add('active');
            resetAnimationState();
            
            // 如果是測驗頁面，確保內容顯示
            if (toScreen.id === 'test-container' && !contentRendered) {
                initParallaxTest();
                contentRendered = true;
            }
            
            // 如果是結果頁面，確保正確設置
            if (toScreen.id === 'result-container') {
                resultShowing = true;
                document.body.style.overflow = 'auto';
            }
        }
    }
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', function() {
        console.log("點擊開始測驗按鈕");
        
        // 確保所有圖片已經預加載完成
        if (!preloadComplete) {
            // 如果預加載未完成，顯示預加載指示器並等待
            DOM.containers.preloader.classList.add('active');
            
            // 每100ms檢查一次是否預加載完成
            const checkInterval = setInterval(() => {
                if (preloadComplete) {
                    clearInterval(checkInterval);
                    DOM.containers.preloader.classList.remove('active');
                    setTimeout(() => {
                        switchScreen(DOM.containers.intro, DOM.containers.test);
                    }, 300);
                }
            }, 100);
        } else {
            // 預加載已完成，直接切換
            switchScreen(DOM.containers.intro, DOM.containers.test);
        }
    });
    
    // 重新開始測驗 - 導航回首頁
    DOM.buttons.restart.addEventListener('click', function() {
        try {
            console.log("點擊重新測驗按鈕");
            // 重置測驗狀態
            currentQuestionIndex = 0;
            userAnswers.length = 0;
            resultShowing = false;
            
            // 重置DOM元素
            DOM.elements.progressFill.style.width = '0%';
            
            // 切換到首頁
            switchScreen(DOM.containers.result, DOM.containers.intro);
            
            // 清空和重置視差滾動內容
            contentRendered = false;
            if (DOM.elements.parallaxWrapper) {
                DOM.elements.parallaxWrapper.innerHTML = '';
            }
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("重新開始測驗出錯:", error);
            // 出錯時嘗試直接切換
            DOM.containers.result.classList.remove('active');
            DOM.containers.intro.classList.add('active');
            resetAnimationState();
        }
    });
    
    // 初始化視差滾動測驗
    function initParallaxTest() {
        console.log("初始化視差滾動測驗...");
        
        // 清空容器
        if (!DOM.elements.parallaxWrapper) {
            console.error("parallaxWrapper element not found!");
            return;
        }
        
        DOM.elements.parallaxWrapper.innerHTML = '';
        
        // 創建所有問題區域
        questions.forEach((question, index) => {
            const questionNumber = index + 1;
            const section = document.createElement('section');
            section.className = 'question-section';
            section.id = `question-${questionNumber}`;
            
            // 第一個問題默認激活
            if (questionNumber === 1) {
                section.classList.add('active');
            } else if (questionNumber === 2) {
                section.classList.add('next');
            }
            
            // 獲取問題文本（去掉前面的題號）
            const questionText = question.question.replace(/^\d+\.\s*/, '');
            
            // 設置問題區域內容
            section.innerHTML = `
                <div class="question-bg" style="background-image: url('./images/Q${questionNumber}.webp')"></div>
                <div class="overlay">
                    <div class="question">${questionText}</div>
                    <div class="options-container">
                        ${question.options.map((option, optIdx) => `
                            <div class="option" data-question="${questionNumber}" data-index="${optIdx}">
                                ${option.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            DOM.elements.parallaxWrapper.appendChild(section);
        });
        
        // 為所有選項添加事件監聽
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', handleOptionClick);
        });
        
        // 更新進度條
        updateProgressBar(1);
    }
    
    // 處理選項點擊 - 重要修改：修復最後一題的處理邏輯
    function handleOptionClick(event) {
        // 防止重複點擊或動畫進行時的點擊
        if (isAnimating) {
            console.log("动画进行中，忽略点击");
            return;
        }
        
        isAnimating = true;
        console.log("点击选项，启动动画过渡");
        
        const option = event.currentTarget;
        const questionNum = parseInt(option.dataset.question);
        const optionIndex = parseInt(option.dataset.index);
        
        console.log(`問題 ${questionNum} 選擇了選項 ${optionIndex + 1}`);
        
        // 記錄用戶選擇
        userAnswers[questionNum - 1] = optionIndex;
        
        // 更新選中狀態
        const optionsContainer = option.closest('.options-container');
        optionsContainer.querySelectorAll('.option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        
        // 短暫延遲，讓用戶看到選中效果
        setTimeout(() => {
            // 修改：使用明確的數字比較而不是與變量比較
            // 修改：更清晰的問題索引比較邏輯
            if (questionNum < questions.length) {
                // 不是最後一題，切換到下一題
                goToNextQuestion(questionNum);
            } else {
                // 是最後一題，顯示結果
                console.log("最后一题，准备显示结果");
                showResults();
            }
        }, 500);
    }
    
    // 切換到下一題
    function goToNextQuestion(currentNum) {
        console.log(`切換到下一題，当前题号: ${currentNum}`);
        
        // 獲取當前和下一個問題區域
        const currentSection = document.getElementById(`question-${currentNum}`);
        const nextSection = document.getElementById(`question-${currentNum + 1}`);
        const nextNextSection = document.getElementById(`question-${currentNum + 2}`);
        
        if (!currentSection || !nextSection) {
            console.error(`无法找到问题区域: 当前题 ${currentNum} 或下一题 ${currentNum + 1}`);
            isAnimating = false;
            return;
        }
        
        // 更新問題索引
        currentQuestionIndex = currentNum;
        
        // 添加过渡效果的调试记录
        console.log(`应用过渡效果: question-${currentNum} => prev, question-${currentNum + 1} => active`);
        
        // 更新CSS類，應用視差過渡效果
        currentSection.classList.remove('active');
        currentSection.classList.add('prev');
        
        nextSection.classList.remove('next');
        nextSection.classList.add('active');
        
        // 如果有後面的問題，設置為next
        if (nextNextSection) {
            nextNextSection.classList.add('next');
        }
        
        // 更新進度條
        updateProgressBar(currentNum + 1);
        
        // 動畫完成後重置狀態
        setTimeout(() => {
            isAnimating = false;
            console.log("问题过渡动画完成，重置动画状态");
        }, 800);
    }
    
    // 更新進度條
    function updateProgressBar(questionNumber) {
        try {
            const progress = (questionNumber / questions.length) * 100;
            if (DOM.elements.progressFill) {
                DOM.elements.progressFill.style.width = `${progress}%`;
            }
            if (DOM.elements.progressText) {
                DOM.elements.progressText.textContent = `問題 ${questionNumber}/${questions.length}`;
            }
        } catch (error) {
            console.error("更新進度條出錯:", error);
        }
    }
    
    // 显示结果 - 添加更多错误处理和日志
    function showResults() {
        console.log("显示结果页面...");
        
        try {
            // 输出用户选择，帮助调试
            console.log("用户选择记录:", userAnswers);
            console.log("用户选择数量:", userAnswers.length);
            console.log("问题总数:", questions.length);
            
            // 计算结果
            const result = calculateResult();
            console.log("计算得到的结果类型:", result.title);
            
            // 准备结果数据
            prepareResultData(result);
            console.log("结果数据准备完成");
            
            // 延迟切换到结果页面，确保用户可以看到最后一题的选择效果
            setTimeout(() => {
                // 确保DOM元素存在
                if (!DOM.containers.test || !DOM.containers.result) {
                    console.error("测试容器或结果容器DOM元素不存在!");
                    alert("显示结果时出错，请刷新页面重试");
                    return;
                }
                
                console.log("切换到结果页面");
                // 强制重置动画状态，确保可以切换
                isAnimating = false;
                switchScreen(DOM.containers.test, DOM.containers.result);
            }, 800); // 增加延迟时间，确保有足够时间完成动画
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            console.log("尝试应急显示结果...");
            
            // 应急处理：强制显示结果
            try {
                const result = calculateResult();
                prepareResultData(result);
                
                // 强制切换屏幕，绕过动画
                DOM.containers.test.classList.remove('active');
                DOM.containers.result.classList.add('active');
                resultShowing = true;
                document.body.style.overflow = 'auto';
                isAnimating = false;
                console.log("应急显示结果成功");
            } catch (e) {
                console.error("应急显示结果也失败:", e);
                alert("顯示結果時出錯，請重新嘗試測驗");
            }
        }
    }
    
    // 准备结果数据
    function prepareResultData(result) {
        try {
            // 設置結果標題和副標題
            if (result.title.includes('靈魂圖書管理員')) {
                DOM.elements.resultTitle.textContent = `你是：${result.title}`;
            } else {
                DOM.elements.resultTitle.textContent = `你的靈魂之書是：${result.title}`;
            }
            
            DOM.elements.resultSubtitle.textContent = result.subtitle || '';
            DOM.elements.resultDescription.textContent = result.description || '';
            
            // 設置書本特質
            DOM.elements.traitsContainer.innerHTML = '';
            const typeScores = window.finalTypeScores || {
                'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0
            };
            
            // 特殊處理《靈魂圖書管理員》的特質顯示
            if (result.title.includes('靈魂圖書管理員')) {
                Object.keys(traitNames).forEach(type => {
                    addTraitElement(type, 3);
                });
            } else {
                // 為每種特質創建評分顯示
                Object.keys(traitNames).forEach(type => {
                    // 獲取原始分數
                    const score = typeScores[type] || 0;
                    
                    // 根據得分計算星星數 (0-11分映射到1-5星)
                    let normalizedScore;
                    if (score < 1) {
                        normalizedScore = 1; 
                    } else if (score >= 1 && score < 3) {
                        normalizedScore = 2; 
                    } else if (score >= 3 && score < 5) {
                        normalizedScore = 3; 
                    } else if (score >= 5 && score < 7) {
                        normalizedScore = 4; 
                    } else {
                        normalizedScore = 5; 
                    }
                    
                    addTraitElement(type, normalizedScore);
                });
            }
            
            // 設置相似和互補書籍
            if (result.similar && Array.isArray(result.similar)) {
                DOM.elements.similarBooks.innerHTML = result.similar.map(book => `<p>${book}</p>`).join('');
            } else {
                DOM.elements.similarBooks.innerHTML = '<p>無相似書籍資料</p>';
            }
            
            if (result.complementary && Array.isArray(result.complementary)) {
                DOM.elements.complementaryBooks.innerHTML = result.complementary.map(book => `<p>${book}</p>`).join('');
            } else {
                DOM.elements.complementaryBooks.innerHTML = '<p>無互補書籍資料</p>';
            }
            
            // 設置分享文字
            DOM.elements.shareText.textContent = result.shareText || '';
            
            console.log("結果數據準備完成");
        } catch (error) {
            console.error("準備結果數據時出錯:", error);
        }
    }
    
    // 計算結果函數 - 使用多特質比例計分邏輯
    function calculateResult() {
        try {
            // 初始化各類型的得分
            const typeScores = {
                'A': 0, // 思辨抽離
                'B': 0, // 情感共鳴
                'C': 0, // 人文觀察
                'D': 0, // 自我敘事
                'E': 0  // 即興演出
            };
            
            console.log("計算結果 - 用戶選擇:", userAnswers);
            
            // 檢查答案完整性
            if (userAnswers.length < questions.length) {
                console.warn(`用户回答不完整: ${userAnswers.length}/${questions.length}`);
                // 如果最後一題沒有回答，使用默認選項0
                if (userAnswers[questions.length - 1] === undefined) {
                    console.log("最后一题未回答，使用默认选项0");
                    userAnswers[questions.length - 1] = 0;
                }
            }
            
            // 計算每種類型的得分 - 多特質比例計分
            userAnswers.forEach((answerIndex, questionIndex) => {
                if (answerIndex !== undefined && questionIndex < questions.length) {
                    const question = questions[questionIndex];
                    if (question && question.options && question.options[answerIndex]) {
                        const selectedOption = question.options[answerIndex];
                        
                        // 獲取該選項的得分分配
                        const scores = selectedOption.scores;
                        
                        // 將得分分配加入總分中
                        for (const type in scores) {
                            if (typeScores.hasOwnProperty(type)) {
                                typeScores[type] += scores[type];
                                console.log(`問題 ${questionIndex+1}: ${type} 類型得分 +${scores[type]}`);
                            }
                        }
                    }
                }
            });
            
            // 將得分保存，以便在結果頁面顯示
            window.finalTypeScores = typeScores;
            
            // 檢查是否有四種類型得分相同
            const scoreFrequency = {};
            for (const type in typeScores) {
                // 四捨五入到小數點後一位，避免浮點數比較問題
                const score = Math.round(typeScores[type] * 10) / 10;
                scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
            }
            
            for (const score in scoreFrequency) {
                if (scoreFrequency[score] === 4) {
                    return results["SPECIAL"];
                }
            }
            
            // 尋找得分最高的類型
            let maxScore = 0;
            let highestTypes = [];
            
            for (const type in typeScores) {
                if (typeScores[type] > maxScore) {
                    maxScore = typeScores[type];
                    highestTypes = [type];
                } else if (Math.abs(typeScores[type] - maxScore) < 0.1) { // 考慮浮點數誤差，差異小於0.1視為相同
                    highestTypes.push(type);
                }
            }
            
            // 如果有三個或更多類型得分相同且為最高分，返回特殊結果
            if (highestTypes.length >= 3) {
                return results["SPECIAL"];
            }
            
            // 如果只有一個最高分類型，直接返回結果
            if (highestTypes.length === 1) {
                return results[highestTypes[0]];
            }
            
            // 如果有兩個類型同分且為最高分，使用決勝題機制 (僅第9題)
            if (highestTypes.length === 2) {
                const tiebreakQuestionIndex = 8; // 第9題的索引是8
                const tiebreakAnswer = userAnswers[tiebreakQuestionIndex];
                
                if (tiebreakAnswer !== undefined) {
                    const tiebreakPrimaryType = questions[tiebreakQuestionIndex].options[tiebreakAnswer].primary;
                    
                    // 檢查決勝題的主要類型是否在最高分類型中
                    if (highestTypes.includes(tiebreakPrimaryType)) {
                        return results[tiebreakPrimaryType];
                    }
                }
                
                // 如果決勝題不能決勝，使用各類型分佈的差異性作為決勝依據
                const balanceScores = {};
                highestTypes.forEach(type => {
                    let diffSum = 0;
                    Object.keys(typeScores).forEach(otherType => {
                        if (type !== otherType) {
                            diffSum += Math.abs(typeScores[type] - typeScores[otherType]);
                        }
                    });
                    balanceScores[type] = diffSum;
                });
                
                // 選擇特質分佈最均衡的類型
                const minBalanceScore = Math.min(...Object.values(balanceScores));
                const balanceWinners = highestTypes.filter(
                    type => balanceScores[type] === minBalanceScore
                );
                
                return results[balanceWinners[0]];
            }
            
            // 保險處理：如果上述所有邏輯都未返回結果，選擇第一個最高分類型
            return results[highestTypes[0]];
        } catch (error) {
            console.error("計算結果時發生錯誤:", error);
            // 出錯時返回默認結果，確保流程不中斷
            return results['A']; 
        }
    }
    
    // 添加特質元素助手函數
    function addTraitElement(type, starCount) {
        try {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-item';
            
            const traitName = document.createElement('span');
            traitName.className = 'trait-name';
            traitName.textContent = traitNames[type];
            
            const traitStars = document.createElement('span');
            traitStars.className = 'trait-stars';
            traitStars.textContent = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
            
            traitElement.appendChild(traitName);
            traitElement.appendChild(traitStars);
            DOM.elements.traitsContainer.appendChild(traitElement);
        } catch (error) {
            console.error("添加特質元素時出錯:", error);
        }
    }
    
    // 複製分享文字
    DOM.buttons.copy.addEventListener('click', function() {
        try {
            const shareText = DOM.elements.shareText.textContent;
            navigator.clipboard.writeText(shareText).then(() => {
                DOM.buttons.copy.textContent = '已複製!';
                setTimeout(() => {
                    DOM.buttons.copy.textContent = '複製';
                }, 2000);
            }).catch(err => {
                console.error('無法複製: ', err);
                alert('複製失敗，請手動選擇文字並複製');
            });
        } catch (error) {
            console.error("複製分享文字時出錯:", error);
            alert('複製失敗，請手動選擇文字並複製');
        }
    });
    
    // 添加全局错误保护 - 防止页面完全卡死
    window.addEventListener('error', function(event) {
        console.error("捕获到全局错误:", event.error);
        
        // 恢复动画状态
        isAnimating = false;
        
        // 如果在测验中出错尝试恢复
        if (DOM.containers.test.classList.contains('active') && !resultShowing) {
            console.log("测验中发生错误，尝试恢复状态");
            
            // 如果所有问题已经回答，显示结果
            if (userAnswers.length >= questions.length - 1) {
                showResults();
            }
        }
    });
    
    // 页面加载完成后初始化的其他逻辑...
    console.log("初始化完成，等待用户开始测验");
});