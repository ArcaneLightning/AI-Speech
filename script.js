const recordBtn = document.getElementById('record-btn');
const recordBtnText = document.getElementById('record-btn-text');
const recordingIndicator = document.getElementById('recording-indicator');
const transcriptionOutput = document.getElementById('transcription-output');
const feedbackContainer = document.getElementById('feedback-container');
const loader = document.getElementById('loader');
const feedbackResults = document.getElementById('feedback-results');

let isRecording = false;
let recognition;
let transcript = '';
let wordCount = 0;
let startTime;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        recordBtnText.textContent = 'Stop Recording';
        recordingIndicator.classList.remove('hidden');
        feedbackContainer.classList.add('hidden');
        feedbackResults.innerHTML = '';
        transcriptionOutput.innerHTML = '';
        transcript = '';
        wordCount = 0;
        startTime = new Date();
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        transcriptionOutput.innerHTML = transcript + '<i class="text-gray-500">' + interimTranscript + '</i>';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
        isRecording = false;
        recordBtnText.textContent = 'Start Recording';
        recordingIndicator.classList.add('hidden');
        if (transcript.trim().length > 0) {
            analyzeSpeech(transcript);
        }
    };

} else {
    recordBtn.disabled = true;
    recordBtnText.textContent = 'Speech Recognition Not Supported';
    transcriptionOutput.textContent = 'Sorry, your browser does not support speech recognition. Please try Google Chrome.';
}

recordBtn.addEventListener('click', () => {
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

async function analyzeSpeech(text) {
    feedbackContainer.classList.remove('hidden');
    loader.classList.remove('hidden');
    feedbackResults.innerHTML = '';

    wordCount = text.trim().split(/\s+/).length;
    const durationInMinutes = (new Date() - startTime) / 60000;
    const wordsPerMinute = Math.round(wordCount / durationInMinutes) || 0;

    const prompt = `
        You are an expert speech and debate coach. Analyze the following speech transcript.
        Provide feedback in JSON format. The JSON object should have these keys:
        - "clarity_conciseness": A summary (2-3 sentences) on the speech's clarity and conciseness.
        - "filler_words": An analysis of potential filler words (like "um", "ah", "like", "so", "you know"). Provide a list of detected filler words and their counts.
        - "pacing_feedback": Feedback on the pacing based on a speed of ${wordsPerMinute} words per minute.
        - "argument_strength": An analysis of the argument structure. Identify the main claim, supporting points, and any potential logical fallacies. If no clear argument, state that.
        - "overall_impression": A brief overall impression and a key suggestion for improvement.

        Transcript: "${text}"
    `;
    
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { 
        contents: chatHistory,
        generationConfig: {
                responseMimeType: "application/json",
        }
    };

    const apiKey = ""; // Leave empty, will be handled by the environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const feedbackJsonText = result.candidates[0].content.parts[0].text;
            const feedback = JSON.parse(feedbackJsonText);
            displayFeedback(feedback, wordsPerMinute);
        } else {
            displayError("Could not get a valid response from the AI coach.");
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        displayError('Failed to analyze speech. Please try again.');
    } finally {
        loader.classList.add('hidden');
    }
}

function displayError(message) {
    feedbackResults.innerHTML = `<div class="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">${message}</div>`;
}

function displayFeedback(feedback, wpm) {
        let fillerWordHtml = '<p>No significant filler words detected.</p>';
    if (feedback.filler_words && typeof feedback.filler_words === 'object' && Object.keys(feedback.filler_words).length > 0) {
        fillerWordHtml = '<ul class="list-disc list-inside">';
        for (const [word, count] of Object.entries(feedback.filler_words)) {
            fillerWordHtml += `<li><strong>${word}:</strong> ${count} time(s)</li>`;
        }
        fillerWordHtml += '</ul>';
    }


    feedbackResults.innerHTML = `
        <div class="grid md:grid-cols-2 gap-6">
            <!-- Left Column -->
            <div>
                <div class="feature-card p-6 rounded-lg mb-6">
                    <h5 class="text-xl font-semibold mb-2">Overall Impression</h5>
                    <p class="text-gray-300">${feedback.overall_impression}</p>
                </div>
                    <div class="feature-card p-6 rounded-lg mb-6">
                    <h5 class="text-xl font-semibold mb-2">Clarity & Conciseness</h5>
                    <p class="text-gray-300">${feedback.clarity_conciseness}</p>
                </div>
                    <div class="feature-card p-6 rounded-lg">
                    <h5 class="text-xl font-semibold mb-2">Argument Strength</h5>
                    <p class="text-gray-300">${feedback.argument_strength}</p>
                </div>
            </div>

            <!-- Right Column -->
            <div>
                <div class="feature-card p-6 rounded-lg mb-6">
                    <h5 class="text-xl font-semibold mb-2">Pacing</h5>
                    <div class="text-center">
                        <p class="text-4xl font-bold text-indigo-400">${wpm} WPM</p>
                        <p class="text-gray-300 mt-2">${feedback.pacing_feedback}</p>
                    </div>
                </div>
                    <div class="feature-card p-6 rounded-lg">
                    <h5 class="text-xl font-semibold mb-2">Filler Words</h5>
                    <div class="text-gray-300">${fillerWordHtml}</div>
                </div>
            </div>
        </div>
    `;
}