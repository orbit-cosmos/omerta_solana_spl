use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata,
    },
    token::{Mint, Token, TokenAccount, MintTo, Burn,Transfer, Approve},
};

declare_id!("8SjEb93bjt9VrcdYDpzLiqpTycp7GgLM3pHQBAHE6ELP");

pub const MAX_CAP: u64 = 100_000_000_000_000_000; // 6 decimals
pub const MIN_SEED:&[u8] = "mint".as_bytes();

#[program]
pub mod omerta_solana_spl {

    use super::*;

    pub fn initialize(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        // PDA seeds and bump to "sign" for CPI
        let seeds = &[MIN_SEED, &[ctx.bumps.mint]];
        let signer = [&seeds[..]];


        // On-chain token metadata for the mint
        let token_data = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );

        create_metadata_accounts_v3(
            metadata_ctx, // cpi context
            token_data,// token metadata
            true,  // is_mutable
            true, // update_authority_is_signer
            None // collection details
        )?;

        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {

        require!(ctx.accounts.mint.supply + amount <= MAX_CAP, OmertaError::CapExceed);

        // PDA seeds and bump to "sign" for CPI
        let seeds = &[MIN_SEED, &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        anchor_spl::token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn transfer(ctx: Context<TransferToken>, amount: u64) -> Result<()> {

        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    authority: ctx.accounts.from.to_account_info(),
                    from: ctx.accounts.from_ata.to_account_info(),
                    to: ctx.accounts.to_ata.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }

    pub fn approve(ctx: Context<ApproveToken>, amount: u64) -> Result<()> {
        anchor_spl::token::approve(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Approve {
                    to: ctx.accounts.from_ata.to_account_info(),
                    authority: ctx.accounts.from.to_account_info(),
                    delegate: ctx.accounts.delegate.to_account_info(),   
                },
            ),
            amount,
        )?;
        Ok(())
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        anchor_spl::token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.from_ata.to_account_info(),   
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }

  
}


#[error_code]
enum OmertaError {
    #[msg("Can not mint more, Cap Exceed")]
    CapExceed,
}

#[derive(Accounts)]
#[instruction(
    params: InitTokenParams
)]
pub struct InitToken<'info> {
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [MIN_SEED],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [MIN_SEED],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct TransferToken<'info> {

    #[account(mut)]
    pub from_ata: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to_ata: Account<'info, TokenAccount>,

    pub from: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}


#[derive(Accounts)]
pub struct ApproveToken<'info> {

    #[account(mut)]
    pub from_ata: Account<'info, TokenAccount>,

    pub from: Signer<'info>,
  
    /// CHECK: This is an unchecked account because the delegate doesn't need to be of any specific type.
    pub delegate: UncheckedAccount<'info>,  
 
    pub token_program: Program<'info, Token>,
}


#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub from_ata: Account<'info, TokenAccount>,

    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
