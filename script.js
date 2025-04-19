// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 图片缓存对象 - 提高图片加载性能
    const imageCache = {};
    
    // 状态跟踪变量 - 防止重复触发动画
    let isTransitioning = false;
    
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
    
    // 优先级预加载 - 先加载关键图片，后加载其他图片
    function preloadImageWithPriority(src, isPriority = false) {
        return new Promise((resolve, reject) => {
            // 如果已经缓存，直接返回
            if (imageCache[src]) {
                resolve(imageCache[src]);
                return;
            }
            
            const img = new Image();
            
            img.onload = () => {
                imageCache[src] = img; // 缓存图片
                console.log(`${src} 加载完成`);
                resolve(img);
            };
            
            img.onerror = (err) => {
                console.error(`${src} 加载失败:`, err);
                reject(err);
            };
            
            // 设置图片源，开始加载
            img.src = src;
            
            // 优先级加载使用高优先级
            if (isPriority) {
                img.fetchPriority = "high";
            }
        });
    }
    
    // 优化的图片预加载策略 - 分批加载
    function preloadQuestionImages() {
        console.log("开始优化预加载问题图片...");
        
        // 首页和第一题是最优先加载的
        const priorityImages = [
            './images/Intro.webp',
            './images/Q1.webp'
        ];
        
        // 优先加载核心图片
        const priorityPromises = priorityImages.map(src => 
            preloadImageWithPriority(src, true)
        );
        
        // 加载优先图片后，再加载其余图片
        Promise.all(priorityPromises)
            .then(() => {
                console.log("优先图片加载完成，开始加载其余图片");
                
                // 使用 requestIdleCallback 在浏览器空闲时加载剩余图片
                if (window.requestIdleCallback) {
                    requestIdleCallback(() => {
                        // 分批加载剩余图片，减少并发请求
                        for (let i = 2; i <= 11; i++) {
                            const imgSrc = `./images/Q${i}.webp`;
                            // 使用 setTimeout 错开请求时间
                            setTimeout(() => {
                                preloadImageWithPriority(imgSrc);
                            }, (i - 2) * 100);
                        }
                    });
                } else {
                    // 不支持 requestIdleCallback 的浏览器
                    setTimeout(() => {
                        for (let i = 2; i <= 11; i++) {
                            preloadImageWithPriority(`./images/Q${i}.webp`);
                        }
                    }, 200);
                }
            })
            .catch(err => {
                console.error("图片预加载出错:", err);
            });
    }
    
    // 立即开始预加载
    preloadQuestionImages();
    
    // 設置視口高度 - 確保移動設備上正確顯示100vh
    function setViewportHeight() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    // 在初始化和窗口大小調整時設置視口高度
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    
    // 优化的切换屏幕函数 - 防止重复触发、优化过渡效果
    function switchScreen(fromScreen, toScreen) {
        // 防止动画重叠和连续点击
        if (isTransitioning) {
            console.log("页面正在切换中，忽略重复操作");
            return;
        }
        
        // 设置状态标记
        isTransitioning = true;
        
        // 添加切换状态和淡出动画
        fromScreen.classList.add('animating', 'fade-out');
        
        // 使用合适的延迟时间
        setTimeout(() => {
            // 切换屏幕显示状态
            fromScreen.classList.remove('active', 'animating', 'fade-out');
            
            // 强制重排以确保动画效果
            void toScreen.offsetWidth;
            
            // 显示新屏幕并添加淡入效果
            toScreen.classList.add('active', 'animating', 'fade-in');
            
            // 动画完成后移除动画类
            setTimeout(() => {
                toScreen.classList.remove('animating', 'fade-in');
                isTransitioning = false; // 重置状态标记
            }, 600);
        }, 600);
    }
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', () => {
        // 同时启动音效和振动反馈（如果支持）
        playFeedback();
        
        // 切换到测试页面
        switchScreen(DOM.containers.intro, DOM.containers.test);
        renderQuestion();
    });
    
    // 重新開始測驗 - 导航回首页
    DOM.buttons.restart.addEventListener('click', () => {
        // 提供反馈
        playFeedback();
        
        // 重置測驗狀態
        currentQuestionIndex = 0;
        userAnswers.length = 0;
        
        // 重置DOM元素
        DOM.elements.progressFill.style.width = '0%';
        
        // 切換到首頁
        switchScreen(DOM.containers.result, DOM.containers.intro);
        
        // 滾動到頂部
        window.scrollTo(0, 0);
    });
    
    // 简单的反馈函数 - 提供触感反馈（可选）
    function playFeedback() {
        // 如果支持振动 API，提供短暂振动
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    // 优化的渲染问题函数 - 确保平滑过渡和背景图片加载
    function renderQuestion() {
        if (isTransitioning) {
            console.log("渲染被忽略 - 页面正在过渡中");
            return;
        }
        
        // 设置状态标记防止重复渲染
        isTransitioning = true;
        
        const question = questions[currentQuestionIndex];
        const questionNumber = currentQuestionIndex + 1;
        const bgUrl = `./images/Q${questionNumber}.webp`;
        
        // 在加载内容前添加加载状态
        DOM.elements.questionContainer.classList.add('loading-bg');
        DOM.elements.questionText.classList.add('fade-out');
        DOM.elements.optionsContainer.classList.add('fade-out');
        
        // 设置适当的延迟，确保动画流畅
        setTimeout(() => {
            // 1. 准备新内容
            const questionTextWithoutNumber = question.question.replace(/^\d+\.\s*/, '');
            DOM.elements.questionText.textContent = questionTextWithoutNumber;
            
            // 2. 构建选项 HTML - 一次性操作减少重排
            let optionsHTML = '';
            question.options.forEach((option, index) => {
                const isSelected = userAnswers[currentQuestionIndex] === index;
                optionsHTML += `
                <div class="option ${isSelected ? 'selected' : ''}" data-index="${index}">
                    ${option.text}
                </div>`;
            });
            DOM.elements.optionsContainer.innerHTML = optionsHTML;
            
            // 3. 设置背景图片 - 优先使用缓存
            if (imageCache[bgUrl]) {
                console.log(`使用缓存的背景图: ${bgUrl}`);
                DOM.elements.questionContainer.style.backgroundImage = `url('${bgUrl}')`;
                // 添加加载完成标记，触发淡入动画
                DOM.elements.questionContainer.classList.add('bg-loaded');
            } else {
                // 如果没有缓存，使用动态加载
                const img = new Image();
                img.onload = () => {
                    DOM.elements.questionContainer.style.backgroundImage = `url('${bgUrl}')`;
                    DOM.elements.questionContainer.classList.add('bg-loaded');
                    imageCache[bgUrl] = img; // 缓存图片
                };
                img.src = bgUrl;
            }
            
            // 4. 为選項添加事件監聽器
            document.querySelectorAll('.option').forEach(option => {
                option.addEventListener('click', handleOptionClick);
            });
            
            // 5. 更新进度条
            updateProgressBar();
            
            // 6. 移除加载状态和淡出类
            DOM.elements.questionContainer.classList.remove('loading-bg');
            DOM.elements.questionText.classList.remove('fade-out');
            DOM.elements.optionsContainer.classList.remove('fade-out');
            
            // 7. 添加淡入类，触发平滑过渡
            DOM.elements.questionText.classList.add('fade-in');
            DOM.elements.optionsContainer.classList.add('fade-in');
            
            // 8. 清理动画类，重置状态
            setTimeout(() => {
                DOM.elements.questionText.classList.remove('fade-in');
                DOM.elements.optionsContainer.classList.remove('fade-in');
                DOM.elements.questionContainer.classList.remove('bg-loaded');
                isTransitioning = false; // 重置过渡状态
            }, 600);
        }, 400);
    }
    
    // 优化选项点击处理逻辑
    function handleOptionClick(e) {
        // 防止重复触发和动画重叠
        if (isTransitioning) {
            return;
        }
        
        // 確保點擊的是選項元素本身，而不是子元素
        const targetElement = e.target.closest('.option');
        if (!targetElement) return;
        
        // 设置过渡状态
        isTransitioning = true;
        
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
        
        // 提供触感反馈
        playFeedback();
        
        // 淡出当前内容
        DOM.elements.questionText.classList.add('fade-out');
        DOM.elements.optionsContainer.classList.add('fade-out');
        
        // 添加延遲，讓用戶能看到選中效果
        setTimeout(() => {
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
                    isTransitioning = false; // 重置状态
                }
            }
        }, 600);
    }
    
    // 更新進度條
    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
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
    
    // 顯示結果 - 优化过渡效果
    function showResult() {
        try {
            const result = calculateResult();
            
            // 切换到结果页面前准备数据
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
            
            // 现在切换到结果页面
            switchScreen(DOM.containers.test, DOM.containers.result);
            
            // 確保結果容器可滾動
            document.body.style.overflow = 'auto';
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("顯示結果時出錯，請重新嘗試測驗");
            isTransitioning = false; // 重置状态
        }
    }
    
    // 添加特質元素助手函數
    function addTraitElement(type, starCount) {
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
    }
    
    // 複製分享文字
    DOM.buttons.copy.addEventListener('click', () => {
        const shareText = DOM.elements.shareText.textContent;
        navigator.clipboard.writeText(shareText).then(() => {
            // 提供反馈
            playFeedback();
            
            DOM.buttons.copy.textContent = '已複製!';
            setTimeout(() => {
                DOM.buttons.copy.textContent = '複製';
            }, 2000);
        }).catch(err => {
            console.error('無法複製: ', err);
        });
    });
});