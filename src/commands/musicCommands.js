const { SlashCommandBuilder } = require('discord.js');

// Define all slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('playlink')
        .setDescription('Play a song from YouTube URL')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('YouTube video URL')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('playsearch')
        .setDescription('Search and play a song from YouTube')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music and leave voice channel'),

    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),

    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song'),

    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),
];

module.exports = { commands };
