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
            questionImageContainer: document.getElementById('question-image-container'),
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
    
    // 從 data.json 獲取測驗數據
    const questions = testData.questions;
    const results = testData.results;
    const traitNames = testData.traitNames;
    
    // 跟踪當前問題索引和用戶選擇
    let currentQuestionIndex = 0;
    const userAnswers = [];
    
    // 設置視口高度 - 確保移動設備上正確顯示100vh
    function setViewportHeight() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    // 在初始化和窗口大小調整時設置視口高度
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', () => {
        DOM.containers.intro.classList.remove('active');
        DOM.containers.test.classList.add('active');
        
        // 強制頁面重排以確保過渡效果平滑
        DOM.containers.test.offsetHeight;
        
        renderQuestion();
    });
    
    // 重新開始測驗
    DOM.buttons.restart.addEventListener('click', () => {
        currentQuestionIndex = 0;
        userAnswers.length = 0;
        DOM.containers.result.classList.remove('active');
        
        // 重置DOM元素
        DOM.elements.progressFill.style.width = '0%';
        
        // 短暫延遲以確保過渡效果
        setTimeout(() => {
            DOM.containers.test.classList.add('active');
            renderQuestion();
            
            // 滾動到頂部
            window.scrollTo(0, 0);
        }, 100);
    });
    
    // 渲染當前問題 - 修改背景图片加载逻辑
    function renderQuestion() {
        const question = questions[currentQuestionIndex];
        
        // 設置問題文本 - 移除標號以增加沉浸感
        const questionTextWithoutNumber = question.question.replace(/^\d+\.\s*/, '');
        DOM.elements.questionText.textContent = questionTextWithoutNumber;
        
        // 修改为基于问题序号选择背景图片
        const questionNumber = currentQuestionIndex + 1; // 问题索引从0开始，+1得到问题编号
        const backgroundImage = `./images/Q${questionNumber}.png`;
        
        // 使用淡入淡出效果更換背景圖片
        DOM.elements.questionImageContainer.style.opacity = '0.7';
        setTimeout(() => {
            DOM.elements.questionImageContainer.style.backgroundImage = `url('${backgroundImage}')`;
            DOM.elements.questionImageContainer.style.opacity = '1';
        }, 300);
        
        // 渲染選項 - 使用淡入效果
        DOM.elements.optionsContainer.style.opacity = '0.7';
        setTimeout(() => {
            let optionsHTML = '';
            question.options.forEach((option, index) => {
                const isSelected = userAnswers[currentQuestionIndex] === index;
                optionsHTML += `
                <div class="option ${isSelected ? 'selected' : ''}" data-index="${index}" style="animation-delay: ${index * 0.1}s">
                    ${option.text}
                </div>`;
            });
            DOM.elements.optionsContainer.innerHTML = optionsHTML;
            DOM.elements.optionsContainer.style.opacity = '1';
            
            // 為選項添加事件監聽器
            document.querySelectorAll('.option').forEach(option => {
                option.addEventListener('click', handleOptionClick);
            });
        }, 300);
        
        updateProgressBar();
    }
    
    // 獲取問題選項中的主導類型 - 保留此函数用于计算结果
    function getDominantType(options) {
        const typeCounts = {};
        
        // 計算每種類型的數量
        options.forEach(option => {
            const type = option.primary; // 使用主要type(primary)
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        // 找出出現最多的類型
        let maxCount = 0;
        let dominantType = 'default';
        
        for (const type in typeCounts) {
            if (typeCounts[type] > maxCount) {
                maxCount = typeCounts[type];
                dominantType = type;
            }
        }
        
        return dominantType;
    }
    
    // 處理選項點擊
    function handleOptionClick(e) {
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
        setTimeout(() => {
            // 判斷是否為最後一題
            if (currentQuestionIndex < questions.length - 1) {
                // 如果不是最後一題，自動前進到下一題
                currentQuestionIndex++;
                renderQuestion();
            } else {
                // 如果是最後一題，則顯示結果
                console.log("已完成所有問題，準備顯示結果");
                
                // 使用淡出效果
                DOM.containers.test.style.opacity = '0';
                setTimeout(() => {
                    DOM.containers.test.classList.remove('active');
                    try {
                        showResult();
                    } catch (error) {
                        console.error("顯示結果時發生錯誤:", error);
                        alert("顯示結果時出錯，請重新嘗試測驗");
                    }
                }, 500);
            }
        }, 300); // 延遲300毫秒
    }
    
    // 更新進度條
    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
    }
    
    // 计算结果函数和其他函数保持不变
    // ...
    
    // 以下是其他代码，根据您的需要保留
});