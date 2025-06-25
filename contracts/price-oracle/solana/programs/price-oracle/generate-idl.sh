TARGET='../../target'

mkdir -p $TARGET/idl
mkdir -p $TARGET/types
anchor idl build --skip-lint --out $TARGET/idl/solana_price_oracle.json --out-ts $TARGET/types/solana_price_oracle.ts --program-name solana_price_oracle
