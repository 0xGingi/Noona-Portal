import { EmbedBuilder } from 'discord.js';
import kavita from '../../kavita/kavita.mjs';

export const setupLibraryNotifications = (client) => {
    const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;
    const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    
    const notifiedItemIds = new Set();
    
    async function checkForNewAdditions() {
        const channel = client.channels.cache.get(NOTIFICATION_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Notification channel not found');
            return;
        }
        
        try {
            const currentTime = Date.now();
            const lookbackTime = currentTime - (24 * 60 * 60 * 1000);
            
            const endpoint = `/api/Series/recently-added-v2`;
            
            const filterDto = {
                statements: [],
                combination: 1
            };
            
            const recentlyAdded = await kavita.fetchData(endpoint, 'POST', filterDto);
            
            if (recentlyAdded && Array.isArray(recentlyAdded) && recentlyAdded.length > 0) {
                const newItems = recentlyAdded.filter(item => {
                    if (!item.lastChapterAdded) return false;
                    
                    const addedDate = new Date(item.lastChapterAdded).getTime();
                    const isWithinLookback = addedDate >= lookbackTime;
                    const isNew = !notifiedItemIds.has(item.id);
                    
                    return isWithinLookback && isNew;
                });
                
                if (newItems.length === 0) {
                    console.log('No new items found in library within the lookback period');
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('📚 New Additions to the Library!')
                    .setColor(0x00FF00)
                    .setTimestamp();
                
                newItems.slice(0, 10).forEach(item => {
                    notifiedItemIds.add(item.id);
                    
                    const addedTime = new Date(item.lastChapterAdded);
                    
                    const fieldValue = [
                        `Added: ${addedTime.toLocaleString()}`,
                        `Library: ${item.libraryName || 'Unknown'}`
                    ].filter(Boolean).join('\n');
                    
                    embed.addFields({ 
                        name: item.name, 
                        value: fieldValue || 'No additional information available'
                    });
                });
                
                await channel.send({ embeds: [embed] });
            } else {
                console.log('No items found in library response');
            }
        } catch (error) {
            console.error('❌ Error checking for new library additions:', error);
        }
    }
    
    const interval = setInterval(checkForNewAdditions, CHECK_INTERVAL);
    
    console.log(`✅ Library notification service initialized - checking every ${CHECK_INTERVAL/(60*60*1000)} hours`);
    
    checkForNewAdditions();
    
    return {
        stop: () => clearInterval(interval),
        checkNow: checkForNewAdditions
    };
}; 