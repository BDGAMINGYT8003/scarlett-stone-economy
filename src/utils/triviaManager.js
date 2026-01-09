const axios = require('axios');
const { log } = require('./logger');

let triviaCache = [];
let isFetching = false;

// Decode Base64 function
const decodeBase64 = (str) => {
    try {
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {
        return str;
    }
};

const fetchTriviaQuestions = async () => {
    if (isFetching) return;
    if (triviaCache.length > 500) return; // Don't overfill

    isFetching = true;
    try {
        const response = await axios.get('https://opentdb.com/api.php?amount=50&encode=base64', {
            timeout: 5000 // 5s timeout
        });

        if (response.data && response.data.results) {
            const newQuestions = response.data.results.map(q => ({
                category: decodeBase64(q.category),
                type: decodeBase64(q.type),
                difficulty: decodeBase64(q.difficulty),
                question: decodeBase64(q.question),
                correct_answer: decodeBase64(q.correct_answer),
                incorrect_answers: q.incorrect_answers.map(decodeBase64)
            }));
            triviaCache.push(...newQuestions);
            // log(`Fetched ${newQuestions.length} trivia questions. Cache size: ${triviaCache.length}`, 'info');
        } else {
            // log('Failed to fetch trivia questions: Invalid response', 'warn');
        }
    } catch (error) {
        // log(`Error fetching trivia questions: ${error.message}`, 'error');
    } finally {
        isFetching = false;
    }
};

const startTriviaScheduler = () => {
    fetchTriviaQuestions(); // Initial fetch
    setInterval(fetchTriviaQuestions, 10000); // Fetch every 10 seconds
};

const getTriviaQuestion = () => {
    if (triviaCache.length === 0) return null;
    return triviaCache.shift();
};

module.exports = {
    startTriviaScheduler,
    getTriviaQuestion
};
