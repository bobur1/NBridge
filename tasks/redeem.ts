import { task } from 'hardhat/config'
import { BigNumber, ContractTransaction, ContractReceipt } from "ethers";
import { Address } from 'cluster';

require("@nomiclabs/hardhat-web3");

task('redeem', 'Redeem tokens from Another bridge')
    .addParam('bridge', 'Bridge address')
    .addParam('token', 'Token address')
    .addParam('user', 'Resiver user address')
    .addParam('amount', 'Token amount')
    .addParam('chainid', 'Sending chain Id')
    .addParam('nonce', 'Unique number')
    .setAction(async ({ bridge, token, user, amount, chainid, nonce}, { ethers, web3 }) => {
        const [owner] = await ethers.getSigners();
        
        const Bridge = await ethers.getContractFactory('Bridge')
	const bridgeContract = Bridge.attach(bridge)
        const swapChainId = chainid;
        const redeemChainId = await bridgeContract.currentBridgeChainId();
        const Token = await ethers.getContractFactory('CustomToken')
        const tokenContract = Token.attach(token)
        const token0Symbol = await tokenContract.symbol()

        const message:string = web3.utils.soliditySha3(
            user,
            amount,
            token0Symbol,
            swapChainId,
            redeemChainId,
            nonce
        )!;

        // event listener from https://stackoverflow.com/questions/68432609/contract-event-listener-is-not-firing-when-running-hardhat-tests-with-ethers-js
        const signature = await web3.eth.sign(message, user); //
        const { v, r, s } = ethers.utils.splitSignature(signature);
        const balanceBeforeRedeem : BigNumber = await tokenContract.balanceOf(user);
        console.log(`Recipient: ${user}`)
        console.log(`Balance of the recipient before redeem: ${balanceBeforeRedeem}`)
        const contractTx: ContractTransaction = await bridgeContract.redeem(token0Symbol, amount, swapChainId, nonce, v,r,s);
        const contractReceipt: ContractReceipt = await contractTx.wait();
        const event = contractReceipt.events?.find(event => event.event === 'SwapRedeemed');
        const eInitiator: Address = event?.args!['initiator'];
        const eNonce: BigNumber = event?.args!['nonce'];
        const balanceAfterRedeem: BigNumber = await tokenContract.balanceOf(user);
        console.log(`Balance of the recipient after redeem: ${balanceAfterRedeem}`)
	console.log(`Initiator: ${eInitiator}`)
	console.log(`Amount: ${amount}`)
	console.log(`Token Symbol: ${token0Symbol}`)
	console.log(`Chain From: ${swapChainId}`)
	console.log(`Chain To: ${redeemChainId}`)
	console.log(`Nonce: ${eNonce}`)
    })
