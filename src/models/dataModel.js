const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load data from JSON file
 * @param {string} category - Category name (manga, manhwa, manhua, international)
 * @returns {Array} - Array of items or empty array if file doesn't exist
 */
function loadData(category) {
    const filePath = path.join(DATA_DIR, `${category}.json`);

    try {
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(rawData);
        }
    } catch (error) {
        console.error(`[DataModel] Error loading ${category}.json:`, error.message);
    }

    return [];
}

/**
 * Save data to JSON file
 * @param {string} category - Category name
 * @param {Array} data - Array of items to save
 */
function saveData(category, data) {
    const filePath = path.join(DATA_DIR, `${category}.json`);

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`[DataModel] Saved ${data.length} items to ${category}.json`);
    } catch (error) {
        console.error(`[DataModel] Error saving ${category}.json:`, error.message);
    }
}

/**
 * Find new items by comparing old and new data
 * @param {Array} oldData - Previous data
 * @param {Array} newData - Fresh data from API
 * @param {string} category - Category type
 * @returns {Array} - Array of new items
 */
function findNewItems(oldData, newData, category) {
    if (oldData.length === 0) {
        // First run - don't treat everything as new
        console.log(`[DataModel] First run for ${category}, saving without notification`);
        return [];
    }

    const newItems = [];

    if (category === 'international') {
        // For international: compare by seriesId + chapterId
        const oldChapterMap = new Map();
        oldData.forEach(item => {
            if (item.latestChapter) {
                oldChapterMap.set(`${item.seriesId}_${item.latestChapter.chapterId}`, true);
            }
        });

        newData.forEach(item => {
            if (item.latestChapter) {
                const key = `${item.seriesId}_${item.latestChapter.chapterId}`;
                if (!oldChapterMap.has(key)) {
                    newItems.push(item);
                }
            }
        });
    } else {
        // For manga/manhwa/manhua: compare by title + latestChapter.url
        const oldChapterMap = new Map();
        oldData.forEach(item => {
            if (item.latestChapter && item.latestChapter.url) {
                oldChapterMap.set(item.latestChapter.url, true);
            }
        });

        newData.forEach(item => {
            if (item.latestChapter && item.latestChapter.url) {
                if (!oldChapterMap.has(item.latestChapter.url)) {
                    newItems.push(item);
                }
            }
        });
    }

    return newItems;
}

module.exports = {
    loadData,
    saveData,
    findNewItems
};
