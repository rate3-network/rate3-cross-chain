const RTESwap = artifacts.require("./RTESwap.sol");
const RTEToken = artifacts.require("./RTEToken.sol");

// These are temporary values
module.exports = function(deployer, network, accounts) {
  // Deploy token contract
  deployer.deploy(RTESwap);
  deployer.deploy(RTEToken);
};
