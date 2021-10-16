import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, network, upgrades } from 'hardhat';
import { expect, assert } from 'chai';
import { BigNumber, ContractTransaction, ContractReceipt } from "ethers";

import Web3 from 'web3';
// @ts-ignore
const web3 = new Web3(network.provider) as Web3;

import { CustomToken, Bridge } from '../typechain';
import { Address } from 'cluster';

const currentChainId = 1;
const anotherChainId = 25;
const token0Symbol = 'Ctm';
const token0Name = 'CustomToken';
const token1Symbol = 'Actm';
const token1Name = 'AnotherCustomToken';
const depositAmount = BigNumber.from(100000000000000);
const amount = 100000000;

let nonce = 0;

let token0: CustomToken;
let token1: CustomToken;
let bridge: Bridge;
let anotherBridge: Bridge;

let owner: SignerWithAddress;
let user0: SignerWithAddress;
let user1: SignerWithAddress;
let users:Array<SignerWithAddress>;

describe('Contract: Bridge', () => {
    beforeEach(async () => {
        [owner, user0, user1, ...users] = await ethers.getSigners();
        const CustomToken = await ethers.getContractFactory('CustomToken');
        token0 = await CustomToken.deploy(token0Name, token0Symbol) as CustomToken;
        token1 = await CustomToken.deploy(token1Name, token1Symbol) as CustomToken;
        const Bridge = await ethers.getContractFactory('Bridge');
        bridge = await upgrades.deployProxy(Bridge, [currentChainId]) as Bridge
        anotherBridge = await upgrades.deployProxy(Bridge, [anotherChainId]) as Bridge;
        // grantRole minter and burner roles of token to bridge contract
        await token0.grantRole(await token0.MINTER_ROLE(), bridge.address);
        await token0.grantRole(await token0.BURNER_ROLE(), bridge.address);
        // grantRole minter and burner roles of token1 to anotherBridge contract
        await token0.grantRole(await token0.MINTER_ROLE(), anotherBridge.address);
        await token0.grantRole(await token0.BURNER_ROLE(), anotherBridge.address);
        // grantRole Validator to the owner of the bridge
        await bridge.grantRole(await bridge.VALIDATOR_ROLE(), owner.address);
        await anotherBridge.grantRole(await bridge.VALIDATOR_ROLE(), owner.address);
        // activate chains
        await bridge.updateChainById(anotherChainId, true);
        await anotherBridge.updateChainById(currentChainId, true);
        // add tokens
        await bridge.addToken(token0Symbol, token0.address);
        await bridge.addToken(token1Symbol, token1.address);
        await anotherBridge.addToken(token0Symbol, token0.address);
        await anotherBridge.addToken(token1Symbol, token1.address);
        
    });
    
	describe('Deployment', () => {
		it('Chech Tokens parametrs', async () => {
			expect(await token0.name()).to.equal(token0Name);
			expect(await token0.symbol()).to.equal(token0Symbol);
			expect(await token1.name()).to.equal(token1Name);
			expect(await token1.symbol()).to.equal(token1Symbol);
		});
		it('Chech Bridge roles in Token contract', async () => {
            const minterRole = await token0.MINTER_ROLE();
            const burnerRole = await token0.BURNER_ROLE();
			expect(await token0.hasRole(minterRole, bridge.address)).to.equal(true);
			expect(await token0.hasRole(burnerRole, bridge.address)).to.equal(true);
		});
        it('Check minting in token', async () => {
            const targetAmount = 10000;
            const targetUserAddress = users[6].address;
            const userBalanceBefore = await token0.balanceOf(targetUserAddress);
            await token0.mint(targetUserAddress, targetAmount);
            const userBalanceAfter= await token0.balanceOf(targetUserAddress);
			expect(userBalanceAfter.sub(userBalanceBefore)).to.equal(targetAmount);
		});
        it('Check burning in token', async () => {
            const targetAmount = 10000;
            const targetUserAddress = users[6].address;
            await token0.mint(targetUserAddress, targetAmount);
            const userBalanceBefore = await token0.balanceOf(targetUserAddress);
            await token0.burn(targetUserAddress, targetAmount);
            const userBalanceAfter= await token0.balanceOf(targetUserAddress);
			expect(userBalanceBefore.sub(userBalanceAfter)).to.equal(targetAmount);
		});
        it('Check Bridge role Validator', async () => {
            const validatorRole = await bridge.VALIDATOR_ROLE();
			expect(await bridge.hasRole(validatorRole, owner.address)).to.equal(true);
			expect(await anotherBridge.hasRole(validatorRole, owner.address)).to.equal(true);
		});
		it('Chech Bridge chain id', async () => {
			expect(await bridge.currentBridgeChainId()).to.equal(currentChainId);
			expect(await anotherBridge.currentBridgeChainId()).to.equal(anotherChainId);
		});
        it('Check Bridge chain id is active', async () => {
			expect(await bridge.isChainActiveById(anotherChainId)).to.equal(true);
			expect(await anotherBridge.isChainActiveById(currentChainId)).to.equal(true);
		});
        it('Check Bridge token is active', async () => {
			const bridge1tokenSymbol = await bridge.tokenBySymbol(token0Symbol)
            expect(bridge1tokenSymbol.state).to.equal(1);
			const bridge2tokenSymbol = await anotherBridge.tokenBySymbol(token0Symbol)
            expect(bridge2tokenSymbol.state).to.equal(1);
		});
		it('Chech NOT all addresses allowed to mint and burn roles in Token contract', async () => {
            const minterRole = await token0.MINTER_ROLE();
            const burnerRole = await token0.BURNER_ROLE();
			expect(await token0.hasRole(minterRole, users[5].address)).to.equal(false);
			expect(await token0.hasRole(burnerRole, users[5].address)).to.equal(false);
		});
        it('Check NOT all users allowed to mint some token', async () => {
            const targetAmount = 10000;
			await expect(token0.connect(users[6]).mint(users[6].address, targetAmount)).to.revertedWith('You should have a minter role');
		});
        it('Check NOT all users allowed to burn some token', async () => {
            const targetAmount = 10000;
			await expect(token0.connect(users[6]).burn(users[6].address, targetAmount)).to.revertedWith('You should have a burner role');
		});
        it('Check NOT all users has Validator role in Bridge contract', async () => {
            const validatorRole = await bridge.VALIDATOR_ROLE();
			expect(await bridge.hasRole(validatorRole, users[6].address)).to.equal(false);
			expect(await anotherBridge.hasRole(validatorRole, users[6].address)).to.equal(false);
		});
        it('Check unregirstered bridges id is NOT active', async () => {
			expect(await bridge.isChainActiveById(token0.address)).to.equal(false);
			expect(await anotherBridge.isChainActiveById(token1.address)).to.equal(false);
		});
        it('Check unknown token in Bridge contract is NOT active', async () => {
			const bridge1tokenSymbol = await bridge.tokenBySymbol('ERR')
            expect(bridge1tokenSymbol.state).to.equal(0);
		});
        it('Checkt token list', async () => {
			const tokenList = await bridge.getTokenList();
            // we have added 2 tokens
            expect(tokenList.length).to.equal(2);
		});
    });

    describe('Transactions', () => {
        beforeEach(async () => {
            // lets mint some tokens
            await token0.mint(user0.address, depositAmount);
        });
        it('Swap from bridge', async () => {
            // event listener from https://stackoverflow.com/questions/68432609/contract-event-listener-is-not-firing-when-running-hardhat-tests-with-ethers-js
            const contractTx: ContractTransaction = await bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);
            const contractReceipt: ContractReceipt = await contractTx.wait();
            const event = contractReceipt.events?.find(event => event.event === 'SwapInitialized');
            
            const eInitiator: Address = event?.args!['initiator'];
            const eRecipient: Address = event?.args!['recipient'];
            const eAmount: BigNumber = event?.args!['amount'];
            const eSymbol: String = event?.args!['symbol'];
            const eChainFrom: BigNumber = event?.args!['chainFrom'];
            const eChainTo: BigNumber = event?.args!['chainTo'];
            const eNonce: BigNumber = event?.args!['nonce'];
            
            expect(eInitiator).to.equal(user0.address);
            expect(eRecipient).to.equal(user1.address);
            expect(eAmount).to.equal(amount);
            expect(eSymbol).to.equal(token0Symbol);
            expect(eChainFrom).to.equal(currentChainId);
            expect(eChainTo).to.equal(anotherChainId);
            expect(eNonce).to.equal(nonce);
            expect(await token0.balanceOf(user0.address)).to.equal(depositAmount.sub(amount));
		});
        it('Redeem from another bridge', async () => {
            const message:string = web3.utils.soliditySha3(
                user1.address,
                amount,
                token0Symbol,
                currentChainId,
                anotherChainId,
                nonce
            )!;
    
            const signature = await web3.eth.sign(message, owner.address);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);

            const contractTx: ContractTransaction = await anotherBridge.connect(user1).redeem(token0Symbol, amount, currentChainId, nonce, v,r,s);
            const contractReceipt: ContractReceipt = await contractTx.wait();
            const event = contractReceipt.events?.find(event => event.event === 'SwapRedeemed');
            const eInitiator: Address = event?.args!['initiator'];
            const eNonce: BigNumber = event?.args!['nonce'];

            expect(eInitiator).to.equal(user1.address);
            expect(eNonce).to.equal(nonce);
            expect(await token0.balanceOf(user0.address)).to.equal(depositAmount.sub(amount));
            expect(await token0.balanceOf(user1.address)).to.equal(amount);
		});
        it('Cannot redeem from the same Bridge', async () => {
            const message:string = web3.utils.soliditySha3(
                user1.address,
                amount,
                token0Symbol,
                currentChainId,
                anotherChainId,
                nonce
            )!;

            const signature = await web3.eth.sign(message, owner.address);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);

            await expect(bridge.connect(user1).redeem(token0Symbol, amount, anotherChainId, nonce, v,r,s))
            .to.revertedWith('Bridge: Validator address is not correct');
		});
        it('Cannot use nonce twice in Swap from the same Bridge', async () => {
            await bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);
            
            await expect(bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce))
            .to.revertedWith('Bridge: Duplication of the transaction');
		});
        it('Cannot use nonce twice in Redeem from the same Bridge', async () => {
            const message:string = web3.utils.soliditySha3(
                user1.address,
                amount,
                token0Symbol,
                currentChainId,
                anotherChainId,
                nonce
            )!;

            const signature = await web3.eth.sign(message, owner.address);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);

            await anotherBridge.connect(user1).redeem(token0Symbol, amount, currentChainId, nonce, v,r,s);
            
            await expect(anotherBridge.connect(user1).redeem(token0Symbol, amount, currentChainId, nonce, v,r,s))
            .to.revertedWith('Bridge: Duplication of the transaction');
		});
        it('Cannot use Bridge\'s chain id in Swap', async () => {
            const chainId = await bridge.currentBridgeChainId();

            await expect(bridge.connect(user0).swap(user1.address, token0Symbol, amount, chainId, nonce))
            .to.revertedWith('Bridge: Invalid chainTo is same with current bridge chain');
		});
        it('Cannot use not active token\'s address in Swap', async () => {
            await expect(bridge.connect(user0).swap(user1.address, "ERR", amount, anotherChainId, nonce))
            .to.revertedWith('Bridge: Token is inactive');
		});
        it('Cannot use not active token\'s address in Redeem', async () => {
            const message:string = web3.utils.soliditySha3(
                user1.address,
                amount,
                token0Symbol,
                currentChainId,
                anotherChainId,
                nonce
            )!;

            const signature = await web3.eth.sign(message, owner.address);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            bridge.connect(user0).swap(user1.address, token0Symbol, amount, anotherChainId, nonce);

            await anotherBridge.deactivateTokenBySymbol(token0Symbol);
            
            await expect(anotherBridge.connect(user1).redeem(token0Symbol, amount, currentChainId, nonce, v,r,s))
            .to.revertedWith('Bridge: Token is inactive');
		});
        it('Change token amount in Bridge contract', async () => {
            await bridge.deactivateTokenBySymbol(token1Symbol);
            const tokenListBefore = await bridge.getTokenList();
            expect(tokenListBefore.length).to.equal(1);
            expect(tokenListBefore[0].tokenAddress).to.equal(token0.address);
            await bridge.addToken("HAH", token1.address);
            const tokenListAfter = await bridge.getTokenList();
            expect(tokenListAfter.length).to.equal(2);
            expect(tokenListAfter[1].tokenAddress).to.equal(token1.address);
		});
    });
});
