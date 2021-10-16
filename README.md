# Bridge

## Using this Project

Clone this repository, then install the dependencies with `npm install`, then compile contracts with `npm run compile`.

### Run Contract Tests & Get Callstacks

`npm run test`

### Run Coverage Report for Tests

`npm run coverage`

### Run docgen

`npm run doc` or `npx hardhat docgen`

The document will be created in the docs folder.

Check about [NatSpec](https://docs.soliditylang.org/en/v0.5.10/natspec-format.html) to know how to describe your contract to docgen.

### Deploy example

Script to deploy CustomToken in rinkeby.

_create .env before._

`npx hardhat run --network rinkeby scripts/deployCustomToken.ts`

### Task example

## Swap task (rinkeby example)

USER_ADDRESS - recipient user address
NONCE_NUMBER - unique number, should be the same for pair swap and redeem functions

`npx hardhat swap --network rinkeby --token TOKEN_ADRESS --user USER_ADDRESS --bridge BRIDGE_ADRESS --amount "10000" --chainid "3" --nonce NONCE_NUMBER`

## Redeem task (ropsten example)

`npx hardhat redeem --network ropsten --token TOKEN_ADRESS --user USER_ADRESS --bridge BRIDGE_ADRESS --amount "10000" --chainid "4" --nonce NONCE_NUMBER`

### Using Mocha Test Explorer in Visual Studio Code

[Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter)
As we are using typescript tests, we nee to add following attribute in *settings.json* file (Visual Studio Code global settings):
`"mochaExplorer.files": "test/**/*.{j,t}s",`

If you see "Mocha: Error" in test explorer, ensure that `npx hardhat test` works.

### Verification example

`npx hardhat verify --network rinkeby CONTRACT_ADDRESS ARG1 ARG2`

To verify upgradable contract - you need use address of implementation as `CONTRACT_ADDRESS`

Btw you can verify your contract with deploy. You can find example how do it in deploy scripts.

### OpenZeppelin Wizard

[Wizard](https://docs.openzeppelin.com/contracts/4.x/wizard) is a useful generator of smart contracts.
