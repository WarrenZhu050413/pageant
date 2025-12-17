BUG:

When I switch between different images, the Prompt Section of the Info Panel does not udpate to reflect the prompt of the currently selected image. It continues to display the prompt of the previously selected image until I manually refresh or reselect the image. This leads to confusion as the displayed prompt does not match the actual prompt used for the current image.

Feature:

# Small

1. I want the add to context for a single image to not replace the existing image context that is already there in the generationb bar.

2. To enable more rapid design, I want to be able to generate multiple batches of images at once. The generate images only shows the indicator inside the prompt where the images are being generated, but not the generated image itself. Thanks!

3. Change the name "Caption (SENT TO AI)" to just "Annotation (SENT TO AI)"

# Large

1.  Change the UI layout, so that the bottom InfoPanel is actually just a separate part of the left side panel. After Style, it should be a Info section. Arrange it so it has

Prompt

Original User Prompt (collapsed by default)

Actual Prompt (Gemini Generated)

---

Caption

---

Design

As the three sections.

2. I want there to be a button that allows the variations to flow along more a fixed dimension. (e.g. I want the generated images to be on a gradient from Extremely Saturated to very less so).

This should be an additional option in the Generate UI bar, perhaps underneath Prompt as an additional toggle.

Consider how to compile this down into a prompt to gemini. It should be an additional section on top of the generate variation prompt.

3. I want the gemini text model to also select what exact image to sent to the backend nano-banana-pro model. Further, I want it to even think about whether the current caption for the image is appropriate, or whether there would be a more appropriate caption.

Then, I want this to be displayed in the prompt preview UI, where for each prompt you can see the different images that are related to it, along with the prompt.

4. I want to change the more like this button.

The more like this pattern should follow the same flow as the other ones. It should preview the prompts to be sent to the backend first, and then send the images to the backend after user review. It should take the current image, and then take it into all kinds of different directions that the user would want to take it to.
