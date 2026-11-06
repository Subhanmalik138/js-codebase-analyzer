// A deliberately messy sample project the analyzer can chew on:
// it contains a dependency cycle, a dead export, a complexity hotspot,
// and a block of code pasted in two places.
const { greet } = require('./a');
const { computeTotal } = require('./b');

function main() {
  console.log(greet('world'));
  console.log('total:', computeTotal([1, 2, 3, 4]));
}

main();
