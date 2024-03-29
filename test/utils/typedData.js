const ethUtil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');

var typedData = {
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" }
    ],
    Transfer: [
      { name: "channelID", type: "bytes32" },
      { name: "balance", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "additionalHash", type: "bytes32" }
    ]
  },
  primaryType: "Transfer",
  domain: {
    name: "litexlayer2",
    version: "1",
    chainId: 1,
    verifyingContract: "0x7C765426aB9d7BCCf151C3d8D03f1368c50c9408"
  },
  message: {
    channelID: "",
    balance: 1,
    nonce: 8,
    additionalHash: ""
  }
};

const types = typedData.types;
function dependencies(primaryType, found = []) {
  if (found.includes(primaryType)) {
    return found;
  }
  if (types[primaryType] === undefined) {
    return found;
  }
  found.push(primaryType);
  for (let field of types[primaryType]) {
    for (let dep of dependencies(field.type, found)) {
      if (!found.includes(dep)) {
        found.push(dep);
      }
    }
  }
  return found;
}

function encodeType(primaryType) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(primaryType);
  deps = deps.filter(t => t != primaryType);
  deps = [primaryType].concat(deps.sort());

  // Format as a string with fields
  let result = "";
  for (let type of deps) {
    result += `${type}(${types[type]
      .map(({ name, type }) => `${type} ${name}`)
      .join(",")})`;
  }
  return result;
}

function typeHash(primaryType) {
  return ethUtil.keccak256(encodeType(primaryType));
}

function encodeData(primaryType, data) {
  let encTypes = [];
  let encValues = [];

  // Add typehash
  encTypes.push("bytes32");
  encValues.push(typeHash(primaryType));

  // Add field contents
  for (let field of types[primaryType]) {
    let value = data[field.name];
    if (field.type == "string" || field.type == "bytes") {
      encTypes.push("bytes32");
      value = ethUtil.keccak256(value);
      encValues.push(value);
    } else if (types[field.type] !== undefined) {
      encTypes.push("bytes32");
      value = ethUtil.keccak256(encodeData(field.type, value));
      encValues.push(value);
    } else if (field.type.lastIndexOf("]") === field.type.length - 1) {
      throw "TODO: Arrays currently unimplemented in encodeData";
    } else {
      encTypes.push(field.type);
      encValues.push(value);
    }
  }

  return abi.rawEncode(encTypes, encValues);
}

function structHash(primaryType, data) {
  return ethUtil.keccak256(encodeData(primaryType, data));
}

function signHash() {
  return ethUtil.keccak256(
    Buffer.concat([
      Buffer.from("1901", "hex"),
      structHash("EIP712Domain", typedData.domain),
      structHash(typedData.primaryType, typedData.message)
    ])
  );
}

module.exports = {
  typedData,
  signHash
};
