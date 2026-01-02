const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config/config');

/**
 * Handle message mirroring for specific channel
 * @param {Message} message - Discord message 
 */
async function handleMirrorMessage(message) {
    // Ignore bot messages to prevent loops
    if (message.author.bot) return;

    // Only process for the mirror channel
    if (message.channelId !== config.MIRROR_CHANNEL_ID) return;

    try {
        // Prepare content, embeds, and attachments
        const embeds = message.embeds.map(e => EmbedBuilder.from(e));
        const files = Array.from(message.attachments.values()).map(a => new AttachmentBuilder(a.url, { name: a.name }));

        // Delete the original message first
        await message.delete().catch(() => { });

        // Re-send through bot
        await message.channel.send({
            content: message.content || null,
            embeds: embeds,
            files: files
        });

    } catch (error) {
        console.error('[MirrorController] Error mirroring message:', error);
    }
}

module.exports = {
    handleMirrorMessage
};
