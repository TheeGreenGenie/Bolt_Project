const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function transcribeAudioFile(audioFilePath) {
    let browser;
    try {
        console.log('🎤 Starting headless transcription...');
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--allow-file-access-from-files',
                '--disable-web-security',
                '--autoplay-policy=no-user-gesture-required'
            ]
        });
        
        const page = await browser.newPage();
        
        // Grant permissions
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'permissions', {
                value: {
                    query: () => Promise.resolve({ state: 'granted' })
                }
            });
        });
        
        // Create transcription HTML
        const transcriptionHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Audio Transcription</title>
        </head>
        <body>
            <audio id="audioPlayer" controls style="display:none;"></audio>
            <div id="transcript"></div>
            
            <script>
                let recognition;
                let finalTranscript = '';
                
                function startTranscription() {
                    return new Promise((resolve, reject) => {
                        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                            recognition.continuous = true;
                            recognition.interimResults = false;
                            recognition.lang = 'en-US';
                            
                            recognition.onresult = function(event) {
                                for (let i = event.resultIndex; i < event.results.length; i++) {
                                    if (event.results[i].isFinal) {
                                        finalTranscript += event.results[i][0].transcript + ' ';
                                    }
                                }
                                document.getElementById('transcript').textContent = finalTranscript;
                            };
                            
                            recognition.onerror = function(event) {
                                console.error('Speech recognition error:', event.error);
                                reject(event.error);
                            };
                            
                            recognition.onend = function() {
                                console.log('Transcription completed');
                                resolve(finalTranscript.trim());
                            };
                            
                            recognition.start();
                            
                            // Auto-stop after audio duration + buffer
                            setTimeout(() => {
                                if (recognition) {
                                    recognition.stop();
                                }
                            }, 30000); // 30 second max
                            
                        } else {
                            reject('Speech recognition not supported');
                        }
                    });
                }
                
                async function loadAndTranscribe(audioFile) {
                    const audio = document.getElementById('audioPlayer');
                    audio.src = audioFile;
                    
                    return new Promise((resolve, reject) => {
                        audio.onloadeddata = async () => {
                            try {
                                // Start recognition then play audio
                                const transcriptionPromise = startTranscription();
                                
                                // Small delay then play
                                setTimeout(() => {
                                    audio.play();
                                }, 100);
                                
                                const transcript = await transcriptionPromise;
                                resolve(transcript);
                                
                            } catch (error) {
                                reject(error);
                            }
                        };
                        
                        audio.onerror = () => reject('Audio load failed');
                    });
                }
                
                // Expose to Node.js
                window.transcribeAudio = loadAndTranscribe;
            </script>
        </body>
        </html>`;
        
        await page.setContent(transcriptionHTML);
        
        // Convert audio file to data URL
        const audioBuffer = fs.readFileSync(audioFilePath);
        const audioBase64 = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/webm;base64,${audioBase64}`;
        
        // Transcribe
        const transcript = await page.evaluate(async (audioData) => {
            return await window.transcribeAudio(audioData);
        }, audioDataUrl);
        
        console.log('✅ Transcription completed:', transcript.substring(0, 100) + '...');
        return transcript;
        
    } catch (error) {
        console.error('❌ Transcription failed:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { transcribeAudioFile };