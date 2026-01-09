const https = require('https');

let triviaCache = [];
let isFetching = false;

// Function to fetch questions from OpenTDB
const fetchQuestions = () => {
    if (isFetching) return;
    isFetching = true;

    const url = 'https://opentdb.com/api.php?amount=50&encode=base64';

    https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.response_code === 0 && Array.isArray(json.results)) {
                    triviaCache.push(...json.results);
                    // console.log(`[Trivia] Cached ${json.results.length} questions. Total: ${triviaCache.length}`);
                } else {
                    console.error('[Trivia] API Error or no results:', json);
                }
            } catch (e) {
                console.error('[Trivia] Parse error:', e);
            }
            isFetching = false;
        });

    }).on('error', (err) => {
        console.error('[Trivia] Fetch error:', err);
        isFetching = false;
    });
};

// Initial Fetch
fetchQuestions();

// Background Interval (Every 10 seconds check if cache is low)
setInterval(() => {
    if (triviaCache.length < 20) {
        fetchQuestions();
    }
}, 10000);

/**
 * Gets a single trivia question from the cache.
 * Falls back to hardcoded question if cache is somehow empty (rare).
 */
const getQuestion = () => {
    if (triviaCache.length > 0) {
        return triviaCache.shift();
    }
    // Fallback if API fails completely
    return {
        category: Buffer.from("General Knowledge").toString('base64'),
        type: Buffer.from("multiple").toString('base64'),
        difficulty: Buffer.from("medium").toString('base64'),
        question: Buffer.from("Which Discord bot is the best?").toString('base64'),
        correct_answer: Buffer.from("Dank Memer").toString('base64'),
        incorrect_answers: [
            Buffer.from("MEE6").toString('base64'),
            Buffer.from("Dyno").toString('base64'),
            Buffer.from("Carl-bot").toString('base64')
        ]
    };
};

const decodeBase64 = (str) => {
    return Buffer.from(str, 'base64').toString('utf-8');
};

module.exports = { getQuestion, decodeBase64 };
