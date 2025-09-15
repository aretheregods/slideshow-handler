# AGENTS.md

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
