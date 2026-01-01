const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
const config = require('./config/config');
const updateController = require('./controllers/updateController');
const commandController = require('./controllers/commandController');
const voiceController = require('./controllers/voiceController');
const welcomeController = require('./controllers/welcomeController');
const verifyController = require('./controllers/verifyController');
const embedBuilder = require('./utils/embedBuilder');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
    console.log('═══════════════════════════════════════════════');
    console.log('   🤖 Komikkuya Discord Bot Started!');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Logged in as: ${readyClient.user.tag}`);
    console.log(`   Channel ID: ${config.CHANNEL_ID}`);
    console.log(`   Fetch Interval: ${config.FETCH_INTERVAL / 1000 / 60} minutes`);
    console.log('═══════════════════════════════════════════════\n');

    // Initialize Controllers
    console.log('[Bot] Initializing controllers...');
    await updateController.checkForUpdates(client);
    await voiceController.setupTriggerChannel(client);
    verifyController.init(client); // Start web server

    // Set Custom Rich Presence
    readyClient.user.setPresence({
        activities: [{
            name: 'Komikkuya',
            type: ActivityType.Playing,
            details: 'Baca Komik Tanpa Iklan',
            state: 'http://komikkuya.my.id/',
            assets: {
                large_image: '70223010',
                large_text: 'Komikkuya'
            },
            buttons: [
                { label: 'Komikkuya', url: 'http://komikkuya.my.id/' }
            ]
        }],
        status: 'online'
    });

    // Set up interval for periodic checks
    setInterval(async () => {
        await updateController.checkForUpdates(client);
    }, config.FETCH_INTERVAL);

    console.log(`\n[Bot] Next check in ${config.FETCH_INTERVAL / 1000 / 60} minutes...`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    // Handle button & menu interactions
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        if (interaction.customId.startsWith('tv_') || interaction.customId.startsWith('modal_tv_')) {
            await voiceController.handleInteraction(interaction);
        } else if (interaction.customId.startsWith('verify_')) {
            await verifyController.handleInteraction(interaction);
        }
    }
});

// Handle message commands
client.on(Events.MessageCreate, async (message) => {
    await commandController.processCommand(message);
});

// Handle voice state updates
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await voiceController.handleVoiceStateUpdate(oldState, newState);
});

// Handle new member welcome
client.on(Events.GuildMemberAdd, async (member) => {
    await welcomeController.handleMemberJoin(member);
});

// Error handling
client.on(Events.Error, (error) => {
    console.error('[Bot] Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('[Bot] Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('\n[Bot] Shutting down...');
    client.destroy();
    process.exit(0);
});

// Login to Discord
console.log('[Bot] Connecting to Discord...');
client.login(config.DISCORD_TOKEN);
