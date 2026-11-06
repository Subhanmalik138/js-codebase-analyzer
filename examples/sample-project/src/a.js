const { shout } = require('./b');

function greet(name) {
  return shout(`hello ${name}`);
}

// Never imported anywhere — the analyzer should flag this as a dead export.
function unusedHelper() {
  return 'nobody calls me';
}

module.exports = { greet, unusedHelper };
