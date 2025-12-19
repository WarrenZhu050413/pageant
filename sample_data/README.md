# Sample Data

Pre-loaded design tokens to demonstrate the library feature.

## Contents

- **6 Design Tokens** covering different categories:
  - `Stark Rim Lighting` (lighting)
  - `Aggressive Double Exposure` (composition)
  - `Binary Threshold Contrast` (colors)
  - `Dusty Sepia Grading` (colors)
  - `Macro Biomorphic Texture` (aesthetic)
  - `Fluid Suspension Density` (layout)

- **12 Images**: Source images and AI-generated concept images

## Usage

To load sample data into your Pageant instance:

```bash
make seed
```

This copies the sample tokens and images to your `generated_images/` directory.

## Notes

- Sample tokens are tagged with `sample` for easy identification
- Running `make seed` is non-destructive - it merges with existing data
- Original sample data remains in `sample_data/` for reference
