import { task } from 'hardhat/config'
import { BigNumber, ContractTransaction, ContractReceipt } from "ethers";
import { Address } from 'cluster';

task('swap', 'Swap tokens from one network to another')
    .addParam('bridge', 'Bridge address')
    .addParam('token', 'Token address')
    .addParam('user', 'Resiver user address')
    .addParam('amount', 'Token amount')
    .addParam('chainid', 'Sending chain Id')
    .addParam('nonce', 'Unique number')
	.setAction(async ({ bridge, token, user, amount, chainid, nonce}, { ethers }) => {
        const Bridge = await ethers.getContractFactory('Bridge')
	const bridgeContract = Bridge.attach(bridge)
        const Token = await ethers.getContractFactory('CustomToken')
        const tokenContract = Token.attach(token)
        const token0Symbol = await tokenContract.symbol()
        // event listener from https://stackoverflow.com/questions/68432609/contract-event-listener-is-not-firing-when-running-hardhat-tests-with-ethers-js
        const contractTx: ContractTransaction = await bridgeContract.swap(user, token0Symbol, amount, chainid, nonce);
        const contractReceipt: ContractReceipt = await contractTx.wait();
        const event = contractReceipt.events?.find(event => event.event === 'SwapInitialized');
        const eInitiator: Address = event?.args!['initiator'];
        const eRecipient: Address = event?.args!['recipient'];
        const eAmount: BigNumber = event?.args!['amount'];
        const eSymbol: String = event?.args!['symbol'];
        const eChainFrom: BigNumber = event?.args!['chainFrom'];
        const eChainTo: BigNumber = event?.args!['chainTo'];
        const eNonce: BigNumber = event?.args!['nonce'];            
	console.log(`Initiator: ${eInitiator}`)
	console.log(`Recipient: ${eRecipient}`)
	console.log(`Amount: ${eAmount}`)
	console.log(`Token Symbol: ${eSymbol}`)
	console.log(`Chain From: ${eChainFrom}`)
	console.log(`Chain To: ${eChainTo}`)
	console.log(`Nonce: ${eNonce}`)
    })
