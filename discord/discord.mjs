// ✅ /discord/discord.mjs — Warden-Ready Discord Setup (With Intent Notes)

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { loadCommands, registerCommands } from './commandManager.mjs';
import { hasRequiredRole } from './roleManager.mjs';
import {
    handleLibrarySelection,
    handleSeriesPage,
    handleSeriesSelection
} from './commands/scan.mjs';
import {
    printStep,
    printResult,
    printError,
    printDivider
} from '../noona/logger/logUtils.mjs';

// ⚠️ NOTE: Only enable privileged intents below IF enabled in Discord Dev Portal
// See: https://discord.com/developers/applications > [Your Bot] > Bot > Privileged Gateway Intents

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        // GatewayIntentBits.GuildMessages,     // 🛑 Requires MESSAGE CONTENT intent (usually not needed)
        // GatewayIntentBits.GuildMembers       // 🛑 Requires SERVER MEMBERS intent (used for join detection, etc)
    ]
});

/**
 * Initializes the Discord bot and sets up all interaction handlers.
 * @returns {Promise<{ client: Client, commandCount: number }>}
 */
export async function setupDiscord() {
    return new Promise(async (resolve, reject) => {
        try {
            printStep('🔄 Loading slash commands...');
            const { commandJSON, commandCollection, commandNames } = await loadCommands();

            if (commandCollection.size === 0) {
                return reject(new Error('No valid commands loaded.'));
            }

            client.commands = commandCollection;
            printResult(`✅ Commands loaded: [ ${commandNames.join(', ')} ]`);

            client.once(Events.ClientReady, async () => {
                printResult(`✅ Bot logged in as ${client.user.tag}`);

                printStep('📡 Registering commands with Discord API...');
                const count = await registerCommands(commandJSON);
                printResult(`✅ Registered ${count} slash commands`);

                printDivider();
                resolve({ client, commandCount: count });
            });

            client.on(Events.InteractionCreate, async interaction => {
                try {
                    // 🔹 Slash Command
                    if (interaction.isChatInputCommand()) {
                        const command = client.commands.get(interaction.commandName);
                        if (!command) return;

                        if (!hasRequiredRole(interaction)) return;

                        await command.execute(interaction);
                    }

                    // 🔹 Autocomplete
                    else if (interaction.isAutocomplete()) {
                        const command = client.commands.get(interaction.commandName);
                        if (command?.autocomplete) {
                            await command.autocomplete(interaction);
                        }
                    }

                    // 🔹 Button Interactions
                    else if (interaction.isButton()) {
                        const [prefix, ...args] = interaction.customId.split('_');
                        const scan = client.commands.get('scan');
                        if (!scan) return;

                        if (prefix === 'scan' && args.length === 0) {
                            await scan.execute(interaction);
                        } else if (prefix === 'scan') {
                            const libraryId = args[0];
                            await handleLibrarySelection(interaction, libraryId);
                        } else if (prefix === 'series' && args[0] === 'page') {
                            const [, libraryId, page] = args;
                            await handleSeriesPage(interaction, libraryId, parseInt(page), false);
                        } else if (prefix === 'series') {
                            const seriesId = args[0];
                            await handleSeriesSelection(interaction, seriesId);
                        }
                    }
                } catch (err) {
                    printError(`❌ Interaction error: ${err.message}`);

                    if (interaction.isRepliable()) {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: '❌ An error occurred while executing that action.',
                                ephemeral: true
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Something went wrong.'
                            });
                        }
                    }
                }
            });

            printStep('🔐 Logging in with bot token...');
            await client.login(process.env.DISCORD_TOKEN);
        } catch (err) {
            printError(`❌ Discord setup failed: ${err.message}`);
            reject(err);
        }
    });
}
