# Alpha Transparency Test Failures

These images were generated with the built-in image2/image generation tool while requesting true transparent PNG output.

Result: the generated files are not valid transparent PNG assets. ImageMagick identified the latest alpha test as `PNG srgb 3.0`, and corner pixels were opaque color values rather than alpha-transparent pixels.

Do not use these files as production transparent brand assets. They are archived only as raw generation records.

Required standard for future brand assets:

- PNG must include an alpha channel.
- Intended transparent corners must have alpha 0.
- Logos for light and dark surfaces must have transparent backgrounds.
- Opaque app icons are allowed only when explicitly labeled as app icon plate assets.
- Creative generation should come from image2/model output, but this current built-in path has not produced real alpha in testing.
