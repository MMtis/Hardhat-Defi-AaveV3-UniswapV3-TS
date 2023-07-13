import { ethers, getNamedAccounts, network } from "hardhat"
import { networkConfig } from "../helper-hardhat-config"

export const AMOUNT = (ethers.utils.parseEther("0.02")).toString()

export async function getWeth() {
    const { deployer } = await getNamedAccounts()
    const signer = await ethers.getSigner(deployer)
    const chainId = network.config.chainId
    let blocksToMine = chainId == 31337 ? 1 : 3
    const iweth = await ethers.getContractAt("IWeth", networkConfig[chainId!].wethToken!, signer)
    const tx = await iweth.deposit({ value: AMOUNT })
    await tx.wait(blocksToMine)
    const wethBalance = await iweth.balanceOf(deployer)
    console.log(`Got ${wethBalance.toString()} WETH`)
}
