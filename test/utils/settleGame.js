const BN = require("bn.js");

function settleGame(randomUsers, randomCP) {
  let RCPBN = new BN(web3.utils.toHex(randomCP).substr(2), 16);
  let hundred = new BN(100);

  let M = RCPBN;
  for (let i = 0; i < randomUsers.length; i++) {
    let RUserBN = new BN(web3.utils.toHex(randomUsers[0]).substr(2), 16);
    M = M.xor(RUserBN);
  }

  M = M.mod(hundred).add(hundred);
  console.log("M is", M);

  const selection = [];
  let totalR = 0;
  let loserIndex = 0;
  for (let i = 0; i < randomUsers.length; i++) {
    let RUserBN = new BN(web3.utils.toHex(randomUsers[0]).substr(2), 16);
    let R = RUserBN.mod(M.sub(new BN(i)))
      .add(new BN(1))
      .toNumber();
    let rate = select(R, selection, M.toNumber());
    selection.push(rate);
    totalR += rate;
    if (i > 0 && rate < selection[loserIndex]) {
      loserIndex = i;
    }
  }

  console.log(totalR, selection);

  return {
    totalR,
    selection,
    loserIndex
  };
}

function select(rand, selection, total) {
  for (let i = 1; i < total + 1; i++) {
    if (selection.includes(i)) {
      continue;
    } else {
      rand--;
    }
    if (rand <= 0) {
      // console.log(selection, i);
      return i;
    }
  }
}

module.exports = {
  settleGame
};
