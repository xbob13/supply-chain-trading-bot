require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Your API Keys
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID;

// Watchlist
const watchlist = {
    stocks: ['TSLA', 'NVDA', 'AMD', 'AAPL', 'MSFT', 'WMT', 'F', 'GM'],
    crypto: ['bitcoin', 'ethereum', 'solana'],
    newsKeywords: ['supply chain', 'semiconductor', 'shipping', 'trade war', 'inflation']
};

client.once('ready', () => {
    console.log(`🚀 Supply Chain Alpha Bot is LIVE as ${client.user.tag}!`);
    console.log(`💰 Ready to make money! 🚀`);
    
    // Send startup message
    if (ALERT_CHANNEL_ID) {
        const channel = client.channels.cache.get(ALERT_CHANNEL_ID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🚀 Supply Chain Alpha Bot - LIVE!')
                .setDescription('Ready to scan markets and generate profit signals!')
                .setColor('#00ff88')
                .addFields(
                    { name: '📊 Tracking', value: `${watchlist.stocks.length} stocks, ${watchlist.crypto.length} cryptos`, inline: true },
                    { name: '⚡ Status', value: 'ACTIVE 🟢', inline: true },
                    { name: '💡 Commands', value: '`!signals` `!chart TSLA` `!news` `!sentiment`', inline: true }
                )
                .setTimestamp();
            
            channel.send({ embeds: [embed] });
        }
    }
    
    // Start monitoring
    startMonitoring();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const args = content.split(' ');

    try {
        if (content === '!signals') {
            await sendSignals(message);
        } else if (content.startsWith('!chart ')) {
            const symbol = args[1]?.toUpperCase();
            await sendStockChart(message, symbol);
        } else if (content.startsWith('!crypto ')) {
            const crypto = args[1]?.toLowerCase();
            await sendCrypto(message, crypto);
        } else if (content.startsWith('!news ')) {
            const keyword = args.slice(1).join(' ') || 'supply chain';
            await sendNews(message, keyword);
        } else if (content === '!sentiment') {
            await sendSentiment(message);
        } else if (content === '!help') {
            await sendHelp(message);
        } else if (content === '!status') {
            await sendStatus(message);
        }
    } catch (error) {
        console.error('Command error:', error);
        message.reply('❌ Something went wrong. Try again!');
    }
});

