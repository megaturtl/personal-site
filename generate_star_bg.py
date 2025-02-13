import os
from PIL import Image, ImageDraw
import random
from pathlib import Path
import math

# Directory containing the star GIFs
STARS_DIR = "src/assets/images/pixel stars"
OUTPUT_FILE = "src/assets/images/star_background.gif"
CANVAS_SIZE = (800, 400)

# Debug settings
DEBUG_SHOW_GRID = False # Toggle to show/hide grid lines
DEBUG_GRID_COLOR = (255, 0, 0, 128)  # Semi-transparent red

# Distribution settings
CELLS_PER_SIDE = 8  # Number of cells per side (total cells will be this squared)
CELL_SIZE = (CANVAS_SIZE[0] // CELLS_PER_SIDE, CANVAS_SIZE[1] // CELLS_PER_SIDE)  # Calculated from canvas size
MIN_DISTANCE = 20  # Minimum distance between star centers

# Animation settings
GLOBAL_SPEED_MULTIPLIER = 1.0  # Keep this at 1.0 to maintain star animation speed
FALL_SPEED_MULTIPLIER = 4.0  # Separate multiplier just for falling speed (higher = faster falling)
FALL_RATE = 1  # Pixels per frame that stars fall
STATIC_STAR_CHANCE = 0.0  # Set to 0 since all stars should fall

# Calculate frames needed for a complete cycle
# To ensure perfect looping, we need the segment height to divide evenly into canvas height
# and be divisible by fall rate
def calculate_loop_segment():
    # Find the largest segment height that:
    # 1. Divides evenly into canvas height
    # 2. Is divisible by fall rate
    # This ensures stars return to exact starting positions
    for test_height in range(CANVAS_SIZE[1], 0, -1):
        if (CANVAS_SIZE[1] % test_height == 0 and  # Divides evenly into canvas height
            test_height % FALL_RATE == 0 and       # Divisible by fall rate
            test_height >= 100):                   # Keep segments reasonably sized
            return test_height
    return CANVAS_SIZE[1]  # Fallback to full height if no perfect division found

LOOP_SEGMENT_HEIGHT = calculate_loop_segment()
FRAMES_FOR_LOOP = LOOP_SEGMENT_HEIGHT // FALL_RATE  # Number of frames needed for the loop

print(f"Using loop segment height of {LOOP_SEGMENT_HEIGHT} pixels for perfect looping")

# Star positions will be stored as a list of (x, y) tuples
star_positions = []

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

def update_star_positions(positions, frame_idx):
    """Update star positions for the current frame, handling wrap-around."""
    updated_positions = []
    for x, y in positions:
        # Move star down by FALL_RATE pixels per frame
        new_y = y + (FALL_RATE * frame_idx)
        # Wrap around when reaching bottom of frame
        wrapped_y = new_y % CANVAS_SIZE[1]
        updated_positions.append((x, wrapped_y))
    return updated_positions

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
    
    # Calculate frame information for star animations
    frame_counts = []
    for star_file in star_files:
        n_frames, _ = get_gif_info(star_file)
        frame_counts.append(n_frames)
    
    # Use FRAMES_FOR_LOOP instead of max frame count to ensure perfect looping
    total_frames = FRAMES_FOR_LOOP
    frames = []
    frame_durations = []
    
    # Create base frames
    for _ in range(total_frames):
        base = Image.new('RGBA', CANVAS_SIZE, (0, 0, 0, 0))
        frames.append(base)
        frame_durations.append(100)
    
    existing_stars = []
    star_data = []  # List to store star information (position, image, size)
    
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

    # First pass: determine initial star positions using grid
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
                
                # Store star data for animation
                star_data.append((position, star_file, star_size))
                existing_stars.append((position, star_size))
                break

    # Second pass: animate all frames with falling motion
    for frame_idx in range(total_frames):
        # Update positions for this frame
        current_positions = update_star_positions([pos for pos, _, _ in star_data], frame_idx)
        
        # Draw stars at their current positions
        for (_, star_file, _), (x, y) in zip(star_data, current_positions):
            with Image.open(star_file) as star:
                n_frames, durations = get_gif_info(star_file)
                # Make star animation loop within our total frames
                star_frame_idx = frame_idx % n_frames
                
                # Seek to correct frame in star animation
                star.seek(0)
                for _ in range(star_frame_idx):
                    star.seek(star.tell() + 1)
                
                star_frame = star.convert('RGBA')
                frames[frame_idx].paste(star_frame, (int(x), int(y)), star_frame)
                # Store original duration, will be modified for star animation speed later
                frame_durations[frame_idx] = max(
                    frame_durations[frame_idx],
                    int(durations[star_frame_idx] / GLOBAL_SPEED_MULTIPLIER)  # Apply star animation speed here
                )

    # Save the resulting animation
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    frames[0].save(
        OUTPUT_FILE,
        save_all=True,
        append_images=frames[1:],
        # Apply fall speed multiplier to control overall animation speed
        duration=[int(20 / FALL_SPEED_MULTIPLIER) for _ in frame_durations],  # Base duration of 20ms
        loop=0,
        optimize=False,
        disposal=2
    )
    print(f"Generated star background saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    create_star_background() 