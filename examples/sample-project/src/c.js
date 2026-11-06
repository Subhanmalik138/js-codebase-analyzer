// Same validation block as in b.js — pasted, not shared.
// Kept as a plain local function, not exported.
function validateUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (typeof user.name !== 'string' || user.name.trim() === '') return false;
  if (typeof user.email !== 'string' || !user.email.includes('@')) return false;
  if (typeof user.age !== 'number' || user.age < 0 || user.age > 150) return false;
  if (!Array.isArray(user.roles) || user.roles.length === 0) return false;
  if (user.roles.some((r) => typeof r !== 'string')) return false;
  return true;
}

module.exports = {};
