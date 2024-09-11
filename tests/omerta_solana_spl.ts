import { OmertaSolanaSpl } from "../target/types/omerta_solana_spl";

import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js"
import assert from "assert"
import { Program } from "@coral-xyz/anchor";
import {BN} from "bn.js"
import { createAccount } from "@solana/spl-token";
async function confirmTransaction(tx) {
  const latestBlockHash = await anchor.getProvider().connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: tx,
  });
}
// this airdrops sol to an address
async function airdropSol(publicKey, amount) {
let airdropTx = await anchor.getProvider().connection.requestAirdrop(publicKey, amount);
await confirmTransaction(airdropTx);
}

describe("OmertaSolanaSpl", async() => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const pg = anchor.workspace.OmertaSolanaSpl as Program<OmertaSolanaSpl>;


    // Metaplex Constants
    const METADATA_SEED = "metadata";
    const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" // metaplex metadata program id
    )

    // Constants from our program
    const MINT_SEED = "mint";
  
    // Data for our tests
    const payer = pg.provider.publicKey;
    const metadata = {
      name: "lamport Token",
      symbol: "LMT",
      uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
      decimals: 9,
    };
    const mintAmount = 10;
    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_SEED)],
      pg.programId
    );

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );


    it("initialize", async () => {


      const context = {
        metadata: metadataAddress,
        mint,
        payer,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      };
  
      const txHash = await pg.methods
        .initToken(metadata)
        .accounts(context)
        .rpc();
  
      console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
      const newInfo = await pg.provider.connection.getAccountInfo(mint);
      assert(newInfo, "  Mint should be initialized.");

      


    });
  
    it("mint tokens", async () => {

      const destination =  anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
  
      let initialBalance: number;
      try {
        const balance = (await pg.provider.connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      } 
      
      const context = {
        mint,
        destination,
        payer,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
      const txHash = await pg.methods
        .mintTokens(new BN(mintAmount * 10 ** metadata.decimals))
        .accounts(context)
        .rpc();
      console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
  
      const postBalance = (
        await pg.provider.connection.getTokenAccountBalance(destination)
      ).value.uiAmount;
      assert.equal(
        initialBalance + mintAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );
    });
   
    it("transfer tokens", async () => {

      const from =  anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
  
      let initialBalance: number;
      try {
        const balance = (await pg.provider.connection.getTokenAccountBalance(from))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      } 


   

      let reciever = anchor.web3.Keypair.generate()
      await airdropSol(reciever.publicKey, 1e9); // 1 SOL
      let recieverTokenAccountKeypair = anchor.web3.Keypair.generate()

      await createAccount(pg.provider.connection,reciever,mint,reciever.publicKey,recieverTokenAccountKeypair);
  


      let receiverInitialBalance: number;
      try {
        const balance = (await pg.provider.connection.getTokenAccountBalance(recieverTokenAccountKeypair.publicKey))
        receiverInitialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        receiverInitialBalance = 0;
      } 

      const context = {
        mintToken:mint,
        fromAccount:from,
        toAccount:recieverTokenAccountKeypair.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
      const txHash = await pg.methods
        .transferTokens(new BN(mintAmount * 10 ** metadata.decimals))
        .accounts(context)
        .rpc();
      console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
  


      /**
      * check sender balance
      */ 
      const postBalance = (
        await pg.provider.connection.getTokenAccountBalance(from)
      ).value.uiAmount;
      assert.equal(
        initialBalance - mintAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );

    /**
     * check receiver balance
    */ 

      const receiverPostBalance = (
        await pg.provider.connection.getTokenAccountBalance(recieverTokenAccountKeypair.publicKey)
      ).value.uiAmount;
      assert.equal(
        receiverInitialBalance + mintAmount,
        receiverPostBalance,
        "Post balance should equal initial plus mint amount"
      );

    });

});




