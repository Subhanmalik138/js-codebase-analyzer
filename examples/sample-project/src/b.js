const { greet } = require('./a'); // closes the cycle: a -> b -> a

function shout(text) {
  return text.toUpperCase() + '!';
}

// A deliberately branchy function — a complexity hotspot.
function computeTotal(numbers) {
  let total = 0;
  for (const n of numbers) {
    if (typeof n !== 'number' || Number.isNaN(n)) {
      continue;
    } else if (n < 0) {
      total -= Math.abs(n);
    } else if (n > 1000) {
      total += 1000;
    } else if (n % 2 === 0 && n % 3 === 0) {
      total += n * 2;
    } else if (n % 2 === 0 || n % 5 === 0) {
      total += n;
    } else {
      total += n;
    }
  }
  return total;
}

// Same validation block as in c.js — the analyzer should flag the duplicate.
// Kept as a plain local function, not exported, so the dead-export check
// stays focused on the one genuinely unused export in a.js.
function validateUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (typeof user.name !== 'string' || user.name.trim() === '') return false;
  if (typeof user.email !== 'string' || !user.email.includes('@')) return false;
  if (typeof user.age !== 'number' || user.age < 0 || user.age > 150) return false;
  if (!Array.isArray(user.roles) || user.roles.length === 0) return false;
  if (user.roles.some((r) => typeof r !== 'string')) return false;
  return true;
}

module.exports = { shout, computeTotal };
