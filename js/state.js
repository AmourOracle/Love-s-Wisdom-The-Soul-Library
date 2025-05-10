// state.js - 狀態管理模組

// 私有狀態對象
const states = {
    isAnimating: false, 
    isTransitioning: false, 
    currentQuestionIndex: 0,
    userAnswers: [], 
    preloadComplete: false, 
    introVisible: false,
    resultShowing: false, 
    contentRendered: false, 
    finalScores: {}
};

// 導出狀態管理器
export const stateManager = {
    lock(stateName) {
        if (states.hasOwnProperty(stateName)) {
            states[stateName] = true;
            console.log(`鎖定狀態: ${stateName}`);
            return true;
        }
        return false;
    },
    
    unlock(stateName) {
        if (states.hasOwnProperty(stateName)) {
            states[stateName] = false;
            console.log(`解鎖狀態: ${stateName}`);
            return true;
        }
        return false;
    },
    
    isLocked(stateName) {
        return states[stateName] === true;
    },
    
    get(stateName) {
        return states[stateName];
    },
    
    set(stateName, value) {
        if (states.hasOwnProperty(stateName)) {
            states[stateName] = value;
            return true;
        }
        return false;
    },
    
    // 方便取得所有狀態的快照(僅供偵錯)
    getSnapshot() {
        return { ...states };
    }
};

// 向後兼容的 state 對象，只暴露給 main.js
export const legacyState = states;