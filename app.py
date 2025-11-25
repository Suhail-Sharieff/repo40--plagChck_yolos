from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import YolosImageProcessor, YolosForObjectDetection
from PIL import Image
import torch
import base64
import io
import time

app = Flask(__name__)
CORS(app)

print("Loading AI Model (YOLOS)... this may take a moment...")
try:
    model = YolosForObjectDetection.from_pretrained('hustvl/yolos-tiny')
    image_processor = YolosImageProcessor.from_pretrained('hustvl/yolos-tiny')
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.route('/analyze', methods=['POST'])
def analyze():
    if not model:
        return jsonify({'error': 'Model not loaded'}), 500

    data = request.json
    if 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        # Decode base64 image
        image_data = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # Run inference
        start_time = time.time()
        inputs = image_processor(images=image, return_tensors="pt")
        outputs = model(**inputs)
        inference_time = (time.time() - start_time) * 3000

        # Post-process results
        target_sizes = torch.tensor([image.size[::-1]])
        results = image_processor.post_process_object_detection(outputs, threshold=0.9, target_sizes=target_sizes)[0]

        detections = []
        suspicious = False
        reasons = []

        print(f"\n--- Analysis Request ({image.size[0]}x{image.size[1]}) ---")
        print(f"Inference Time: {inference_time:.2f}ms")

        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            label_name = model.config.id2label[label.item()]
            confidence = round(score.item(), 2)
            
            detections.append({
                'label': label_name,
                'confidence': confidence
            })

            print(f" > Detected: \033[96m{label_name}\033[0m ({confidence*100:.1f}%) at {box.tolist()}")

            if label_name == 'cell phone':
                suspicious = True
                if 'Cell phone detected' not in reasons:
                    reasons.append('Cell phone detected')
            
            # Count people logic would need aggregation, but for now just list them
        
        person_count = len([d for d in detections if d['label'] == 'person'])
        if person_count > 1:
            suspicious = True
            reasons.append(f'Multiple people detected ({person_count})')

        # Log to console
        log_color = "\033[91m" if suspicious else "\033[92m"
        reset_color = "\033[0m"
        print(f"{log_color}[RESULT] Suspicious: {suspicious} | Reasons: {reasons}{reset_color}")
        print("--------------------------------------------------\n")

        return jsonify({
            'suspicious': suspicious,
            'reasons': reasons,
            'detections': detections
        })

    except Exception as e:
        print(f"Error processing image: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
