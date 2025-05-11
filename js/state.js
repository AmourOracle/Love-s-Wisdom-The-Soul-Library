// js/state.js - 狀態管理模組 (重構版)

/**
 * 私有狀態對象
 * 儲存應用程式的各種狀態。
 */
const states = {
    // 動畫與流程控制狀態
    isScreenSwitching: false,   // 標記主屏幕 (intro, test, result) 是否正在切換中
    isOptionProcessing: false,  // 標記選項點擊後的處理流程 (TypeIt, 爆炸動畫, 準備下一題)是否正在進行中
    isPreloading: true,         // 標記資源是否仍在預加載 (初始為 true)

    // 測驗進程相關狀態
    currentQuestionIndex: -1, // 初始為 -1，表示測驗未開始或在 intro 頁面
    userAnswers: [],          // 存儲用戶的答案索引
    finalScores: {},          // 存儲最終計算出的各類型得分

    // 頁面可見性狀態 (用於更精確的邏輯判斷)
    activeScreen: 'preloader', // 當前活動的屏幕 ID ('preloader', 'intro', 'test', 'result')
};

/**
 * 狀態管理器 (stateManager)
 * 提供一組方法來安全地讀取和修改 states 對象。
 */
export const stateManager = {
    /**
     * 鎖定一個狀態 (將其設為 true)。
     * @param {string} stateName - 要鎖定的狀態名稱。
     * @returns {boolean} 如果狀態存在且成功鎖定，返回 true；否則返回 false。
     */
    lock(stateName) {
        if (states.hasOwnProperty(stateName)) {
            if (states[stateName] === true && (stateName === 'isScreenSwitching' || stateName === 'isOptionProcessing')) {
                // 對於流程控制鎖，如果重複鎖定，發出警告，因為這可能指示邏輯問題
                console.warn(`[State WARN] Attempted to lock an already locked critical state: ${stateName}. This might indicate a logic flow issue.`);
            }
            states[stateName] = true;
            console.log(`[State LOG] Locked: ${stateName}`);
            return true;
        }
        console.error(`[State ERR] Attempted to lock non-existent state: ${stateName}`);
        return false;
    },

    /**
     * 解鎖一個狀態 (將其設為 false)。
     * @param {string} stateName - 要解鎖的狀態名稱。
     * @returns {boolean} 如果狀態存在且成功解鎖（或原本就已解鎖），返回 true；否則返回 false。
     */
    unlock(stateName) {
        if (states.hasOwnProperty(stateName)) {
            if (states[stateName] === false && (stateName === 'isScreenSwitching' || stateName === 'isOptionProcessing')) {
                // console.log(`[State LOG] State already unlocked (or being redundantly unlocked): ${stateName}`);
            }
            states[stateName] = false;
            console.log(`[State LOG] Unlocked: ${stateName}`);
            return true;
        }
        console.error(`[State ERR] Attempted to unlock non-existent state: ${stateName}`);
        return false;
    },

    /**
     * 檢查一個狀態是否被鎖定 (值是否為 true)。
     * @param {string} stateName - 要檢查的狀態名稱。
     * @returns {boolean} 如果狀態存在且為 true，返回 true；否則返回 false。
     */
    isLocked(stateName) {
        if (states.hasOwnProperty(stateName)) {
            return states[stateName] === true;
        }
        // console.warn(`[State WARN] Checked non-existent state: ${stateName}. Returning false.`);
        return false; // 對於不存在的狀態，視為未鎖定
    },

    /**
     * 獲取一個狀態的值。
     * @param {string} stateName - 要獲取值的狀態名稱。
     * @returns {*} 狀態的值；如果狀態不存在，返回 undefined。
     */
    get(stateName) {
        if (states.hasOwnProperty(stateName)) {
            return states[stateName];
        }
        console.warn(`[State WARN] Attempted to get non-existent state: ${stateName}. Returning undefined.`);
        return undefined;
    },

    /**
     * 設定一個狀態的值。
     * @param {string} stateName - 要設定值的狀態名稱。
     * @param {*} value - 要設定的新值。
     * @returns {boolean} 如果狀態存在且成功設定，返回 true；否則返回 false。
     */
    set(stateName, value) {
        if (states.hasOwnProperty(stateName)) {
            const oldValue = states[stateName];
            states[stateName] = value;
            console.log(`[State LOG] Set: ${stateName} from`, oldValue, "to", value);
            return true;
        }
        console.error(`[State ERR] Attempted to set non-existent state: ${stateName}`);
        return false;
    },

    /**
     * 獲取所有狀態的快照 (主要用於偵錯)。
     * @returns {object} 當前所有狀態的唯讀副本。
     */
    getSnapshot() {
        return { ...states }; // 返回副本以防外部直接修改
    },

    /**
     * 重置測驗相關的狀態，用於重新開始測驗。
     * 不會重置 isPreloading 和 activeScreen (如果希望 intro 頁面在重置後顯示)。
     */
    resetForNewTest() {
        this.unlock('isScreenSwitching');    // 確保流程鎖已解開
        this.unlock('isOptionProcessing'); // 確保流程鎖已解開
        
        states.currentQuestionIndex = -1; // 重置到 Intro 之前的狀態
        states.userAnswers = [];
        states.finalScores = {};
        // activeScreen 會在 switchScreen 時更新
        console.log("[State LOG] Test-related states have been reset for a new test.");
    }
};

// 為了盡可能減少對舊代碼的直接衝擊（如果還有地方在用），
// 可以暫時保留 legacyState，但所有新寫的或重構的程式碼都應該使用 stateManager。
// 在理想情況下，最終應該移除 legacyState 的導出。
export const legacyState = states;

// 打印初始狀態，方便調試
console.log("[State LOG] Initial states:", JSON.parse(JSON.stringify(states)));