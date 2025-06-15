from PIL import Image
import os

# Configuration
MAX_FILESIZE_MB = 2
MAX_DIMENSION = 2560  # max width or height in pixels
JPEG_QUALITY = 85
SUPPORTED_FORMATS = ('.jpg', '.jpeg', '.png')
INPUT_DIR = '/Users/markvalencia/Shelf/damnpictures/uncompressed_photos'
OUTPUT_DIR = '/Users/markvalencia/Shelf/damnpictures/albums'

def compress_image(file_path, output_path):
    try:
        with Image.open(file_path) as img:
            img_format = img.format
            img = img.convert('RGB')  # Convert for JPEG saving

            # Resize if too large
            width, height = img.size
            if max(width, height) > MAX_DIMENSION:
                if width > height:
                    new_width = MAX_DIMENSION
                    new_height = int((MAX_DIMENSION / width) * height)
                else:
                    new_height = MAX_DIMENSION
                    new_width = int((MAX_DIMENSION / height) * width)
                img = img.resize((new_width, new_height), Image.LANCZOS)

            # Save with compression
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            img.save(output_path, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    except Exception as e:
        print(f"Failed to process {file_path}: {e}")

def is_file_acceptable(file_path):
    return os.path.getsize(file_path) <= MAX_FILESIZE_MB * 1024 * 1024

def process_directory(input_dir, output_dir):
    for root, _, files in os.walk(input_dir):
        for file in files:
            if file.lower().endswith(SUPPORTED_FORMATS):
                input_path = os.path.join(root, file)
                rel_path = os.path.relpath(input_path, input_dir)
                output_path = os.path.join(output_dir, rel_path)

                if not is_file_acceptable(input_path):
                    compress_image(input_path, output_path)
                else:
                    # Copy without modification
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(input_path, 'rb') as src, open(output_path, 'wb') as dst:
                        dst.write(src.read())

process_directory(INPUT_DIR, OUTPUT_DIR)
