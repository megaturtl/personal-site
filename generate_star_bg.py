import os
from PIL import Image, ImageDraw
import random
from pathlib import Path
import math

# Directory containing the star GIFs
STARS_DIR = "src/assets/images/pixel stars"
OUTPUT_FILE = "src/assets/images/star_background.gif"
CANVAS_SIZE = (1000, 1000)

# Debug settings
DEBUG_SHOW_GRID = False # Toggle to show/hide grid lines
DEBUG_GRID_COLOR = (255, 0, 0, 128)  # Semi-transparent red

# Distribution settings
CELLS_PER_SIDE = 10  # Number of cells per side (total cells will be this squared)
CELL_SIZE = (CANVAS_SIZE[0] // CELLS_PER_SIDE, CANVAS_SIZE[1] // CELLS_PER_SIDE)  # Calculated from canvas size
MIN_DISTANCE = 20  # Minimum distance between star centers

# Animation settings
GLOBAL_SPEED_MULTIPLIER = 1.5  # Higher = faster animation (e.g., 2.0 = twice as fast)
SPEED_VARIATION_CHANCE = 0.8  
SPEED_VARIATION_RANGE = (0.75, 1.75)  # Random multiplier range for animation speed
STATIC_STAR_CHANCE = 0.10  # 15% chance for a star to be static

def get_gif_info(gif_path):
    """Get the number of frames and their durations from a GIF file."""
    with Image.open(gif_path) as img:
        n_frames = 0
        durations = []
        try:
            while True:
                n_frames += 1
                durations.append(img.info.get('duration', 100))
                img.seek(img.tell() + 1)
        except EOFError:
            pass
    return n_frames, durations

def distance(p1, p2):
    """Calculate distance between two points."""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def get_cell_bounds(cell_x, cell_y):
    """Get the boundaries of a cell."""
    x_start = cell_x * CELL_SIZE[0]
    y_start = cell_y * CELL_SIZE[1]
    return (x_start, y_start, x_start + CELL_SIZE[0], y_start + CELL_SIZE[1])

def is_valid_position(pos, star_size, existing_stars, cell_bounds):
    """Check if a position is valid for placing a new star."""
    star_center = (pos[0] + star_size[0]/2, pos[1] + star_size[1]/2)
    x_min, y_min, x_max, y_max = cell_bounds
    
    # Check if star is completely within cell bounds
    if (pos[0] < x_min or pos[1] < y_min or 
        pos[0] + star_size[0] > x_max or 
        pos[1] + star_size[1] > y_max):
        return False
    
    # Check distance from other stars
    for other_pos, other_size in existing_stars:
        other_center = (other_pos[0] + other_size[0]/2, other_pos[1] + other_size[1]/2)
        if distance(star_center, other_center) < MIN_DISTANCE:
            return False
    
    return True

def try_place_star(cell_bounds, star_size, existing_stars, attempts=50):
    """Try to place a star within given cell bounds."""
    x_min, y_min, x_max, y_max = cell_bounds
    
    for _ in range(attempts):
        # Calculate position ensuring star fits entirely within cell
        x = random.randint(x_min, x_max - star_size[0])
        y = random.randint(y_min, y_max - star_size[1])
        
        if is_valid_position((x, y), star_size, existing_stars, cell_bounds):
            return (x, y)
    return None

def create_star_background():
    # Get all GIF files and their sizes
    star_files = list(Path(STARS_DIR).glob("*.gif"))
    if not star_files:
        print("No GIF files found in the stars directory!")
        return

    # Get star sizes and sort into categories
    star_sizes = {}
    for star_file in star_files:
        with Image.open(star_file) as img:
            star_sizes[star_file] = img.size
    
    # Sort stars by size for better distribution
    small_stars = []
    medium_stars = []
    large_stars = []
    
    for star_file, size in star_sizes.items():
        area = size[0] * size[1]
        if area < 400:
            small_stars.append(star_file)
        elif area < 900:
            medium_stars.append(star_file)
        else:
            large_stars.append(star_file)
    
    # Calculate frame information
    frame_counts = []
    for star_file in star_files:
        n_frames, _ = get_gif_info(star_file)
        frame_counts.append(n_frames)
    
    total_frames = max(frame_counts)
    frames = []
    frame_durations = []
    
    # Create base frames
    for _ in range(total_frames):
        base = Image.new('RGBA', CANVAS_SIZE, (0, 0, 0, 0))
        frames.append(base)
        frame_durations.append(100)
    
    existing_stars = []
    
    # Draw debug grid lines if enabled
    if DEBUG_SHOW_GRID:
        for frame in frames:
            draw = ImageDraw.Draw(frame)
            # Draw vertical lines
            for x in range(0, CANVAS_SIZE[0] + 1, CELL_SIZE[0]):
                draw.line([(x, 0), (x, CANVAS_SIZE[1])], fill=DEBUG_GRID_COLOR, width=1)
            # Draw horizontal lines
            for y in range(0, CANVAS_SIZE[1] + 1, CELL_SIZE[1]):
                draw.line([(0, y), (CANVAS_SIZE[0], y)], fill=DEBUG_GRID_COLOR, width=1)

    # Place one star in each cell
    for cell_x in range(CELLS_PER_SIDE):
        for cell_y in range(CELLS_PER_SIDE):
            cell_bounds = get_cell_bounds(cell_x, cell_y)
            
            # Choose star size category with bias towards smaller stars
            if random.random() < 0.6 and small_stars:
                star_list = small_stars
            elif random.random() < 0.8 and medium_stars:
                star_list = medium_stars
            elif large_stars:
                star_list = large_stars
            else:
                continue
            
            # Try stars from the chosen category until one fits
            for _ in range(len(star_list)):
                star_file = random.choice(star_list)
                star_size = star_sizes[star_file]
                
                # Skip if star is too big for cell
                if (star_size[0] > CELL_SIZE[0] * 0.9 or 
                    star_size[1] > CELL_SIZE[1] * 0.9):
                    continue
                
                position = try_place_star(cell_bounds, star_size, existing_stars)
                if position is None:
                    continue
                
                # Place the star
                with Image.open(star_file) as star:
                    n_frames, durations = get_gif_info(star_file)
                    star.seek(0)
                    
                    x, y = position
                    existing_stars.append((position, star_size))

                    # Determine if star will be static
                    is_static = random.random() < STATIC_STAR_CHANCE
                    if is_static:
                        # Choose random frame to freeze on
                        static_frame = random.randint(0, n_frames - 1)
                        star.seek(static_frame)
                        static_frame = star.convert('RGBA')
                    
                    # Random frame offset
                    frame_offset = random.randint(0, n_frames - 1)
                    
                    # Determine speed variation
                    speed_multiplier = 1.0
                    if not is_static and random.random() < SPEED_VARIATION_CHANCE:
                        speed_multiplier = random.uniform(*SPEED_VARIATION_RANGE)
                    
                    for frame_idx in range(total_frames):
                        if is_static:
                            frames[frame_idx].paste(static_frame, (x, y), static_frame)
                        else:
                            star.seek(0)  # Reset to start
                            star_frame_idx = (frame_idx + frame_offset) % n_frames
                            for _ in range(star_frame_idx):  # Seek to correct frame
                                star.seek(star.tell() + 1)
                            star_frame = star.convert('RGBA')
                            frames[frame_idx].paste(star_frame, (x, y), star_frame)
                            # Adjust frame duration based on speed multiplier
                            frame_durations[frame_idx] = max(
                                frame_durations[frame_idx],
                                int(durations[star_frame_idx] * speed_multiplier)
                            )
                break  # Successfully placed a star, move to next cell

    # Save the resulting animation
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    frames[0].save(
        OUTPUT_FILE,
        save_all=True,
        append_images=frames[1:],
        duration=[int(d / GLOBAL_SPEED_MULTIPLIER) for d in frame_durations],  # Apply global speed multiplier
        loop=0,
        optimize=False,
        disposal=2
    )
    print(f"Generated star background saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    create_star_background() 