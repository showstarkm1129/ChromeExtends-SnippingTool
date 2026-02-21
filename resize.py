from PIL import Image
import sys

def resize_icon(input_path, output_dir):
    sizes = [16, 48, 128]
    try:
        with Image.open(input_path) as img:
            for size in sizes:
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                output_path = f"{output_dir}/icon{size}.png"
                resized_img.save(output_path, "PNG")
                print(f"Saved {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python resize.py <input_image> <output_dir>")
        sys.exit(1)
    resize_icon(sys.argv[1], sys.argv[2])
