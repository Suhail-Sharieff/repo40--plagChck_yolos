document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('webcam');
    const errorElement = document.getElementById('camera-error');
    const inputElement = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // Initialize Webcam
    async function startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                }
            });
            videoElement.srcObject = stream;
        } catch (err) {
            console.error("Error accessing webcam:", err);
            errorElement.classList.remove('hidden');
            // Optional: Add a retry button logic here if needed
        }
    }

    startWebcam();

    // Load Models
    let faceModel = undefined;

    // Only load FaceMesh locally. Object detection moves to Python server.
    faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        { runtime: 'tfjs' }
    ).then(loadedFace => {
        faceModel = loadedFace;
        console.log("FaceMesh loaded");
        detectFrame();
    }).catch(err => {
        console.error("Failed to load FaceMesh:", err);
    });

    const alertContainer = document.getElementById('alert-container');
    let lastAnalysisTime = 0;

    // Helper to capture frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function getFrameAsBase64() {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.7); // Compress slightly
    }

    function isLookingAway(predictions) {
        if (predictions.length === 0) return false;

        // New API returns keypoints array directly in the prediction object
        const keypoints = predictions[0].keypoints;
        if (!keypoints) return false;

        // 1: Nose Tip, 234: Left Cheek, 454: Right Cheek
        // Note: Indices might slightly vary or be named, but usually match 468 mesh
        const nose = keypoints[1];
        const leftCheek = keypoints[234];
        const rightCheek = keypoints[454];

        if (!nose || !leftCheek || !rightCheek) return false;

        const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
        const noseOffset = nose.x - leftCheek.x;
        const ratio = noseOffset / faceWidth;

        // Normal ratio is around 0.5. < 0.3 is looking left, > 0.7 is looking right
        if (ratio < 0.2 || ratio > 0.8) return "Turning Head";

        return false;
    }

    async function updateAlerts() {
        if (videoElement.readyState !== 4) return;

        alertContainer.innerHTML = '';
        let suspicious = false;
        let reasons = [];

        // 1. Gaze Detection (Local)
        if (faceModel) {
            const facePredictions = await faceModel.estimateFaces(videoElement);
            const gazeStatus = isLookingAway(facePredictions);
            if (gazeStatus) {
                suspicious = true;
                reasons.push(`Looking Away (${gazeStatus})`);
            }
        }

        // 2. Object Detection (Python Server)
        const now = Date.now();
        if (now - lastAnalysisTime > 1000) { // Check every 1 second
            try {
                const imageBase64 = getFrameAsBase64();
                const response = await fetch('http://localhost:5000/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageBase64 })
                });

                const data = await response.json();

                if (data.suspicious) {
                    suspicious = true;
                    reasons.push(...data.reasons);
                }

                // Store server results to display in between checks
                window.lastServerReasons = data.reasons || [];
                window.lastServerSuspicious = data.suspicious;

            } catch (err) {
                console.error("Server analysis failed:", err);
            }
            lastAnalysisTime = now;
        } else {
            // Use cached server results
            if (window.lastServerSuspicious) {
                suspicious = true;
                reasons.push(...(window.lastServerReasons || []));
            }
        }

        // Deduplicate reasons
        reasons = [...new Set(reasons)];

        if (suspicious) {
            reasons.forEach(reason => {
                const alert = document.createElement('div');
                alert.className = 'alert';
                alert.innerHTML = `⚠️ ${reason}`;
                alertContainer.appendChild(alert);
            });
        } else {
            const alert = document.createElement('div');
            alert.className = 'alert clean';
            alert.innerHTML = `✅ Environment Secure`;
            alertContainer.appendChild(alert);
        }
    }

    function detectFrame() {
        updateAlerts().then(() => {
            requestAnimationFrame(detectFrame);
        });
    }

    // Plagiarism Check
    const checkPlagBtn = document.getElementById('check-plagiarism-btn');
    const plagResult = document.getElementById('plagiarism-result');

    checkPlagBtn.addEventListener('click', async () => {
        // Simulating getting code from the current input or a mock editor
        const currentCode = inputElement.value.trim();

        if (!currentCode) {
            alert("Please enter some code to check.");
            return;
        }

        plagResult.classList.remove('hidden');
        plagResult.innerHTML = 'Analyzing code database...';

        try {
            const response = await fetch('http://localhost:3000/api/plagiarism', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: currentCode })
            });

            const result = await response.json();

            plagResult.className = result.isFlagged ? 'danger' : 'safe';
            plagResult.innerHTML = `
<strong>Similarity Score: ${result.score}%</strong>
${result.isFlagged ? `<br>⚠️ Flagged for review. High similarity with ${result.matchedWith}.` : '<br>✅ Code appears original.'}
            `;
        } catch (err) {
            console.error(err);
            plagResult.innerHTML = "Error connecting to server.";
        }
    });

    // Handle Input
    function handleSend() {
        const text = inputElement.value.trim();
        if (text) {
            console.log("User sent:", text);
            // Here you would typically send the data somewhere

            // Visual feedback
            const originalBtnContent = sendBtn.innerHTML;
            sendBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;

            setTimeout(() => {
                sendBtn.innerHTML = originalBtnContent;
                inputElement.value = '';
            }, 1000);
        }
    }

    sendBtn.addEventListener('click', handleSend);

    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    });
});
