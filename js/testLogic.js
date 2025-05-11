// js/testLogic.js - 測驗核心邏輯 (重構版)

import { stateManager, legacyState } from './state.js';
import { DOM } from './dom.js';
import { displayQuestion } from './view.js'; // 用於顯示問題和選項
import { switchScreen, animateOptionExplode } from './animation.js'; // 導入屏幕切換和爆炸動畫
import { calculateAndShowResults } from './resultLogic.js'; // 導入結果處理邏輯 (稍後實現)

let currentQuestionsData = null; // 模組內部儲存當前測驗的問題數據

/**
 * 初始化測驗屏幕，並顯示第一個問題。
 * 此函數應在從 Intro 頁切換到 Test 頁完成後被調用。
 * @param {object[]} questions - 測驗的問題數據陣列。
 */
export function initializeTestScreen(questions) {
    console.log("[TestLogic LOG] initializeTestScreen called.");
    if (!questions || questions.length === 0) {
        console.error("[TestLogic ERR] initializeTestScreen: 無效的問題數據。");
        // 考慮是否需要切換回 Intro 頁或顯示錯誤
        // switchScreen('test', 'intro').catch(e => console.error(e));
        return;
    }
    currentQuestionsData = questions; // 儲存問題數據

    stateManager.set('currentQuestionIndex', 0);
    legacyState.userAnswers = []; // 使用 legacyState 保持與 resultLogic 的兼容性，將來可統一

    // 確保在顯示第一個問題前，相關的流程鎖是解開的
    // isScreenSwitching 應由調用者（例如 main.js 中的開始按鈕邏輯）在 switchScreen 完成後解鎖
    // isOptionProcessing 在這裡應該是初始的 false 狀態
    if (stateManager.isLocked('isOptionProcessing')) {
        console.warn("[TestLogic WARN] isOptionProcessing was locked at the start of initializeTestScreen. Unlocking.");
        stateManager.unlock('isOptionProcessing');
    }

    console.log(`[TestLogic LOG] currentQuestionIndex set to 0. Total questions: ${currentQuestionsData.length}`);
    displayQuestion(0, currentQuestionsData); // 顯示第一個問題
}

/**
 * 處理用戶點擊測驗選項的核心函數。
 * 此函數由 view.js 中的選項按鈕事件監聽器調用。
 * @param {Event} event - 點擊事件對象。
 * @param {object[]} allQuestionsData - 完整的測驗問題數據陣列。
 */
