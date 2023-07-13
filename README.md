# Hardhat DeFi 

This project is a rework of the section of the Typescript edition Blockchain/Smart Contract FreeCodeCamp Course. In this project we use a combination of Aave V3 for depositing/borrowing/repaying and Uniswap V3 for token swaps.

- [Hardhat DeFi](#hardhat-defi)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Quickstart](#quickstart)
- [Usage](#usage)
  - [Details](#details)  
  - [Testing](#testing)
- [Running on a testnet or mainnet](#running-on-a-testnet-or-mainnet)
- [Linting](#linting)
  - [Formatting](#formatting)
- [Thank you!](#thank-you)
- [Special mentions](#special-mentions)

# Getting Started

## Requirements

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
  - You'll know you did it right if you can run `git --version` and you see a response like `git version x.x.x`
- [Nodejs](https://nodejs.org/en/)
  - You'll know you've installed nodejs right if you can run:
    - `node --version` and get an ouput like: `vx.x.x`
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/) instead of `npm`
  - You'll know you've installed yarn right if you can run:
    - `yarn --version` and get an output like:`x.x.x`
    - You might need to install it with npm

## Quickstart

```
git clone https://github.com/MMtis/Hardhat-Defi-AaveV3-UniswapV3
cd Hardhat-Defi-AaveV3-UniswapV3
yarn
```


# Usage

This repo requires a mainnet rpc provider, but don't worry! You won't need to spend any real money. We are going to be `forking` mainnet, and pretend as if we are interacting with mainnet contracts. 

All you'll need, is to set a `MAINNET_RPC_URL` environment variable in a `.env` file that you create. You can get setup with one for free from [Alchemy](https://alchemy.com/?a=673c802981)

Run:

```
yarn hardhat run scripts/aaveBorrow.js
```

## Details:

- Aave V3 does not support stable rate borrowing for some tokens. To check if stable rate borrowing is allowed, we check the value of the 59th bit of the return value of the function getReserveData() of the Pool contract as explained in the [aave docs](https://docs.aave.com/developers/core-contracts/pool).
- Since the accrued interest is very low. We might have some issues with the amount. To avoid this, we increase evm time by 30 days, this increases the accrued interest to an amount that is high enough wich doesn't cause any issues.
- We then swap some WETH for DAI using Uniswap V3 exactInputSingle() function of the SwapRouter contract and repay the remaining interest.
- As of now there is no official SwapRouter contract address deployed on Sepolia. The swap tokens part is skipped for Sepolia. Once the Uniswap team decides to deploy it, you can update the helper-hardhat-config.js file with the address.

## Testing

We didn't write any tests for this, sorry!


# Running on a testnet or mainnet

1. Setup environment variables

You'll want to set your `SEPOLIA_RPC_URL` and `PRIVATE_KEY` as environment variables. You can add them to a `.env` file, similar to what you see in `.env.example`.

- `PRIVATE_KEY`: The private key of your account (like from [metamask](https://metamask.io/)). **NOTE:** FOR DEVELOPMENT, PLEASE USE A KEY THAT DOESN'T HAVE ANY REAL FUNDS ASSOCIATED WITH IT.
  - You can [learn how to export it here](https://metamask.zendesk.com/hc/en-us/articles/360015289632-How-to-Export-an-Account-Private-Key).
- `SEPOLIA_RPC_URL`: This is url of the sepolia testnet node you're working with. You can get setup with one for free from [Alchemy](https://alchemy.com/?a=673c802981)

2. Get testnet ETH

Head over to [faucets.chain.link](https://faucets.chain.link/) and get some tesnet ETH. You should see the ETH show up in your metamask.

3. Run

```
yarn hardhat run scripts/aaveBorrow.js --network sepolia
```


# Linting

To check linting / code formatting:
```
yarn lint
```
or, to fix: 
```
yarn lint:fix
```

## Formatting

```
yarn format
```


# Thank you!

If you appreciated this, feel free to follow me or donate!

ETH/Polygon/Avalanche/etc Address: 0xC24D24973C3E2f0025bA5C1e5B3CCa6Dc1b3C7b1

# Special mentions:

I want to thank PatrickAlphaC for the course. Feel free to check his Github repo https://github.com/PatrickAlphaC.