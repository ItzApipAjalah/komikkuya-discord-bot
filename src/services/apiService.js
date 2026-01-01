const axios = require('axios');
const config = require('../config/config');

/**
 * Fetch data from a single API endpoint
 * @param {string} category - Category name (manga, manhwa, manhua, international)
 * @returns {Promise<Array>} - Array of items from API
 */
async function fetchCategory(category) {
    const url = config.API_ENDPOINTS[category];

    if (!url) {
        console.error(`[ApiService] Unknown category: ${category}`);
        return [];
    }

    try {
        console.log(`[ApiService] Fetching ${category}...`);
        const response = await axios.get(url, { timeout: 30000 });

        if (response.data && response.data.success) {
            // Handle different response structures
            if (category === 'international') {
                return response.data.data.results || [];
            } else {
                return response.data.data.mangaList || [];
            }
        } else {
            console.error(`[ApiService] API returned unsuccessful for ${category}`);
            return [];
        }
    } catch (error) {
        console.error(`[ApiService] Error fetching ${category}:`, error.message);
        return [];
    }
}

/**
 * Fetch all categories simultaneously
 * @returns {Promise<Object>} - Object with all category data
 */
async function fetchAll() {
    const categories = ['manga', 'manhwa', 'manhua', 'international'];
    const results = {};

    const promises = categories.map(async (category) => {
        const data = await fetchCategory(category);
        results[category] = data;
    });

    await Promise.all(promises);

    console.log('[ApiService] All categories fetched successfully');
    return results;
}

module.exports = {
    fetchCategory,
    fetchAll
};
