const BN = require("bn.js");
let rlp = require("rlp");
let { typedData, signHash } = require("./utils/typedData");
const { tEcsign, myEcsign, personalSign } = require("./utils/helper");
const { getPrivateKeys, getPuppetAccounts } = require("./utils/keys");
var PacketVerify = artifacts.require("PacketVerify");
const {
  rlpEncodeProviderRandomHash,
  rlpEncodeProviderRevealRandom,
  rlpEncodeUserHashReady,
  rlpEncodeUserRandomHash,
  rlpEncodeProviderSettle
} = require("./utils/message");
const { settleGame } = require("./utils/settleGame");

contract("PacketVerify", accounts => {
  const providerAddress = accounts[0];
  const regulatorAddress = accounts[1];
  const userAddress = accounts[2];
  const tokenAddress = accounts[3];

  let providerPrivateKey, regulatorPrivateKey, userPrivateKey, puppetAddrs, puppetPrivates;
  let channelIDs = [];
  before(async () => {
    let keys = await getPrivateKeys();
    providerPrivateKey = keys.providerPrivateKey;
    regulatorPrivateKey = keys.regulatorPrivateKey;
    userPrivateKey = keys.userPrivateKey;

    let puppetKeys = await getPuppetAccounts(accounts);
    puppetAddrs = puppetKeys.puppetAddrs;
    puppetPrivates = puppetKeys.puppetPrivates;
    for (let i = 0; i < puppetAddrs.length; i++) {
      channelIDs.push(web3.utils.soliditySha3({ t: "address", v: puppetAddrs[i] }, { t: "address", v: userAddress }));
    }
  });

  beforeEach(async () => {
    typedData.domain.verifyingContract = providerAddress;
    typedData.domain.chainId = 4;
  });

  it("verify success game message", async () => {
    let messageList = [];
    let sessionID = web3.utils.soliditySha3("ok");

    let RandomCP = sessionID;
    let RandomUser = sessionID;

    let capital = web3.utils.toWei("0.15263752357", "ether");

    // provider send hash random
    let buffer = rlpEncodeProviderRandomHash(web3.utils.soliditySha3(RandomCP), tokenAddress, capital);
    let hash = web3.utils.soliditySha3(providerAddress, providerAddress, sessionID, { t: "uint8", v: 1 }, { t: "bytes", v: buffer });
    let sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
    messageList.push([
      providerAddress,
      providerAddress,
      sessionID,
      new BN(1),
      buffer,
      sig,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      new BN(0),
      new BN(0),
      new BN(0),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x"
    ]);

    // user send random hash
    buffer = rlpEncodeUserRandomHash(web3.utils.soliditySha3(RandomUser));
    for (let i = 0; i < puppetAddrs.length; i++) {
      let hash = web3.utils.soliditySha3(puppetAddrs[i], providerAddress, sessionID, { t: "uint8", v: 2 }, { t: "bytes", v: buffer });
      let sig = tEcsign(Buffer.from(hash.substr(2), "hex"), puppetPrivates[i]);

      typedData.message.channelID = channelIDs[i];
      typedData.message.balance = capital;
      typedData.message.nonce = 1;
      let addHash = web3.utils.soliditySha3({ t: "bytes32", v: hash }, { t: "uint256", v: typedData.message.balance });
      typedData.message.additionalHash = addHash;
      let paySig = tEcsign(signHash(), puppetPrivates[i]);

      messageList.push([
        puppetAddrs[i],
        providerAddress,
        sessionID,
        new BN(2),
        buffer,
        sig,
        channelIDs[i],
        new BN(typedData.message.balance),
        new BN(1),
        new BN(typedData.message.balance),
        addHash,
        paySig
      ]);
    }

    // UserHashReady
    buffer = rlpEncodeUserHashReady(puppetAddrs[0], puppetAddrs[1], puppetAddrs[2], puppetAddrs[3], puppetAddrs[4]);
    hash = web3.utils.soliditySha3(providerAddress, providerAddress, sessionID, { t: "uint8", v: 3 }, { t: "bytes", v: buffer });
    sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
    messageList.push([
      providerAddress,
      providerAddress,
      sessionID,
      new BN(3),
      buffer,
      sig,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      new BN(0),
      new BN(0),
      new BN(0),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x"
    ]);

    // ProviderRevealRandom
    buffer = rlpEncodeProviderRevealRandom(RandomUser, RandomUser, RandomUser, RandomUser, RandomUser);
    hash = web3.utils.soliditySha3(providerAddress, providerAddress, sessionID, { t: "uint8", v: 4 }, { t: "bytes", v: buffer });
    sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
    messageList.push([
      providerAddress,
      providerAddress,
      sessionID,
      new BN(4),
      buffer,
      sig,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      new BN(0),
      new BN(0),
      new BN(0),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x"
    ]);

    // ProviderSettle
    buffer = rlpEncodeProviderSettle(RandomCP);
    let rate = new BN(web3.utils.toHex(98).substr(2), 16);
    let hundred = new BN(web3.utils.toHex(100).substr(2), 16);
    let stake = new BN(capital);

    const { selection, totalR, loserIndex } = settleGame([RandomUser, RandomUser, RandomUser, RandomUser, RandomUser], RandomCP);
    console.log(totalR, selection);

    for (let i = 0; i < puppetAddrs.length; i++) {
      let hash = web3.utils.soliditySha3(providerAddress, puppetAddrs[i], sessionID, { t: "uint8", v: 5 }, { t: "bytes", v: buffer });
      let sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
      let addHash;
      typedData.message.channelID = channelIDs[i];
      typedData.message.nonce = 1;

      if (i == loserIndex) {
        typedData.message.balance = new BN(selection[i])
          .mul(stake)
          .mul(rate)
          .div(hundred)
          .div(new BN(totalR))
          .toString(10);
      } else {
        typedData.message.balance = new BN(selection[i])
          .mul(stake)
          .mul(rate)
          .div(hundred)
          .div(new BN(totalR))
          .add(stake)
          .toString(10);
      }
      addHash = web3.utils.soliditySha3({ t: "bytes32", v: hash }, { t: "uint256", v: typedData.message.balance });
      typedData.message.additionalHash = addHash;
      let paySig = tEcsign(signHash(), providerPrivateKey);

      messageList.push([
        providerAddress,
        puppetAddrs[i],
        sessionID,
        new BN(5),
        buffer,
        sig,
        channelIDs[i],
        new BN(typedData.message.balance),
        new BN(1),
        new BN(typedData.message.balance),
        addHash,
        paySig
      ]);
    }

    let rlpencoded = rlp.encode(messageList).toString("hex");

    let instance = await PacketVerify.new();
    let res = await instance.verify.call("0x" + rlpencoded);
    // console.log("res", res);

    assert.equal(res.verifyResult, "Success!\n", "verify Result is not success");
  });

  it("verify wrong settle amount", async () => {});
  it("verify wrong message order", async () => {});
  it("verify picked wrong user", async () => {});
  it("verify wrong message order", async () => {});

});
