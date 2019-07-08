let rlp = require("rlp");
const BN = require("bn.js");
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

contract("PacketVerify", accounts => {
  const providerAddress = accounts[0];
  const regulatorAddress = accounts[1];
  const userAddress = accounts[2];
  const tokenAddress = accounts[3];

  let providerPrivateKey, regulatorPrivateKey, userPrivateKey, puppetAddrs, puppetPrivates;

  before(async () => {
    let keys = await getPrivateKeys();
    providerPrivateKey = keys.providerPrivateKey;
    regulatorPrivateKey = keys.regulatorPrivateKey;
    userPrivateKey = keys.userPrivateKey;

    let puppetKeys = await getPuppetAccounts(accounts);
    puppetAddrs = puppetKeys.puppetAddrs;
    puppetPrivates = puppetKeys.puppetPrivates;
  });

  beforeEach(async () => {
    typedData.domain.verifyingContract = providerAddress;
    typedData.domain.chainId = 4;
  });

  it("verify cancelled game message", async () => {
    let messageList = [];
    let sessionID = web3.utils.soliditySha3("ok");
    let channelIDs = [];
    for (let i = 0; i < puppetAddrs.length; i++) {
      channelIDs.push(web3.utils.soliditySha3({ t: "address", v: puppetAddrs[i] }, { t: "address", v: userAddress }));
    }

    let capital = web3.utils.toWei("0.1", "ether");
    // provider send hash random
    let buffer = rlpEncodeProviderRandomHash(web3.utils.soliditySha3(sessionID), tokenAddress, capital);
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
    buffer = rlpEncodeUserRandomHash(web3.utils.soliditySha3(sessionID));
    for (let i = 0; i < puppetAddrs.length; i++) {
      let hash = web3.utils.soliditySha3(puppetAddrs[i], providerAddress, sessionID, { t: "uint8", v: 2 }, { t: "bytes", v: buffer });
      let sig = tEcsign(Buffer.from(hash.substr(2), "hex"), puppetPrivates[i]);

      // console.log("add hash", addHash);
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

    // // UserRevealRandom

    // Provider cancel
    hash = web3.utils.soliditySha3(providerAddress, providerAddress, sessionID, { t: "uint8", v: 6 }, "0x");
    sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
    messageList.push([
      providerAddress,
      providerAddress,
      sessionID,
      new BN(6),
      "0x",
      sig,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      new BN(0),
      new BN(0),
      new BN(0),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x"
    ]);

    // Provider refund
    for (let i = 0; i < puppetAddrs.length; i++) {
      let hash = web3.utils.soliditySha3(providerAddress, puppetAddrs[i], sessionID, { t: "uint8", v: 7 }, "0x");
      let sig = tEcsign(Buffer.from(hash.substr(2), "hex"), providerPrivateKey);
      typedData.message.balance = capital;
      let addHash = web3.utils.soliditySha3({ t: "bytes32", v: hash }, { t: "uint256", v: typedData.message.balance });
      typedData.message.channelID = channelIDs[i];
      typedData.message.additionalHash = addHash;
      typedData.message.nonce = 2;
      let paySig = tEcsign(signHash(), providerPrivateKey);
      messageList.push([
        providerAddress,
        puppetAddrs[i],
        sessionID,
        new BN(7),
        "0x",
        sig,
        channelIDs[i],
        new BN(typedData.message.balance),
        new BN(2),
        new BN(typedData.message.balance),
        addHash,
        paySig
      ]);
    }
    // console.log(messageList);
    let rlpencoded = rlp.encode(messageList).toString("hex");

    let instance = await PacketVerify.new();
    let res = await instance.verify.call("0x" + rlpencoded);
    // console.log("res", res);

    assert.equal(res.verifyResult, "game canceled, refund success\n", "verify Result is not success");
  });

  it("verify cancelled game with wrong refund amount", async () => {});
});
