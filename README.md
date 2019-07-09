# pkt.red.contracts

## Overview

Pkt.red is a decentralized game based on l2app technology, which need five players. The stake and the actions are signed by the sender, then all the signed data will be saved on the l2app sessions. If players want to verify the game, the can fetch the data from the l2app, then post it to the game rules contract on ethereum. The contract will give the verify result to the players.

pkt.red.contracts is contract on Ethereum to verify the game data. More infomation about pkt.red, please refer to pkt.red.

## Game Rules

The following is the rule of game pkt.red

1. Five players and provider produce their random privately.
2. provider bring out the hash of his random H(Rcp)
3. players bring out the hash of their random H(Ru1)...H(Ru5), and their stake for this game.
4. when provider collect all the six hash, he broadcast a game ready message 
5. all the players bring out their random Ru1...Ru5
6. provider bring out his random Rcp
7. Provider verify the hash and random, after that settle the game base on the algorithm, and send the earnings to every player.
```
let M = (Rcp ^ Ru1 ^ Ru2 ^ Ru3 ^ Ru4 ^ Ru5)mod(100) + 100  // ^ means xor

let Ri = Rui mod M

let R = R1 + R2 + R3 + R4 + R5

let Si = (Ri div R) mul stake

The loser is one which hash the minimal Si.
The loser will only get Si. The winners will not only get Si, but also withdraw their stake back.

```

## Code Structure

The following is the structure of pkt.red.contracts

### contracts folder

- **lib**
    - ECDSA.sol: Elliptic curve signature operation
    - MsDecoder.sol: RLP decoder for session message
    - RLPReader.sol: RLP reader for data
- **PacketVerify.sol** Verification contract for game messages base on game rule of pkt.red
- **pkt.sol** PKT token source code, it is ERC20 token with 1 billion total supply.

### test folder

- **util**
  - helper.js: signature functions
  - keys.js: address/key pair generate functions for test
  - message.js: RLP encode function for session message
  - typedData.js: Sign_TypedData V3 validation functions
- game_cancel_test.js: building canceled game messages for test
- game_success_test.js: building success game messages for test


## Run & Test

1. Install node v10
2. Go to project root, install node dependencies
```
npm install
```
3. Install truffle suite
``` 
npm install -g truffle ganache-cli
```
4. start ganache-cli

```
ganache-cli -l 8000000
```
5. copy ganache's mnemonic, replace mnemonic in test/utils/keys.js
```
const mnemonic =
  "member guess canvas moment boring tragic find thumb cart identify above dutch"; // put your ganache mnemonic here.

const bip39 = require("bip39");
const hdkey = require("ethereumjs-wallet/hdkey");
const wallet = require("ethereumjs-wallet");
```
6. Run truffle test
```
truffle test
```