import { dotenv, fs } from "./imports";
import {ethers, run, upgrades, network} from 'hardhat'
import {delay} from '../utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
	hashBytecodeWithoutMetadata,
	Manifest,
} from "@openzeppelin/upgrades-core";

const envConfig = dotenv.parse(fs.readFileSync(".env-" + network.name))
for (const k in envConfig) {
	process.env[k] = envConfig[k]
}

let owner: SignerWithAddress;

async function deployBridge() {
	[owner] = await ethers.getSigners();

	const BridgeV2 = await ethers.getContractFactory('BridgeV2')
	console.log('starting upgrading Bridge...')
    const address = process.env.BRIDGE_ADDRESS as string
    const bridge = await upgrades.upgradeProxy(address, BridgeV2);
    console.log('Bridge upgraded on address: ' + bridge.address)
    
	const ozUpgradesManifestClient = await Manifest.forNetwork(network.provider);
	const manifest = await ozUpgradesManifestClient.read();
	const bytecodeHash = hashBytecodeWithoutMetadata(BridgeV2.bytecode);
	const implementation = manifest.impls[bytecodeHash];

	console.log('Bridge implementation deployed with address: ' + implementation!.address)
    console.log('wait of delay...')
	await delay(25000)
	console.log('starting verify implementation...')
	try {
		await run('verify:verify', {
			address: implementation!.address,
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
