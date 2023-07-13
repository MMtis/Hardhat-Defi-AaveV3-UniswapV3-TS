import { getWeth, AMOUNT } from "../scripts/getWeth"
import { ethers, getNamedAccounts, network } from "hardhat"
import { networkConfig } from "../helper-hardhat-config"
import { IPool, IPoolAddressesProvider } from "../typechain-types"
import { Address } from "hardhat-deploy/dist/types"
import { BigNumber } from "ethers"

async function main() {
    // the protocol treats everything as an ERC20 token
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let blocksToMine = chainId == 31337 ? 1 : 3

    // Pool address provider : 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
    // Pool ^

    const Pool: IPool = await getLendingPool(deployer)
    console.log(`Lending Pool address ${Pool.address}`)
    console.log("*****************************************************************************")

    // deposit !
    const wethTokenAddress = networkConfig[chainId!].wethToken!
    await approveErc20(wethTokenAddress, Pool.address, AMOUNT, deployer)
    console.log("Depositing...")
    const tx = await Pool.supply(wethTokenAddress, AMOUNT, deployer, 0)
    tx.wait(blocksToMine)
    console.log("Deposited")
    console.log("*****************************************************************************")
    let { availableBorrowsBase, totalDebtBase } = await getBorrowUserData(Pool, deployer)
    // Borrow Time !

    let { priceDAIUSD, priceETHUSD, priceDAIUSDDecimals, priceETHUSDDecimals } = await getPrice()
    const amountDaiToBorrow =
        (availableBorrowsBase.toNumber() / Math.pow(10, priceETHUSDDecimals.toString())) *
        0.95 *
        (Math.pow(10, priceDAIUSDDecimals.toString()) / priceDAIUSD.toNumber())
    console.log(`You can borrow ${amountDaiToBorrow} DAI`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

    const daiTokenAddress = networkConfig[chainId!].daiToken!
    const isStableRateEnabled = await getReserveData(Pool, daiTokenAddress)
    console.log(
        `The stable rate enable/disable flag for DAI in AAVE V3 is : ${isStableRateEnabled}`
    )
    console.log("Borrowing...")
    // console.log(amountDaiToBorrowWei.toString())
    await borrowDai(
        daiTokenAddress,
        Pool,
        amountDaiToBorrowWei.toString(),
        isStableRateEnabled,
        deployer
    )
    await getBorrowUserData(Pool, deployer)
    console.log("*****************************************************************************")

    const routerExists = networkConfig[chainId!].uniswapV3Router
    if (routerExists) {
        console.log("Let's jump 30 days forward and check the accrued interest again!")
        const oneMonth = 30 * 24 * 60 * 60
        await network.provider.request({
            method: "evm_increaseTime",
            params: [oneMonth],
        })
        await network.provider.request({
            method: "evm_mine",
            params: [],
        })
        await getBorrowUserData(Pool, deployer)
    }
    console.log("*****************************************************************************")
    console.log("Let's pay the notional amount...")
    await repay(
        amountDaiToBorrowWei.toString(),
        daiTokenAddress,
        Pool,
        isStableRateEnabled,
        deployer
    )
    await getBorrowUserData(Pool, deployer)
    console.log("*****************************************************************************")

    if (routerExists) {
        console.log("Time to get some more WETH and swap for DAI")
        let daiBalance = await balanceOf(daiTokenAddress, deployer)
        console.log(`The current DAI balance is: ${daiBalance}`)
        await getWeth()
        await swapWEthToDai(wethTokenAddress, daiTokenAddress, AMOUNT, deployer)
        daiBalance = await balanceOf(daiTokenAddress, deployer)
        console.log(`The current DAI balance is: ${daiBalance}`)
        console.log("*****************************************************************************")
        ;({ availableBorrowsBase, totalDebtBase } = await getBorrowUserData(Pool, deployer))
        const amountLeft =
            (totalDebtBase.toNumber() / Math.pow(10, priceETHUSDDecimals.toString())) *
            (Math.pow(10, priceDAIUSDDecimals.toString()) / priceDAIUSD.toNumber())
        console.log(`The accrued interest is ${amountLeft} DAI`)
        const amountLeftWei = ethers.utils.parseEther(amountLeft.toString())
        // console.log(amountLeftWei.toString())

        console.log("Let's pay the remaining interest...")
        await repay(amountLeftWei.toString(), daiTokenAddress, Pool, isStableRateEnabled, deployer)
        console.log("*****************************************************************************")
        console.log("What's left....")
        await getBorrowUserData(Pool, deployer)
    }
}

async function swapWEthToDai(WETH: string, DAI: string, amount: string, account: Address) {
    const swapRouter = await ethers.getContractAt(
        "ISwapRouter",
        networkConfig[network.config!.chainId!].uniswapV3Router!,
        account
    )
    await approveErc20(WETH, swapRouter.address, amount, account)
    const currentBlockTime = (await ethers.provider.getBlock("latest")).timestamp

    const params = {
        tokenIn: WETH,
        tokenOut: DAI,
        fee: networkConfig[network.config!.chainId!].poolFee,
        recipient: account,
        deadline: currentBlockTime + 1800,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
    }

    const amountOut = await swapRouter.exactInputSingle(params)
    console.log("Swapped ETH to DAI")
    return amountOut
}

async function repay(
    amount: string,
    daiAddress: string,
    Pool: IPool,
    isStableRateEnabled: number,
    account: Address
) {
    await approveErc20(daiAddress, Pool.address, amount, account)
    let blocksToMine = network.config.chainId == 31337 ? 1 : 3
    let repayTx
    if (isStableRateEnabled == 0) {
        repayTx = await Pool.repay(daiAddress, amount, 2, account)
    } else {
        repayTx = await Pool.repay(daiAddress, amount, 1, account)
    }
    await repayTx.wait(blocksToMine)
    console.log("Repaid!")
}

async function borrowDai(
    daiAddress: string,
    Pool: IPool,
    amountDaiToBorrowWei: string,
    isStableRateEnabled: number,
    account: Address
) {
    let borrowTx
    let blocksToMine = network.config.chainId == 31337 ? 1 : 3
    if (isStableRateEnabled == 0) {
        borrowTx = await Pool.borrow(daiAddress, amountDaiToBorrowWei, 2, 0, account)
    } else {
        borrowTx = await Pool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    }
    await borrowTx.wait(blocksToMine)
    console.log("You've borrowed!")
}

async function getReserveData(Pool: IPool, daiAddress: string) {
    const { configuration } = await Pool.getReserveData(daiAddress)

    const reserveData = BigInt(configuration.toString())
    // console.log(reserveData)

    // Create a bit mask to isolate the 59th bit of the configuration data
    // Bitwise shift BigInt(1) 59 places to the left
    const bitMask = BigInt(1) << BigInt(59)
    // console.log(bitMask.toString())

    // Use the bitwise AND operator (&) with reserveData and bitMask to isolate the 59th bit
    // Then, shift the result 59 places to the right to get the value of the 59th bit
    const bit59Value = (reserveData & bitMask) >> BigInt(59)

    return Number(bit59Value)
}

async function getBorrowUserData(Pool: IPool, account: Address) {
    const { totalCollateralBase, totalDebtBase, availableBorrowsBase } =
        await Pool.getUserAccountData(account)
    console.log(`You have ${totalCollateralBase} USD worth of Eth deposited`)
    console.log(`You have ${totalDebtBase} USD worth of Eth borrowed`)
    console.log(`You can borrow ${availableBorrowsBase} USD worth of Eth`)
    return { availableBorrowsBase, totalDebtBase }
}

async function getLendingPool(account: Address): Promise<IPool> {
    const lendingPoolAddressProvider = await ethers.getContractAt(
        "IPoolAddressesProvider",
        networkConfig[network.config!.chainId!].PoolAddressesProvider!,
        account
    )
    const PoolAddress = await lendingPoolAddressProvider.getPool()
    const Pool: IPool = await ethers.getContractAt("IPool", PoolAddress, account)
    return Pool
}

async function approveErc20(
    contractAddress: string,
    spenderAddress: string,
    amountToSpend: string,
    account: Address
) {
    const ecr20Token = await ethers.getContractAt("IERC20", contractAddress, account)
    let blocksToMine = network.config.chainId == 31337 ? 1 : 3
    const Tx = await ecr20Token.approve(spenderAddress, amountToSpend)
    Tx.wait(blocksToMine)
    console.log("Approved !")
}

async function balanceOf(contractAddress: string, account: Address) {
    const ecr20Token = await ethers.getContractAt("IERC20", contractAddress, account)
    const balance = await ecr20Token.balanceOf(account)
    return balance
}

async function getPrice() {
    const daiUsdPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config!.chainId!].daiUsdPriceFeed!
    )
    const EthUsdPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config!.chainId!].ethUsdPriceFeed!
    )

    const priceDAIUSD = (await daiUsdPriceFeed.latestRoundData())[1]
    const priceETHUSD = (await EthUsdPriceFeed.latestRoundData())[1]

    const priceDAIUSDDecimals = await daiUsdPriceFeed.decimals()
    const priceETHUSDDecimals = await EthUsdPriceFeed.decimals()

    console.log(`The DAI/USD price is ${priceDAIUSD.toString()}`)
    console.log(`The ETH/USD price is ${priceETHUSD.toString()}`)

    console.log(`The DAI/USD decimals are ${priceDAIUSDDecimals.toString()}`)
    console.log(`The ETH/USD decimals are ${priceETHUSDDecimals.toString()}`)

    return { priceDAIUSD, priceETHUSD, priceDAIUSDDecimals, priceETHUSDDecimals }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
