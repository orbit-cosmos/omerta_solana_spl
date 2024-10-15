import { OmertaSolanaSpl } from "../target/types/omerta_solana_spl";
import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js"
import assert from "assert"
import { Program } from "@coral-xyz/anchor";
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

async function getSplBalance(pg:Program<OmertaSolanaSpl>,address:anchor.web3.PublicKey):Promise<number>{
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

    const MINT_SEED = "omerta-mint";
  
    const payer = pg.provider.publicKey;
    const reciever = anchor.web3.Keypair.generate()
    const account3 = anchor.web3.Keypair.generate()
    const mintAmount = 100_000_000_000 - 1;
    const tokenTotalSupply = 100_000_000_000;
    const burnAmount = 2;

    const metadata = {
      name: "lamport Token",
      symbol: "LMT",
      uri: "https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=128&img-dpr=2&img-onerror=redirect",
      decimals: 6,
    };

    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_SEED)],
      pg.programId
    );

    const payer_ata =  anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer,
    });

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    before(async()=>{
      await airdropSol(reciever.publicKey, 1e9); // 1 SOL
      await airdropSol(account3.publicKey, 1e9); // 1 SOL
    })

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
        .initToken(metadata)
        .accounts(context)
        .rpc();
  
      const newInfo = await pg.provider.connection.getAccountInfo(mint);
      assert(newInfo)
      const metadataString = await pg.provider.connection.getAccountInfo(metadataAddress);
      assert(metadataString.data.toString().includes("lamport Token"));
      assert(metadataString.data.toString().includes("LMT"));

    });
  

    it("change metadata", async () => {
      const newMetadata = {
        name: "omerta Token",
        symbol: "OMERTA",
        uri: "https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=128&img-dpr=2&img-onerror=redirect",
        decimals: 6,
      };
      const context = {
        metadata: metadataAddress,
        mint,
        payer,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      };
  
      await pg.methods
        .updateMetadata(newMetadata)
        .accounts(context)
        .rpc();
  
        const newInfo = await pg.provider.connection.getAccountInfo(metadataAddress);
        assert(newInfo.data.toString().includes("omerta Token"));
        assert(newInfo.data.toString().includes("OMERTA"));
      });

    it("mint tokens", async () => {

      const destination =  payer_ata;
  
      const preBalance = await getSplBalance(pg,destination)
      assert.equal(
        0,
        preBalance
      );
      
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
        .mintTokens(new anchor.BN((mintAmount * 10 ** metadata.decimals).toString()))
        .accounts(context)
        .rpc();
      
      const postBalance = await getSplBalance(pg,destination)
      assert.equal(
        preBalance+mintAmount,
        postBalance
      );

      const totalSupply = await pg.provider.connection.getTokenSupply(mint)
      assert.equal(
        mintAmount * 10 ** metadata.decimals,
        totalSupply.value.amount
      );
    });
   
    it("transfer tokens", async () => {
      const transferAmount = 10
      const from_ata =  payer_ata;

      // const reciever_ata = await createAssociatedTokenAccount(pg.provider.connection,reciever,mint,reciever.publicKey);
  


      const reciever_ata = anchor.utils.token.associatedAddress({
        mint: mint,
        owner: reciever.publicKey,
      });

      /**
      * check sender balance
      */ 

       const senderPreBalance = 
       await getSplBalance(pg,from_ata)
    

      /**
      * check receiver balance
      */ 

      const receiverPreBalance = 
       await getSplBalance(pg,reciever_ata)
      assert.equal(
       0,
       receiverPreBalance,
      );


      const context = {
        from:payer,
        to:reciever.publicKey,
        fromAta:from_ata,
        toAta:reciever_ata,
        mint,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
       await pg.methods
        .transfer(new anchor.BN((transferAmount * 10 ** metadata.decimals).toString()))
        .accounts(context)
        .rpc();
     

      /**
      * check sender balance
      */ 
      const postBalance = 
        await getSplBalance(pg,from_ata)
      assert.equal(
        senderPreBalance - transferAmount,
        postBalance,
      );

    /**
     * check receiver balance
    */ 

      const receiverPostBalance = 
        await getSplBalance(pg,reciever_ata)
      assert.equal(
        transferAmount,
        receiverPostBalance,
      );

    });

    it("transfer tokens with manual ATA creation", async () => {
      const transferAmount = 10
      const from_ata =  payer_ata;
      const reciever = account3
      const reciever_ata = await createAssociatedTokenAccount(pg.provider.connection,reciever,mint,reciever.publicKey);
  



      /**
      * check sender balance
      */ 

       const senderPreBalance = 
       await getSplBalance(pg,from_ata)
   

      /**
      * check receiver balance
      */ 

      const receiverPreBalance = 
       await getSplBalance(pg,reciever_ata)
      assert.equal(
       0,
       receiverPreBalance,
      );


      const context = {
        from:payer,
        to:reciever.publicKey,
        fromAta:from_ata,
        toAta:reciever_ata,
        mint,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
       await pg.methods
        .transfer(new anchor.BN((transferAmount * 10 ** metadata.decimals).toString()))
        .accounts(context)
        .rpc();
     

      /**
      * check sender balance
      */ 
      const postBalance = 
        await getSplBalance(pg,from_ata)
      assert.equal(
        senderPreBalance - transferAmount,
        postBalance,
      );

    /**
     * check receiver balance
    */ 

      const receiverPostBalance = 
        await getSplBalance(pg,reciever_ata)
      assert.equal(
        transferAmount,
        receiverPostBalance,
      );

    });


    it("approve tokens", async () => {
      const approveAmount = 2;
      const from_ata =  payer_ata
      
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
        .approve(new anchor.BN((approveAmount * 10 ** metadata.decimals).toString()))
        .accounts(context)
        .rpc();

     
      const context1 = {
        from:reciever.publicKey,
        to:reciever.publicKey,
        fromAta:from_ata,
        toAta:reciever_ata,
        mint,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };



      const receiverBalance = 
        await getSplBalance(pg,reciever_ata)
        const senderBalance = 
        await getSplBalance(pg,from_ata)

     await pg.methods
        .transfer(new anchor.BN((approveAmount * 10 ** metadata.decimals).toString()))
        .accounts(context1)
        .signers([reciever])
        .rpc();
  

        const senderPostBalance = await getSplBalance(pg,from_ata)
        assert.equal(
          senderBalance-approveAmount,
          senderPostBalance,
        );


        const receiverPostBalance = 
          await getSplBalance(pg,reciever_ata)
        
    
        assert.equal(
          receiverPostBalance,
          receiverBalance+approveAmount,
        );
    });

    it("burn tokens", async () => {
    
      const preTotalSupply = await pg.provider.connection.getTokenSupply(mint)
     const reciever_ata = anchor.utils.token.associatedAddress({
        mint: mint,
        owner: reciever.publicKey,
      });

      const context = {
        fromAta:reciever_ata,
        mint:mint,
        payer:reciever.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      };
      
      const receiverPreBalance = 
      await getSplBalance(pg,reciever_ata)
    

      await pg.methods
        .burn(new anchor.BN((burnAmount * 10 ** metadata.decimals).toString()))
        .accounts(context)
        .signers([reciever])
        .rpc();



        const receiverPostBalance = 
          await getSplBalance(pg,reciever_ata)
        
    
        assert.equal(
          receiverPostBalance,
          receiverPreBalance-burnAmount,
        );
        const postTotalSupply = await pg.provider.connection.getTokenSupply(mint)

        assert.equal(preTotalSupply.value.amount,Number(postTotalSupply.value.amount)+Number(burnAmount* 10 ** metadata.decimals))


      });

      it("mint tokens fail", async () => {

        const destination =  payer_ata;
        
        const context = {
          mint,
          destination,
          payer,
          rent: web3.SYSVAR_RENT_PUBKEY,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        };
        try{
            await pg.methods
              .mintTokens(new anchor.BN(((mintAmount+2) * 10 ** metadata.decimals).toString()))
              .accounts(context)
              .rpc();
        }catch(e){
            if (e instanceof anchor.AnchorError){
            assert(e.message.includes("CapExceed"))
          }else{
            assert(false);
          }
        }
    
      });

      it("change mint authority", async () => {
       
  
        const context = {
          mint:mint,
          currentAuthority:payer,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        };
        

        await pg.methods
          .changeMintAuthority(reciever.publicKey)
          .accounts(context)
          .rpc();

          const reciever_ata = anchor.utils.token.associatedAddress({
            mint: mint,
            owner: reciever.publicKey,
          });

          const context1 = {
            mint,
            destination:reciever_ata,
            payer:reciever.publicKey,
            rent: web3.SYSVAR_RENT_PUBKEY,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          };
      
          const receiverPreBalance = 
          await getSplBalance(pg,reciever_ata)

          await pg.methods
            .mintTokens(new anchor.BN((1 * 10 ** metadata.decimals).toString()))
            .accounts(context1)
            .signers([reciever])
            .rpc();
          
          
            const receiverPostBalance = 
            await getSplBalance(pg,reciever_ata)
  
            assert.equal(
              receiverPreBalance+1,
              receiverPostBalance,
            );
          

            const totalSupply = await pg.provider.connection.getTokenSupply(mint)
            assert.equal(
              (tokenTotalSupply  - burnAmount )* 10 ** metadata.decimals,
              totalSupply.value.amount
            );
        });


    

    });
    
    