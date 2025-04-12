// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 檢查DOM元素是否存在
    const containers = {
        intro: document.getElementById('intro-container'),
        test: document.getElementById('test-container'),
        result: document.getElementById('result-container')
    };
    
    const buttons = {
        start: document.getElementById('start-test'),
        prev: document.getElementById('prev-btn'),
        next: document.getElementById('next-btn'),
        restart: document.getElementById('restart-btn')
    };
    
    // 檢查核心元素
    if (!containers.intro || !containers.test || !containers.result) {
        console.error("關鍵容器元素缺失:", 
            !containers.intro ? "intro-container" : "",
            !containers.test ? "test-container" : "",
            !containers.result ? "result-container" : "");
    }
    
    if (!buttons.start || !buttons.prev || !buttons.next || !buttons.restart) {
        console.error("關鍵按鈕元素缺失:", 
            !buttons.start ? "start-test" : "",
            !buttons.prev ? "prev-btn" : "",
            !buttons.next ? "next-btn" : "",
            !buttons.restart ? "restart-btn" : "");
    }

    // 保存元素引用，避免重複獲取
    const DOM = {
        containers: {
            intro: document.getElementById('intro-container'),
            test: document.getElementById('test-container'),
            result: document.getElementById('result-container')
        },
        elements: {
            questionContainer: document.getElementById('question-container'),
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
            prev: document.getElementById('prev-btn'),
            next: document.getElementById('next-btn'),
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
    
    // 開始測驗
    DOM.buttons.start.addEventListener('click', () => {
        DOM.containers.intro.classList.remove('active');
        DOM.containers.test.classList.add('active');
        renderQuestion();
    });
    
    // 重新開始測驗
    DOM.buttons.restart.addEventListener('click', () => {
        currentQuestionIndex = 0;
        userAnswers.length = 0;
        DOM.containers.result.classList.remove('active');
        DOM.containers.test.classList.add('active');
        renderQuestion();
        updateNavigationButtons();
        updateProgressBar();
    });
    
    // 渲染當前問題
    function renderQuestion() {
        const question = questions[currentQuestionIndex];
        
        let optionsHTML = '';
        question.options.forEach((option, index) => {
            const isSelected = userAnswers[currentQuestionIndex] === index;
            optionsHTML += `
            <div class="option ${isSelected ? 'selected' : ''}" data-index="${index}">
                ${option.text}
            </div>`;
        });
        
        DOM.elements.questionContainer.innerHTML = `
            <div class="question">${question.question}</div>
            <div class="options">${optionsHTML}</div>
        `;
        
        // 為選項添加事件監聽器
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => {
                // 確保點擊的是選項元素本身，而不是子元素
                const targetElement = e.target.closest('.option');
                if (!targetElement) return;
                
                const optionIndex = parseInt(targetElement.dataset.index);
                userAnswers[currentQuestionIndex] = optionIndex;
                
                console.log(`問題 ${currentQuestionIndex+1} 選擇了選項 ${optionIndex+1}, 類型: ${questions[currentQuestionIndex].options[optionIndex].type}`);
                
                // 更新選項樣式
                document.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                targetElement.classList.add('selected');
                
                // 啟用下一步按鈕
                DOM.buttons.next.disabled = false;
            });
        });
        
        updateProgressBar();
    }
    
    // 更新進度條
    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        DOM.elements.progressFill.style.width = `${progress}%`;
        DOM.elements.progressText.textContent = `問題 ${currentQuestionIndex + 1}/${questions.length}`;
    }
    
    // 更新導航按鈕狀態
    function updateNavigationButtons() {
        DOM.buttons.prev.disabled = currentQuestionIndex === 0;
        
        if (currentQuestionIndex === questions.length - 1) {
            DOM.buttons.next.textContent = '查看結果';
        } else {
            DOM.buttons.next.textContent = '下一題';
        }
        
        // 如果當前問題已經回答過，則啟用下一步按鈕
        DOM.buttons.next.disabled = userAnswers[currentQuestionIndex] === undefined;
    }
    
    // 上一題
    DOM.buttons.prev.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
            updateNavigationButtons();
        }
    });
    
    // 下一題或顯示結果
    DOM.buttons.next.addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
            updateNavigationButtons();
        } else {
            console.log("已完成所有問題，準備顯示結果");
            // 計算結果並顯示
            try {
                console.log("用戶選擇總覽:", userAnswers);
                showResult();
            } catch (error) {
                console.error("顯示結果時發生錯誤:", error.message, error.stack);
                alert("顯示結果時出錯，請重新嘗試測驗或聯繫開發者");
            }
        }
    });
    
    // 计算结果
    function calculateResult() {
        try {
            // 初始化各类型的得分
            const typeScores = {
                'A': 0, // 思辨抽离
                'B': 0, // 情感共鸣
                'C': 0, // 人文观察
                'D': 0, // 自我叙事
                'E': 0  // 即兴演出
            };
            
            // 记录日志
            console.log("计算结果 - 用户选择:", userAnswers);
            
            // 计算每种类型的得分
            userAnswers.forEach((answerIndex, questionIndex) => {
                if (answerIndex !== undefined && questionIndex < questions.length) {
                    const question = questions[questionIndex];
                    if (question && question.options && question.options[answerIndex]) {
                        const selectedType = question.options[answerIndex].type;
                        if (typeScores.hasOwnProperty(selectedType)) {
                            typeScores[selectedType]++;
                            console.log(`问题 ${questionIndex+1}: 选择 ${selectedType} 类型，得分 +1`);
                        }
                    }
                }
            });
            
            // 计算总得分（应该是11分）
            const totalScore = Object.values(typeScores).reduce((sum, score) => sum + score, 0);
            console.log("特质得分统计:", typeScores, "总分:", totalScore);
            
            // 将得分保存，以便在结果页面显示
            window.finalTypeScores = typeScores;

            // ========== 增强的同分检测逻辑 ==========
            
            // 1. 检查是否有四种类型得分相同
            // 统计每个分数出现的次数
            const scoreFrequency = {};
            for (const type in typeScores) {
                const score = typeScores[type];
                scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
            }
            
            console.log("分数频率分布:", scoreFrequency);
            
            // 检查是否有四种类型得分相同（无论是否为最高分）
            for (const score in scoreFrequency) {
                if (scoreFrequency[score] === 4) {
                    console.log(`检测到四种类型得分相同(${score}分)，触发特殊结果`);
                    return results["SPECIAL"];
                }
            }
            
            // 2. 寻找得分最高的类型(可能有多个)
            let maxScore = 0;
            let highestTypes = [];
            
            for (const type in typeScores) {
                if (typeScores[type] > maxScore) {
                    maxScore = typeScores[type];
                    highestTypes = [type];
                } else if (typeScores[type] === maxScore) {
                    highestTypes.push(type);
                }
            }
            
            console.log("最高分类型:", highestTypes, "分数:", maxScore);
            
            // 3. 如果有三个或更多类型得分相同且为最高分，返回特殊结果
            if (highestTypes.length >= 3) {
                console.log(`${highestTypes.length}种最高分类型同分，返回特殊结果: 灵魂图书管理员`);
                return results["SPECIAL"];
            }
            
            // 4. 如果有两个类型同分且为最高分，使用单一决胜题（问题10）
            if (highestTypes.length === 2) {
                console.log("两种类型同分，启动简化决胜机制（问题10+2分）");
                
                // 仅使用问题10作为决胜题
                const tiebreakQuestionIndex = 9; // 问题10的索引
                const tiebreakAnswer = userAnswers[tiebreakQuestionIndex];
                
                if (tiebreakAnswer !== undefined) {
                    const tiebreakType = questions[tiebreakQuestionIndex].options[tiebreakAnswer].type;
                    console.log(`决胜题 问题10 选择: ${tiebreakType}`);
                    
                    // 创建分数副本，用于决胜加分
                    const tiebreakScores = { ...typeScores };
                    
                    // 为决胜题选择的类型加2分
                    tiebreakScores[tiebreakType] += 2;
                    console.log(`决胜加分: 类型 ${tiebreakType} +2分`);
                    console.log("决胜加分后分数:", tiebreakScores);
                    
                    // 重新寻找最高分类型
                    let newMaxScore = 0;
                    let newHighestTypes = [];
                    
                    for (const type in tiebreakScores) {
                        if (tiebreakScores[type] > newMaxScore) {
                            newMaxScore = tiebreakScores[type];
                            newHighestTypes = [type];
                        } else if (tiebreakScores[type] === newMaxScore) {
                            newHighestTypes.push(type);
                        }
                    }
                    
                    console.log("决胜后最高分类型:", newHighestTypes, "分数:", newMaxScore);
                    
                    // 如果决胜后仍有多个类型同分，且都是原来同分的类型，则选择第一个
                    // 如果决胜后只有一个最高分类型，不管是否为原同分类型，都选择它
                    if (newHighestTypes.length === 1) {
                        const resultType = newHighestTypes[0];
                        console.log(`决胜成功! 最终结果类型: ${resultType}`);
                        return results[resultType];
                    } else {
                        // 如果所有最高分类型中包含原同分类型，选择第一个原同分类型
                        for (const type of newHighestTypes) {
                            if (highestTypes.includes(type)) {
                                console.log(`决胜后仍有同分，选择原同分类型中的第一个: ${type}`);
                                return results[type];
                            }
                        }
                        // 如果最高分类型都不在原同分类型中，选择原第一个最高分类型
                        console.log(`决胜后出现新的同分情况，选择原同分类型中的第一个: ${highestTypes[0]}`);
                        return results[highestTypes[0]];
                    }
                }
            }
            
            // 5. 如果没有同分或决胜题没有解决同分，选择第一个最高分类型
            const resultType = highestTypes[0];
            console.log("最终结果类型:", resultType);
            
            // 确保返回有效结果
            if (!results[resultType]) {
                console.error("未找到匹配的结果类型:", resultType);
                return results['A']; // 返回默认结果
            }
            
            return results[resultType];
        } catch (error) {
            console.error("计算结果时发生错误:", error);
            return results['A']; // 发生错误时返回默认结果
        }
    }
    
    // 显示结果
    function showResult() {
        try {
            console.log("准备显示结果...");
            
            // 确保结果容器可见性
            document.body.style.overflow = 'auto'; // 确保滚动条正常
            
            const result = calculateResult();
            console.log("计算得到的结果:", result);
            
            if (!result) {
                console.error("结果未定义");
                alert("计算结果时出错，请重新尝试测验");
                return;
            }
            
            // 强制DOM刷新和显示
            window.setTimeout(() => {
                try {
                    // 设置结果标题和副标题
                    if (DOM.elements.resultTitle) {
                        // 特殊处理《灵魂图书管理员》类型的标题
                        if (result.title.includes('靈魂圖書管理員')) {
                            DOM.elements.resultTitle.textContent = `你是：${result.title}`;
                        } else {
                            DOM.elements.resultTitle.textContent = `你的靈魂之書是：${result.title}`;
                        }
                        console.log("已设置结果标题:", DOM.elements.resultTitle.textContent);
                    } else {
                        console.error("result-title 元素不存在");
                    }
                    
                    if (DOM.elements.resultSubtitle) {
                        DOM.elements.resultSubtitle.textContent = result.subtitle || '';
                        console.log("已设置副标题");
                    } else {
                        console.error("result-subtitle 元素不存在");
                    }
                    
                    // 设置结果描述
                    if (DOM.elements.resultDescription) {
                        DOM.elements.resultDescription.textContent = result.description || '';
                        console.log("已设置描述");
                    } else {
                        console.error("result-description 元素不存在");
                    }
                    
                    // 设置书本特质（根据所有选择的特质评分）
                    if (DOM.elements.traitsContainer) {
                        DOM.elements.traitsContainer.innerHTML = '';
                        
                        // 使用刚刚存储的特质得分
                        const typeScores = window.finalTypeScores || {
                            'A': 0, // 思辨抽离
                            'B': 0, // 情感共鸣
                            'C': 0, // 人文观察
                            'D': 0, // 自我叙事
                            'E': 0  // 即兴演出
                        };
                        
                        // 使用從data.json加載的特質名稱
                        console.log("构建特质星级显示，原始分数:", typeScores);
                        
                        // 特殊处理《灵魂图书管理员》的特质显示
                        if (result.title.includes('靈魂圖書管理員')) {
                            Object.keys(traitNames).forEach(type => {
                                const traitElement = document.createElement('div');
                                traitElement.className = 'trait-item';
                                
                                const traitName = document.createElement('span');
                                traitName.className = 'trait-name';
                                traitName.textContent = traitNames[type];
                                
                                const traitStars = document.createElement('span');
                                traitStars.className = 'trait-stars';
                                traitStars.textContent = '★'.repeat(3) + '☆'.repeat(2); // 所有特质均为3星
                                
                                traitElement.appendChild(traitName);
                                traitElement.appendChild(traitStars);
                                DOM.elements.traitsContainer.appendChild(traitElement);
                            });
                            console.log("已设置特殊结果特质");
                        } else {
                            // 为每种特质创建评分显示
                            Object.keys(traitNames).forEach(type => {
                                const score = typeScores[type] || 0;
                                
                                // 根据得分计算星星数
                                // 使用更合理的方式计算星级：最高分11题，映射到1-5星
                                let normalizedScore;
                                if (score === 0) {
                                    normalizedScore = 1; // 0分设为1星
                                } else if (score >= 1 && score <= 2) {
                                    normalizedScore = 2; // 1-2分设为2星
                                } else if (score >= 3 && score <= 4) {
                                    normalizedScore = 3; // 3-4分设为3星
                                } else if (score >= 5 && score <= 6) {
                                    normalizedScore = 4; // 5-6分设为4星
                                } else {
                                    normalizedScore = 5; // 7分及以上设为5星
                                }
                                
                                console.log(`${traitNames[type]} 原始分数: ${score}, 转换为 ${normalizedScore} 星`);
                                
                                const traitElement = document.createElement('div');
                                traitElement.className = 'trait-item';
                                
                                const traitName = document.createElement('span');
                                traitName.className = 'trait-name';
                                traitName.textContent = traitNames[type];
                                
                                const traitStars = document.createElement('span');
                                traitStars.className = 'trait-stars';
                                traitStars.textContent = '★'.repeat(normalizedScore) + '☆'.repeat(5 - normalizedScore);
                                
                                traitElement.appendChild(traitName);
                                traitElement.appendChild(traitStars);
                                DOM.elements.traitsContainer.appendChild(traitElement);
                            });
                            console.log("已设置正常结果特质");
                        }
                    } else {
                        console.error("traits-container 元素不存在");
                    }
                    
                    // 设置相似和互补书籍
                    if (DOM.elements.similarBooks) {
                        if (result.similar && Array.isArray(result.similar)) {
                            DOM.elements.similarBooks.innerHTML = result.similar.map(book => `<p>${book}</p>`).join('');
                            console.log("已设置相似书籍");
                        } else {
                            DOM.elements.similarBooks.innerHTML = '<p>無相似書籍資料</p>';
                        }
                    } else {
                        console.error("similar-books 元素不存在");
                    }
                    
                    if (DOM.elements.complementaryBooks) {
                        if (result.complementary && Array.isArray(result.complementary)) {
                            DOM.elements.complementaryBooks.innerHTML = result.complementary.map(book => `<p>${book}</p>`).join('');
                            console.log("已设置互补书籍");
                        } else {
                            DOM.elements.complementaryBooks.innerHTML = '<p>無互補書籍資料</p>';
                        }
                    } else {
                        console.error("complementary-books 元素不存在");
                    }
                    
                    // 设置分享文字
                    if (DOM.elements.shareText) {
                        DOM.elements.shareText.textContent = result.shareText || '';
                        console.log("已设置分享文字");
                    } else {
                        console.error("share-text 元素不存在");
                    }
                    
                    // 显示结果容器 - 强制处理
                    if (DOM.containers.test) {
                        DOM.containers.test.style.display = 'none';
                        DOM.containers.test.classList.remove('active');
                        console.log("已隐藏测验容器");
                    } else {
                        console.error("test-container 元素不存在");
                    }
                    
                    if (DOM.containers.result) {
                        DOM.containers.result.style.display = 'block';
                        DOM.containers.result.classList.add('active');
                        console.log("已显示结果容器");
                    } else {
                        console.error("result-container 元素不存在");
                    }
                    
                    // 强制重绘
                    DOM.containers.result.offsetHeight;
                    
                    console.log("结果显示完成，强制页面重绘");
                    
                    // 滚动到顶部
                    window.scrollTo(0, 0);
                } catch (innerError) {
                    console.error("DOM操作过程中发生错误:", innerError.message, innerError.stack);
                    alert("显示结果时出错，请刷新页面重试");
                }
            }, 100); // 延迟100ms确保DOM更新
        } catch (error) {
            console.error("显示结果时发生错误:", error.message, error.stack);
            alert("显示结果时出错，请重新尝试测验");
        }
    }
    
    // 複製分享文字
    DOM.buttons.copy.addEventListener('click', () => {
        const shareText = DOM.elements.shareText.textContent;
        navigator.clipboard.writeText(shareText).then(() => {
            DOM.buttons.copy.textContent = '已複製!';
            setTimeout(() => {
                DOM.buttons.copy.textContent = '複製';
            }, 2000);
        }).catch(err => {
            console.error('無法複製: ', err);
        });
    });
    
    // 初始化
    updateNavigationButtons();
});