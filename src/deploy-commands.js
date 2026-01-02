/**
 * Deploy Slash Commands to Discord API
 * Run this script once with: node src/deploy-commands.js
 */

const { REST, Routes } = require('discord.js');
const { commands } = require('./commands/musicCommands');
const config = require('./config/config');

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

// Get Guild ID from config or set manually
const GUILD_ID = '1452642808400707678'; // Your server ID

async function deployCommands() {
    try {
        console.log('🔄 Started refreshing application (/) commands...');

        const commandData = commands.map(cmd => cmd.toJSON());

        // Register to specific guild (faster for testing)
        await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID || '1456270638107983942', GUILD_ID),
            { body: commandData }
        );

        console.log('✅ Successfully registered application commands!');
        console.log('📝 Registered commands:');
        commandData.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
}

deployCommands();
