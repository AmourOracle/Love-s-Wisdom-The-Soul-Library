// 在頁面載入完成後運行
document.addEventListener('DOMContentLoaded', function() {
    console.log("頁面已載入，測驗初始化中...");
    
    // 立即隱藏導航按鈕
    const navigateButtons = document.querySelector('.navigate-btns');
    if (navigateButtons) {
        navigateButtons.style.display = 'none';
    }
    
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
        
        // 為選項添加事件監聽器 - 修改此部分以自動進入下一題
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
                
                // 添加延遲，讓用戶能看到選中效果
                setTimeout(() => {
                    // 判斷是否為最後一題
                    if (currentQuestionIndex < questions.length - 1) {
                        // 如果不是最後一題，自動前進到下一題
                        currentQuestionIndex++;
                        renderQuestion();
                        updateProgressBar();
                    } else {
                        // 如果是最後一題，則顯示結果
                        console.log("已完成所有問題，準備顯示結果");
                        try {
                            console.log("用戶選擇總覽:", userAnswers);
                            showResult();
                        } catch (error) {
                            console.error("顯示結果時發生錯誤:", error.message, error.stack);
                            alert("顯示結果時出錯，請重新嘗試測驗或聯繫開發者");
                        }
                    }
                }, 300); // 延遲300毫秒
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
    
// 計算結果函數
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
        
        // 計算每種類型的得分
        userAnswers.forEach((answerIndex, questionIndex) => {
            if (answerIndex !== undefined && questionIndex < questions.length) {
                const question = questions[questionIndex];
                if (question && question.options && question.options[answerIndex]) {
                    const selectedType = question.options[answerIndex].type;
                    if (typeScores.hasOwnProperty(selectedType)) {
                        typeScores[selectedType]++;
                        console.log(`問題 ${questionIndex+1}: 選擇 ${selectedType} 類型，得分 +1`);
                    }
                }
            }
        });
        
        // 計算總得分（應該是11分）
        const totalScore = Object.values(typeScores).reduce((sum, score) => sum + score, 0);
        console.log("特質得分統計:", typeScores, "總分:", totalScore);
        
        // 將得分保存，以便在結果頁面顯示
        window.finalTypeScores = typeScores;
        
        // 1. 檢查是否有四種類型得分相同（無論是否為最高分）
        const scoreFrequency = {};
        for (const type in typeScores) {
            const score = typeScores[type];
            scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
        }
        
        console.log("分數頻率分布:", scoreFrequency);
        
        for (const score in scoreFrequency) {
            if (scoreFrequency[score] === 4) {
                console.log(`檢測到四種類型得分相同(${score}分)，觸發特殊結果`);
                return results["SPECIAL"];
            }
        }
        
        // 2. 尋找得分最高的類型(可能有多個)
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
        
        console.log("最高分類型:", highestTypes, "分數:", maxScore);
        
        // 3. 如果有三個或更多類型得分相同且為最高分，返回特殊結果
        if (highestTypes.length >= 3) {
            console.log(`${highestTypes.length}種最高分類型同分，返回特殊結果: 靈魂圖書管理員`);
            return results["SPECIAL"];
        }
        
        // 4. 如果只有一個最高分類型，直接返回結果
        if (highestTypes.length === 1) {
            const resultType = highestTypes[0];
            console.log("單一最高分類型:", resultType);
            return results[resultType];
        }
        
        // 5. 如果有兩個類型同分且為最高分，使用雙決勝題機制
        if (highestTypes.length === 2) {
            console.log("兩種類型同分，啟動雙決勝機制（問題10和問題11各+3分）");
            
            // 創建分數副本，用於決勝加分
            const tiebreakScores = { ...typeScores };
            
            // 第一決勝題（問題10）
            const tiebreakQuestion1Index = 9; // 問題10的索引
            const tiebreakAnswer1 = userAnswers[tiebreakQuestion1Index];
            
            if (tiebreakAnswer1 !== undefined) {
                const tiebreakType1 = questions[tiebreakQuestion1Index].options[tiebreakAnswer1].type;
                tiebreakScores[tiebreakType1] += 3;
                console.log(`第一決勝題（問題10）選擇: ${tiebreakType1} +3分`);
            }
            
            // 第二決勝題（問題11）
            const tiebreakQuestion2Index = 10; // 問題11的索引
            const tiebreakAnswer2 = userAnswers[tiebreakQuestion2Index];
            
            if (tiebreakAnswer2 !== undefined) {
                const tiebreakType2 = questions[tiebreakQuestion2Index].options[tiebreakAnswer2].type;
                tiebreakScores[tiebreakType2] += 3;
                console.log(`第二決勝題（問題11）選擇: ${tiebreakType2} +3分`);
            }
            
            console.log("雙決勝加分後分數:", tiebreakScores);
            
            // 重新尋找最高分類型
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
            
            console.log("雙決勝後最高分類型:", newHighestTypes, "分數:", newMaxScore);
            
            // 6. 決勝後結果處理
            // 檢查是否有三種或以上類型同為最高分
            if (newHighestTypes.length >= 3) {
                console.log(`決勝後有${newHighestTypes.length}種類型同為最高分，觸發特殊結果`);
                return results["SPECIAL"];
            }
            
            // 如果決勝後只有一個最高分類型
            if (newHighestTypes.length === 1) {
                const resultType = newHighestTypes[0];
                console.log(`決勝成功! 最終結果類型: ${resultType}`);
                return results[resultType];
            }
            
            // 7. 如果決勝後仍有兩種類型同分，使用多維度綜合決勝法
            if (newHighestTypes.length === 2) {
                console.log("雙決勝後仍有兩種類型同分，啟用多維度綜合決勝法");
                
                // 關鍵問題分析（使用問題1、5、8作為關鍵問題）
                const keyQuestions = [0, 4, 7]; // 問題1、5、8的索引
                const patternScore = {};
                
                newHighestTypes.forEach(type => {
                    patternScore[type] = 0;
                    keyQuestions.forEach(qIndex => {
                        if (userAnswers[qIndex] !== undefined && 
                            questions[qIndex].options[userAnswers[qIndex]].type === type) {
                            patternScore[type] += 1;
                            console.log(`關鍵問題${qIndex+1}選擇了${type}類型，模式得分+1`);
                        }
                    });
                });
                
                console.log("關鍵問題模式分析:", patternScore);
                
                // 檢查是否有明確的模式偏好
                const maxPatternScore = Math.max(...Object.values(patternScore));
                const hasPatternPreference = maxPatternScore > 0;
                
                if (hasPatternPreference) {
                    const patternWinners = newHighestTypes.filter(
                        type => patternScore[type] === maxPatternScore
                    );
                    
                    if (patternWinners.length === 1) {
                        const resultType = patternWinners[0];
                        console.log(`根據關鍵問題模式選擇: ${resultType} (關鍵問題得分: ${maxPatternScore})`);
                        return results[resultType];
                    }
                    
                    // 如果模式分析也同分，進行特質平衡分析
                    console.log("關鍵問題模式分析也同分，進行特質平衡分析");
                }
                
                // 特質平衡分析
                const balanceScores = {};
                
                newHighestTypes.forEach(type => {
                    let diffSum = 0;
                    Object.keys(typeScores).forEach(otherType => {
                        if (type !== otherType) {
                            diffSum += Math.abs(typeScores[type] - typeScores[otherType]);
                        }
                    });
                    balanceScores[type] = diffSum;
                });
                
                console.log("特質平衡分析:", balanceScores);
                
                // 選擇特質分佈最均衡的類型（差異和最小）
                const minBalanceScore = Math.min(...Object.values(balanceScores));
                const balanceWinners = newHighestTypes.filter(
                    type => balanceScores[type] === minBalanceScore
                );
                
                if (balanceWinners.length === 1) {
                    const resultType = balanceWinners[0];
                    console.log(`根據特質平衡度選擇: ${resultType} (平衡得分: ${minBalanceScore})`);
                    return results[resultType];
                }
                
                // 如果特質平衡分析也無法決出勝負，選擇第一個
                const resultType = balanceWinners[0];
                console.log(`所有決策方法均無法區分，選擇第一個: ${resultType}`);
                return results[resultType];
            }
        }
        
        // 保險處理：如果上述所有邏輯都未返回結果，選擇第一個最高分類型
        const resultType = highestTypes[0];
        console.log("使用默認處理，選擇第一個最高分類型:", resultType);
        
        // 確保返回有效結果
        if (!results[resultType]) {
            console.error("未找到匹配的結果類型:", resultType);
            return results['A']; // 返回默認結果
        }
        
        return results[resultType];
    } catch (error) {
        console.error("計算結果時發生錯誤:", error);
        return results['A']; // 發生錯誤時返回默認結果
    }
}
    
    // 顯示結果
    function showResult() {
        try {
            console.log("準備顯示結果...");
            
            // 確保結果容器可見性
            document.body.style.overflow = 'auto'; // 確保滾動條正常
            
            const result = calculateResult();
            console.log("計算得到的結果:", result);
            
            if (!result) {
                console.error("結果未定義");
                alert("計算結果時出錯，請重新嘗試測驗");
                return;
            }
            
            // 強制DOM刷新和顯示
            window.setTimeout(() => {
                try {
                    // 設置結果標題和副標題
                    if (DOM.elements.resultTitle) {
                        // 特殊處理《靈魂圖書管理員》類型的標題
                        if (result.title.includes('靈魂圖書管理員')) {
                            DOM.elements.resultTitle.textContent = `你是：${result.title}`;
                        } else {
                            DOM.elements.resultTitle.textContent = `你的靈魂之書是：${result.title}`;
                        }
                        console.log("已設置結果標題:", DOM.elements.resultTitle.textContent);
                    } else {
                        console.error("result-title 元素不存在");
                    }
                    
                    if (DOM.elements.resultSubtitle) {
                        DOM.elements.resultSubtitle.textContent = result.subtitle || '';
                        console.log("已設置副標題");
                    } else {
                        console.error("result-subtitle 元素不存在");
                    }
                    
                    // 設置結果描述
                    if (DOM.elements.resultDescription) {
                        DOM.elements.resultDescription.textContent = result.description || '';
                        console.log("已設置描述");
                    } else {
                        console.error("result-description 元素不存在");
                    }
                    
                    // 設置書本特質（根據所有選擇的特質評分）
                    if (DOM.elements.traitsContainer) {
                        DOM.elements.traitsContainer.innerHTML = '';
                        
                        // 使用剛剛存儲的特質得分
                        const typeScores = window.finalTypeScores || {
                            'A': 0, // 思辨抽離
                            'B': 0, // 情感共鳴
                            'C': 0, // 人文觀察
                            'D': 0, // 自我敘事
                            'E': 0  // 即興演出
                        };
                        
                        // 使用從data.json加載的特質名稱
                        console.log("構建特質星級顯示，原始分數:", typeScores);
                        
                        // 特殊處理《靈魂圖書管理員》的特質顯示
                        if (result.title.includes('靈魂圖書管理員')) {
                            Object.keys(traitNames).forEach(type => {
                                const traitElement = document.createElement('div');
                                traitElement.className = 'trait-item';
                                
                                const traitName = document.createElement('span');
                                traitName.className = 'trait-name';
                                traitName.textContent = traitNames[type];
                                
                                const traitStars = document.createElement('span');
                                traitStars.className = 'trait-stars';
                                traitStars.textContent = '★'.repeat(3) + '☆'.repeat(2); // 所有特質均為3星
                                
                                traitElement.appendChild(traitName);
                                traitElement.appendChild(traitStars);
                                DOM.elements.traitsContainer.appendChild(traitElement);
                            });
                            console.log("已設置特殊結果特質");
                        } else {
                            // 為每種特質創建評分顯示
                            Object.keys(traitNames).forEach(type => {
                                const score = typeScores[type] || 0;
                                
                                // 根據得分計算星星數
                                // 使用更合理的方式計算星級：最高分11題，映射到1-5星
                                let normalizedScore;
                                if (score === 0) {
                                    normalizedScore = 1; // 0分設為1星
                                } else if (score >= 1 && score <= 2) {
                                    normalizedScore = 2; // 1-2分設為2星
                                } else if (score >= 3 && score <= 4) {
                                    normalizedScore = 3; // 3-4分設為3星
                                } else if (score >= 5 && score <= 6) {
                                    normalizedScore = 4; // 5-6分設為4星
                                } else {
                                    normalizedScore = 5; // 7分及以上設為5星
                                }
                                
                                console.log(`${traitNames[type]} 原始分數: ${score}, 轉換為 ${normalizedScore} 星`);
                                
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
                            console.log("已設置正常結果特質");
                        }
                    } else {
                        console.error("traits-container 元素不存在");
                    }
                    
                    // 設置相似和互補書籍
                    if (DOM.elements.similarBooks) {
                        if (result.similar && Array.isArray(result.similar)) {
                            DOM.elements.similarBooks.innerHTML = result.similar.map(book => `<p>${book}</p>`).join('');
                            console.log("已設置相似書籍");
                        } else {
                            DOM.elements.similarBooks.innerHTML = '<p>無相似書籍資料</p>';
                        }
                    } else {
                        console.error("similar-books 元素不存在");
                    }
                    
                    if (DOM.elements.complementaryBooks) {
                        if (result.complementary && Array.isArray(result.complementary)) {
                            DOM.elements.complementaryBooks.innerHTML = result.complementary.map(book => `<p>${book}</p>`).join('');
                            console.log("已設置互補書籍");
                        } else {
                            DOM.elements.complementaryBooks.innerHTML = '<p>無互補書籍資料</p>';
                        }
                    } else {
                        console.error("complementary-books 元素不存在");
                    }
                    
                    // 設置分享文字
                    if (DOM.elements.shareText) {
                        DOM.elements.shareText.textContent = result.shareText || '';
                        console.log("已設置分享文字");
                    } else {
                        console.error("share-text 元素不存在");
                    }
                    
                    // 顯示結果容器 - 強制處理
                    if (DOM.containers.test) {
                        DOM.containers.test.style.display = 'none';
                        DOM.containers.test.classList.remove('active');
                        console.log("已隱藏測驗容器");
                    } else {
                        console.error("test-container 元素不存在");
                    }
                    
                    if (DOM.containers.result) {
                        DOM.containers.result.style.display = 'block';
                        DOM.containers.result.classList.add('active');
                        console.log("已顯示結果容器");
                    } else {
                        console.error("result-container 元素不存在");
                    }
                    
                    // 強制重繪
                    DOM.containers.result.offsetHeight;
                    
                    console.log("結果顯示完成，強制頁面重繪");
                    
                    // 滾動到頂部
                    window.scrollTo(0, 0);
                } catch (innerError) {
                    console.error("DOM操作過程中發生錯誤:", innerError.message, innerError.stack);
                    alert("顯示結果時出錯，請刷新頁面重試");
                }
            }, 100); // 延遲100ms確保DOM更新
        } catch (error) {
            console.error("顯示結果時發生錯誤:", error.message, error.stack);
            alert("顯示結果時出錯，請重新嘗試測驗");
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
});