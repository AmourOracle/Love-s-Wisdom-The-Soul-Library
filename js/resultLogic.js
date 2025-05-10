// resultLogic.js - 結果計算與顯示模組

import { stateManager, legacyState } from './state.js';
import { DOM } from './dom.js';
import { switchScreen } from './animation.js';

// 展示測驗結果
export function showResults(questions, userAnswers) {
    console.log("顯示結果頁面...");
    
    try {
        console.log("計算結果...");
        const resultData = calculateResult(questions, userAnswers);
        if (!resultData) throw new Error("結果計算失敗");
        
        console.log("準備結果數據...");
        if (prepareResultData(resultData, legacyState.finalScores)) {
            console.log("結果數據準備成功，切換到結果畫面...");
            // 解鎖 isTransitioning，讓 switchScreen 可以正確執行
            stateManager.unlock('isTransitioning');
            console.log("isTransitioning 解鎖 (showResults)");
            
            // 切換到結果畫面
            switchScreen('test', 'result')
                .then(() => console.log("結果頁面顯示完成"))
                .catch(err => console.error("切換到結果頁面時出錯:", err));
        } else {
            throw new Error("結果數據準備失敗");
        }
    } catch (error) {
        console.error("顯示結果時發生錯誤:", error);
        alert(`抱歉，顯示結果時發生錯誤: ${error.message} 請重試。`);
        
        // 確保解鎖所有狀態
        stateManager.unlock('isTransitioning');
        stateManager.unlock('isAnimating');
        
        switchScreen('test', 'intro').catch(err => console.error("返回介紹頁面時出錯:", err));
    }
}

// 結果計算函數
export function calculateResult(questions, userAnswers) { 
    console.log("計算測驗結果..."); 
    
    try { 
        const scores = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 }; 
        
        if (userAnswers.length !== questions.length) { 
            console.warn(`Answers (${userAnswers.length}) mismatch questions (${questions.length})! Padding...`); 
            for (let i = 0; i < questions.length; i++) { 
                if (userAnswers[i] === undefined) userAnswers[i] = 0; 
            } 
        } 
        
        userAnswers.forEach((answerIndex, questionIndex) => { 
            const question = questions[questionIndex]; 
            if (question?.options?.[answerIndex]?.scores) { 
                const optionScores = question.options[answerIndex].scores; 
                for (const type in optionScores) { 
                    if (scores.hasOwnProperty(type)) { 
                        scores[type] += optionScores[type]; 
                    } 
                } 
            } else { 
                console.warn(`Invalid data for Q${questionIndex + 1}, Option ${answerIndex}, skipping score.`); 
            } 
        }); 
        
        legacyState.finalScores = scores; 
        console.log("Final Scores:", legacyState.finalScores); 
        
        // 檢查是否符合特殊結果條件
        const resultType = determineResultType(scores, userAnswers, questions);
        return window.testData.results[resultType];
    } catch (error) { 
        console.error("Error calculating result:", error); 
        return window.testData.results['A']; 
    } 
}

// 決定結果類型
function determineResultType(scores, userAnswers, questions) {
    // 檢查特殊結果條件
    const scoreValues = Object.values(scores); 
    const scoreFrequency = {}; 
    
    scoreValues.forEach(score => { 
        const roundedScore = Math.round(score * 10) / 10; 
        scoreFrequency[roundedScore] = (scoreFrequency[roundedScore] || 0) + 1; 
    }); 
    
    for (const score in scoreFrequency) { 
        if (scoreFrequency[score] >= 4) { 
            console.log("SPECIAL result condition (4+ same scores)"); 
            return "SPECIAL"; 
        } 
    } 
    
    // 尋找最高分
    let maxScore = -Infinity; 
    let highestTypes = []; 
    
    for (const type in scores) { 
        if (Math.abs(scores[type] - maxScore) < 0.01) { 
            highestTypes.push(type); 
        } else if (scores[type] > maxScore) { 
            maxScore = scores[type]; 
            highestTypes = [type]; 
        } 
    } 
    
    console.log("Highest type(s):", highestTypes, "Score:", maxScore); 
    
    // 確定最終結果
    if (highestTypes.length === 1) { 
        return highestTypes[0]; 
    } 
    
    if (highestTypes.length >= 3) { 
        console.log("SPECIAL result condition (3+ tied max scores)"); 
        return "SPECIAL"; 
    } 
    
    if (highestTypes.length === 2) { 
        console.log("Tiebreaker needed (2 types tied)"); 
        
        const tiebreakQuestionIndex = 8; 
        if (userAnswers[tiebreakQuestionIndex] === undefined) { 
            console.warn("Tiebreaker question unanswered, selecting first tied type."); 
            return highestTypes[0]; 
        } 
        
        const tiebreakAnswerIndex = userAnswers[tiebreakQuestionIndex]; 
        const tiebreakPrimaryType = questions[tiebreakQuestionIndex]?.options?.[tiebreakAnswerIndex]?.primary; 
        
        console.log(`Tiebreaker Q9 primary type: ${tiebreakPrimaryType}`); 
        
        if (tiebreakPrimaryType && highestTypes.includes(tiebreakPrimaryType)) { 
            console.log(`Tiebreaker success: ${tiebreakPrimaryType}`); 
            return tiebreakPrimaryType; 
        } else { 
            console.log("Tiebreaker failed or type not in tie, selecting first tied type."); 
            return highestTypes[0]; 
        } 
    } 
    
    console.warn("Scoring logic fallback, returning default A"); 
    return 'A';
}

