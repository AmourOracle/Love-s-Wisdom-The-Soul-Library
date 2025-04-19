// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 創建圖片緩存和動畫狀態管理
    const imageCache = {};
    let isAnimating = false;
    let previousProgress = 0;
    
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
    
    // 動畫狀態管理函數
    function beginAnimation(container, direction = '') {
        // 防止動畫重疊
        if (isAnimating) {
            console.log("動畫進行中，忽略請求");
            return false;
        }
        
        isAnimating = true;
        
        // 添加動畫狀態類
        document.querySelector('.container').classList.add('animating');
        if (direction) {
            document.querySelector('.container').classList.add(direction);
        }
        
        // 設置超時保護，防止動畫狀態鎖死
        setTimeout(() => {
            endAnimation();
        }, 1000); // 保護性超時
        
        return true;
    }
    
    function endAnimation() {
        isAnimating = false;
        const container = document.querySelector('.container');
        if (container) {
            container.classList.remove('animating', 'slide-up', 'slide-down');
        }
    }
    
    // 優化的圖片預加載函數
    function preloadImage(src) {
        return new Promise((resolve, reject) => {
            // 檢查緩存
            if (imageCache[src]) {
                resolve(imageCache[src]);
                return;
            }
            
            // 加載新圖片
            const img = new Image();
            img.onload = () => {
                // 緩存並返回圖片
                imageCache[src] = img;
                console.log(`圖片預加載成功: ${src}`);
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`圖片加載失敗: ${src}`, err);
                reject(err);
            };
            img.src = src;
        });
    }
    
    // 預加載首頁和第一題圖片
    function preloadInitialImages() {
        try {
            console.log("預加載初始圖片...");
            Promise.all([
                preloadImage('./images/Intro.webp'),
                preloadImage('./images/Q1.webp')
            ]).then(() => {
                console.log("初始圖片加載完成");
                
                // 在空閒時預加載其他圖片
                if (window.requestIdleCallback) {
                    requestIdleCallback(() => {
                        preloadRemainingImages();
                    });
                } else {
                    setTimeout(preloadRemainingImages, 1000);
                }
            }).catch(err => {
                console.error("初始圖片預加載錯誤:", err);
            });
        } catch(error) {
            console.error("預加載函數錯誤:", error);
            // 出錯不阻止應用繼續運行
        }
    }
    
    // 預加載剩餘問題圖片
    function preloadRemainingImages() {
        console.log("開始預加載剩餘圖片...");
        
        // 分批加載，每批2-3張圖片，減少並發請求
        for (let batch = 0; batch < 4; batch++) {
            setTimeout(() => {
                const startIdx = batch * 3 + 2; // 從Q2開始，每批3張
                const endIdx = Math.min(startIdx + 2, 11);
                
                for (let i = startIdx; i <= endIdx; i++) {
                    preloadImage(`./images/Q${i}.webp`).catch(err => {
                        // 錯誤處理，但不阻止應用繼續運行
                        console.warn(`加載Q${i}圖片失敗，將在需要時重試`, err);
                    });
                }
            }, batch * 300); // 每批延遲300ms
        }
    }
    
    // 立即開始預加載初始圖片
    preloadInitialImages();
    
    // 設置視口高度 - 確保移動設備上正確顯示100vh
    function setViewportHeight() {
        try {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        } catch (error) {
            console.error("設置視口高度時出錯:", error);
        }
    }
    
    // 在初始化和窗口大小調整時設置視口高度
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    
    // 提供觸覺反饋（如果設備支持）
    function provideFeedback() {
        try {
            if (navigator && navigator.vibrate) {
                navigator.vibrate(30); // 短暫振動30ms
            }
        } catch (error) {
            // 不阻止應用繼續運行
            console.warn("觸覺反饋不可用:", error);
        }
    }
    
    // 優化的屏幕切換函數
    function switchScreen(fromScreen, toScreen) {
        try {
            // 檢查動畫狀態
            if (!beginAnimation(document.querySelector('.container'), 'slide-up')) {
                return;
            }
            
            // 添加離開動畫
            fromScreen.classList.add('fade-out');
            
            // 設置適當延遲以確保動畫流暢
            setTimeout(() => {
                // 切換屏幕顯示狀態
                fromScreen.classList.remove('active', 'fade-out');
                
                // 強制重排以確保動畫效果
                void toScreen.offsetWidth;
                
                // 添加進入動畫
                toScreen.classList.add('active', 'fade-in');
                
                // 動畫完成後清理類
                setTimeout(() => {
                    toScreen.classList.remove('fade-in');
                    endAnimation();
                }, 600);
            }, 500);
        } catch (error) {
            console.error("屏幕切換出錯:", error);
            // 出錯時確保基本功能正常
            fromScreen.classList.remove('active');
            toScreen.classList.add('active');
            endAnimation();
        }
    }
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', function() {
        try {
            console.log("點擊開始測驗");
            provideFeedback();
            switchScreen(DOM.containers.intro, DOM.containers.test);
            setTimeout(() => {
                renderQuestion();
            }, 100);
        } catch (error) {
            console.error("開始測驗時出錯:", error);
            alert("開始測驗時出錯，請刷新頁面重試");
        }
    });
    
    // 重新開始測驗 - 導航回首頁
    DOM.buttons.restart.addEventListener('click', function() {
        try {
            // 提供觸覺反饋
            provideFeedback();
            
            // 重置測驗狀態
            currentQuestionIndex = 0;
            userAnswers.length = 0;
            previousProgress = 0;
            
            // 重置DOM元素
            DOM.elements.progressFill.style.width = '0%';
            
            // 切換到首頁
            switchScreen(DOM.containers.result, DOM.containers.intro);
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("重新開始測驗時出錯:", error);
            alert("重新開始測驗時出錯，請刷新頁面重試");
        }
    });
    
    // 優化的問題渲染函數
    function renderQuestion() {
        try {
            // 防止動畫重疊
            if (isAnimating) {
                console.log("動畫進行中，忽略渲染請求");
                return;
            }
            
            beginAnimation(DOM.elements.questionContainer, 'slide-down');
            
            const question = questions[currentQuestionIndex];
            const questionNumber = currentQuestionIndex + 1;
            const bgImageUrl = `./images/Q${questionNumber}.webp`;
            
            // 舊內容淡出
            DOM.elements.questionText.classList.add('fade-out');
            DOM.elements.optionsContainer.classList.add('fade-out');
            
            // 添加背景加載狀態
            DOM.elements.questionContainer.classList.add('loading-bg');
            
            // 使用定時器確保動畫順序
            setTimeout(() => {
                // 更新問題文本
                const questionTextWithoutNumber = question.question.replace(/^\d+\.\s*/, '');
                DOM.elements.questionText.textContent = questionTextWithoutNumber;
                
                // 構建選項HTML
                let optionsHTML = '';
                question.options.forEach((option, index) => {
                    const isSelected = userAnswers[currentQuestionIndex] === index;
                    optionsHTML += `
                    <div class="option ${isSelected ? 'selected' : ''}" data-index="${index}">
                        ${option.text}
                    </div>`;
                });
                DOM.elements.optionsContainer.innerHTML = optionsHTML;
                
                // 預加載並設置背景圖片
                loadBackgroundImage(bgImageUrl).then(() => {
                    // 移除淡出類和添加淡入類
                    DOM.elements.questionText.classList.remove('fade-out');
                    DOM.elements.optionsContainer.classList.remove('fade-out');
                    DOM.elements.questionText.classList.add('fade-in');
                    DOM.elements.optionsContainer.classList.add('fade-in');
                    
                    // 為選項添加事件監聽器
                    document.querySelectorAll('.option').forEach(option => {
                        option.addEventListener('click', handleOptionClick);
                    });
                    
                    // 更新進度條
                    updateProgressBar();
                    
                    // 清理動畫類
                    setTimeout(() => {
                        DOM.elements.questionText.classList.remove('fade-in');
                        DOM.elements.optionsContainer.classList.remove('fade-in');
                        endAnimation();
                    }, 600);
                });
            }, 300);
        } catch (error) {
            console.error("渲染問題時出錯:", error);
            // 確保動畫狀態重置
            DOM.elements.questionContainer.classList.remove('loading-bg');
            endAnimation();
        }
    }
    
    // 加載背景圖片並處理過渡效果
    function loadBackgroundImage(url) {
        return new Promise((resolve, reject) => {
            try {
                // 先嘗試使用緩存
                if (imageCache[url]) {
                    console.log(`使用緩存圖片: ${url}`);
                    DOM.elements.questionContainer.style.backgroundImage = `url('${url}')`;
                    
                    // 短暫延遲以確保CSS過渡效果
                    setTimeout(() => {
                        DOM.elements.questionContainer.classList.remove('loading-bg');
                        DOM.elements.questionContainer.classList.add('bg-loaded');
                        
                        // 動畫完成後移除加載類
                        setTimeout(() => {
                            DOM.elements.questionContainer.classList.remove('bg-loaded');
                            resolve();
                        }, 500);
                    }, 50);
                    return;
                }
                
                // 如果沒有緩存，加載新圖片
                preloadImage(url)
                    .then(img => {
                        DOM.elements.questionContainer.style.backgroundImage = `url('${url}')`;
                        
                        // 短暫延遲以確保CSS過渡效果
                        setTimeout(() => {
                            DOM.elements.questionContainer.classList.remove('loading-bg');
                            DOM.elements.questionContainer.classList.add('bg-loaded');
                            
                            // 動畫完成後移除加載類
                            setTimeout(() => {
                                DOM.elements.questionContainer.classList.remove('bg-loaded');
                                resolve();
                            }, 500);
                        }, 50);
                    })
                    .catch(err => {
                        console.error("背景圖片加載錯誤:", err);
                        // 即使圖片加載失敗，也要繼續
                        DOM.elements.questionContainer.classList.remove('loading-bg');
                        resolve();
                    });
            } catch (error) {
                console.error("加載背景圖片時出錯:", error);
                DOM.elements.questionContainer.classList.remove('loading-bg');
                resolve(); // 即使出錯也繼續
            }
        });
    }
    
    // 處理選項點擊
    function handleOptionClick(e) {
        try {
            // 防止動畫重疊或選項重複點擊
            if (isAnimating) {
                return;
            }
            
            // 設置動畫狀態
            beginAnimation(DOM.elements.questionContainer, 'slide-up');
            
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
            
            // 提供觸覺反饋
            provideFeedback();
            
            // 更新選項樣式
            document.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            targetElement.classList.add('selected');
            
            // 淡出當前內容
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
                        endAnimation(); // 重置動畫狀態
                    }
                }
            }, 600);
        } catch (error) {
            console.error("處理選項點擊時出錯:", error);
            endAnimation(); // 確保動畫狀態重置
        }
    }
    
    // 更新進度條
    function updateProgressBar() {
        try {
            const currentProgress = ((currentQuestionIndex + 1) / questions.length) * 100;
            
            // 設置CSS變量以供動畫使用
            DOM.elements.progressFill.style.setProperty('--progress-from', `${previousProgress}%`);
            DOM.elements.progressFill.style.setProperty('--progress-to', `${currentProgress}%`);
            
            // 添加動畫類
            DOM.elements.progressFill.classList.add('animate');
            
            // 設置當前進度
            DOM.elements.progressFill.style.width = `${currentProgress}%`;
            
            // 更新進度文本
            DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
            
            // 保存當前進度以供下次動畫使用
            previousProgress = currentProgress;
            
            // 動畫完成後移除動畫類
            setTimeout(() => {
                DOM.elements.progressFill.classList.remove('animate');
            }, 500);
        } catch (error) {
            console.error("更新進度條時出錯:", error);
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
    
    // 顯示結果
    function showResult() {
        try {
            // 計算結果
            const result = calculateResult();
            
            // 準備結果內容
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
            
            // 切換到結果頁面
            switchScreen(DOM.containers.test, DOM.containers.result);
            
            // 確保結果容器可滾動
            document.body.style.overflow = 'auto';
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error);
            alert("顯示結果時出錯，請重新嘗試測驗");
            endAnimation(); // 重置動畫狀態
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
            // 提供觸覺反饋
            provideFeedback();
            
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
});