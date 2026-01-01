const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

/**
 * Fix URL to use komikkuya.my.id domain
 * @param {string} url - Original URL
 * @param {string} category - Category type
 * @returns {string} - Fixed URL
 */
function fixUrl(url, category) {
    if (!url) return url;

    if (category === 'international') {
        // Replace weebcentral.com with komikkuya.my.id
        return url.replace('https://weebcentral.com', 'http://komikkuya.my.id/chapter');
    } else {
        // Replace https://komiku.org/https://komiku.org with http://komikkuya.my.id/
        // Also handle https://komiku.org// pattern
        return url
            .replace('https://komiku.org/https://komiku.org', 'http://komikkuya.my.id/chapter')
            .replace('https://komiku.org/', 'http://komikkuya.my.id/chapter');
    }
}

/**
 * Create Discord embed for a comic update
 * @param {Object} item - Comic item data
 * @param {string} category - Category (manga, manhwa, manhua, international)
 * @returns {Object} - Object containing embed
 */
function createUpdateEmbed(item, category) {
    const color = config.CATEGORY_COLORS[category] || 0x5865F2;
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

    let embed;
    let chapterUrl;

    if (category === 'international') {
        // International format
        const chapterNum = item.latestChapter?.chapterNumber || 'New Chapter';
        chapterUrl = fixUrl(item.latestChapter?.url || item.seriesUrl, category);
        const seriesUrl = fixUrl(item.seriesUrl, category);

        embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`📚 ${item.title}`)
            .setURL(seriesUrl)
            .setDescription(`**${chapterNum}** telah dirilis!\n\n🔗 **Link Chapter:**\n${chapterUrl}`)
            .setImage(item.cover) // Large image
            .addFields(
                { name: '🏷️ Kategori', value: categoryLabel, inline: true },
                { name: '📖 Chapter', value: chapterNum, inline: true }
            )
            .setFooter({ text: 'Komikkuya Update' })
            .setTimestamp();
    } else {
        // Manga/Manhwa/Manhua format
        const chapterTitle = item.latestChapter?.title || 'New Chapter';
        chapterUrl = fixUrl(item.latestChapter?.url || item.url, category);
        const comicUrl = fixUrl(item.url, category);

        embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`📚 ${item.title}`)
            .setURL(comicUrl)
            .setDescription(`${item.description || 'Komik baru update!'}\n\n🔗 **Link Chapter:**\n${chapterUrl}`)
            .setImage(item.imageUrl) // Large image
            .addFields(
                { name: '🏷️ Kategori', value: `${categoryLabel} • ${item.genre || 'Unknown'}`, inline: true },
                { name: '📖 Chapter', value: chapterTitle, inline: true },
                { name: '👁️ Views', value: item.stats?.views || 'N/A', inline: true }
            )
            .setFooter({ text: `Komikkuya Update • ${item.updateStatus || ''}` })
            .setTimestamp();
    }

    return { embed, components: [] };
}

/**
 * Create summary embed for multiple updates
 * @param {number} count - Total number of updates
 * @param {Object} categoryCounts - Count per category
 * @returns {EmbedBuilder} - Discord embed object
 */
function createSummaryEmbed(count, categoryCounts) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔔 Update Komik Baru!')
        .setDescription(`Ditemukan **${count}** komik yang baru update:`)
        .setTimestamp();

    const fields = [];
    for (const [category, num] of Object.entries(categoryCounts)) {
        if (num > 0) {
            const label = category.charAt(0).toUpperCase() + category.slice(1);
            fields.push({ name: label, value: `${num} update`, inline: true });
        }
    }

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

module.exports = {
    createUpdateEmbed,
    createSummaryEmbed
};
