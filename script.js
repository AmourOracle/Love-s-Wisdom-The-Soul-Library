// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
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
    
    // 基本的圖片預加載 - 簡化版，避免阻塞主線程
    function preloadQuestionImages() {
        try {
            console.log("开始预加载问题图片...");
            // 仅加载第一题图片，其余图片按需加载
            const firstImage = new Image();
            firstImage.src = './images/Q1.webp';
        } catch (error) {
            console.error("预加载图片时出错：", error);
            // 错误不会阻止应用继续运行
        }
    }
    
    // 尝试预加载图片，但不阻止测验进行
    preloadQuestionImages();
    
    // 設置視口高度 - 確保移動設備上正確顯示100vh
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (error) {
            console.error("设置视口高度时出错：", error);
        }
    }
    
    // 在初始化和窗口大小調整時設置視口高度
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    
    // 简化的切换屏幕函数 - 移除复杂动画，确保稳定性
    function switchScreen(fromScreen, toScreen) {
        try {
            // 简单的屏幕切换
            fromScreen.classList.remove('active');
            void toScreen.offsetWidth; // 强制重排
            toScreen.classList.add('active');
        } catch (error) {
            console.error("切换屏幕时出错：", error);
            alert("页面切换出错，请刷新页面重试");
        }
    }
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', function() {
        try {
            console.log("点击开始测验按钮");
            switchScreen(DOM.containers.intro, DOM.containers.test);
            renderQuestion();
        } catch (error) {
            console.error("开始测验时出错：", error);
            alert("开始测验时出错，请刷新页面重试");
        }
    });
    
    // 重新開始測驗 - 导航回首页
    DOM.buttons.restart.addEventListener('click', function() {
        try {
            // 重置測驗狀態
            currentQuestionIndex = 0;
            userAnswers.length = 0;
            
            // 重置DOM元素
            DOM.elements.progressFill.style.width = '0%';
            
            // 切換到首頁
            switchScreen(DOM.containers.result, DOM.containers.intro);
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("重新开始测验时出错：", error);
            alert("重新开始测验时出错，请刷新页面重试");
        }
    });
    
    // 简化的渲染问题函数 - 专注于基本功能
    function renderQuestion() {
        try {
            const question = questions[currentQuestionIndex];
            
            // 設置問題文本 - 移除標號以增加沉浸感
            const questionTextWithoutNumber = question.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionText.textContent = questionTextWithoutNumber;
            
            // 設置背景圖片 - 基于问题序号
            const questionNumber = currentQuestionIndex + 1;
            DOM.elements.questionContainer.style.backgroundImage = `url('./images/Q${questionNumber}.webp')`;
            
            // 渲染選項
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
            
            updateProgressBar();
        } catch (error) {
            console.error("渲染问题时出错：", error);
            alert("显示问题时出错，请刷新页面重试");
        }
    }
    
    // 简化的选项点击处理
    function handleOptionClick(e) {
        try {
            // 確保點擊的是選項元素本身，而不是子元素
            const targetElement = e.target.closest('.option');
            if (!targetElement) return;
            
            // 防止連續點擊
            document.querySelectorAll('.option').forEach(option => {
                option.removeEventListener('click', handleOptionClick);
            });
            
            const optionIndex = parseInt(targetElement.dataset.index);
            userAnswers[currentQuestionIndex] = optionIndex;
            
            console.log(`問題 ${currentQuestionIndex+1} 選擇了選項 ${optionIndex+1}, 主要類型: ${questions[currentQuestionIndex].options[optionIndex].primary}`);
            
            // 更新選項樣式
            document.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            targetElement.classList.add('selected');
            
            // 添加延遲，讓用戶能看到選中效果
            setTimeout(function() {
                // 判斷是否為最後一題
                if (currentQuestionIndex < questions.length - 1) {
                    // 如果不是最後一題，自動前進到下一題
                    currentQuestionIndex++;
                    renderQuestion();
                } else {
                    // 如果是最後一題，則顯示結果
                    console.log("已完成所有問題，準備顯示結果");
                    
                    try {
                        showResult();
                    } catch (error) {
                        console.error("顯示結果時發生錯誤:", error);
                        alert("顯示結果時出錯，請重新嘗試測驗");
                    }
                }
            }, 300);
        } catch (error) {
            console.error("处理选项点击时出错：", error);
            alert("选择选项时出错，请刷新页面重试");
        }
    }
    
    // 更新進度條
    function updateProgressBar() {
        try {
            const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
            DOM.elements.progressFill.style.width = `${progress}%`;
            DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
        } catch (error) {
            console.error("更新进度条时出错：", error);
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
            return results['A']; // 發生錯誤時返回默認結果
        }
    }
    
    // 顯示結果 - 简化版
    function showResult() {
        try {
            const result = calculateResult();
            
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
            
            // 切换到结果页面
            switchScreen(DOM.containers.test, DOM.containers.result);
            
            // 確保結果容器可滾動
            document.body.style.overflow = 'auto';
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("顯示結果時出錯，請重新嘗試測驗");
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
            console.error("添加特质元素时出错：", error);
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
            console.error("复制分享文字时出错：", error);
            alert('複製失敗，請手動選擇文字並複製');
        }
    });
});