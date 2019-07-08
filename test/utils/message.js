let rlp = require("rlp");

// mType=1
function rlpEncodeProviderRandomHash(prHash, token, amount) {
  let data = [prHash, token, web3.utils.toHex(amount)];
  return "0x" + rlp.encode(data).toString("hex");
}

// mType=2
function rlpEncodeUserRandomHash(urHash) {
  let data = [urHash];
  return "0x" + rlp.encode(data).toString("hex");
}
// mType=3
function rlpEncodeUserHashReady(user1, user2, user3, user4, user5) {
  let data = [user1, user2, user3, user4, user5];
  return "0x" + rlp.encode(data).toString("hex");
}

// mType=4
function rlpEncodeProviderRevealRandom(random1, random2, random3, random4, random5) {
  let data = [random1, random2, random3, random4, random5];
  return "0x" + rlp.encode(data).toString("hex");
}
// mType=5
function rlpEncodeProviderSettle(pRandom) {
  let data = [pRandom];
  return "0x" + rlp.encode(data).toString("hex");
}
// mType=6 CancelSession
// mType=7 Refund

module.exports = {
  rlpEncodeProviderRandomHash,
  rlpEncodeProviderRevealRandom,
  rlpEncodeUserHashReady,
  rlpEncodeUserRandomHash,
  rlpEncodeProviderSettle
};
