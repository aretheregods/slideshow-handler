# AGENTS.md

## description

- This app processes PPTX archives and renders them as SVG in the browser.
- There are 2 phases: parsing and then rendering.
- During the parsing phase, the data from a slide in the PPTX archive is parsed into shapes
  and text and saved as JavaScript object data into the ReactiveStore on a per slide basis.
- During the rendering phase, the data for a given slide is retrieved from the
  ReactiveStore and rendered to the SVG canvas.

## coding style

- Never use async/await. Always prefer promise chaining.
- Never use typescript.
- Always preserve functionality unless expressly requested by the user to remove it.
- Always add JSDocs to new functions, classes and associated code.
- Always use 4 spaces for tabs instead of 2.
- Always use space around code inside of brackets or parentheses.

## testing and code verification

- Always request code reviews.
- Always test added or refactored code until the tests pass.
- Don't ever remove tests to get them to pass.
- Don't ever remove code to get tests to pass.
- Don't ever commit code with failing tests
- Don't ever attempt to run playwright verification scripts.
  I will verify visual changes locally.
- Always verify that the JSON schema as defined src/schemas/current.js is full
  and complete after your changes and before you submit changes to github.
