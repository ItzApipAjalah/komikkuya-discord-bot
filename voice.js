const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const config = require('./src/config/config');

// Target Category ID
const CATEGORY_ID = '1456319739612762183';
const TOTAL_CHANNELS = 50;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Starting voice channel creation...');

    try {
        // Find the category
        const category = await client.channels.fetch(CATEGORY_ID);

        if (!category || category.type !== ChannelType.GuildCategory) {
            console.error('Category not found or invalid ID!');
            process.exit(1);
        }

        const guild = category.guild;

        for (let i = 1; i <= TOTAL_CHANNELS; i++) {
            const channelName = `Voice - ${i.toString().padStart(2, '0')}`;

            console.log(`Creating ${channelName}...`);

            await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: CATEGORY_ID
            });

            // Small delay to avoid aggressive rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('Successfully created all 50 voice channels!');
    } catch (error) {
        console.error('Error creating channels:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(config.DISCORD_TOKEN);
