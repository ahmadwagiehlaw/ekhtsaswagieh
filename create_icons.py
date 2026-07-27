import sys
from PIL import Image
import os

input_img = sys.argv[1]
output_dir = sys.argv[2]

img = Image.open(input_img)
img = img.convert("RGBA")
img.resize((192, 192)).save(os.path.join(output_dir, "icon-192.png"))
img.resize((512, 512)).save(os.path.join(output_dir, "icon-512.png"))
print("Icons generated successfully!")