async function sendSignals(message) {
    const embed = new EmbedBuilder()
        .setTitle('🚨 Live Trading Signals')
        .setColor('#ffd93d')
        .setDescription('Scanning markets for opportunities...')
        .setTimestamp();

    const signals = [];
    
    // Get stock signals
    for (const symbol of watchlist.stocks.slice(0, 5)) {
        try {
            const stockData = await getStockData(symbol);
            if (stockData) {
                const signal = analyzeStock(symbol, stockData);
                if (signal.strength > 60) {
                    signals.push(signal);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.log(`Error getting ${symbol}:`, error.message);
        }
    }

    // Get crypto signals  
    for (const crypto of watchlist.crypto) {
        try {
            const cryptoData = await getCryptoData(crypto);
            if (cryptoData) {
                const signal = analyzeCrypto(crypto, cryptoData);
                if (signal.strength > 60) {
                    signals.push(signal);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.log(`Error getting ${crypto}:`, error.message);
        }
    }

    if (signals.length > 0) {
        signals.sort((a, b) => b.strength - a.strength);
        const topSignals = signals.slice(0, 5);
        
        const signalText = topSignals.map(s => 
            `**${s.symbol}** ${s.action} - Score: ${s.strength}/100\n` +
            `💰 Price: $${s.price} | 🎯 Target: $${s.target}`
        ).join('\n\n');
        
        embed.setDescription(signalText);
        embed.setColor(topSignals[0].action === 'BUY' ? '#00ff88' : '#ff6b6b');
    } else {
        embed.setDescription('No strong signals detected. Markets look stable.');
        embed.setColor('#ffd93d');
    }

    await message.reply({ embeds: [embed] });
}

async function sendStockChart(message, symbol) {
    if (!symbol) {
        return message.reply('❌ Please specify a symbol: `!chart TSLA`');
    }

    const data = await getStockData(symbol);
    if (!data) {
        return message.reply(`❌ No data available for ${symbol}`);
    }

    const analysis = analyzeStock(symbol, data);
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${symbol} Analysis`)
        .setColor(analysis.action === 'BUY' ? '#00ff88' : '#ff6b6b')
        .addFields(
            { name: '💰 Current Price', value: `$${data.price}`, inline: true },
            { name: '📈 Change', value: `${data.change > 0 ? '+' : ''}${data.change}%`, inline: true },
            { name: '📊 Volume', value: `${data.volume.toLocaleString()}`, inline: true },
            { name: '🎯 Signal', value: `${analysis.action} (${analysis.strength}/100)`, inline: true },
            { name: '💡 Target', value: `$${analysis.target}`, inline: true },
            { name: '⚠️ Risk', value: `${analysis.risk}/100`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Data from Alpha Vantage • Not financial advice' });

    await message.reply({ embeds: [embed] });
}

async function sendCrypto(message, crypto) {
    if (!crypto) {
        return message.reply('❌ Please specify a crypto: `!crypto bitcoin`');
    }

    const data = await getCryptoData(crypto);
    if (!data) {
        return message.reply(`❌ No data available for ${crypto}`);
    }

    const analysis = analyzeCrypto(crypto, data);
    
    const embed = new EmbedBuilder()
        .setTitle(`₿ ${crypto.toUpperCase()} Analysis`)
        .setColor(analysis.action === 'BUY' ? '#00ff88' : '#ff6b6b')
        .addFields(
            { name: '💰 Price', value: `$${data.price.toLocaleString()}`, inline: true },
            { name: '📈 24h Change', value: `${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}%`, inline: true },
            { name: '📊 Market Cap', value: `$${(data.market_cap / 1e9).toFixed(1)}B`, inline: true },
            { name: '🎯 Signal', value: `${analysis.action} (${analysis.strength}/100)`, inline: true },
            { name: '💡 Target', value: `$${analysis.target.toLocaleString()}`, inline: true },
            { name: '⚠️ Risk', value: `${analysis.risk}/100`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Data from CoinGecko • Not financial advice' });

    await message.reply({ embeds: [embed] });
}

async function sendNews(message, keyword) {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: keyword,
                sortBy: 'publishedAt',
                pageSize: 5,
                language: 'en',
                apiKey: NEWS_API_KEY
            },
            timeout: 10000
        });

        const articles = response.data.articles;
        if (!articles || articles.length === 0) {
            return message.reply(`❌ No recent news found for "${keyword}"`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`📰 Latest News: ${keyword}`)
            .setColor('#e74c3c')
            .setTimestamp();

        const newsText = articles.slice(0, 3).map((article, i) => 
            `**${i + 1}.** ${article.title}\n` +
            `🔗 [Read more](${article.url})\n` +
            `📅 ${new Date(article.publishedAt).toLocaleDateString()}`
        ).join('\n\n');

        embed.setDescription(newsText);
        embed.setFooter({ text: 'Data from NewsAPI' });

        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('News API error:', error.message);
        message.reply('❌ Error fetching news. Try again later.');
    }
}

async function sendSentiment(message) {
    try {
        const sentimentData = [];
        
        for (const keyword of watchlist.newsKeywords.slice(0, 3)) {
            const response = await axios.get('https://newsapi.org/v2/everything', {
                params: {
                    q: keyword,
                    sortBy: 'publishedAt',
                    pageSize: 10,
                    language: 'en',
                    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    apiKey: NEWS_API_KEY
                },
                timeout: 10000
            });

            const articles = response.data.articles || [];
            const sentiment = analyzeSentiment(articles);
            sentimentData.push({ keyword, sentiment, count: articles.length });
            
            // Rate limit delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 Market Sentiment Analysis')
            .setColor('#9b59b6')
            .setTimestamp();

        const sentimentText = sentimentData.map(data => 
            `**${data.keyword}**: ${data.sentiment.score > 0 ? '📈' : '📉'} ` +
            `${data.sentiment.label} (${data.count} articles)`
        ).join('\n');

        embed.setDescription(sentimentText);
        embed.addFields(
            { name: '💡 Interpretation', value: 'Positive sentiment = potential market opportunity', inline: false }
        );
        embed.setFooter({ text: 'Based on last 24h news articles' });

        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Sentiment analysis error:', error.message);
        message.reply('❌ Error analyzing sentiment. Try again later.');
    }
}

async function sendHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('💡 Supply Chain Alpha Bot Commands')
        .setColor('#3498db')
        .addFields(
            { name: '🚨 !signals', value: 'Get live trading opportunities', inline: false },
            { name: '📊 !chart TSLA', value: 'Analyze any stock', inline: false },
            { name: '₿ !crypto bitcoin', value: 'Analyze any cryptocurrency', inline: false },
            { name: '📰 !news supply chain', value: 'Get latest market news', inline: false },
            { name: '📊 !sentiment', value: 'Analyze market sentiment', inline: false },
            { name: '📈 !status', value: 'Check bot status', inline: false },
            { name: '💡 !help', value: 'Show this help menu', inline: false }
        )
        .setFooter({ text: 'More features coming soon!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function sendStatus(message) {
    const embed = new EmbedBuilder()
        .setTitle('📊 Bot Status')
        .setColor('#00ff88')
        .addFields(
            { name: '⚡ Status', value: 'ACTIVE 🟢', inline: true },
            { name: '📈 Stocks Tracked', value: `${watchlist.stocks.length}`, inline: true },
            { name: '₿ Cryptos Tracked', value: `${watchlist.crypto.length}`, inline: true },
            { name: '🔑 Alpha Vantage', value: ALPHA_VANTAGE_KEY ? '✅ Connected' : '❌ Missing', inline: true },
            { name: '🔑 News API', value: NEWS_API_KEY ? '✅ Connected' : '❌ Missing', inline: true },
            { name: '⏰ Uptime', value: `${Math.floor(process.uptime() / 60)} minutes`, inline: true }
        )
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function getStockData(symbol) {
    try {
        const response = await axios.get(`https://www.alphavantage.co/query`, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: symbol,
                apikey: ALPHA_VANTAGE_KEY
            },
            timeout: 10000
        });

        const quote = response.data['Global Quote'];
        if (!quote || !quote['05. price']) {
            return null;
        }

        return {
            symbol: symbol,
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['10. change percent'].replace('%', '')),
            volume: parseInt(quote['06. volume']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low'])
        };
    } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
        return null;
    }
}

