import { CustomToken, Bridge } from '../typechain'
import {ethers, run, upgrades, network} from 'hardhat'
import {delay} from '../utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
	hashBytecodeWithoutMetadata,
	Manifest,
} from "@openzeppelin/upgrades-core";

let owner: SignerWithAddress;

async function deployBridge() {
	[owner] = await ethers.getSigners();
	const CustomToken = await ethers.getContractFactory('CustomToken')
	console.log('starting deploying token...')
	const tokenSymbol = 'Ctm'
	const token = await CustomToken.deploy('CustomToken', tokenSymbol) as CustomToken
	console.log('CustomToken deployed with address: ' + token.address)
	console.log('wait of deploying...')
	await token.deployed()
	await token.mint(owner.address, ethers.utils.parseEther("100"));
	console.log('wait of delay...')
	await delay(25000)
	console.log('starting verify token...')
	try {
		await run('verify:verify', {
			address: token!.address,
			contract: 'contracts/CustomToken.sol:CustomToken',
			constructorArguments: [ 'CustomToken', tokenSymbol ],
		});
		console.log('verify success')
	} catch (e: any) {
		console.log(e.message)
	}

	const Bridge = await ethers.getContractFactory('Bridge')
	console.log('starting deploying Bridge...')
	// we work with rinkeby or ropsten
	const currentNetworkChainId = network.config.chainId;
	// another network is either ropsten or rinkeby
	const anotherNetworkChainId = currentNetworkChainId == 4 ? 3 : 4;
	const bridge = await upgrades.deployProxy(Bridge, [currentNetworkChainId]) as Bridge
	console.log('Bridge Proxy deployed with address: ' + bridge.address)
	const ozUpgradesManifestClient = await Manifest.forNetwork(network.provider);
	const manifest = await ozUpgradesManifestClient.read();
	const bytecodeHash = hashBytecodeWithoutMetadata(Bridge.bytecode);
	const implementation = manifest.impls[bytecodeHash];
	console.log('Bridge implementation deployed with address: ' + implementation!.address)
	console.log('Granting roles')
	await token.grantRole(await token.MINTER_ROLE(), bridge.address);
    await token.grantRole(await token.BURNER_ROLE(), bridge.address);
	await bridge.grantRole(await bridge.VALIDATOR_ROLE(), owner.address);
	await bridge.updateChainById(anotherNetworkChainId, true);
	await bridge.addToken(tokenSymbol, token.address);
	console.log('wait of delay...')
	await delay(25000)
	console.log('starting verify Bridge...')
	try {
		await run('verify:verify', {
			address: implementation!.address,
			contract: 'contracts/Bridge.sol:Bridge',
			constructorArguments: [],
		});
		console.log('verify success')
	} catch (e: any) {
		console.log(e.message)
	}
}

deployBridge()
.then(() => process.exit(0))
.catch(error => {
	console.error(error)
	process.exit(1)
})
