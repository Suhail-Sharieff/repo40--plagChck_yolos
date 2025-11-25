const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const natural = require('natural');
const { generateFingerprint, calculateSimilarity } = require('./winnowing');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Database of Known Code (for demo purposes) ---
// In a real system, this would be a database of millions of submissions.
const codeDatabase = [
    {
        id: 'algo_001',
        name: 'Two Sum (JavaScript)',
        content: `function twoSum(nums, target) {
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    if (nums[i] + nums[j] === target) {
                        return [i, j];
                    }
                }
            }
        }`
    },
    {
        id: 'algo_002',
        name: 'Factorial Recursive',
        content: `const factorial = (n) => {
            if (n === 0 || n === 1) return 1;
            return n * factorial(n - 1);
        }`
    },
    {
        id: 'algo_003',
        name: 'Bubble Sort',
        content: `function bubbleSort(arr) {
            let len = arr.length;
            for (let i = 0; i < len; i++) {
                for (let j = 0; j < len - 1; j++) {
                    if (arr[j] > arr[j + 1]) {
                        let tmp = arr[j];
                        arr[j] = arr[j + 1];
                        arr[j + 1] = tmp;
                    }
                }
            }
            return arr;
        }`
    }
];

// Pre-calculate fingerprints for database
codeDatabase.forEach(entry => {
    entry.fingerprint = generateFingerprint(entry.content);
});

// --- Plagiarism Detection Logic ---
function checkSimilarity(candidateCode) {
    let maxSimilarity = 0;
    let bestMatch = null;

    const candidateFingerprint = generateFingerprint(candidateCode);

    if (candidateFingerprint.length === 0) {
        return { score: 0, match: null };
    }

    codeDatabase.forEach(entry => {
        const similarity = calculateSimilarity(candidateFingerprint, entry.fingerprint);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatch = entry;
        }
    });

    return {
        score: maxSimilarity,
        match: bestMatch
    };
}

// --- Routes ---

app.post('/api/plagiarism', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    console.log(`[Plagiarism] Analyzing submission... length: ${code.length}`);

    const result = checkSimilarity(code);
    const isFlagged = result.score > 0.85; // Threshold

    const response = {
        score: (result.score * 100).toFixed(1),
        isFlagged: isFlagged,
        matchedWith: isFlagged ? result.match.name : null
    };

    console.log(`[Plagiarism] Result: ${response.score}% match. Flagged: ${response.isFlagged}`);
    res.json(response);
});

app.post('/api/violation', (req, res) => {
    const { type, details, timestamp } = req.body;
    console.log(`\x1b[31m[VIOLATION] ${timestamp} - ${type}: ${details}\x1b[0m`);
    // In a real app, save to DB
    res.json({ status: 'logged' });
});

app.post('/api/telemetry', (req, res) => {
    const { gaze, objects, timestamp } = req.body;
    // Clear line and write over it for a "live" feel, or just log new lines
    // Using carriage return \r to overwrite the line is cool for status updates
    process.stdout.write(`\r\x1b[K[LIVE ANALYZER] Gaze: \x1b[36m${gaze}\x1b[0m | Objects: \x1b[33m${objects.join(', ') || 'None'}\x1b[0m`);
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Loaded ${codeDatabase.length} reference algorithms.`);
    console.log("Waiting for client telemetry...");
});