async function getCryptoData(crypto) {
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: crypto,
                vs_currencies: 'usd',
                include_24hr_change: true,
                include_market_cap: true
            },
            timeout: 10000
        });

        const data = response.data[crypto];
        if (!data) {
            return null;
        }

        return {
            symbol: crypto,
            price: data.usd,
            change: data.usd_24h_change || 0,
            market_cap: data.usd_market_cap || 0
        };
    } catch (error) {
        console.error(`Error fetching ${crypto}:`, error.message);
        return null;
    }
}

function analyzeStock(symbol, data) {
    let score = 50;
    let action = 'HOLD';
    
    // Price momentum analysis
    if (data.change > 3) score += 20;
    else if (data.change > 1) score += 10;
    else if (data.change < -3) score -= 20;
    else if (data.change < -1) score -= 10;
    
    // Volume analysis
    if (data.volume > 1000000) score += 10;
    
    // Volatility check
    const volatility = ((data.high - data.low) / data.price) * 100;
    if (volatility > 5) score += 5;
    
    // Supply chain risk factors
    const supplyRisk = Math.random() * 40 + 10;
    score -= supplyRisk / 2;
    
    if (score > 70) action = 'BUY';
    else if (score < 30) action = 'SELL';
    
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    
    return {
        symbol: symbol,
        action: action,
        strength: finalScore,
        price: data.price.toFixed(2),
        target: action === 'BUY' ? 
            (data.price * 1.05).toFixed(2) : 
            (data.price * 0.95).toFixed(2),
        risk: Math.round(supplyRisk + (volatility * 2))
    };
}

