import { OmertaSolanaSpl } from "../target/types/omerta_solana_spl";
import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js"
import assert from "assert"
import { Program } from "@coral-xyz/anchor";
import {BN} from "bn.js"
import { createAssociatedTokenAccount } from "@solana/spl-token";

async function confirmTransaction(tx:string) {
  const latestBlockHash = await anchor.getProvider().connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: tx,
  });
}

async function airdropSol(publicKey:anchor.web3.PublicKey, amount:number) {
let airdropTx = await anchor.getProvider().connection.requestAirdrop(publicKey, amount);
await confirmTransaction(airdropTx);
}

async function getSolBalance(pg:Program<OmertaSolanaSpl>,address:anchor.web3.PublicKey):Promise<number>{
  let initialBalance: number;
  try {
    const balance = (await pg.provider.connection.getTokenAccountBalance(address))
    initialBalance = balance.value.uiAmount;
  } catch {
    // Token account not yet initiated has 0 balance
    initialBalance = 0;
  } 
  return initialBalance;
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

    const MINT_SEED = "mint";
  
    const payer = pg.provider.publicKey;
    let reciever = anchor.web3.Keypair.generate()


    const metadata = {
      name: "lamport Token",
      symbol: "LMT",
      uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
      decimals: 9,
    };

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
  
      await pg.methods
        .initialize(metadata)
        .accounts(context)
        .rpc();
  
      const newInfo = await pg.provider.connection.getAccountInfo(mint);
      assert(newInfo, "  Mint should be initialized.");
      // console.log("program address",pg.programId.toString());

    });
  
    it("mint tokens", async () => {
      const mintAmount = 12;

      const destination =  anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
  
      
      const context = {
        mint,
        destination,
        payer,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
      await pg.methods
        .mintTokens(new BN(mintAmount * 10 ** metadata.decimals))
        .accounts(context)
        .rpc();
      
      const postBalance = (
        await pg.provider.connection.getTokenAccountBalance(destination)
      ).value.uiAmount;
      assert.equal(
        mintAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );
    });
   
    it("transfer tokens", async () => {
      const transferAmount = 10
      const from_ata =  anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
  
      let initialBalance = await getSolBalance(pg,from_ata)
   
      await airdropSol(reciever.publicKey, 1e9); // 1 SOL

      const reciever_ata = await createAssociatedTokenAccount(pg.provider.connection,reciever,mint,reciever.publicKey);
  

      const context = {
        fromAta:from_ata,
        toAta:reciever_ata,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      };
  
       await pg.methods
        .transfer(new BN(transferAmount * 10 ** metadata.decimals))
        .accounts(context)
        .rpc();
     

      /**
      * check sender balance
      */ 
      const postBalance = (
        await pg.provider.connection.getTokenAccountBalance(from_ata)
      ).value.uiAmount;
      assert.equal(
        initialBalance - transferAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );

    /**
     * check receiver balance
    */ 

      const receiverPostBalance = (
        await pg.provider.connection.getTokenAccountBalance(reciever_ata)
      ).value.uiAmount;
      assert.equal(
        transferAmount,
        receiverPostBalance,
        "Post balance should equal initial plus mint amount"
      );

    });

    it("approve tokens", async () => {
      const approveAmount = 2;
      const from_ata =  anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
      
     const reciever_ata = anchor.utils.token.associatedAddress({
        mint: mint,
        owner: reciever.publicKey,
      });

      const context = {
        fromAta:from_ata,
        delegate:reciever.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      };
      
      await pg.methods
        .approve(new BN(approveAmount * 10 ** metadata.decimals))
        .accounts(context)
        .signers([reciever])
        .rpc();

      const context1 = {
        fromAta:from_ata,
        toAta:reciever_ata,
        from:reciever.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      };



      const receiverBalance = (
        await pg.provider.connection.getTokenAccountBalance(reciever_ata)
      ).value.uiAmount;

     await pg.methods
        .transfer(new BN(approveAmount * 10 ** metadata.decimals))
        .accounts(context1)
        .signers([reciever])
        .rpc();
  

        const senderPostBalance = (
          await pg.provider.connection.getTokenAccountBalance(from_ata)
        ).value.uiAmount;
        assert.equal(
          0,
          senderPostBalance,
          "Post balance should equal initial plus mint amount"
        );


        const receiverPostBalance = (
          await pg.provider.connection.getTokenAccountBalance(reciever_ata)
        ).value.uiAmount;
    
        assert.equal(
          receiverPostBalance,
          receiverBalance+approveAmount,
          "Post balance should equal initial plus mint amount"
        );

    });
});




