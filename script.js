// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 圖片緩存 - 簡化圖片管理
    const imageCache = {};
    
    // 狀態標記 - 防止並發動畫和操作
    let isAnimating = false;
    let contentRendered = false;
    let resultShowing = false; // 添加结果页面状态标记
    
    // 保存元素引用，避免重複獲取
    const DOM = {
        containers: {
            intro: document.getElementById('intro-container'),
            test: document.getElementById('test-container'),
            result: document.getElementById('result-container')
        },
        elements: {
            questionContainer: document.getElementById('question-container'),
            questionText: document.getElementById('question-text'),
            optionsContainer: document.getElementById('options-container'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            resultTitle: document.getElementById('result-title'),
            resultSubtitle: document.getElementById('result-subtitle'),
            resultDescription: document.getElementById('result-description'),
            traitsContainer: document.getElementById('traits-container'),
            similarBooks: document.getElementById('similar-books'),
            complementaryBooks: document.getElementById('complementary-books'),
            shareText: document.getElementById('share-text')
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
    
    // 預加載首頁和第一題圖片 - 確保關鍵圖片可用
    function preloadInitialImages() {
        console.log("開始預加載關鍵圖片...");
        try {
            const img1 = new Image();
            img1.src = './images/Intro.webp';
            
            const img2 = new Image();
            img2.src = './images/Q1.webp';
            
            console.log("關鍵圖片預加載請求完成");
        } catch (error) {
            console.warn("圖片預加載錯誤:", error);
            // 預加載錯誤不影響應用運行
        }
    }
    
    // 立即開始預加載關鍵圖片
    preloadInitialImages();
    
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
    
    // 重置动画和状态标记的辅助函数
    function resetAnimationState() {
        console.log("重置动画状态...");
        isAnimating = false;
        // 不重置contentRendered，因为它与特定页面相关
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
                
                // 如果是切換到測驗頁面，延遲渲染問題內容以確保過渡動畫流暢
                if (toScreen.id === 'test-container') {
                    contentRendered = false;
                    console.log("準備渲染問題內容...");
                    
                    // 確保DOM更新後再渲染內容
                    setTimeout(() => {
                        renderQuestion();
                        console.log("問題內容渲染完成");
                    }, 100);
                }
                
                // 如果是切換到結果頁面，設置相應狀態
                if (toScreen.id === 'result-container') {
                    resultShowing = true;
                    // 結果頁面需要滾動
                    document.body.style.overflow = 'auto';
                } else {
                    resultShowing = false;
                    // 其他頁面禁止滾動
                    document.body.style.overflow = 'hidden';
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
                renderQuestion();
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
        switchScreen(DOM.containers.intro, DOM.containers.test);
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
    
    // 預加載問題背景圖片
    function preloadQuestionImage(questionNumber) {
        const nextImage = new Image();
        nextImage.src = `./images/Q${questionNumber}.webp`;
        imageCache[questionNumber] = nextImage;
        return nextImage;
    }
    
    // 簡化的問題渲染函數 - 更可靠的實現
    function renderQuestion() {
        try {
            console.log(`渲染問題 ${currentQuestionIndex + 1}...`);
            contentRendered = true;
            
            const question = questions[currentQuestionIndex];
            const questionNumber = currentQuestionIndex + 1;
            
            // 設置問題文本
            const questionTextWithoutNumber = question.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionText.textContent = questionTextWithoutNumber;
            
            // 設置背景圖片和加載狀態
            DOM.elements.questionContainer.classList.add('loading-bg');
            
            // 嘗試從緩存獲取圖片，或直接設置背景
            if (imageCache[questionNumber]) {
                DOM.elements.questionContainer.style.backgroundImage = `url('./images/Q${questionNumber}.webp')`;
                DOM.elements.questionContainer.classList.remove('loading-bg');
                DOM.elements.questionContainer.classList.add('bg-loaded');
                
                setTimeout(() => {
                    DOM.elements.questionContainer.classList.remove('bg-loaded');
                }, 500);
            } else {
                // 直接設置背景圖片，不等待加載完成
                DOM.elements.questionContainer.style.backgroundImage = `url('./images/Q${questionNumber}.webp')`;
                
                // 監聽背景圖片加載
                const img = preloadQuestionImage(questionNumber);
                img.onload = () => {
                    // 圖片加載完成後移除加載狀態
                    DOM.elements.questionContainer.classList.remove('loading-bg');
                    DOM.elements.questionContainer.classList.add('bg-loaded');
                    
                    // 短暫延遲後移除加載完成狀態
                    setTimeout(() => {
                        DOM.elements.questionContainer.classList.remove('bg-loaded');
                    }, 500);
                };
            }
            
            // 構建選項HTML - 一次性更新DOM
            let optionsHTML = '';
            question.options.forEach((option, index) => {
                const isSelected = userAnswers[currentQuestionIndex] === index;
                optionsHTML += `
                <div class="option ${isSelected ? 'selected' : ''}" data-index="${index}">
                    ${option.text}
                </div>`;
            });
            DOM.elements.optionsContainer.innerHTML = optionsHTML;
            
            // 為選項添加事件監聽器
            document.querySelectorAll('.option').forEach(option => {
                option.addEventListener('click', handleOptionClick);
            });
            
            // 更新進度條
            updateProgressBar();
            
            // 預加載下一題圖片（如果不是最後一題）
            if (currentQuestionIndex < questions.length - 1) {
                preloadQuestionImage(questionNumber + 1);
            }
            
            // 安全措施：即使圖片未加載也不會永久卡在加載狀態
            setTimeout(() => {
                DOM.elements.questionContainer.classList.remove('loading-bg');
            }, 3000); // 3秒後強制移除加載狀態
            
            // 為問題和選項添加淡入效果
            DOM.elements.questionText.style.opacity = '0';
            DOM.elements.optionsContainer.style.opacity = '0';
            
            // 短暫延遲後顯示問題和選項，創建淡入效果
            setTimeout(() => {
                DOM.elements.questionText.style.transition = 'opacity 0.4s ease';
                DOM.elements.optionsContainer.style.transition = 'opacity 0.4s ease';
                DOM.elements.questionText.style.opacity = '1';
                DOM.elements.optionsContainer.style.opacity = '1';
            }, 100);
            
        } catch (error) {
            console.error("渲染問題出錯:", error);
            // 出錯時確保加載狀態被移除
            DOM.elements.questionContainer.classList.remove('loading-bg');
            resetAnimationState();
        }
    }
    
    // 處理選項點擊 - 優化問題之間的過渡動畫
    function handleOptionClick(e) {
        try {
            // 防止動畫進行時或內容未渲染時的點擊
            if (isAnimating || !contentRendered) {
                console.log("忽略點擊：動畫進行中或內容未渲染");
                return;
            }
            
            console.log("選項被點擊");
            
            // 確保點擊的是選項元素本身，而不是子元素
            const targetElement = e.target.closest('.option');
            if (!targetElement) {
                return;
            }
            
            // 防止連續點擊
            document.querySelectorAll('.option').forEach(option => {
                option.removeEventListener('click', handleOptionClick);
            });
            
            const optionIndex = parseInt(targetElement.dataset.index);
            userAnswers[currentQuestionIndex] = optionIndex;
            
            console.log(`問題 ${currentQuestionIndex+1} 選擇了選項 ${optionIndex+1}`);
            
            // 更新選項樣式
            document.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            targetElement.classList.add('selected');
            
            // 設置動畫狀態
            isAnimating = true;
            
            // 添加延遲，讓用戶能看到選中效果
            setTimeout(() => {
                // 判斷是否為最後一題
                if (currentQuestionIndex < questions.length - 1) {
                    // 如果不是最後一題，為問題容器添加淡出效果
                    fadeOutCurrentQuestion(() => {
                        // 淡出完成後，更新問題索引並渲染下一題
                        currentQuestionIndex++;
                        contentRendered = false;
                        
                        // 淡入下一個問題
                        fadeInNextQuestion();
                    });
                } else {
                    // 如果是最後一題，則顯示結果
                    console.log("已完成所有問題，準備顯示結果");
                    
                    try {
                        // 直接调用显示结果函数，特殊处理最后一题
                        processAndShowResult();
                    } catch (error) {
                        console.error("處理最後一題結果時出錯:", error);
                        // 出错时尝试直接切换到结果页面
                        emergencyShowResult();
                    }
                }
            }, 500);
        } catch (error) {
            console.error("處理選項點擊出錯:", error);
            resetAnimationState();
            
            // 如果是最后一题出错，确保能够看到结果
            if (currentQuestionIndex >= questions.length - 1) {
                emergencyShowResult();
            }
        }
    }
    
    // 淡出當前問題的輔助函數
    function fadeOutCurrentQuestion(callback) {
        // 為問題文本和選項添加淡出效果
        DOM.elements.questionText.style.transition = 'opacity 0.4s ease';
        DOM.elements.optionsContainer.style.transition = 'opacity 0.4s ease';
        DOM.elements.questionText.style.opacity = '0';
        DOM.elements.optionsContainer.style.opacity = '0';
        
        // 為背景添加淡出效果
        DOM.elements.questionContainer.style.transition = 'opacity 0.6s ease';
        DOM.elements.questionContainer.style.opacity = '0.7';
        
        // 等待淡出動畫完成
        setTimeout(() => {
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, 400);
    }
    
    // 淡入下一個問題的輔助函數
    function fadeInNextQuestion() {
        // 先重置問題容器的透明度
        DOM.elements.questionContainer.style.transition = 'none';
        DOM.elements.questionContainer.style.opacity = '0.7';
        
        // 重置過渡屬性以準備動畫
        setTimeout(() => {
            DOM.elements.questionContainer.style.transition = 'opacity 0.6s ease';
            DOM.elements.questionContainer.style.opacity = '1';
            
            // 渲染下一題內容
            renderQuestion();
            
            // 動畫完成後重置狀態
            setTimeout(() => {
                resetAnimationState();
            }, 600);
        }, 50);
    }
    
    // 应急显示结果函数 - 确保即使出错也能显示结果
    function emergencyShowResult() {
        console.log("启动应急结果显示...");
        try {
            // 重置所有状态
            resetAnimationState();
            
            // 计算结果并准备数据
            const result = calculateResult();
            prepareResultData(result);
            
            // 强制切换到结果页面
            DOM.containers.test.classList.remove('active');
            DOM.containers.result.classList.add('active');
            
            // 设置结果页面状态
            resultShowing = true;
            document.body.style.overflow = 'auto';
            
            // 滚动到顶部
            window.scrollTo(0, 0);
            
            console.log("应急结果显示完成");
        } catch (error) {
            console.error("应急显示结果失败:", error);
            alert("显示结果时出错，请刷新页面重试");
        }
    }
    
    // 处理并显示结果 - 优化过渡效果
    function processAndShowResult() {
        console.log("开始处理并显示结果...");
        
        // 先淡出最后一个问题
        fadeOutCurrentQuestion(() => {
            // 重置动画状态以确保流程不被阻塞
            resetAnimationState();
            
            // 计算结果
            const result = calculateResult();
            
            // 准备结果数据但不切换页面
            prepareResultData(result);
            
            // 显示前重置状态
            resultShowing = false;
            
            // 切换到结果页面
            switchScreen(DOM.containers.test, DOM.containers.result);
            console.log("结果页面显示完成");
        });
    }
    
    // 准备结果数据 - 从showResult抽取的数据准备逻辑
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
    
    // 顯示結果 - 重构以支持多种调用方式
    function showResult() {
        try {
            console.log("显示结果页面...");
            
            // 采用更可靠的处理方法
            processAndShowResult();
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("顯示結果時出錯，請重新嘗試測驗");
            resetAnimationState();
            
            // 错误时尝试应急显示
            emergencyShowResult();
        }
    }
    
    // 更新進度條
    function updateProgressBar() {
        try {
            const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
            DOM.elements.progressFill.style.width = `${progress}%`;
            DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
        } catch (error) {
            console.error("更新進度條出錯:", error);
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
        
        // 如果测验已经开始但卡在中间状态，尝试恢复
        if (currentQuestionIndex > 0 && !resultShowing) {
            resetAnimationState();
            
            // 如果已经完成全部问题但未显示结果，尝试显示结果
            if (currentQuestionIndex >= questions.length - 1 && userAnswers.length >= questions.length) {
                console.log("检测到测验已完成但结果未显示，尝试恢复...");
                emergencyShowResult();
            }
        }
    });
    
    // 页面加载完成后初始化的其他逻辑...
    console.log("初始化完成，等待用户开始测验");
});