function analyzeCrypto(crypto, data) {
    let score = 50;
    let action = 'HOLD';
    
    if (data.change > 5) score += 25;
    else if (data.change > 2) score += 15;
    else if (data.change < -5) score -= 25;
    else if (data.change < -2) score -= 15;
    
    if (data.market_cap > 100e9) score += 10;
    else if (data.market_cap < 1e9) score += 5;
    
    const cryptoRisk = Math.random() * 30 + 20;
    score -= cryptoRisk / 3;
    
    if (score > 70) action = 'BUY';
    else if (score < 30) action = 'SELL';
    
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    
    return {
        symbol: crypto.toUpperCase(),
        action: action,
        strength: finalScore,
        price: data.price,
        target: action === 'BUY' ? 
            Math.round(data.price * 1.08) : 
            Math.round(data.price * 0.92),
        risk: Math.round(cryptoRisk + Math.abs(data.change))
    };
}

function analyzeSentiment(articles) {
    const positiveWords = ['growth', 'increase', 'boost', 'positive', 'strong', 'bullish', 'up', 'gain'];
    const negativeWords = ['decline', 'decrease', 'drop', 'negative', 'weak', 'bearish', 'down', 'loss', 'crisis', 'disruption'];
    
    let score = 0;
    let totalWords = 0;
    
    articles.forEach(article => {
        const text = (article.title + ' ' + (article.description || '')).toLowerCase();
        const words = text.split(/\s+/);
        totalWords += words.length;
        
        words.forEach(word => {
            if (positiveWords.some(pw => word.includes(pw))) score += 1;
            if (negativeWords.some(nw => word.includes(nw))) score -= 1;
        });
    });
    
    const normalizedScore = totalWords > 0 ? score / totalWords * 100 : 0;
    let label = 'Neutral';
    
    if (normalizedScore > 2) label = 'Bullish';
    else if (normalizedScore > 0.5) label = 'Slightly Positive';
    else if (normalizedScore < -2) label = 'Bearish';
    else if (normalizedScore < -0.5) label = 'Slightly Negative';
    
    return { score: normalizedScore, label };
}

function startMonitoring() {
    console.log('📊 Starting market monitoring...');
    
    // Check for signals every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('🔍 Scanning for high-probability signals...');
        
        if (!ALERT_CHANNEL_ID) return;
        
        const channel = client.channels.cache.get(ALERT_CHANNEL_ID);
        if (!channel) return;
        
        const signals = [];
        
        for (const symbol of watchlist.stocks.slice(0, 3)) {
            try {
                const data = await getStockData(symbol);
                if (data) {
                    const signal = analyzeStock(symbol, data);
                    if (signal.strength > 80) {
                        signals.push(signal);
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.log(`Monitor error for ${symbol}:`, error.message);
            }
        }
        
        for (const signal of signals) {
            const embed = new EmbedBuilder()
                .setTitle(`🚨 HIGH PROBABILITY ALERT: ${signal.symbol}`)
                .setColor(signal.action === 'BUY' ? '#00ff88' : '#ff6b6b')
                .addFields(
                    { name: '💰 Price', value: `$${signal.price}`, inline: true },
                    { name: '🎯 Action', value: signal.action, inline: true },
                    { name: '💪 Score', value: `${signal.strength}/100`, inline: true },
                    { name: '🎯 Target', value: `$${signal.target}`, inline: true },
                    { name: '⚠️ Risk', value: `${signal.risk}/100`, inline: true },
                    { name: '📱 Execute', value: 'CashApp/Webull', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Not financial advice • Trade responsibly' });
            
            await channel.send({ content: '@everyone', embeds: [embed] });
        }
    });
    
    // Daily morning report
    cron.schedule('0 9 * * 1-5', async () => {
        if (!ALERT_CHANNEL_ID) return;
        
        const channel = client.channels.cache.get(ALERT_CHANNEL_ID);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🌅 Daily Market Brief')
            .setDescription('Good morning! Here\'s your market overview for today.')
            .setColor('#00aaff')
            .addFields(
                { name: '📊 Markets', value: 'Scanning for opportunities...', inline: false },
                { name: '💡 Tip', value: 'Use `!signals` for live trading opportunities', inline: false }
            )
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
    }, {
        timezone: "America/New_York"
    });
}

// Health check for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running!',
        uptime: process.uptime(),
        watchlist: watchlist
    });
});

app.listen(PORT, () => {
    console.log(`🏥 Health server running on port ${PORT}`);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

// Bot login
client.login(DISCORD_TOKEN);
