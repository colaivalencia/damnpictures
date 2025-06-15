import os
import json

BASE_DIR = 'albums'
output_file = 'gallery.js'
image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

def scan_albums():
    items = []

    for root, dirs, files in os.walk(BASE_DIR):
        rel_dir = os.path.relpath(root, BASE_DIR)
        group = None if rel_dir == '.' else rel_dir

        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in image_extensions:
                rel_path = os.path.join(root, file).replace('\\', '/')
                item = {
                    "name": os.path.splitext(file)[0],
                    "src": rel_path,
                }
                if group:
                    item["group"] = group
                items.append(item)
    
    return items

def generate_js(items):
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("const allItems = ")
        json.dump(items, f, indent=2)
        f.write(";")

if __name__ == '__main__':
    gallery = scan_albums()
    generate_js(gallery)
    print(f"✅ Generated {output_file} with {len(gallery)} images.")
