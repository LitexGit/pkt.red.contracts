pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./lib/MsDecoder.sol";
import "./lib/ECDSA.sol";
import "./lib/RLPReader.sol";

contract PacketVerify {
    using RLPReader for bytes;
    using RLPReader for uint;
    using RLPReader for RLPReader.RLPItem;

    uint256 constant rate = 98;

    struct State {
        bytes32 prh;
        address token;
        uint256 amount;
        address provider;
        bytes32 pr;
        address loser;
    }
    struct URHash {
        bytes32 urh;
        address user;
        bytes32 urr;
        uint256 m;
    }
    struct PSettle{
        address user;
        uint amount;
    }

    function verify (
        bytes memory data
    )
        public
        view
        returns(string memory verifyResult, string memory gameInformation, address loser, address[5] memory users, bytes32[5] memory userSecretHashs, bytes32[5] memory userSecrets, uint[5] memory userModules, uint[5] memory userSettleAmounts) //0=success, 1xxx=invalid data, 2xxx=wrong result
    {
        MsDecoder.Message[] memory ms = MsDecoder.decode(data);
        State memory s;
        URHash[] memory urHash = new URHash[](5);
        PSettle[] memory pSettle = new PSettle[](5);
        uint idx = 0;
        // provider start game message
        if (ms[0].mType == 1) {
            RLPReader.RLPItem[] memory items = ms[0].content.toRlpItem().toList();
            s.prh = toBytes32(items[0].toBytes());
            s.token = items[1].toAddress();
            s.amount = items[2].toUint();
            s.provider = ms[0].from;
            gameInformation = string(abi.encodePacked("provider: ", addressToString(s.provider), ", token: ", addressToString(s.token), ", wager: ", uintToString(s.amount), ", provider secret hash: ", bytes32ToString(s.prh)));
            // token = s.token;
        } else {
            verifyResult = "error(-1001): provider should send game information message first\n";
            return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
        }
        // provider cancel game
        for(uint i=1; i<ms.length; i++){
            if(ms[i].mType == 6 && ms[i].from == s.provider){
                if(verifyCancel(s, ms, i)){
                    verifyResult = "game canceled, refund success\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                } else {
                    verifyResult = "game canceled, refund failed\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);    
                }
            }
        }
        // provider send hash ready message
        for(uint i=1; i<ms.length; i++){ 
            if(ms[i].mType == 3 && ms[i].from == s.provider){
                RLPReader.RLPItem[] memory items = ms[i].content.toRlpItem().toList();
                for(uint k=0; k<5; k++) {
                    urHash[k].user = items[k].toAddress();
                    users[k] = items[k].toAddress();
                }
                idx = 0;
                for(uint j=1; j<i&&idx<5; j++){
                    if(ms[j].mType == 2 && ms[j].to == s.provider && ms[j].from == urHash[idx].user && ms[j].amount == s.amount){
                        urHash[idx].urh = toBytes32(ms[j].content.toRlpItem().toList()[0].toBytes());
                        userSecretHashs[idx] = urHash[idx].urh;
                        idx++;
                    }
                }
                if(idx < 5){
                    verifyResult = "error(-1002): users provider picked was wrong\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                }
                break;
            }
        }
        if(urHash[0].user == address(0)) {
            verifyResult = "error(-1003): provider did not pick users\n";
            return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
        }
        // provider settle game
        idx = 0;
        for(uint i=1; i<ms.length&&idx<5; i++){
            if(ms[i].mType == 5 && ms[i].from == s.provider){
                if(idx == 0) {
                    s.pr = toBytes32(ms[i].content.toRlpItem().toList()[0].toBytes());
                    gameInformation = string(abi.encodePacked(gameInformation, ", provider secret: ", bytes32ToString(s.pr)));
                    if (keccak256(abi.encodePacked(s.pr)) != s.prh) {
                        verifyResult = "error(-1004): provider random was not matched with hash of random\n";
                        return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                    }
                } else if(toBytes32(ms[i].content.toRlpItem().toList()[0].toBytes()) != s.pr) {
                    verifyResult = "error(-1004): provider random was not matched with hash of random\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                }
                pSettle[idx].user = ms[i].to;
                pSettle[idx].amount = ms[i].amount;
                userSettleAmounts[idx] = ms[i].amount;
                idx++;
            }
        }
        if(!verifyProviderSettle(urHash, pSettle)) {
            verifyResult = "error(-1005): provider settle order was not matched with order of users\n";
            return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
        }
        // provider send random message
        for(uint i=1; i<ms.length; i++){
            if(ms[i].mType == 4 && ms[i].from == s.provider){
                RLPReader.RLPItem[] memory items = ms[i].content.toRlpItem().toList();
                for(uint j=0; j<5; j++){
                    if(keccak256(abi.encodePacked(toBytes32(items[j].toBytes()))) != urHash[j].urh) {
                        verifyResult = "error(-1006): user random was not matched with hash of random\n";
                        return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                    }
                    urHash[j].urr = toBytes32(items[j].toBytes());
                    userSecrets[j] = urHash[j].urr;
                }
            }
        }
        uint256 m = uint256(urHash[0].urr^urHash[1].urr^urHash[2].urr^urHash[3].urr^urHash[4].urr^s.pr)%100 + 100;
        gameInformation = string(abi.encodePacked(gameInformation, ", module: ", uintToString(m)));
        uint256 minRand = 0;
        for (uint i=0; i<5; i++) {
            // uint i = 4 - j;
            // urHash[i].m = uint256(urHash[i].urr)%m;
            urHash[i].m = selectNumber(uint256(urHash[i].urr)%(m-i) + 1, userModules, m);
            userModules[i] = urHash[i].m;
            if(i == 0) {
                s.loser = urHash[i].user;
                minRand = urHash[i].m;
            } else if(urHash[i].m < minRand) {
                minRand = urHash[i].m;
                s.loser = urHash[i].user;
            }
        }
        loser = s.loser;
        // verify if settlement was correct
        for (uint i=0; i<5; i++) {
            if(pSettle[i].user == s.loser) {
                if(pSettle[i].amount != (s.amount*rate/100)*urHash[i].m/(urHash[0].m+urHash[1].m+urHash[2].m+urHash[3].m+urHash[4].m)) {
                    verifyResult = "error(-1007): wrong settle amount\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                }
            } else {
                if(pSettle[i].amount != ((s.amount*rate/100)*urHash[i].m/(urHash[0].m+urHash[1].m+urHash[2].m+urHash[3].m+urHash[4].m)) + s.amount) {
                    verifyResult = "error(-1007): wrong settle amount\n";
                    return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
                }
            }
        }
        verifyResult = "Success!\n";
        return (verifyResult, gameInformation, loser, users, userSecretHashs, userSecrets, userModules, userSettleAmounts);
    }

    function selectNumber(
        uint rand,
        uint[5] memory userModules,
        uint module
    )
        internal
        view
        returns(uint)
    {
        uint temp = rand;
        for(uint i = 1; i < module + 1; i++){

            bool included = false;
            for(uint j = 0; j < 5; j ++){
                if(userModules[j] == i){
                    included = true;
                    break;
                }
            }
            if(!included) {
                temp --;
            }
            if(temp <= 0){
                return i;
            }
        }
        return module;
    }

    function verifyCancel (
        State memory s,
        MsDecoder.Message[] memory ms,
        uint cIdx
    )
        internal
        view
        returns(bool)
    {
        address[] memory users = new address[](cIdx);
        uint userLength = 0;
        for(uint i=0; i<cIdx; i++) {
            if(ms[i].mType == 2 && ms[i].to == s.provider  && ms[i].amount == s.amount){
                users[userLength] = ms[i].from;
                userLength++;
            }
        }
        uint idx = 0;
        for(uint j=cIdx; j<ms.length&&idx<userLength; j++) {
            if(ms[j].mType == 7 && ms[j].to == users[idx] && ms[j].amount == s.amount){
                idx++;
            }
        }
        if(idx < userLength) {
            return false;
        } else {
            return true;
        }
    }

    function verifyProviderSettle (
        URHash[] memory urHash,
        PSettle[] memory pSettle 
    )
        internal
        pure
        returns(bool)
    {
        for(uint i=0; i<5; i++) {
            uint j = 0;
            while(urHash[i].user != pSettle[j].user && j<5) j++;
            if(j==5) return false;
        }
        return true;
    }

    function toBytes32(
        bytes memory source
    ) 
        internal 
        pure 
        returns (bytes32 result) 
    {
        if (source.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }


    function addressToString(address _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";
    
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12]) >> 4)];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12]) & 0x0f)];
        }
        return string(str);
    }
    
    function bytes32ToString(bytes32 value) internal view returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 32; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i]) >> 4)];
            str[3+i*2] = alphabet[uint(uint8(value[i]) & 0x0f)];
        }
        return string(str);
    }
    
    function uintToString(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}