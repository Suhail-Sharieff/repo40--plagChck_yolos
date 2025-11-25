const crypto = require('crypto');

// Configuration for Winnowing
const K_GRAM_SIZE = 20; // Size of the sliding window (characters)
const WINDOW_SIZE = 10; // Window size for selecting fingerprints

/**
 * Preprocesses code by removing comments and whitespace.
 * This makes the detection robust against formatting changes.
 */
function sanitizeCode(code) {
    // Remove single-line comments
    let clean = code.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove all whitespace and convert to lowercase
    clean = clean.replace(/\s+/g, '').toLowerCase();
    return clean;
}

/**
 * Generates k-grams from the sanitized string.
 */
function generateKGrams(text, k) {
    const kgrams = [];
    for (let i = 0; i <= text.length - k; i++) {
        kgrams.push(text.substring(i, i + k));
    }
    return kgrams;
}

/**
 * Hashes a string using MD5 and returns a simplified integer hash.
 * (In production, a rolling hash like Rabin-Karp is faster, but MD5 is easier to implement reliably here)
 */
function hashString(str) {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    // Take first 8 chars to keep it manageable
    return parseInt(hash.substring(0, 8), 16);
}

/**
 * The Winnowing Algorithm.
 * Selects the minimum hash in each window to form a fingerprint.
 */
function winnow(hashes, windowSize) {
    const fingerprints = new Set();
    const len = hashes.length;

    for (let i = 0; i <= len - windowSize; i++) {
        let minHash = Infinity;
        // Find min hash in current window
        for (let j = 0; j < windowSize; j++) {
            if (hashes[i + j] < minHash) {
                minHash = hashes[i + j];
            }
        }
        fingerprints.add(minHash);
    }

    return Array.from(fingerprints);
}

/**
 * Main function to generate a fingerprint for a code snippet.
 */
function generateFingerprint(code) {
    const cleanCode = sanitizeCode(code);
    if (cleanCode.length < K_GRAM_SIZE) return [];

    const kgrams = generateKGrams(cleanCode, K_GRAM_SIZE);
    const hashes = kgrams.map(hashString);
    const fingerprint = winnow(hashes, WINDOW_SIZE);

    return fingerprint;
}

/**
 * Calculates similarity between two fingerprints using Jaccard Index.
 * Intersection / Union
 */
function calculateSimilarity(fp1, fp2) {
    const set1 = new Set(fp1);
    const set2 = new Set(fp2);

    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    for (const hash of set1) {
        if (set2.has(hash)) {
            intersection++;
        }
    }

    const union = set1.size + set2.size - intersection;
    return intersection / union;
}

module.exports = {
    generateFingerprint,
    calculateSimilarity
};