export async function handleOptionClick(event, allQuestionsData) {
    const clickedOptionElement = event.currentTarget;
    const optionIndex = parseInt(clickedOptionElement.dataset.index);
    const currentQuestionIdx = stateManager.get('currentQuestionIndex');

    console.log(`[TestLogic LOG] handleOptionClick: Question ${currentQuestionIdx + 1}, Option ${optionIndex + 1} clicked.`);

    if (stateManager.isLocked('isScreenSwitching')) {
        console.warn("[TestLogic WARN] Option click ignored: Screen is currently switching.");
        return;
    }
    if (stateManager.isLocked('isOptionProcessing')) {
        console.warn("[TestLogic WARN] Option click ignored: Another option is already being processed.");
        return;
    }

    stateManager.lock('isOptionProcessing');
    console.log("[State LOG] Locked: isOptionProcessing (handleOptionClick start)");

    if (isNaN(optionIndex) || currentQuestionIdx < 0 || currentQuestionIdx >= allQuestionsData.length) {
        console.error("[TestLogic ERR] Invalid option index or question index.", { optionIndex, currentQuestionIdx });
        stateManager.unlock('isOptionProcessing');
        console.log("[State LOG] Unlocked: isOptionProcessing (handleOptionClick - invalid index)");
        return;
    }

    // 1. 記錄用戶答案
    legacyState.userAnswers[currentQuestionIdx] = optionIndex; // 假設答案是選項的索引
    console.log(`[TestLogic LOG] User answer for Q${currentQuestionIdx + 1}: ${optionIndex + 1}. Answers so far:`, legacyState.userAnswers);

    try {
        // 2. 執行選項爆炸動畫 (或其他點擊反饋動畫)
        // animateOptionExplode 需要被點擊的選項按鈕元素
        // 它返回一個 Promise，以便我們在其完成後繼續
        if (typeof animateOptionExplode === 'function') {
            console.log("[TestLogic LOG] Starting option explosion animation...");
            await animateOptionExplode(clickedOptionElement);
            console.log("[TestLogic LOG] Option explosion animation completed.");
        } else {
            console.warn("[TestLogic WARN] animateOptionExplode function not found. Skipping animation.");
            // 如果沒有爆炸動畫，也模擬一個短延遲，讓用戶有反應時間
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 3. 判斷是進入下一題還是顯示結果
        if (currentQuestionIdx < allQuestionsData.length - 1) {
            console.log("[TestLogic LOG] Preparing next question...");
            prepareNextQuestion(allQuestionsData);
            // isOptionProcessing 將在 prepareNextQuestion -> displayQuestion -> createOptions (TypeIt 完成) 後，
            // 或者更準確地說，在 handleOptionClick 的 finally 塊中解鎖。
            // 此處 prepareNextQuestion 是同步的，真正的異步在 view.js 的 TypeIt。
            // 因此，解鎖操作應該放在整個異步鏈的末尾。
        } else {
            console.log("[TestLogic LOG] Last question answered. Triggering show results...");
            await triggerShowResults(allQuestionsData, legacyState.userAnswers);
        }
    } catch (error) {
        console.error("[TestLogic ERR] Error during option processing or animation:", error);
        // 即使出錯，也要確保解鎖
    } finally {
        // 確保 isOptionProcessing 在所有異步操作後解鎖
        // 這個 finally 塊會在 try 中的 await 完成後（無論成功或失敗）或 catch 執行後執行。
        // 如果 prepareNextQuestion 或 triggerShowResults 內部有更長的異步操作（例如屏幕切換），
        // 那麼 isOptionProcessing 的解鎖應該由那些更深層的 Promise鏈的最終完成點來控制。
        // 目前的設計：prepareNextQuestion 是同步的，它調用 displayQuestion，後者內部的 TypeIt 是異步的。
        // triggerShowResults 內部的 switchScreen 也是異步的。
        // 因此，這裡的 finally 解鎖可能太早。
        // **正確的做法是：isOptionProcessing 的解鎖應該在下一題的 TypeIt 動畫完成後，或者結果頁顯示完成後。**
        // 我們暫時將解鎖推遲到 `prepareNextQuestion` 和 `triggerShowResults` 的異步操作完成後。
        // 為了簡化，我們暫時假設爆炸動畫是主要耗時操作，下一題的準備是相對快的。
        // stateManager.unlock('isOptionProcessing');
        // console.log("[State LOG] Unlocked: isOptionProcessing (handleOptionClick end - THIS MIGHT BE TOO EARLY)");
        // **正確的解鎖時機將在 prepareNextQuestion 和 triggerShowResults 的 Promise 完成後。**
        // 為了確保解鎖，我們可以在這裡先註釋掉，然後在各自的流程終點解鎖。
        // 或者，handleOptionClick 本身返回一個 Promise，由調用棧更高層處理。
        // 目前：讓 prepareNextQuestion 和 triggerShowResults 返回 Promise，然後在這裡 await 它們。
    }
}

/**
 * 準備並顯示下一個問題。
 * @param {object[]} allQuestionsData - 完整的測驗問題數據陣列。
 * @returns {Promise<void>} 當下一個問題的視圖（包括TypeIt）準備好時 resolve。
 */
async function prepareNextQuestion(allQuestionsData) {
    const newQuestionIndex = stateManager.get('currentQuestionIndex') + 1;
    stateManager.set('currentQuestionIndex', newQuestionIndex);

    console.log(`[TestLogic LOG] prepareNextQuestion: Advancing to question ${newQuestionIndex + 1}`);

    // displayQuestion 會觸發 TypeIt 動畫，這是異步的。
    // 我們需要一種方法來知道 displayQuestion (包括其內部的 TypeIt) 何時完成。
    // 目前 view.js 中的 createOptionsUI 使用 Promise.allSettled(typeItPromises)
    // 並在其 .then() 中解鎖 isTransitioning (現在是 isOptionProcessing)。
    // 這裡我們直接調用 displayQuestion，並相信 view.js 會在其異步操作完成後處理好狀態。
    // TODO: 考慮讓 displayQuestion 或 createOptionsUI 返回一個 Promise 以便更精確控制。
    displayQuestion(newQuestionIndex, allQuestionsData);

    // 由於 displayQuestion 內部包含異步的 TypeIt，
    // isOptionProcessing 的解鎖不應該在這裡立即發生。
    // 它應該在 TypeIt 動畫完成後。目前 view.js 的 Promise.allSettled
    // 的 .then() 內部會解鎖 isTransitioning (我們之前的 isOptionProcessing)。
    // 我們需要確保 state.js 中的狀態名稱一致。
    // 假設 view.js 會在所有 TypeIt 打完後解鎖 isOptionProcessing (或者一個類似的信號)
    // 這裡我們暫時不返回 Promise，依賴 view.js 的解鎖。
    // 但更好的做法是讓 displayQuestion 返回 Promise。

    // 為了讓 handleOptionClick 的 finally 能正確解鎖，這裡我們模擬一個延遲
    // 代表 view.js 完成異步操作的時間。
    // 實際中，應該由 view.js 返回 Promise。
    const estimatedViewRenderTime = (allQuestionsData[newQuestionIndex].options.length * 400) + 1000; // 粗略估算
    await new Promise(resolve => setTimeout(resolve, estimatedViewRenderTime));
    console.log("[TestLogic LOG] prepareNextQuestion: Assumed view rendering complete.");
    stateManager.unlock('isOptionProcessing');
    console.log("[State LOG] Unlocked: isOptionProcessing (after prepareNextQuestion's estimated delay)");
}

/**
 * 觸發結果的計算和顯示流程。
 * @param {object[]} allQuestionsData - 完整的測驗問題數據陣列。
 * @param {number[]} userAnswers - 用戶的答案陣列。
 * @returns {Promise<void>} 當結果頁顯示完成時 resolve。
 */
async function triggerShowResults(allQuestionsData, userAnswers) {
    console.log("[TestLogic LOG] triggerShowResults called.");
    stateManager.lock('isScreenSwitching'); // 鎖定屏幕切換狀態，因為我們要切換到結果頁

    try {
        // 1. 計算結果 (假設 resultLogic.js 有一個 calculateAndPrepareResults 函數)
        // 這部分邏輯我們會在 resultLogic.js 中實現
        // const resultData = calculateResult(allQuestionsData, userAnswers);
        // DOM.elements.resultTitle.textContent = resultData.title; // 等
        console.log("[TestLogic LOG] (Skipping result calculation for now) User answers:", userAnswers);


        // 2. 切換到結果屏幕
        await switchScreen('test', 'result'); // animation.js 中的 switchScreen 返回 Promise
        console.log("[TestLogic LOG] Switched to result screen.");

        // 3. （可選）在結果頁上顯示結果內容
        // 這一部分會在重構 resultLogic.js 和相關 view 時完成
        if (typeof calculateAndShowResults === 'function') {
            calculateAndShowResults(allQuestionsData, userAnswers);
        } else {
            console.warn_log("[TestLogic WARN] calculateAndShowResults is not yet implemented/imported.");
            // 臨時在結果頁顯示一些東西
            if(DOM.elements.resultTitle) DOM.elements.resultTitle.textContent = "測驗完成！";
            if(DOM.elements.resultDescription) DOM.elements.resultDescription.textContent = "結果正在生成中...（功能待實現）";
        }


    } catch (error) {
        console.error("[TestLogic ERR] Error in triggerShowResults:", error);
        // 即使出錯，也嘗試解鎖屏幕切換
        if(stateManager.isLocked('isScreenSwitching')) stateManager.unlock('isScreenSwitching');
    } finally {
        // isScreenSwitching 應由 switchScreen 內部在其 Promise resolve 時解鎖
        // isOptionProcessing 在這裡應該解鎖，因為選項處理流程到此結束
        if(stateManager.isLocked('isOptionProcessing')) {
            stateManager.unlock('isOptionProcessing');
            console.log("[State LOG] Unlocked: isOptionProcessing (after triggerShowResults)");
        }
        if(stateManager.isLocked('isScreenSwitching')) { // 再次確認，以防 switchScreen 內部出錯未解鎖
            stateManager.unlock('isScreenSwitching');
            console.warn("[State WARN] isScreenSwitching was still locked at the end of triggerShowResults, unlocking.");
        }
    }
}

// 移除舊的、不再需要的函數
// export function bindStartButton(...) {}
// export function bindOptionEvents(...) {}
// export function forceInitializeButtons(...) {}
// export function bindOtherButtons(...) {}