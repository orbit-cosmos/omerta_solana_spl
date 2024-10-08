# Omerta SPL Token

[Omerta Website](https://www.omertagame.com)

[Omerta Whitepaper](https://docs.omertagame.com/whitepaper)

## install solana CLI 

```sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)"```
```export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"```

## update to latest version

```solana-install update```

for more information goto
- https://docs.solanalabs.com/cli/install


## install anchor cli
- ```cargo install --git https://github.com/coral-xyz/anchor avm --locked --force```
- ```sudo apt-get update && sudo apt-get upgrade && sudo apt-get install -y pkg-config build-essential libudev-dev libssl-dev```
- ```avm install latest```
- ```avm use latest```
- ```anchor --version```

for more information goto
- https://www.anchor-lang.com/docs/installation



## generate a new keypair

```shell
solana-keygen new -o /home/asad/.config/solana/id.json
```
## generate custom keypair
```shell
solana-keygen grind --starts-with Game:1 --ignore-case
```
past the key in ```target/deploy/omerta_solana_spl-keypair.json``` and change ```declare_id```


## install project dependencies
```shell
yarn
```

## build the project
```shell
anchor clean
```
```shell
anchor build
```

## run test

```shell
anchor test
```




