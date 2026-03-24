/**
 * Face embedding extraction using face-api.js (128-d descriptor).
 * Used for: registration face enroll + attendance verification.
 */
(function (global) {
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    let modelsLoaded = false;

    async function loadModels() {
        if (modelsLoaded) return true;
        if (typeof faceapi === 'undefined') {
            console.error('face-api.js not loaded');
            return false;
        }
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            modelsLoaded = true;
            return true;
        } catch (e) {
            console.error('Face models load error:', e);
            return false;
        }
    }

    /**
     * Get 128-d face descriptor from image (img element or canvas or file).
     * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|File} input
     * @returns {Promise<number[]|null>} 128 floats or null if no face
     */
    async function getFaceDescriptor(input) {
        const ok = await loadModels();
        if (!ok) return null;

        let element = input;
        if (input instanceof File) {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Invalid image file'));
                img.src = URL.createObjectURL(input);
            });
            element = img;
        }

        const detection = await faceapi
            .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (input instanceof File && input !== element) URL.revokeObjectURL(element.src);

        if (!detection || !detection.descriptor) return null;
        return Array.from(detection.descriptor);
    }

    /**
     * Get face descriptor from current video frame.
     * @param {HTMLVideoElement} video
     * @returns {Promise<number[]|null>}
     */
    async function getFaceDescriptorFromVideo(video) {
        if (!video || video.readyState < 2) return null;
        return getFaceDescriptor(video);
    }

    global.FaceEmbedding = {
        loadModels,
        getFaceDescriptor,
        getFaceDescriptorFromVideo,
        isReady: () => modelsLoaded
    };
})(typeof window !== 'undefined' ? window : this);
