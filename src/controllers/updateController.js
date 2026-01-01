const apiService = require('../services/apiService');
const dataModel = require('../models/dataModel');
const embedBuilder = require('../utils/embedBuilder');
const config = require('../config/config');

/**
 * Check for updates and send notifications
 * @param {Client} client - Discord.js client
 */
async function checkForUpdates(client) {
    console.log('\n[UpdateController] Starting update check...');
    console.log(`[UpdateController] Time: ${new Date().toLocaleString('id-ID')}`);

    try {
        // Get the channel
        const channel = await client.channels.fetch(config.CHANNEL_ID);
        if (!channel) {
            console.error('[UpdateController] Channel not found!');
            return;
        }

        // Fetch all categories
        const freshData = await apiService.fetchAll();

        const categories = ['manga', 'manhwa', 'manhua', 'international'];
        const allNewItems = [];
        const categoryCounts = {};

        for (const category of categories) {
            const newData = freshData[category] || [];
            const oldData = dataModel.loadData(category);

            // Find new items
            const newItems = dataModel.findNewItems(oldData, newData, category);

            categoryCounts[category] = newItems.length;

            if (newItems.length > 0) {
                console.log(`[UpdateController] Found ${newItems.length} new items in ${category}`);
                newItems.forEach(item => {
                    allNewItems.push({ item, category });
                });
            }

            // Always save fresh data (update the JSON files)
            if (newData.length > 0) {
                dataModel.saveData(category, newData);
            }
        }

        // Send notifications if there are new items
        if (allNewItems.length > 0) {
            console.log(`[UpdateController] Sending ${allNewItems.length} notifications...`);

            // Send summary embed first if many updates
            if (allNewItems.length > 3) {
                const summaryEmbed = embedBuilder.createSummaryEmbed(allNewItems.length, categoryCounts);
                await channel.send({ embeds: [summaryEmbed] });
            }

            // Send individual embeds (limit to prevent spam)
            const maxEmbeds = 10;
            const itemsToSend = allNewItems.slice(0, maxEmbeds);

            for (const { item, category } of itemsToSend) {
                const { embed, components } = embedBuilder.createUpdateEmbed(item, category);
                await channel.send({ embeds: [embed], components });

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (allNewItems.length > maxEmbeds) {
                await channel.send(`📌 Dan ${allNewItems.length - maxEmbeds} update lainnya...`);
            }

            console.log('[UpdateController] Notifications sent successfully!');
        } else {
            console.log('[UpdateController] No new updates found.');
        }

    } catch (error) {
        console.error('[UpdateController] Error during update check:', error);
    }
}

module.exports = {
    checkForUpdates
};