// 準備結果數據
function prepareResultData(resultData, finalScores) { 
    console.log("Preparing result data..."); 
    
    if (!resultData || !DOM.elements.resultTitle || !DOM.elements.resultSubtitle || !DOM.elements.resultDescription || !DOM.elements.traitsContainer || !DOM.elements.similarBooks || !DOM.elements.complementaryBooks || !DOM.elements.shareText) { 
        console.error("Failed to prepare result data: Missing DOM elements."); 
        return false; 
    } 
    
    try { 
        // 結果標題根據是否為特殊結果顯示不同文字
        DOM.elements.resultTitle.textContent = resultData.title ? (resultData.title.includes('管理員') ? `你是：${resultData.title}` : `你的靈魂之書是：${resultData.title}`) : '結果未知'; 
        DOM.elements.resultSubtitle.textContent = resultData.subtitle || ''; 
        DOM.elements.resultDescription.textContent = resultData.description || '無法載入描述。'; 
        
        // 使用 DocumentFragment 優化特質渲染
        renderTraits(finalScores, resultData);
        
        // 使用 DocumentFragment 優化書籍列表渲染
        DOM.elements.similarBooks.innerHTML = '';
        DOM.elements.similarBooks.appendChild(createBookList(resultData.similar));
        
        DOM.elements.complementaryBooks.innerHTML = '';
        DOM.elements.complementaryBooks.appendChild(createBookList(resultData.complementary));
        
        DOM.elements.shareText.textContent = resultData.shareText || '快來測測你的靈魂之書吧！#靈魂藏書閣 #AmourOracle'; 
        
        console.log("Result data prepared."); 
        return true; 
    } catch (error) { 
        console.error("Error preparing result data:", error); 
        DOM.elements.resultTitle.textContent = "顯示結果時發生錯誤"; 
        return false; 
    } 
}

// 創建書籍列表
function createBookList(books) {
    const fragment = document.createDocumentFragment();
    
    if (books && books.length) {
        books.forEach(book => {
            const p = document.createElement('p');
            p.textContent = book;
            fragment.appendChild(p);
        });
    } else {
        const p = document.createElement('p');
        p.textContent = '暫無資料';
        fragment.appendChild(p);
    }
    
    return fragment;
}

// 渲染特質
function renderTraits(typeScores, resultData) {
    const traitNames = window.testData.traitNames;
    DOM.elements.traitsContainer.innerHTML = ''; 
    
    if (!typeScores || Object.keys(typeScores).length === 0) { 
        console.warn("Cannot get final scores for traits."); 
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    if (resultData.title && resultData.title.includes('管理員')) { 
        // 對於特殊結果，所有特質都顯示 3 顆星
        Object.keys(traitNames).forEach(type => {
            fragment.appendChild(createTraitElement(type, 3, traitNames));
        }); 
    } else { 
        // 對於一般結果，根據分數顯示星星
        Object.keys(traitNames).forEach(type => { 
            const score = typeScores[type] || 0; 
            let stars = 1; 
            if (score >= 7) stars = 5; 
            else if (score >= 5) stars = 4; 
            else if (score >= 3) stars = 3; 
            else if (score >= 1) stars = 2; 
            
            fragment.appendChild(createTraitElement(type, stars, traitNames));
        }); 
    } 
    
    DOM.elements.traitsContainer.appendChild(fragment);
}

// 創建特質元素
function createTraitElement(type, starCount, traitNames) { 
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
        return traitElement;
    } catch (error) { 
        console.error(`Error creating trait ${type}:`, error); 
        return document.createElement('div');
    } 
}