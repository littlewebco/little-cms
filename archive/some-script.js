// some-script.js - Sample JavaScript file for GitShow demo

function greet(name) {
  // Simple greeting function
  if (!name) {
    name = 'World';
  }
  console.log(`Hello, ${name}!`);
  return `Hello, ${name}!`;
}

// Example usage:
const message = greet('Developer');

// Adding an event listener (example)
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  // You could potentially interact with the embedded content here,
  // although the worker inserts it directly.
});

// Basic calculation
const add = (a, b) => a + b;

console.log("Script loaded.");
console.log("2 + 3 =", add(2, 3)); 