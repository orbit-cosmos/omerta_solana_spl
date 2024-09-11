## install solana CLI 

```sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)"```
```export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"```

## update to latest version

```solana-install update```

- https://docs.solanalabs.com/cli/install


## install anchor cli
- ```cargo install --git https://github.com/coral-xyz/anchor avm --locked --force```
- ```sudo apt-get update && sudo apt-get upgrade && sudo apt-get install -y pkg-config build-essential libudev-dev libssl-dev```
- ```avm install latest```
- ```avm use latest```
- ```anchor --version```

- https://www.anchor-lang.com/docs/installation


## install project dependencies

```yarn```

## generate a new keypair

```solana-keygen new -o /home/asad/.config/solana/id.json```

## build the project
```anchor clean```
```anchor build```

## run test

```anchor test```

